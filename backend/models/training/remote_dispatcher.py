"""
Remote Training Dispatcher
Handles dispatching YOLO training jobs to a remote RunPod agent.
Called from api_routes.py when device = "remote:<node_id>:<gpu_index>".

Local training is completely untouched — this is a parallel path only.
"""

import io
import os
import threading
import time
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests

from core.config import settings
from database.database import SessionLocal
from database.models import TrainingSession, RemoteTrainingNode
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

# How often the poller checks the remote agent
POLL_INTERVAL_SEC = 1.5
UPLOAD_CHUNK_SIZE = 4 * 1024 * 1024   # 4 MB chunks for upload
REQUEST_TIMEOUT = 30                   # seconds for agent HTTP calls


# ── Device string helpers ────────────────────────────────────────────────────

def is_remote_device(device: str) -> bool:
    """Returns True if device value signals remote GPU (e.g. 'remote:1:0')."""
    return isinstance(device, str) and device.startswith("remote:")


def parse_remote_device(device: str):
    """
    Parse 'remote:<node_id>:<gpu_index>' → (node_id: int, gpu_index: int).
    Raises ValueError on bad format.
    """
    parts = device.split(":")
    if len(parts) != 3:
        raise ValueError(f"Invalid remote device format: '{device}'. Expected 'remote:<node_id>:<gpu_index>'")
    return int(parts[1]), int(parts[2])


def _agent_url(node: RemoteTrainingNode) -> str:
    host = node.host.strip()
    if host.startswith("http://") or host.startswith("https://"):
        return host.rstrip("/")
    return f"http://{host}:{node.port}"


# ── Training data preparation ─────────────────────────────────────────────────

def _find_training_data_dir(resolved_config: dict) -> Optional[Path]:
    """
    Find the extracted training data directory from resolved_config.
    resolved_config['train']['data'] is a relative path to data.yaml.
    Returns the parent directory containing images/, labels/, data.yaml.
    """
    try:
        data_path = None
        train_section = resolved_config.get("train", {})

        # Try 'data' key in train section
        if "data" in train_section:
            data_path = train_section["data"]

        # Also check top-level (some configs may be flat)
        if not data_path:
            data_path = resolved_config.get("data")

        if not data_path:
            return None

        # Resolve relative path against project root
        project_root = settings.BASE_DIR
        abs_path = (project_root / data_path).resolve()

        # data_path points to data.yaml — parent is the training data dir
        if abs_path.name == "data.yaml":
            return abs_path.parent
        elif abs_path.is_dir():
            return abs_path

        return None
    except Exception as e:
        logger.warning("operations.training", f"Could not find training data dir: {e}", "remote_find_data_dir_failed", {"error": str(e)})
        return None


def _zip_training_data(data_dir: Path) -> Optional[bytes]:
    """
    Zip the training data folder (images/, labels/, data.yaml) into memory.
    Returns ZIP bytes or None on failure.
    """
    try:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in data_dir.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(data_dir)
                    zf.write(file_path, arcname)
        buf.seek(0)
        return buf.read()
    except Exception as e:
        logger.error("operations.training", f"Failed to zip training data: {e}", "remote_zip_failed", {"error": str(e)})
        return None


def _resolve_model_for_agent(resolved_config: dict) -> tuple:
    """
    Returns (model_name_for_agent, model_file_path_or_None).
    - Standard YOLO model (in models/yolo/): return just filename, no upload needed.
    - Custom .pt file: return filename + absolute path (caller must upload it).
    """
    train_section = resolved_config.get("train", {})
    model_val = train_section.get("model") or train_section.get("pretrained") or resolved_config.get("model")

    if not model_val:
        return "yolo11n.pt", None

    model_path = Path(str(model_val))
    model_name = model_path.name   # just the filename

    # Resolve to absolute if relative
    project_root = settings.BASE_DIR
    abs_model = (project_root / model_val).resolve() if not model_path.is_absolute() else model_path

    # Standard model = lives in models/yolo/ → agent will auto-download
    yolo_model_dir = project_root / "models" / "yolo"
    if abs_model.parent.resolve() == yolo_model_dir.resolve():
        return model_name, None

    # Custom model — needs uploading
    if abs_model.exists():
        return model_name, abs_model

    # Fallback: send just the name and hope agent can resolve
    return model_name, None


def _extract_flat_training_params(resolved_config: dict, gpu_index: int, task: str) -> dict:
    """
    Build a flat dict of YOLO training params to send to the agent.
    Excludes: data, model, project, name (agent sets these itself).
    """
    train = resolved_config.get("train", {})
    hyper = resolved_config.get("hyperparameters", {})
    aug = resolved_config.get("augmentation", {})
    val = resolved_config.get("val", {})

    # Merge all sections (train wins over others)
    flat = {}
    for section in [val, aug, hyper, train]:
        flat.update({k: v for k, v in section.items() if v is not None})

    # Remove keys that agent sets itself
    for key in ("data", "model", "pretrained", "project", "name", "device", "task", "mode", "exist_ok"):
        flat.pop(key, None)

    # Fix early_stop → patience (same logic as yaml_generator)
    if "early_stop" in flat:
        early_stop = flat.pop("early_stop")
        if "patience" not in flat or flat.get("patience") == 0:
            flat["patience"] = 30 if early_stop else 0

    # Remove UI-only keys
    flat.pop("enabled", None)

    return flat


# ── Main dispatch function ────────────────────────────────────────────────────

def dispatch_remote_training(
    session_id: int,
    node_id: int,
    gpu_index: int,
    resolved_config: dict,
    logs_dir: str,
    yaml_content: str = "",
) -> bool:
    """
    Full remote training dispatch:
    1. Look up node in DB
    2. Create job on agent
    3. Zip + upload training data
    4. Optionally upload custom model
    5. Start training on agent
    6. Save remote_job_id to DB
    7. Start background poller thread

    Returns True on success, False on failure.
    """
    db = SessionLocal()
    try:
        # Load session and node
        session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
        node = db.query(RemoteTrainingNode).filter(RemoteTrainingNode.id == node_id).first()

        if not session or not node:
            logger.error("operations.training", "Session or node not found for remote dispatch", "remote_dispatch_not_found", {
                "session_id": session_id, "node_id": node_id
            })
            return False

        base_url = _agent_url(node)

        # ── Step 1: Create job on agent ──────────────────────────────────────
        logger.info("operations.training", f"Creating remote job on {node.name}", "remote_create_job", {
            "session": session.name, "node": node.name
        })
        resp = requests.post(f"{base_url}/agent/job/create", timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        remote_job_id = resp.json()["job_id"]

        # Save remote job id to DB immediately
        session.remote_node_id = node_id
        session.remote_job_id = remote_job_id
        db.commit()

        # ── Step 2: Find release ZIP path from DB ────────────────────────────
        # Use the existing release ZIP directly — no re-zipping needed
        # Resolve path the SAME way the rest of the app does (PathManager), not BASE_DIR.
        release_zip_path = None
        release_dbg = {"dataset_release_id": session.dataset_release_id}
        if session.dataset_release_id:
            from database.models import Release
            from utils.path_utils import PathManager
            release = db.query(Release).filter(Release.id == session.dataset_release_id).first()
            release_dbg["release_found"] = bool(release)
            if release:
                release_dbg["model_path"] = release.model_path
                if release.model_path:
                    abs_path = PathManager.get_absolute_path(release.model_path)
                    candidate = Path(abs_path) if abs_path else None
                    release_dbg["resolved"] = str(candidate)
                    release_dbg["exists"] = bool(candidate and candidate.exists())
                    if candidate and candidate.exists() and candidate.suffix == ".zip":
                        release_zip_path = candidate

        if not release_zip_path:
            logger.error("operations.training", f"Release ZIP not found: {release_dbg}", "remote_release_zip_not_found", release_dbg)
            raise RuntimeError(
                f"Release ZIP not found for session '{session.name}'. Debug: {release_dbg}"
            )

        # Stable release cache key — same release name + size = reuse cached data, skip upload
        release_key = f"{release_zip_path.stem}_{release_zip_path.stat().st_size}"
        zip_size_mb = release_zip_path.stat().st_size / 1024 / 1024

        # ── Step 3: Upload release ZIP — UNLESS already cached on the pod ─────
        already_cached = False
        try:
            chk = requests.get(f"{base_url}/agent/release-exists", params={"release_key": release_key}, timeout=REQUEST_TIMEOUT)
            if chk.status_code == 200:
                already_cached = bool(chk.json().get("exists"))
        except Exception:
            already_cached = False

        if already_cached:
            logger.info("operations.training", f"Release already cached on {node.name} — skipping {zip_size_mb:.0f} MB upload", "remote_upload_skipped", {
                "release_key": release_key, "session": session.name
            })
        else:
            logger.info("operations.training", f"Uploading release ZIP ({zip_size_mb:.1f} MB) to {node.name}", "remote_upload_data", {
                "zip_path": str(release_zip_path), "size_mb": round(zip_size_mb, 1), "session": session.name
            })
            with open(release_zip_path, "rb") as zip_file:
                resp = requests.post(
                    f"{base_url}/agent/upload/{remote_job_id}",
                    params={"release_key": release_key},
                    files={"file": (release_zip_path.name, zip_file, "application/zip")},
                    timeout=7200,   # allow up to 2 hours for large ZIPs on slow connections
                )
            resp.raise_for_status()

        # ── Step 4: Upload custom model if needed ─────────────────────────────
        model_name, custom_model_path = _resolve_model_for_agent(resolved_config)
        if custom_model_path:
            logger.info("operations.training", f"Uploading custom model: {custom_model_path.name}", "remote_upload_model", {
                "model": custom_model_path.name
            })
            with open(custom_model_path, "rb") as f:
                model_bytes = f.read()
            resp = requests.post(
                f"{base_url}/agent/upload-model/{remote_job_id}",
                files={"file": (custom_model_path.name, model_bytes, "application/octet-stream")},
                timeout=300,
            )
            # Best-effort — if endpoint not available, agent will try auto-download
            if resp.status_code not in (200, 404):
                resp.raise_for_status()

        # ── Step 5: Build and send training config ────────────────────────────
        extra_params = _extract_flat_training_params(resolved_config, gpu_index, session.task or "detect")

        task_map = {"detection": "detect", "segmentation": "segment"}
        yolo_task = task_map.get(session.task or "detection", "detect")

        train_config = {
            "job_id": remote_job_id,
            "model": model_name,
            "task": yolo_task,
            "epochs": extra_params.pop("epochs", 100),
            "batch": extra_params.pop("batch", 16),
            "imgsz": extra_params.pop("imgsz", 640),
            "device": gpu_index,
            "extra": extra_params,
            "yaml_content": yaml_content,   # full generated YAML with all defaults
            "release_key": release_key,     # agent reads data from release cache
        }

        logger.info("operations.training", f"Starting remote training on {node.name}", "remote_start_training", {
            "session": session.name, "model": model_name, "epochs": train_config["epochs"]
        })
        resp = requests.post(
            f"{base_url}/agent/start/{remote_job_id}",
            json=train_config,
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()

        logger.info("operations.training", f"Remote training started. job_id={remote_job_id}", "remote_training_started", {
            "session": session.name, "remote_job_id": remote_job_id, "node": node.name
        })

        # ── Step 6: Start background poller ──────────────────────────────────
        t = threading.Thread(
            target=_poll_remote_training,
            args=(session_id, node_id, remote_job_id, logs_dir),
            daemon=True,
            name=f"remote-poller-{session_id}",
        )
        t.start()

        return True

    except Exception as e:
        logger.error("operations.training", f"Remote training dispatch failed: {e}", "remote_dispatch_failed", {
            "session_id": session_id, "node_id": node_id, "error": str(e)
        })
        # Mark session as failed
        try:
            session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
            if session:
                session.status = "failed"
                session.error_msg = f"Remote dispatch failed: {str(e)}"
                db.commit()
        except Exception:
            pass
        return False
    finally:
        db.close()


# ── Background poller ─────────────────────────────────────────────────────────

def _poll_remote_training(session_id: int, node_id: int, remote_job_id: str, logs_dir: str):
    """
    Runs in a background daemon thread.
    - Polls agent every POLL_INTERVAL_SEC seconds for new log lines
    - Writes log lines to local training.log (existing WebSocket reads this)
    - Polls status every few cycles
    - When done: downloads best.pt, last.pt, plots → saves locally → updates DB
    """
    project_root = settings.BASE_DIR
    log_file_path = project_root / logs_dir / "training.log"
    log_file_path.parent.mkdir(parents=True, exist_ok=True)

    db = None
    log_offset = 0
    consecutive_errors = 0
    MAX_ERRORS = 10   # give up after 10 consecutive connection failures

    try:
        db = SessionLocal()
        node = db.query(RemoteTrainingNode).filter(RemoteTrainingNode.id == node_id).first()
        if not node:
            logger.error("operations.training", "Remote node not found in poller", "remote_poller_no_node", {"node_id": node_id})
            return

        base_url = _agent_url(node)
        logger.info("operations.training", f"Remote poller started for session {session_id}", "remote_poller_start", {
            "session_id": session_id, "remote_job_id": remote_job_id
        })

        while True:
            time.sleep(POLL_INTERVAL_SEC)

            try:
                # ── Fetch new log lines ──────────────────────────────────────
                log_resp = requests.get(
                    f"{base_url}/agent/logs/{remote_job_id}",
                    params={"offset": log_offset},
                    timeout=REQUEST_TIMEOUT,
                )
                if log_resp.status_code == 200:
                    data = log_resp.json()
                    new_lines = data.get("lines", "")
                    log_offset = data.get("offset", log_offset)

                    if new_lines:
                        with open(log_file_path, "a", encoding="utf-8", errors="ignore") as f:
                            f.write(new_lines)
                        # Metrics parsing + live Status card updates are handled by
                        # health_checker (_parse_and_update_metrics) reading this same
                        # local training.log — identical to local training.

                # ── Check job status ─────────────────────────────────────────
                status_resp = requests.get(
                    f"{base_url}/agent/status/{remote_job_id}",
                    timeout=REQUEST_TIMEOUT,
                )
                if status_resp.status_code == 200:
                    status_data = status_resp.json()
                    remote_status = status_data.get("status", "unknown")

                    consecutive_errors = 0  # reset on success

                    if remote_status == "done":
                        logger.info("operations.training", f"Remote training done for session {session_id}", "remote_training_done", {
                            "session_id": session_id
                        })
                        _download_results(db, session_id, base_url, remote_job_id, project_root)
                        return

                    elif remote_status == "failed":
                        error_msg = status_data.get("error", "Unknown error on remote agent")
                        logger.warning("operations.training", f"Remote training failed for session {session_id}: {error_msg}", "remote_training_failed", {
                            "session_id": session_id, "error": error_msg
                        })
                        session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
                        if session:
                            session.status = "failed"
                            session.error_msg = f"Remote training failed: {error_msg}"
                            session.completed_at = datetime.utcnow()
                            db.commit()
                        return

            except requests.exceptions.ConnectionError:
                consecutive_errors += 1
                logger.warning("operations.training", f"Remote agent connection error ({consecutive_errors}/{MAX_ERRORS})", "remote_poller_connection_error", {
                    "session_id": session_id
                })
                if consecutive_errors >= MAX_ERRORS:
                    logger.error("operations.training", "Remote agent unreachable. Marking session failed.", "remote_poller_gave_up", {
                        "session_id": session_id
                    })
                    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
                    if session:
                        session.status = "failed"
                        session.error_msg = "Remote agent connection lost during training"
                        db.commit()
                    return

            except Exception as e:
                logger.warning("operations.training", f"Poller error: {e}", "remote_poller_error", {
                    "session_id": session_id, "error": str(e)
                })

    except Exception as e:
        logger.error("operations.training", f"Remote poller crashed: {e}", "remote_poller_crash", {
            "session_id": session_id, "error": str(e)
        })
    finally:
        if db:
            db.close()


def _download_results(db, session_id: int, base_url: str, remote_job_id: str, project_root: Path):
    """
    Download best.pt, last.pt, and plots from agent.
    Save to local project folder. Update DB session paths and status.
    """
    try:
        session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
        if not session:
            return

        # Local training run directory — YOLO output gets recreated here so the folder
        # looks EXACTLY like a local training (weights/, args.yaml, results.csv/png,
        # confusion_matrix, all curves, batch jpgs, predictions.json).
        run_dir = project_root / session.run_dir
        run_dir.mkdir(parents=True, exist_ok=True)

        # ── Download the ENTIRE YOLO output folder as one archive ─────────────
        try:
            resp = requests.get(f"{base_url}/agent/download/{remote_job_id}/output-archive", timeout=1800, stream=True)
            if resp.status_code == 200:
                archive_bytes = io.BytesIO(resp.content)
                with zipfile.ZipFile(archive_bytes) as z:
                    z.extractall(str(run_dir))
                logger.info("operations.training", f"Downloaded full output folder for session {session_id}", "remote_download_output")
            else:
                raise RuntimeError(f"output-archive returned {resp.status_code}")
        except Exception as e:
            # Fallback: at least grab best.pt + last.pt so the model isn't lost
            logger.warning("operations.training", f"Output archive failed ({e}); falling back to best/last only", "remote_download_archive_failed", {"error": str(e)})
            weights_dir = project_root / session.weights_dir
            weights_dir.mkdir(parents=True, exist_ok=True)
            for which, fname in (("best", "best.pt"), ("last", "last.pt")):
                try:
                    r = requests.get(f"{base_url}/agent/download/{remote_job_id}/{which}", timeout=300, stream=True)
                    if r.status_code == 200:
                        with open(weights_dir / fname, "wb") as f:
                            for chunk in r.iter_content(chunk_size=8192):
                                f.write(chunk)
                except Exception:
                    pass

        # Rewrite pod paths -> local paths inside args.yaml so the folder is
        # uniform with a local training (Model Lab / any tool reading args.yaml).
        try:
            args_path = run_dir / "args.yaml"
            if args_path.exists():
                with open(args_path, "r", encoding="utf-8", errors="ignore") as _af:
                    _args_txt = _af.read()
                # Replace the remote job output dir and project dir with local ones
                _args_txt = _args_txt.replace(
                    f"/workspace/jobs/{remote_job_id}/output", str(run_dir)
                ).replace(
                    f"/workspace/jobs/{remote_job_id}", str(run_dir.parent)
                )
                # Replace any cached-release data path with the local training_data path
                import re as _re
                _args_txt = _re.sub(
                    r"/workspace/releases_cache/[^\s\"']+/data\.yaml",
                    str((project_root / (session.dataset_release_dir or "")) / "data.yaml")
                    if session.dataset_release_dir else "data.yaml",
                    _args_txt,
                )
                # The agent runs YOLO with name=output; rewrite it to the real session name
                _args_txt = _re.sub(r"(?m)^name:\s*output\s*$", f"name: {session.name}", _args_txt)
                with open(args_path, "w", encoding="utf-8") as _af:
                    _af.write(_args_txt)
        except Exception as _e:
            logger.warning("operations.training", f"Could not rewrite args.yaml paths: {_e}", "remote_args_rewrite_failed", {"error": str(_e)})

        # Set best_weights_path (weights/best.pt under the run dir)
        best_pt_path = run_dir / "weights" / "best.pt"
        if best_pt_path.exists():
            session.best_weights_path = str(best_pt_path.relative_to(project_root))

        # ── Update DB session ─────────────────────────────────────────────────
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        session.last_update_at = datetime.utcnow()
        db.commit()

        logger.info("operations.training", f"Remote training session {session_id} completed and saved locally", "remote_session_complete")

        # ── Cleanup job on agent ──────────────────────────────────────────────
        try:
            requests.delete(f"{base_url}/agent/job/{remote_job_id}", timeout=REQUEST_TIMEOUT)
        except Exception:
            pass  # cleanup is best-effort

    except Exception as e:
        logger.error("operations.training", f"Failed to download results for session {session_id}: {e}", "remote_download_results_failed", {
            "error": str(e)
        })
        try:
            session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
            if session:
                session.status = "failed"
                session.error_msg = f"Failed to download results: {str(e)}"
                db.commit()
        except Exception:
            pass
