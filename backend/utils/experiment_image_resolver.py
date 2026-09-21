"""Resolve which source image an experiment actually predicted on.

The same filename can belong to several genuinely different photographs: the
parts are re-shot on different days, so `disk-1-down-center-Darkest.png` from
the 09-09 session and from the 15-09 session are two different pictures with
their own, separately drawn labels. Matching ground truth by filename returns
both, which draws one photo's cracks on top of another photo's image.

Every experiment records the md5 of each image it ran on, so that md5 is the
only identity worth trusting. This module is the single place that turns an
experiment + image name into the one image row it came from, and every caller
that needs the image file, its ground truth, or its size goes through it so
they can never disagree with each other.

The lookup deliberately spans every workflow stage - unassigned, annotating and
dataset - because a prediction can be run over images that were never split
into a dataset, and their labels are just as real.
"""
import json
from typing import List, Optional

from sqlalchemy.orm import Session

from database.models import Annotation, Dataset, Image as DBImage


def get_filename(path: str) -> str:
    """Bare filename from any path shape, forward or back slashes."""
    return path.replace("\\", "/").split("/")[-1] if path else ""


def get_experiment_image_meta(experiment, image_name: str) -> dict:
    """The {md5, width, height} an experiment stored for one image, if any.

    Older experiments stored `input_images` as name -> md5 string rather than a
    dict, and some stored nothing at all, so every shape is tolerated.
    """
    raw = getattr(experiment, "input_images", None)
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            raw = None
    if not isinstance(raw, dict):
        return {}

    wanted = get_filename(image_name)
    entry = raw.get(image_name, raw.get(wanted))
    if entry is None:
        entry = next((v for k, v in raw.items() if get_filename(str(k)) == wanted), None)

    if isinstance(entry, str):
        try:
            entry = json.loads(entry)
        except (json.JSONDecodeError, ValueError):
            return {"md5": entry}          # old format: the value IS the md5
    return entry if isinstance(entry, dict) else {}


def resolve_experiment_image(db: Session, experiment, image_name: str) -> Optional[DBImage]:
    """The one image row this experiment predicted on, or None.

    md5 decides. Filename is used only when the experiment predates md5 storage,
    and even then the search stays inside the experiment's own project.
    """
    wanted = get_filename(image_name)
    project_id = getattr(experiment, "project_id", None)

    def scoped():
        q = db.query(DBImage).join(Dataset, DBImage.dataset_id == Dataset.id)
        return q.filter(Dataset.project_id == project_id) if project_id else q

    md5 = (get_experiment_image_meta(experiment, image_name) or {}).get("md5")
    if md5:
        hit = scoped().filter(DBImage.image_hash_md5 == md5).first()
        if hit:
            return hit
        # md5 recorded but absent from this project: the image may have been
        # re-imported elsewhere. Widen to md5 alone rather than fall back to a
        # name, which could match a different photograph.
        hit = db.query(DBImage).filter(DBImage.image_hash_md5 == md5).first()
        if hit:
            return hit

    # No md5 on record. Prefer a dataset-stage image so the common case stays
    # stable, but accept any stage, because predictions can run on unassigned
    # or still-annotating images.
    by_name = (DBImage.filename == wanted) | (DBImage.original_filename == wanted)
    return (
        scoped().filter(by_name)
        .order_by((DBImage.split_type == "dataset").desc())
        .first()
    )


def load_gt_polygons(db: Session, image_row: Optional[DBImage]) -> List[list]:
    """Real GT crack polygons (absolute pixel points) for one resolved image.

    Keyed on the image's id, never its name, so only that photograph's own
    labels come back.
    """
    if image_row is None:
        return []
    rows = (
        db.query(Annotation.segmentation)
        .filter(Annotation.image_id == image_row.id)
        .order_by(Annotation.id)
        .all()
    )
    polygons: List[list] = []
    for (seg_json,) in rows:
        if not seg_json:
            continue
        try:
            seg = json.loads(seg_json) if isinstance(seg_json, str) else seg_json
        except (json.JSONDecodeError, ValueError, TypeError):
            continue
        points = [(pt["x"], pt["y"]) for pt in seg if "x" in pt and "y" in pt]
        if len(points) >= 3:
            polygons.append(points)
    return polygons


def load_gt_polygons_for_experiment_image(db: Session, experiment, image_name: str) -> List[list]:
    """Resolve the image, then its own ground truth, in one step."""
    return load_gt_polygons(db, resolve_experiment_image(db, experiment, image_name))
