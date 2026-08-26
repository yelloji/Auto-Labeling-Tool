"""
ONNX Export Routes — "Production ONNX" profile

Converts a training session's best.pt to a production-ready ONNX file and
automatically validates it before it is offered for download.

Configurable export options (chosen in Model Lab → Model Manager):
    imgsz          = always the training session's own image size (never hardcoded,
                     never user-editable — it must match how the model was trained)
    batch_sizes    = which batch sizes to validate, default [1, 8, 16, 32]
    dynamic        = whether the batch dimension is dynamic, default True.
                     When True, only batch is dynamic — height/width stay fixed at
                     the training imgsz, e.g. ["batch", 3, 1312, 1312].
                     When False, the export is fully static and only batch=1 is
                     meaningful, regardless of what batch_sizes was set to.
    half           = FP16 precision, default True
    opset          = ONNX opset version, default 17
    simplify       = onnxslim simplification, default True
    metadata       = task, real class names, color order, input scaling, layout,
                      the options actually used — embedded directly in the .onnx file
    output         = a single self-contained .onnx file (no external tensor-data)

Validation (runs automatically after export, before the file is marked "done"):
    - loads the .onnx with ONNX Runtime's CUDA execution provider
    - runs inference at each requested batch size
    - compares detections/classes against the source .pt model
    - records GPU memory delta and inference time per batch size
    - computes the file's SHA-256 checksum
    "done" (Export passed) is only reported once every batch size validates.

Used by both Retraining Mode (Results step) and Full Mode (Model Lab → Model Manager).
Retraining Mode has no options UI of its own — it calls /convert with no body,
which reuses the last options a human chose for that project in Model Lab (see
`_load_project_defaults` / `_save_project_defaults`), falling back to the
built-in DEFAULT_OPTIONS if this project has never exported one before.
"""

import os
import json
import shutil
import threading
import time
import hashlib

import yaml
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import TrainingSession
from utils.path_utils import path_manager
from logging_system.professional_logger import get_professional_logger


def _register_cudnn9_for_onnxruntime():
    """
    ONNX Runtime's CUDA execution provider (1.19+) links against cuDNN 9, which is
    a separate major version from the cuDNN 8.x this project's PyTorch/training
    stack uses. Rather than requiring a system-wide cuDNN 9 install, we ship it as
    the `nvidia-cudnn-cu12` pip package and put its DLL directory on PATH here.

    Windows' DLL loader for onnxruntime's native provider bridge does not honor
    os.add_dll_directory() for this particular load path — only the classic PATH
    environment variable search works — so PATH is what we modify.
    """
    try:
        import nvidia.cudnn
        cudnn_bin = os.path.join(os.path.dirname(nvidia.cudnn.__file__), "bin")
        if os.path.isdir(cudnn_bin) and cudnn_bin not in os.environ.get("PATH", ""):
            os.environ["PATH"] = cudnn_bin + os.pathsep + os.environ.get("PATH", "")
    except ImportError:
        pass


_register_cudnn9_for_onnxruntime()

logger = get_professional_logger()
router = APIRouter()

ALLOWED_BATCH_SIZES = [1, 2, 4, 8, 16, 32, 64]
ALLOWED_OPSETS = [12, 13, 14, 15, 16, 17, 18]

DEFAULT_OPTIONS = {
    "batch_sizes": [1, 8, 16, 32],
    "dynamic": True,
    "half": True,
    "opset": 17,
    "simplify": True,
}

# In-memory status store: { training_id: "pending" | "converting" | "validating" | "done" | "failed" }
_onnx_status: dict = {}
_onnx_error: dict = {}
_onnx_lock = threading.Lock()


class ProductionOnnxOptions(BaseModel):
    batch_sizes: list[int] | None = None
    dynamic: bool | None = None
    half: bool | None = None
    opset: int | None = None
    simplify: bool | None = None


def _sanitize_options(opts: dict) -> dict:
    """Clamp/validate user-supplied options to safe, supported values."""
    out = dict(DEFAULT_OPTIONS)
    out.update({k: v for k, v in opts.items() if v is not None})

    batch_sizes = [b for b in out.get("batch_sizes") or [1] if b in ALLOWED_BATCH_SIZES]
    out["batch_sizes"] = sorted(set(batch_sizes)) or [1]

    if not out.get("dynamic", True):
        # A static export only has one real batch size — testing others against
        # a fixed-batch graph isn't meaningful.
        out["batch_sizes"] = [1]

    if out.get("opset") not in ALLOWED_OPSETS:
        out["opset"] = DEFAULT_OPTIONS["opset"]

    out["dynamic"] = bool(out.get("dynamic", True))
    out["half"] = bool(out.get("half", True))
    out["simplify"] = bool(out.get("simplify", True))
    return out


def _project_defaults_path(session) -> str | None:
    """Sidecar file: last options a human chose for this project, for Retraining Mode to reuse."""
    if not session.project_name:
        return None
    try:
        project_model_dir = str(path_manager.get_absolute_path(f"projects/{session.project_name}/model"))
        return os.path.join(project_model_dir, "onnx_export_defaults.json")
    except Exception:
        return None


def _load_project_defaults(session) -> dict:
    path = _project_defaults_path(session)
    if path and os.path.exists(path):
        try:
            with open(path) as f:
                return _sanitize_options(json.load(f))
        except Exception:
            pass
    return dict(DEFAULT_OPTIONS)


def _save_project_defaults(session, options: dict):
    path = _project_defaults_path(session)
    if not path:
        return
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(options, f, indent=2)
    except Exception as e:
        logger.warning("errors.system", f"Could not save ONNX export defaults for project: {e}",
                        "onnx_defaults_save_failed", {"project": session.project_name})


def _onnx_path_for(best_pt: str) -> str:
    """Derive the .onnx path from the best.pt path."""
    return os.path.splitext(best_pt)[0] + ".onnx"


def _validation_path_for(onnx_path: str) -> str:
    """Sidecar JSON report next to the .onnx (not ONNX external tensor-data)."""
    return onnx_path + ".validation.json"


def _resolve_best_pt(session) -> str | None:
    """Return the absolute best.pt path for a training session."""
    if session.best_weights_path:
        abs_path = str(path_manager.get_absolute_path(session.best_weights_path))
        if os.path.exists(abs_path):
            return abs_path
    if session.weights_dir:
        abs_weights = str(path_manager.get_absolute_path(session.weights_dir))
        candidate = os.path.join(abs_weights, "best.pt")
        if os.path.exists(candidate):
            return candidate
    return None


def _resolve_imgsz(session) -> int:
    """
    Read the image size THIS training session actually used.
    Never hardcode a project-wide value — different trainings can use different imgsz.
    This is intentionally NOT a user-configurable option — it must match training.
    """
    try:
        if session.resolved_config_json:
            cfg = json.loads(session.resolved_config_json)
            imgsz = cfg.get("train", {}).get("imgsz")
            if imgsz:
                return int(imgsz)
    except Exception:
        pass
    try:
        if session.run_dir:
            args_path = os.path.join(str(path_manager.get_absolute_path(session.run_dir)), "args.yaml")
            if os.path.exists(args_path):
                with open(args_path) as f:
                    args = yaml.safe_load(f)
                if args and args.get("imgsz"):
                    return int(args["imgsz"])
    except Exception:
        pass
    logger.warning("errors.system", f"Could not resolve imgsz for training {session.id}, defaulting to 640",
                    "onnx_imgsz_fallback", {"training_id": session.id})
    return 640


def _resolve_class_names(session, best_pt: str) -> dict:
    """
    Resolve the REAL class names for this model.

    dataset_summary_json is recorded from the actual release data.yaml at training
    time and is authoritative. The checkpoint's own model.names can be a generic
    placeholder (e.g. "item") when the training used single_cls=True — that
    placeholder must never be trusted blindly.
    """
    try:
        if session.dataset_summary_json:
            summary = json.loads(session.dataset_summary_json)
            classes = summary.get("classes")
            if classes:
                return {i: str(name) for i, name in enumerate(classes)}
    except Exception:
        pass
    try:
        import torch
        ckpt = torch.load(best_pt, map_location="cpu", weights_only=False)
        model = ckpt.get("model") if isinstance(ckpt, dict) else None
        names = getattr(model, "names", None)
        if names:
            logger.warning(
                "errors.system",
                f"Using checkpoint class names as fallback for training {session.id}: {names}",
                "onnx_class_names_fallback", {"training_id": session.id},
            )
            return {int(k): str(v) for k, v in names.items()}
    except Exception:
        pass
    return {0: "item"}


def _find_a_dataset_image(snapshot: dict) -> str | None:
    """Best-effort: find one real image from this training's release for validation."""
    release_dir = snapshot.get("dataset_release_dir")
    if not release_dir:
        return None
    try:
        abs_release_dir = str(path_manager.get_absolute_path(release_dir))
        for sub in ("train/images", "val/images", "images/train", "images/val"):
            candidate_dir = os.path.join(abs_release_dir, sub)
            if not os.path.isdir(candidate_dir):
                continue
            label_dir = candidate_dir.replace(os.sep + "images", os.sep + "labels").replace(
                "images" + os.sep, "labels" + os.sep
            )
            # Prefer an image that actually has a non-empty label file, so the
            # validation comparison is meaningful rather than a blank crop.
            for fn in sorted(os.listdir(candidate_dir))[:200]:
                if not fn.lower().endswith((".jpg", ".jpeg", ".png")):
                    continue
                label_path = os.path.join(label_dir, os.path.splitext(fn)[0] + ".txt")
                if os.path.exists(label_path) and os.path.getsize(label_path) > 0:
                    return os.path.join(candidate_dir, fn)
            # fall back to the first image even if its label is empty
            for fn in sorted(os.listdir(candidate_dir)):
                if fn.lower().endswith((".jpg", ".jpeg", ".png")):
                    return os.path.join(candidate_dir, fn)
        # fallback: shallow recursive scan capped for speed
        scanned = 0
        for root, _, files in os.walk(abs_release_dir):
            for fn in files:
                scanned += 1
                if fn.lower().endswith((".jpg", ".jpeg", ".png")):
                    return os.path.join(root, fn)
                if scanned > 500:
                    return None
    except Exception:
        return None
    return None


def _get_test_source(snapshot: dict):
    """A real dataset image if one can be found, otherwise synthetic noise of the right size."""
    path = _find_a_dataset_image(snapshot)
    if path:
        return path
    import numpy as np
    imgsz = snapshot["imgsz"]
    return np.random.randint(0, 255, (imgsz, imgsz, 3), dtype=np.uint8)


def _fix_dynamic_axes(onnx_path: str, imgsz: int):
    """
    Ultralytics' dynamic=True makes batch, height AND width all dynamic. We only
    want the batch dimension dynamic — height/width must stay fixed at the
    training image size, e.g. ["batch", 3, 1312, 1312].

    Run one real inference at batch=1 to discover the true (fixed) output shapes
    for this imgsz, then rewrite the graph's declared input/output shapes so only
    dim 0 stays symbolic ("batch"). Only called when dynamic=True was requested.
    """
    import onnx
    import numpy as np
    import onnxruntime as ort

    providers = [p for p in ort.get_available_providers() if p in ("CUDAExecutionProvider", "CPUExecutionProvider")]
    sess = ort.InferenceSession(onnx_path, providers=providers)
    input_meta = sess.get_inputs()[0]
    dtype = np.float16 if "float16" in input_meta.type else np.float32
    dummy = np.random.rand(1, 3, imgsz, imgsz).astype(dtype)
    outputs = sess.run(None, {input_meta.name: dummy})

    def set_dims(value_info, shape):
        dims = value_info.type.tensor_type.shape.dim
        for i, d in enumerate(dims):
            d.Clear()
            if i == 0:
                d.dim_param = "batch"
            else:
                d.dim_value = int(shape[i])

    model = onnx.load(onnx_path)
    set_dims(model.graph.input[0], (1, 3, imgsz, imgsz))
    for out_vi, out_val in zip(model.graph.output, outputs):
        set_dims(out_vi, out_val.shape)
    onnx.save(model, onnx_path)


def _write_metadata(onnx_path: str, snapshot: dict, class_names: dict, imgsz: int, options: dict):
    """Embed production metadata directly in the ONNX file (read by AI Studio's app)."""
    import onnx

    meta = {
        "task": "segmentation",
        "names": json.dumps(class_names),
        "imgsz": str(imgsz),
        "precision": "fp16" if options["half"] else "fp32",
        "dynamic_batch": "true" if options["dynamic"] else "false",
        "opset": str(options["opset"]),
        "color_order": "RGB",
        "input_scaling": "1/255",
        "layout": "NCHW",
        "validated_batch_sizes": json.dumps(options["batch_sizes"]),
        "training_id": str(snapshot["id"]),
        "training_name": snapshot.get("name") or "",
        "export_profile": "production_onnx",
    }

    model = onnx.load(onnx_path)
    keep = [m for m in model.metadata_props if m.key not in meta]
    del model.metadata_props[:]
    model.metadata_props.extend(keep)
    for k, v in meta.items():
        prop = model.metadata_props.add()
        prop.key, prop.value = k, v
    onnx.save(model, onnx_path)


def _sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _validate_onnx(onnx_path: str, best_pt: str, snapshot: dict, class_names: dict, imgsz: int, options: dict) -> dict:
    """
    Load the exported ONNX with CUDA, run inference at each requested batch size,
    compare against the source .pt, record GPU memory + timing, verify outputs, checksum.
    """
    import torch
    from ultralytics import YOLO

    report = {
        "started_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "opset": options["opset"],
        "precision": "fp16" if options["half"] else "fp32",
        "dynamic": options["dynamic"],
        "simplify": options["simplify"],
        "imgsz": imgsz,
        "class_names": class_names,
        "batches": {},
        "passed": False,
        "errors": [],
    }

    if not torch.cuda.is_available():
        report["errors"].append("CUDA is not available on this machine — Production ONNX validation requires a GPU.")
        report["checksum_sha256"] = _sha256_of(onnx_path)
        report["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        return report

    # Verify ONNX Runtime's CUDA execution provider actually initializes.
    # Passing CPUExecutionProvider as a fallback would let onnxruntime silently
    # run on CPU when CUDA fails to load, making every check below meaningless —
    # the spec requires "Load it with ONNX Runtime CUDA", so we probe CUDA-only
    # first and fail loudly rather than pass on the wrong backend.
    try:
        import onnxruntime as ort
        probe = ort.InferenceSession(onnx_path, providers=["CUDAExecutionProvider"])
        if "CUDAExecutionProvider" not in probe.get_providers():
            raise RuntimeError("CUDAExecutionProvider did not report as active")
        del probe
    except Exception as e:
        report["errors"].append(f"ONNX Runtime CUDA execution provider unavailable: {e}")
        report["checksum_sha256"] = _sha256_of(onnx_path)
        report["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        return report

    test_source = _get_test_source(snapshot)
    max_class_id = max(class_names.keys()) if class_names else 0

    try:
        pt_model = YOLO(best_pt)
        onnx_model = YOLO(onnx_path, task="segment")
    except Exception as e:
        report["errors"].append(f"Failed to load models for validation: {e}")
        report["checksum_sha256"] = _sha256_of(onnx_path)
        report["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        return report

    for bs in options["batch_sizes"]:
        try:
            images = [test_source] * bs

            torch.cuda.synchronize()
            free_before, _ = torch.cuda.mem_get_info()
            t0 = time.perf_counter()
            onnx_results = onnx_model.predict(
                images, imgsz=imgsz, half=options["half"], device=0, batch=bs, verbose=False
            )
            torch.cuda.synchronize()
            elapsed = time.perf_counter() - t0
            free_after, _ = torch.cuda.mem_get_info()
            gpu_mem_mb = max(0.0, (free_before - free_after) / (1024 * 1024))

            pt_results = pt_model.predict(images[:1], imgsz=imgsz, half=options["half"], device=0, verbose=False)

            onnx_r = onnx_results[0]
            pt_r = pt_results[0]
            onnx_count = len(onnx_r.boxes) if onnx_r.boxes is not None else 0
            pt_count = len(pt_r.boxes) if pt_r.boxes is not None else 0
            has_masks = onnx_r.masks is not None

            count_diff_ok = abs(onnx_count - pt_count) <= max(1, round(0.2 * pt_count))

            classes_ok = True
            if onnx_r.boxes is not None and onnx_count:
                onnx_classes = [int(c) for c in onnx_r.boxes.cls.tolist()]
                classes_ok = all(0 <= c <= max_class_id for c in onnx_classes)

            no_nan = True
            if onnx_r.boxes is not None and len(onnx_r.boxes):
                no_nan = bool(torch.isfinite(onnx_r.boxes.data).all())

            passed = count_diff_ok and classes_ok and no_nan
            batch_result = {
                "status": "passed" if passed else "failed",
                "onnx_detections": onnx_count,
                "pt_detections": pt_count,
                "has_masks": has_masks,
                "inference_time_ms": round(elapsed * 1000 / bs, 2),
                "gpu_memory_mb": round(gpu_mem_mb, 1),
            }
            if not passed:
                batch_result["reason"] = "Detection count/class mismatch between ONNX and PT outputs"
        except Exception as e:
            batch_result = {"status": "failed", "error": str(e)}
            report["errors"].append(f"batch={bs}: {e}")

        report["batches"][str(bs)] = batch_result

    report["checksum_sha256"] = _sha256_of(onnx_path)
    report["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    report["passed"] = bool(report["batches"]) and all(
        b.get("status") == "passed" for b in report["batches"].values()
    )
    return report


def _run_conversion(training_id: str, best_pt: str, onnx_path: str, snapshot: dict, options: dict):
    """Background thread: Production ONNX export + automatic validation."""
    from ultralytics import YOLO
    import torch

    try:
        imgsz = snapshot["imgsz"]
        class_names = snapshot["class_names"]

        model = YOLO(best_pt)
        # Correct the embedded class names before export (fixes "item" placeholders
        # produced by single_cls training) so the exported metadata reflects reality.
        model.model.names = class_names

        export_device = 0 if torch.cuda.is_available() else "cpu"
        exported = model.export(
            format="onnx",
            imgsz=imgsz,
            half=options["half"],
            dynamic=options["dynamic"],
            opset=options["opset"],
            simplify=options["simplify"],
            device=export_device,
        )
        exported = str(exported)
        if exported != onnx_path and os.path.exists(exported):
            shutil.move(exported, onnx_path)

        # Production ONNX must be a single self-contained file.
        ext_data = onnx_path + ".data"
        if os.path.exists(ext_data):
            os.remove(ext_data)
            raise RuntimeError("ONNX export produced external tensor-data, which is not allowed for Production ONNX")

        if not os.path.exists(onnx_path):
            raise RuntimeError("ONNX file was not created")

        if options["dynamic"]:
            _fix_dynamic_axes(onnx_path, imgsz)
        _write_metadata(onnx_path, snapshot, class_names, imgsz, options)

        with _onnx_lock:
            _onnx_status[training_id] = "validating"

        report = _validate_onnx(onnx_path, best_pt, snapshot, class_names, imgsz, options)
        with open(_validation_path_for(onnx_path), "w") as f:
            json.dump(report, f, indent=2)

        with _onnx_lock:
            _onnx_status[training_id] = "done" if report["passed"] else "failed"
            if not report["passed"]:
                _onnx_error[training_id] = "Validation failed — see validation report"
            else:
                _onnx_error.pop(training_id, None)

        logger.info(
            "operations.training",
            f"Production ONNX export {'passed validation' if report['passed'] else 'failed validation'}",
            "onnx_conversion_result",
            {"training_id": training_id, "passed": report["passed"], "options": options},
        )
    except Exception as e:
        logger.error("errors.system", f"ONNX conversion error: {e}",
                     "onnx_conversion_error", {"training_id": training_id, "error": str(e)})
        with _onnx_lock:
            _onnx_status[training_id] = "failed"
            _onnx_error[training_id] = str(e)


@router.post("/onnx/training/{training_id}/convert")
def start_onnx_conversion(training_id: str, options: ProductionOnnxOptions | None = None, db: Session = Depends(get_db)):
    """
    Start Production ONNX export + validation for a training session's best.pt.

    Model Lab sends explicit `options` (batch_sizes/dynamic/half/opset/simplify)
    chosen by the user, and those become this project's new remembered defaults.
    Retraining Mode calls this with no body — it automatically reuses whichever
    options were last chosen for this project, or the built-in defaults if this
    project has never exported a Production ONNX before.

    Returns immediately — poll GET /onnx/training/{id}/status for progress.
    """
    session = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    best_pt = _resolve_best_pt(session)
    if not best_pt:
        raise HTTPException(status_code=404, detail="best.pt not found for this training session")

    onnx_path = _onnx_path_for(best_pt)

    with _onnx_lock:
        current = _onnx_status.get(training_id)

    if current in ("converting", "validating"):
        return {"status": current, "onnx_ready": False}

    if options is not None and any(v is not None for v in options.model_dump().values()):
        resolved_options = _sanitize_options(options.model_dump())
        _save_project_defaults(session, resolved_options)
    else:
        resolved_options = _load_project_defaults(session)

    if current == "done" and os.path.exists(onnx_path):
        return {"status": "done", "onnx_ready": True}

    imgsz = _resolve_imgsz(session)
    class_names = _resolve_class_names(session, best_pt)
    snapshot = {
        "id": session.id,
        "name": session.name,
        "dataset_release_dir": session.dataset_release_dir,
        "imgsz": imgsz,
        "class_names": class_names,
    }

    with _onnx_lock:
        _onnx_status[training_id] = "converting"
        _onnx_error.pop(training_id, None)

    t = threading.Thread(
        target=_run_conversion, args=(training_id, best_pt, onnx_path, snapshot, resolved_options), daemon=True
    )
    t.start()

    logger.info(
        "operations.training", "Production ONNX export started", "onnx_conversion_start",
        {"training_id": training_id, "best_pt": best_pt, "imgsz": imgsz, "options": resolved_options},
    )

    return {"status": "converting", "onnx_ready": False}


@router.get("/onnx/training/{training_id}/status")
def get_onnx_status(training_id: str, db: Session = Depends(get_db)):
    """Poll the Production ONNX export/validation status for a training session."""
    session = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    best_pt = _resolve_best_pt(session)
    onnx_path = _onnx_path_for(best_pt) if best_pt else None
    onnx_exists = bool(onnx_path and os.path.exists(onnx_path))

    with _onnx_lock:
        status = _onnx_status.get(training_id)
        error = _onnx_error.get(training_id)

    validation = None
    if onnx_path:
        vpath = _validation_path_for(onnx_path)
        if os.path.exists(vpath):
            try:
                with open(vpath) as f:
                    validation = json.load(f)
            except Exception:
                validation = None

    # Recover state after a backend restart when a file/report already exists on disk.
    if status not in ("converting", "validating"):
        if onnx_exists:
            recovered = "done" if (validation is None or validation.get("passed")) else "failed"
            with _onnx_lock:
                _onnx_status[training_id] = recovered
            status = recovered
        elif status is None:
            status = "pending"

    return {
        "status": status,
        "onnx_ready": onnx_exists,
        "validation": validation,
        "error": error,
        "project_defaults": _load_project_defaults(session),
    }


@router.get("/onnx/training/{training_id}/download")
def download_onnx(training_id: str, db: Session = Depends(get_db)):
    """Download the exported Production ONNX file."""
    session = db.query(TrainingSession).filter(TrainingSession.id == training_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")

    best_pt = _resolve_best_pt(session)
    if not best_pt:
        raise HTTPException(status_code=404, detail="best.pt not found for this training session")

    onnx_path = _onnx_path_for(best_pt)
    if not os.path.exists(onnx_path):
        raise HTTPException(status_code=404, detail="ONNX file not found — please convert first")

    filename = f"{session.name or training_id}_best.onnx"
    return FileResponse(
        path=onnx_path,
        media_type="application/octet-stream",
        filename=filename,
    )
