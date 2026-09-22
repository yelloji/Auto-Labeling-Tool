"""Disk cache for the SAHI image-viewer overlay.

Computing one overlay rasterises the full-resolution GT and prediction masks and
skeletonises them, which costs around 700ms, while the result is about 10KB of
JSON. For a completed experiment that result never changes: the predictions are
frozen and the labels only move when someone edits them. So it is computed once
and read back in well under a millisecond after that.

Staleness is handled by the key rather than by invalidation. The cache filename
carries a fingerprint of the labels the result was built from - how many there
are and when one was last edited - so editing a crack in the labeling UI simply
points the lookup at a filename that does not exist yet, and the overlay is
rebuilt. Nothing has to remember to clear anything.

Stored inside the owning project's own cache folder, so a project carries its
derived data with it on export and loses it on delete.
"""
import hashlib
import json
import re
import shutil
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import Annotation, Image as DBImage
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

_SAFE = re.compile(r"[^A-Za-z0-9_.-]")


def experiment_cache_dir(experiment_id: str, project_name: str = None):
    """Inside the owning project's cache folder, so the project carries its own
    derived data on export and loses it on delete."""
    from utils import project_cache
    return project_cache.overlay_dir(project_name or "_unknown", experiment_id)


def label_fingerprint(db: Session, image_row: Optional[DBImage]) -> str:
    """How many labels this image has and when one last changed.

    Any edit in the labeling UI moves one of the two, which changes the cache
    key, which rebuilds the overlay. An image with no labels still gets a
    stable fingerprint of its own.
    """
    if image_row is None:
        return "noimg"
    count, updated, created = (
        db.query(func.count(Annotation.id),
                 func.max(Annotation.updated_at),
                 func.max(Annotation.created_at))
        .filter(Annotation.image_id == image_row.id)
        .one()
    )
    stamp = str(updated or created or "none")
    return f"{count or 0}-{_SAFE.sub('', stamp)[:20]}"


def cache_path(experiment_id: str, image_name: str, fingerprint: str, variant: str,
               project_name: str = None):
    """One file per experiment + image + label state + overlay settings.

    Keyed on the bare filename: callers pass the same image either plainly or
    with a path in front of it, and both produce the same overlay, so they must
    land on one entry rather than two copies of the same answer. The name is
    also hashed in, because it can be long or differ only by case on Windows.
    """
    bare = image_name.replace("\\", "/").split("/")[-1]
    stem = _SAFE.sub("_", bare)[:80]
    digest = hashlib.md5(f"{bare}|{fingerprint}|{variant}".encode("utf-8")).hexdigest()[:16]
    return experiment_cache_dir(experiment_id, project_name) / f"{stem}__{digest}.json"


def read(path) -> Optional[dict]:
    """Cached overlay, or None if absent or unreadable.

    A damaged file is treated as a miss rather than an error - the overlay will
    simply be recomputed and rewritten.
    """
    try:
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write(path, payload: dict) -> None:
    """Store an overlay result. Never raises: a cache failure must not break
    the viewer, it only costs the recompute next time."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f)
        tmp.replace(path)          # atomic, so a reader never sees half a file
    except OSError as e:
        logger.warning(
            "errors.system",
            f"Could not write overlay cache {path.name}: {e}",
            "overlay_cache_write_failed",
        )


def clear_experiment(experiment_id: str, project_name: str = None) -> None:
    """Drop every cached overlay for one experiment, on deletion."""
    d = experiment_cache_dir(experiment_id, project_name)
    if d.exists():
        try:
            shutil.rmtree(d)
        except OSError as e:
            logger.warning(
                "errors.system",
                f"Could not clear overlay cache for {experiment_id}: {e}",
                "overlay_cache_clear_failed",
            )
