"""
Gevis AI Studio — Remote Training Agent v1.0.0
Lightweight worker that runs on RunPod (or any Ubuntu GPU VM).
The local app backend talks to this via HTTP on port 12000.

Deploy:
  1. Copy this file to /workspace/agent.py on RunPod
  2. pip install fastapi==0.104.1 "uvicorn[standard]==0.24.0" python-multipart==0.0.6 "ultralytics==8.4.23"
  3. python agent.py
"""

import io
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import uuid
import yaml
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn

# ── Constants ─────────────────────────────────────────────────────────────────
AGENT_VERSION = "1.0.0"
PORT = 12000
WORKSPACE = Path("/workspace")
JOBS_DIR = WORKSPACE / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)

# Release cache — extracted training data keyed by release name.
# Lets repeat trainings of the same release skip the (slow) upload entirely.
RELEASES_CACHE = WORKSPACE / "releases_cache"
RELEASES_CACHE.mkdir(parents=True, exist_ok=True)

# ── In-memory job store ───────────────────────────────────────────────────────
_jobs: dict = {}
_lock = threading.Lock()

app = FastAPI(title="Gevis Remote Training Agent", version=AGENT_VERSION)


# ── Job state ─────────────────────────────────────────────────────────────────
class JobState:
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.status = "created"       # created|uploading|ready|running|done|failed
        self.error: Optional[str] = None
        self.created_at = datetime.utcnow().isoformat()
        self.started_at: Optional[str] = None
        self.finished_at: Optional[str] = None
        self.process: Optional[subprocess.Popen] = None

    @property
    def job_dir(self) -> Path:
        return JOBS_DIR / self.job_id

    @property
    def training_data_dir(self) -> Path:
        return self.job_dir / "training_data"

    @property
    def log_file(self) -> Path:
        return self.job_dir / "training.log"

    @property
    def best_pt(self) -> Path:
        return self.job_dir / "output" / "weights" / "best.pt"

    @property
    def last_pt(self) -> Path:
        return self.job_dir / "output" / "weights" / "last.pt"

    @property
    def plots_dir(self) -> Path:
        return self.job_dir / "output"

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "error": self.error,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "has_best_pt": self.best_pt.exists(),
            "has_last_pt": self.last_pt.exists(),
        }


# ── Training config payload ───────────────────────────────────────────────────
class TrainingConfig(BaseModel):
    job_id: str
    model: str            # e.g. "yolo11n.pt" — ultralytics auto-downloads standard models
    task: str             # "detect" or "segment"
    epochs: int = 100
    batch: int = 16
    imgsz: int = 640
    device: int = 0       # GPU index on RunPod — always 0 for single GPU pods
    extra: dict = {}      # any additional YOLO params (optimizer, lr0, patience, etc.)
    yaml_content: str = ""  # full pre-generated YAML from local app (includes all base defaults)
    release_key: str = ""   # if set, training data is read from the release cache (no per-job upload)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _get_job(job_id: str) -> JobState:
    with _lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


def _get_gpu_info() -> list:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10
        )
        gpus = []
        for i, line in enumerate(result.stdout.strip().split("\n")):
            if not line.strip():
                continue
            parts = [p.strip() for p in line.split(",")]
            name = parts[0] if parts else "Unknown GPU"
            vram_mb = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
            gpus.append({
                "index": i,
                "name": name,
                "vram_mb": vram_mb,
                "vram_gb": round(vram_mb / 1024, 1),
            })
        return gpus
    except Exception:
        return [{"index": 0, "name": "GPU (nvidia-smi unavailable)", "vram_mb": 0, "vram_gb": 0}]


def _resolve_training_data_dir(extracted_dir: Path) -> Path:
    """
    Handle ZIP that may or may not have a top-level folder.
    If extracted_dir contains only one subdirectory, use that as the real data dir.
    """
    children = [c for c in extracted_dir.iterdir() if c.is_dir()]
    files = [c for c in extracted_dir.iterdir() if c.is_file()]
    if len(children) == 1 and not files:
        return children[0]
    return extracted_dir


def _run_training(job: JobState, config: TrainingConfig):
    """Runs in a background thread. Starts YOLO, waits for completion."""
    log_f = None
    try:
        job.status = "running"
        job.started_at = datetime.utcnow().isoformat()

        # Training data comes from the release cache (if release_key set) or the per-job upload
        if config.release_key:
            cache_dir = RELEASES_CACHE / config.release_key
            data_dir = _resolve_training_data_dir(cache_dir)
        else:
            data_dir = _resolve_training_data_dir(job.training_data_dir)

        # Fix data.yaml path to absolute so YOLO can find images
        data_yaml = data_dir / "data.yaml"
        if data_yaml.exists():
            with open(data_yaml, "r") as f:
                data_yaml_content = yaml.safe_load(f) or {}
            data_yaml_content["path"] = str(data_dir)
            with open(data_yaml, "w") as f:
                yaml.dump(data_yaml_content, f, sort_keys=False)

        # Build YOLO config YAML
        cfg_yaml = job.job_dir / "training_config.yaml"

        if config.yaml_content:
            # Use full pre-generated YAML from local app (includes all base defaults + user settings)
            # Only replace the path-specific fields for RunPod environment
            yolo_args = yaml.safe_load(config.yaml_content) or {}
            yolo_args["data"] = str(data_yaml)          # fix data path for RunPod
            yolo_args["model"] = config.model           # use resolved model name
            yolo_args["project"] = str(job.job_dir)     # fix output project path
            yolo_args["name"] = "output"                # fix output name
            yolo_args["device"] = config.device         # use RunPod GPU index
            yolo_args["exist_ok"] = True
        else:
            # Fallback: build config from scratch (backward compatible)
            yolo_args = {
                "task": config.task,
                "mode": "train",
                "model": config.model,
                "data": str(data_yaml),
                "epochs": config.epochs,
                "batch": config.batch,
                "imgsz": config.imgsz,
                "device": config.device,
                "project": str(job.job_dir),
                "name": "output",
                "exist_ok": True,
            }
            yolo_args.update(config.extra)

        with open(cfg_yaml, "w") as f:
            yaml.dump(yolo_args, f, sort_keys=False)

        # Find yolo executable
        yolo_cmd = shutil.which("yolo")
        if yolo_cmd:
            cmd = [yolo_cmd, f"cfg={cfg_yaml}"]
        else:
            cmd = [
                sys.executable, "-c",
                f"from ultralytics.cfg import entrypoint; import sys; "
                f"sys.argv=['yolo', 'cfg={cfg_yaml}']; entrypoint('yolo')"
            ]

        # Open log file and write YOLO output STRAIGHT to it — exactly like the
        # local training executor does. Writing to a real file (not a pipe) makes
        # YOLO emit its full per-batch progress bar (\r updates), which the poller
        # streams down so the local app gets live per-batch progress.
        job.log_file.parent.mkdir(parents=True, exist_ok=True)
        log_f = open(job.log_file, "w", encoding="utf-8")

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

        proc = subprocess.Popen(
            cmd,
            cwd=str(job.job_dir),
            stdout=log_f,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
        )

        with _lock:
            job.process = proc

        proc.wait()
        log_f.close()
        log_f = None

        if proc.returncode == 0 and job.best_pt.exists():
            job.status = "done"
        else:
            job.status = "failed"
            job.error = f"YOLO process exited with code {proc.returncode}"

    except Exception as e:
        job.status = "failed"
        job.error = str(e)
    finally:
        if log_f:
            try:
                log_f.close()
            except Exception:
                pass
        job.finished_at = datetime.utcnow().isoformat()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/agent/info")
def agent_info():
    """Local app calls this to check if agent is online and get GPU list."""
    return {
        "version": AGENT_VERSION,
        "status": "online",
        "gpus": _get_gpu_info(),
    }


@app.post("/agent/job/create")
def create_job():
    """Create a new job and return job_id."""
    job_id = str(uuid.uuid4())
    job = JobState(job_id)
    job.job_dir.mkdir(parents=True, exist_ok=True)
    with _lock:
        _jobs[job_id] = job
    return {"job_id": job_id, "status": "created"}


@app.get("/agent/release-exists")
def release_exists(release_key: str = Query(...)):
    """Check whether a release is already cached on this pod (so upload can be skipped)."""
    cache_dir = RELEASES_CACHE / release_key
    exists = cache_dir.exists() and any(cache_dir.iterdir())
    return {"exists": bool(exists), "release_key": release_key}


@app.post("/agent/upload/{job_id}")
async def upload_training_data(
    job_id: str,
    file: UploadFile = File(...),
    release_key: str = Query(default=""),
):
    """
    Receive zipped training_data folder from local app.
    ZIP should contain: images/, labels/, data.yaml
    If release_key is given, extract into the persistent release cache so future
    trainings of the same release can skip the upload.
    """
    job = _get_job(job_id)

    if job.status not in ("created",):
        raise HTTPException(status_code=400, detail=f"Cannot upload. Job status: {job.status}")

    job.status = "uploading"

    # Stream write to disk in chunks — low memory, visible progress, robust for 4GB+ files
    zip_path = job.job_dir / "training_data.zip"
    CHUNK = 8 * 1024 * 1024  # 8 MB chunks
    bytes_written = 0
    try:
        with open(zip_path, "wb") as f:
            while True:
                chunk = await file.read(CHUNK)
                if not chunk:
                    break
                f.write(chunk)
                bytes_written += len(chunk)
        print(f"[upload] job {job_id}: received {bytes_written / 1024 / 1024:.1f} MB")
    except Exception as e:
        job.status = "failed"
        job.error = f"Upload failed: {e}"
        zip_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

    # Extract — into the release cache if a key was given, else the per-job folder
    if release_key:
        target_dir = RELEASES_CACHE / release_key
    else:
        target_dir = job.training_data_dir
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(str(zip_path), "r") as zf:
            zf.extractall(str(target_dir))
    except Exception as e:
        job.status = "failed"
        job.error = f"Extract failed: {e}"
        raise HTTPException(status_code=500, detail=f"Extract failed: {e}")
    finally:
        # Remove zip to save disk space
        zip_path.unlink(missing_ok=True)

    job.status = "ready"
    print(f"[upload] job {job_id}: extracted to {'cache:' + release_key if release_key else 'job'} and ready")
    return {"ok": True, "job_id": job_id, "status": "ready", "bytes": bytes_written}


@app.post("/agent/start/{job_id}")
def start_training(job_id: str, config: TrainingConfig):
    """Start YOLO training. Runs in background thread."""
    job = _get_job(job_id)

    # When using the release cache, no per-job upload happens, so status stays "created".
    if config.release_key:
        cache_dir = RELEASES_CACHE / config.release_key
        if not (cache_dir.exists() and any(cache_dir.iterdir())):
            raise HTTPException(status_code=400, detail=f"Release '{config.release_key}' not found in cache")
        if job.status not in ("created", "ready"):
            raise HTTPException(status_code=400, detail=f"Job not startable. Status: {job.status}")
    else:
        if job.status != "ready":
            raise HTTPException(status_code=400, detail=f"Job not ready. Status: {job.status}")

    t = threading.Thread(target=_run_training, args=(job, config), daemon=True)
    t.start()

    return {"ok": True, "job_id": job_id, "status": "running"}


@app.get("/agent/status/{job_id}")
def get_status(job_id: str):
    """Poll training status."""
    job = _get_job(job_id)
    return job.to_dict()


@app.get("/agent/logs/{job_id}")
def get_logs(job_id: str, offset: int = Query(default=0, ge=0)):
    """
    Return new log content since byte offset.
    Local app polls this every 3 seconds and forwards to frontend WebSocket.
    """
    job = _get_job(job_id)

    if not job.log_file.exists():
        return {"lines": "", "offset": 0}

    with open(job.log_file, "r", encoding="utf-8", errors="ignore") as f:
        f.seek(offset)
        chunk = f.read()
        new_offset = f.tell()

    return {"lines": chunk, "offset": new_offset}


@app.post("/agent/stop/{job_id}")
def stop_training(job_id: str):
    """Stop a running training job."""
    job = _get_job(job_id)

    if job.status != "running":
        raise HTTPException(status_code=400, detail=f"Job not running. Status: {job.status}")

    with _lock:
        proc = job.process

    if proc:
        try:
            proc.terminate()
            time.sleep(2)
            if proc.poll() is None:
                proc.kill()
        except Exception:
            pass

    job.status = "failed"
    job.error = "Stopped by user"
    job.finished_at = datetime.utcnow().isoformat()

    return {"ok": True, "job_id": job_id, "status": "stopped"}


@app.get("/agent/download/{job_id}/output-archive")
def download_output_archive(job_id: str):
    """
    Download the ENTIRE YOLO output folder as a ZIP — weights/, args.yaml,
    results.csv/png, confusion_matrix, all curve plots, batch jpgs, predictions.json.
    Local side extracts this into the training folder so it matches local training exactly.
    """
    job = _get_job(job_id)
    output_dir = job.job_dir / "output"
    if not output_dir.exists():
        raise HTTPException(status_code=404, detail="output folder not found — training may not be complete")

    archive_path = job.job_dir / "output_archive.zip"
    with zipfile.ZipFile(str(archive_path), "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in output_dir.rglob("*"):
            if fp.is_file():
                # arcname relative to output/ so it extracts directly into the run dir
                zf.write(fp, fp.relative_to(output_dir))

    return FileResponse(
        str(archive_path),
        filename=f"output_{job_id[:8]}.zip",
        media_type="application/zip",
    )


@app.get("/agent/download/{job_id}/best")
def download_best_pt(job_id: str):
    """Download best.pt after training completes."""
    job = _get_job(job_id)
    if not job.best_pt.exists():
        raise HTTPException(status_code=404, detail="best.pt not found — training may not be complete")
    return FileResponse(str(job.best_pt), filename="best.pt", media_type="application/octet-stream")


@app.get("/agent/download/{job_id}/last")
def download_last_pt(job_id: str):
    """Download last.pt after training completes."""
    job = _get_job(job_id)
    if not job.last_pt.exists():
        raise HTTPException(status_code=404, detail="last.pt not found")
    return FileResponse(str(job.last_pt), filename="last.pt", media_type="application/octet-stream")


@app.get("/agent/download/{job_id}/plots")
def download_plots(job_id: str):
    """Download all training plot images (results.png, confusion_matrix.png etc.) as ZIP."""
    job = _get_job(job_id)

    if not job.plots_dir.exists():
        raise HTTPException(status_code=404, detail="No plots directory found")

    plot_files = list(job.plots_dir.glob("*.png")) + list(job.plots_dir.glob("*.jpg"))
    if not plot_files:
        raise HTTPException(status_code=404, detail="No plot images found")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for pf in plot_files:
            zf.write(pf, pf.name)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=plots_{job_id[:8]}.zip"},
    )


@app.delete("/agent/job/{job_id}")
def cleanup_job(job_id: str):
    """Delete all job files from disk. Call after downloading model."""
    with _lock:
        job = _jobs.get(job_id)

    if job and job.job_dir.exists():
        shutil.rmtree(str(job.job_dir), ignore_errors=True)

    with _lock:
        _jobs.pop(job_id, None)

    return {"ok": True, "cleaned": job_id}


@app.get("/agent/jobs")
def list_jobs():
    """List all current jobs (useful for debugging)."""
    with _lock:
        return [j.to_dict() for j in _jobs.values()]


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"Gevis Remote Training Agent v{AGENT_VERSION}")
    print(f"Listening on port {PORT}")
    print(f"Jobs dir: {JOBS_DIR}")
    gpus = _get_gpu_info()
    for g in gpus:
        print(f"  GPU {g['index']}: {g['name']} ({g['vram_gb']} GB VRAM)")
    uvicorn.run(app, host="0.0.0.0", port=PORT, timeout_keep_alive=7200, h11_max_incomplete_event_size=10 * 1024 * 1024 * 1024)
