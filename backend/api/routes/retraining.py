"""
Retraining Mode API Routes

Provides a simplified pipeline for operators to retrain existing models.
All data (releases, training sessions) is stored in the same tables as Full Mode.
The retraining_references table is just a pointer to the production reference.

Does NOT modify any existing route or service — new pipeline only.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime
import json
import random
import shutil

from database.database import get_db
from database.models import (
    Project, RetrainingReference, TrainingSession, Release, Dataset, Image, Annotation
)
from utils.path_utils import path_manager
from logging_system.professional_logger import get_professional_logger
from models.training.model_lab_model_router import deploy_training_model_record

logger = get_professional_logger()
router = APIRouter()


# ---------------------------------------------------------------------------
# GET /api/v1/retraining/projects
# Returns only projects that have a retraining reference assigned.
# ---------------------------------------------------------------------------
@router.get("/retraining/projects")
def get_retraining_projects(db: Session = Depends(get_db)):
    """
    Returns all projects with their retraining reference status.
    Projects without a reference are included but marked as locked.
    """
    try:
        projects = db.query(Project).order_by(Project.updated_at.desc()).all()
        result = []
        for proj in projects:
            ref = db.query(RetrainingReference).filter(
                RetrainingReference.project_id == proj.id
            ).first()

            result.append({
                "id": proj.id,
                "name": proj.name,
                "description": proj.description,
                "project_type": proj.project_type,
                "created_at": proj.created_at.isoformat() if proj.created_at else None,
                "updated_at": proj.updated_at.isoformat() if proj.updated_at else None,
                "has_reference": ref is not None,
                "reference": {
                    "training_session_id": ref.training_session_id,
                    "release_id": ref.release_id,
                    "assigned_at": ref.assigned_at.isoformat() if ref.assigned_at else None,
                    "notes": ref.notes,
                } if ref else None
            })

        return {"projects": result}

    except Exception as e:
        logger.warning("errors.system", f"Failed to fetch retraining projects: {e}",
                       "retraining_projects_error", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/v1/retraining/{project_id}/reference
# Returns the full reference params for auto-filling retraining.
# ---------------------------------------------------------------------------
@router.get("/retraining/{project_id}/reference")
def get_retraining_reference(project_id: int, db: Session = Depends(get_db)):
    """
    Returns the production reference for a project:
    - training session params (model, epochs, optimizer, task, etc.)
    - release config (transformations, format, task type, split ratios)
    """
    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()

    if not ref:
        raise HTTPException(
            status_code=404,
            detail="No production reference set for this project. Please contact your developer."
        )

    # Load training session params
    training_params = {}
    training_info = {}
    if ref.training_session_id:
        ts = db.query(TrainingSession).filter(
            TrainingSession.id == ref.training_session_id
        ).first()
        if ts:
            training_info = {
                "id": ts.id,
                "name": ts.name,
                "framework": ts.framework,
                "task": ts.task,
                "model_name": ts.model_name,
                "base_model_id": ts.base_model_id,
                "best_weights_path": ts.best_weights_path,
            }
            if ts.resolved_config_json:
                try:
                    training_params = json.loads(ts.resolved_config_json)
                except Exception:
                    training_params = {}

    # Load release config (transformation settings + split ratios)
    release_info = {}
    if ref.release_id:
        rel = db.query(Release).filter(Release.id == ref.release_id).first()
        if rel:
            release_config = {}
            if rel.config:
                try:
                    release_config = json.loads(rel.config) if isinstance(rel.config, str) else rel.config
                except Exception:
                    release_config = {}

            release_info = {
                "id": rel.id,
                "name": rel.name,
                "task_type": rel.task_type,
                "export_format": release_config.get("export_format"),
                "output_format": release_config.get("output_format"),
                "transformations": release_config.get("transformations", []),
                "images_per_original": release_config.get("multiplier") or release_config.get("images_per_original", 1),
                "train_image_count": rel.train_image_count,
                "val_image_count": rel.val_image_count,
                "test_image_count": rel.test_image_count,
            }

    return {
        "project_id": project_id,
        "reference_id": ref.id,
        "training_info": training_info,
        "training_params": training_params,
        "release_info": release_info,
        "assigned_at": ref.assigned_at.isoformat() if ref.assigned_at else None,
        "notes": ref.notes,
    }


# ---------------------------------------------------------------------------
# POST /api/v1/retraining/{project_id}/assign-production
# Sets a training session as the production reference for a project.
# Called from Retraining Mode results page AND Full Mode Model Lab.
# ---------------------------------------------------------------------------
@router.post("/retraining/{project_id}/assign-production")
def assign_production(
    project_id: int,
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Assigns a training session as the production reference for this project.
    Creates or updates the retraining_references row.
    Body: { training_session_id, notes (optional) }
    """
    training_session_id = body.get("training_session_id")
    notes = body.get("notes", "")

    if not training_session_id:
        raise HTTPException(status_code=400, detail="training_session_id is required")

    # Verify training session exists and belongs to this project
    ts = db.query(TrainingSession).filter(
        TrainingSession.id == training_session_id,
        TrainingSession.project_id == project_id
    ).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Training session not found for this project")

    # Find the release used by this training session
    release_id = ts.dataset_release_id

    # Upsert retraining reference
    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()

    if ref:
        ref.training_session_id = training_session_id
        ref.release_id = release_id
        ref.assigned_at = datetime.utcnow()
        ref.notes = notes
    else:
        ref = RetrainingReference(
            project_id=project_id,
            training_session_id=training_session_id,
            release_id=release_id,
            notes=notes,
        )
        db.add(ref)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    auto_model_name = f"{ts.name} - Production trained model"
    auto_model_description = "Auto-added from Assign to Production"
    auto_model, model_created_now = deploy_training_model_record(
        db=db,
        project=project,
        session=ts,
        model_type="best",
        model_name=auto_model_name,
        description=auto_model_description,
    )

    db.commit()
    db.refresh(ref)

    logger.info("app.retraining", f"Assigned training {training_session_id} as production reference",
                "assign_production", {"project_id": project_id, "training_session_id": training_session_id})

    return {
        "success": True,
        "project_id": project_id,
        "training_session_id": training_session_id,
        "release_id": release_id,
        "assigned_at": ref.assigned_at.isoformat(),
        "auto_model_added": model_created_now,
        "auto_model_id": auto_model.id,
        "auto_model_name": auto_model.name,
    }


# ---------------------------------------------------------------------------
# DELETE /api/v1/retraining/{project_id}/unassign-production
# Removes the production reference — project becomes locked in Retraining Mode.
# ---------------------------------------------------------------------------
@router.delete("/retraining/{project_id}/unassign-production")
def unassign_production(project_id: int, db: Session = Depends(get_db)):
    """
    Removes the retraining reference for this project.
    Project will appear locked in User Retraining Mode until reassigned.
    """
    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()

    if not ref:
        raise HTTPException(status_code=404, detail="No production reference found for this project.")

    db.delete(ref)
    db.commit()

    logger.info("app.retraining", f"Removed production reference for project {project_id}",
                "unassign_production", {"project_id": project_id})

    return {"success": True, "project_id": project_id}


# ---------------------------------------------------------------------------
# POST /api/v1/retraining/{project_id}/create-release
# Returns the full release payload (copied from reference) for the frontend
# to submit to POST /releases/create. Also deletes old unprotected
# user_retraining releases for this project before returning.
# ---------------------------------------------------------------------------
@router.post("/retraining/{project_id}/create-release")
def create_retraining_release(
    project_id: int,
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Body: { name: str }
    1. Validates reference release exists.
    2. Deletes old unprotected user_retraining releases (DB + ZIP file).
    3. Returns full ReleaseCreate payload with all config auto-copied from reference.
    Frontend then POSTs this payload to /releases/create.
    """
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Release name is required")

    # ── Get reference ────────────────────────────────────────────────────────
    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()
    if not ref or not ref.release_id:
        raise HTTPException(
            status_code=404,
            detail="No production reference release found. Please contact your developer."
        )

    ref_release = db.query(Release).filter(Release.id == ref.release_id).first()
    if not ref_release:
        raise HTTPException(status_code=404, detail="Reference release no longer exists.")

    # ── Extract reference config ─────────────────────────────────────────────
    release_config = {}
    if ref_release.config:
        try:
            release_config = json.loads(ref_release.config) if isinstance(ref_release.config, str) else ref_release.config
        except Exception:
            release_config = {}

    # ── Delete old unprotected user_retraining releases ──────────────────────
    # Production-protected = currently pointed to by retraining_references.release_id
    protected_id = ref.release_id

    old_releases = db.query(Release).filter(
        Release.project_id == project_id,
        Release.release_source == 'user_retraining',
        Release.id != protected_id,
    ).all()

    for old_rel in old_releases:
        # Delete ZIP file from disk
        if old_rel.model_path:
            try:
                zip_path = path_manager.get_absolute_path(old_rel.model_path)
                if zip_path.exists():
                    zip_path.unlink()
                # Also try removing the parent folder if it's now empty
                if zip_path.parent.exists() and not any(zip_path.parent.iterdir()):
                    zip_path.parent.rmdir()
            except Exception:
                pass  # Non-critical — DB record still removed
        db.delete(old_rel)

    db.commit()

    logger.info("app.retraining",
                f"Deleted {len(old_releases)} old user_retraining release(s) for project {project_id}",
                "create_release_cleanup",
                {"project_id": project_id, "deleted_count": len(old_releases)})

    # ── Collect all dataset IDs for this project ──────────────────────────────
    all_datasets = db.query(Dataset).filter(
        Dataset.project_id == project_id
    ).all()
    dataset_ids = [str(d.id) for d in all_datasets]

    if not dataset_ids:
        raise HTTPException(status_code=400, detail="No datasets found for this project.")

    # ── Build full ReleaseCreate payload ─────────────────────────────────────
    return {
        "project_id": project_id,
        "release_payload": {
            "version_name": name,
            "dataset_ids": dataset_ids,
            "description": f"Auto-created by Retraining Mode on {datetime.utcnow().strftime('%Y-%m-%d')}",
            "transformations": release_config.get("transformations", []),
            "multiplier": release_config.get("multiplier") or release_config.get("images_per_original", 1),
            "export_format": release_config.get("export_format") or ref_release.export_format or "YOLO",
            "task_type": ref_release.task_type or "object_detection",
            "output_format": release_config.get("output_format", "original"),
            "include_images": True,
            "include_annotations": True,
            "verified_only": False,
            "preserve_annotations": True,
            "release_source": "user_retraining",
        }
    }


# ---------------------------------------------------------------------------
# POST /api/v1/retraining/{project_id}/start-training
# Starts a new training session by copying all params from the reference.
# Operator provides only the name.
# ---------------------------------------------------------------------------
@router.post("/retraining/{project_id}/start-training")
def start_retraining(
    project_id: int,
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Returns the full training config copied from the production reference,
    ready for the frontend to submit to the existing training start endpoint.
    Body: { name, base_model_id (optional override), release_id }
    """
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Training name is required")

    release_id = body.get("release_id")
    base_model_override = body.get("base_model_id")

    ref = db.query(RetrainingReference).filter(
        RetrainingReference.project_id == project_id
    ).first()

    if not ref or not ref.training_session_id:
        raise HTTPException(
            status_code=404,
            detail="No production reference found. Please contact your developer."
        )

    # Load reference training session
    ts = db.query(TrainingSession).filter(
        TrainingSession.id == ref.training_session_id
    ).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Reference training session no longer exists.")

    # Copy all params from reference
    resolved_config = {}
    if ts.resolved_config_json:
        try:
            resolved_config = json.loads(ts.resolved_config_json)
        except Exception:
            resolved_config = {}

    # Remove old dataset/output paths — they belong to the old run
    for key in ("project", "data", "name", "save_dir"):
        resolved_config.pop(key, None)

    return {
        "project_id": project_id,
        "training_payload": {
            "name": name,
            "framework": ts.framework,
            "task": ts.task,
            "base_model_id": base_model_override or ts.base_model_id,
            "dataset_release_id": release_id or ts.dataset_release_id,
            "resolved_config": resolved_config,
        }
    }


# ---------------------------------------------------------------------------
# POST /api/v1/retraining/{project_id}/auto-split
# Silently assigns train/val/test split to all user_retraining annotating images.
# Called automatically by the frontend when the Label step is opened.
# ---------------------------------------------------------------------------
@router.post("/retraining/{project_id}/auto-split")
def auto_split_retraining_images(project_id: int, db: Session = Depends(get_db)):
    """
    Conditions to run (ALL must be true):
    1. Project has a production reference (for split ratio).
    2. There are datasets with upload_source='user_retraining'.
    3. All images in those datasets with split_type='annotating' are labeled.

    If images are already in 'dataset' stage → skipped (already split).
    If not all labeled → skipped (frontend gates Next button separately).
    """
    try:
        # ── Get project ──────────────────────────────────────────────────────
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # ── Get reference release for ratio calculation ───────────────────────
        ref = db.query(RetrainingReference).filter(
            RetrainingReference.project_id == project_id
        ).first()

        if not ref or not ref.release_id:
            raise HTTPException(status_code=404, detail="No production reference found.")

        ref_release = db.query(Release).filter(Release.id == ref.release_id).first()
        if not ref_release:
            raise HTTPException(status_code=404, detail="Reference release not found.")

        # ── Calculate split ratios from reference release image counts ─────────
        train_cnt = ref_release.train_image_count or 0
        val_cnt = ref_release.val_image_count or 0
        test_cnt = ref_release.test_image_count or 0
        total_ref = train_cnt + val_cnt + test_cnt

        if total_ref == 0:
            train_ratio, val_ratio = 0.7, 0.2
        else:
            train_ratio = train_cnt / total_ref
            val_ratio = val_cnt / total_ref
        # test gets the remainder (avoids float rounding leaving an image unassigned)

        # ── Collect annotating images from user_retraining datasets ───────────
        datasets = db.query(Dataset).filter(
            Dataset.project_id == project_id,
            Dataset.upload_source == 'user_retraining'
        ).all()

        if not datasets:
            return {"split_done": False, "skipped": True, "reason": "no_retraining_datasets"}

        images_to_split = []  # list of (image, dataset)
        for dataset in datasets:
            annotating = db.query(Image).filter(
                Image.dataset_id == dataset.id,
                Image.split_type == 'annotating'
            ).all()

            if not annotating:
                continue  # dataset already split or empty — skip

            # All must be labeled before we auto-split
            if not all(img.is_labeled for img in annotating):
                return {"split_done": False, "skipped": True, "reason": "not_all_labeled"}

            images_to_split.extend((img, dataset) for img in annotating)

        if not images_to_split:
            return {"split_done": False, "skipped": True, "reason": "no_annotating_images"}

        # ── Assign split sections by ratio ────────────────────────────────────
        random.shuffle(images_to_split)
        n = len(images_to_split)
        n_train = round(train_ratio * n)
        n_val = round(val_ratio * n)
        n_test = n - n_train - n_val
        if n_test < 0:
            n_train += n_test
            n_test = 0

        assignments = (
            [('train', img, ds) for img, ds in images_to_split[:n_train]] +
            [('val',   img, ds) for img, ds in images_to_split[n_train:n_train + n_val]] +
            [('test',  img, ds) for img, ds in images_to_split[n_train + n_val:]]
        )

        # ── Copy files and update DB ──────────────────────────────────────────
        project_folder = path_manager.get_absolute_path(f"projects/{project.name}")
        counts = {"train": 0, "val": 0, "test": 0}

        for split_section, image, dataset in assignments:
            target_folder = project_folder / "dataset" / dataset.name / split_section
            target_folder.mkdir(parents=True, exist_ok=True)
            target_path = target_folder / image.filename

            source_path = path_manager.get_absolute_path(image.file_path)
            if source_path.exists():
                shutil.copy2(str(source_path), str(target_path))

            new_path = f"projects/{project.name}/dataset/{dataset.name}/{split_section}/{image.filename}"
            image.split_type = 'dataset'
            image.split_section = split_section
            image.file_path = new_path
            image.updated_at = datetime.utcnow()

            counts[split_section] += 1

        db.commit()

        # ── Remove annotating folders (non-critical) ──────────────────────────
        for dataset in datasets:
            annotating_folder = project_folder / "annotating" / dataset.name
            if annotating_folder.exists():
                try:
                    shutil.rmtree(str(annotating_folder))
                except Exception:
                    pass

        logger.info("app.retraining",
                    f"Auto-split complete for project {project_id}: "
                    f"{counts['train']} train / {counts['val']} val / {counts['test']} test",
                    "auto_split_complete",
                    {"project_id": project_id, "counts": counts, "total": n})

        return {
            "split_done": True,
            "skipped": False,
            "counts": counts,
            "total": n,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("errors.system", f"Auto-split failed: {e}", "auto_split_error",
                     {"project_id": project_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# GET /api/v1/retraining/{project_id}/dataset-stats
# Returns image + annotation counts per split section (train/val/test)
# for all images in 'dataset' stage across ALL project datasets (old + new).
# ---------------------------------------------------------------------------
@router.get("/retraining/{project_id}/dataset-stats")
def get_dataset_stats(project_id: int, db: Session = Depends(get_db)):
    """
    Returns per-split image and annotation counts for the full project dataset.
    Covers both old (previous training) images and new (user_retraining) images.
    Only counts images with split_type='dataset' (already split and ready).
    """
    try:
        rows = (
            db.query(
                Image.split_section,
                func.count(Image.id.distinct()).label("image_count"),
                func.count(Annotation.id).label("annotation_count"),
            )
            .join(Dataset, Image.dataset_id == Dataset.id)
            .outerjoin(Annotation, Annotation.image_id == Image.id)
            .filter(
                Dataset.project_id == project_id,
                Image.split_type == "dataset",
            )
            .group_by(Image.split_section)
            .all()
        )

        stats = {"train": None, "val": None, "test": None}
        total_images = 0
        total_annotations = 0

        for row in rows:
            section = row.split_section
            if section in stats:
                stats[section] = {
                    "images": row.image_count,
                    "annotations": row.annotation_count,
                }
                total_images += row.image_count
                total_annotations += row.annotation_count

        # Per-class annotation counts across all dataset images
        class_rows = (
            db.query(
                Annotation.class_name,
                func.count(Annotation.id).label("annotation_count"),
            )
            .join(Image, Annotation.image_id == Image.id)
            .join(Dataset, Image.dataset_id == Dataset.id)
            .filter(
                Dataset.project_id == project_id,
                Image.split_type == "dataset",
            )
            .group_by(Annotation.class_name)
            .order_by(func.count(Annotation.id).desc())
            .all()
        )

        per_class = [
            {"class_name": row.class_name, "annotations": row.annotation_count}
            for row in class_rows
        ]

        return {
            "project_id": project_id,
            "train": stats["train"],
            "val":   stats["val"],
            "test":  stats["test"],
            "total": {"images": total_images, "annotations": total_annotations},
            "per_class": per_class,
        }

    except Exception as e:
        logger.error("errors.system", f"dataset-stats failed: {e}",
                     "dataset_stats_error", {"project_id": project_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))
