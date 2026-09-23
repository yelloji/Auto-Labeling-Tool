"""Where a project's derived image caches live, and how they are keyed.

Everything here is rebuildable from the originals, but it belongs to one project
and is stored inside that project's folder, so exporting or deleting a project
takes its caches with it:

    projects/<project>/cache/previews/<md5>.jpg
    projects/<project>/cache/thumbs/<size>/<md5>.jpg
    projects/<project>/cache/overlays/<experiment_id>/<image>__<fingerprint>.json

Previews and thumbnails are keyed by the image's md5, not by the experiment that
happened to ask for them. A resized copy of a photograph depends only on the
photograph, so the same image predicted in five experiments shares one file
instead of being written out five times. Overlays do depend on the experiment -
different predictions, different result - so those stay per experiment.
"""
import re
from pathlib import Path
from typing import Optional

from core.config import settings

_SAFE = re.compile(r"[^A-Za-z0-9_.-]")
_LEGACY_ROOTS = ("thumb_cache", "preview_cache", "overlay_cache")


def _safe(value: str) -> str:
    return _SAFE.sub("_", str(value or ""))


def project_cache_dir(project_name: str) -> Path:
    """The one cache folder for a project, inside the project's own folder."""
    return settings.PROJECTS_DIR / project_name / "cache"


def preview_path(project_name: str, image_md5: str) -> Path:
    """Display-resolution JPEG for one image, shared by every experiment."""
    return project_cache_dir(project_name) / "previews" / f"{_safe(image_md5)}.jpg"


def thumb_path(project_name: str, image_md5: str, size: int) -> Path:
    """Gallery thumbnail for one image at one size, shared by every experiment."""
    return project_cache_dir(project_name) / "thumbs" / str(int(size)) / f"{_safe(image_md5)}.jpg"


def overlay_dir(project_name: str, experiment_id: str) -> Path:
    """Cached GT overlays for one experiment. Experiment-specific by nature."""
    return project_cache_dir(project_name) / "overlays" / _safe(experiment_id)


def clear_experiment_overlays(project_name: str, experiment_id: str) -> None:
    """Drop one experiment's overlays, on deletion. Previews and thumbnails are
    deliberately left: they describe the images, not the experiment, and other
    experiments on the same images still need them."""
    import shutil
    d = overlay_dir(project_name, experiment_id)
    if d.exists():
        try:
            shutil.rmtree(d)
        except OSError:
            pass


def resolve_project_name(experiment) -> Optional[str]:
    """Folder name of the project an experiment belongs to."""
    return getattr(experiment, "project_name", None)


def relink_overlay_cache_ids(project_name: str, id_map: dict) -> int:
    """After an import gives every experiment a new id, rename its overlay
    cache folder to match, so cache that traveled inside the export keeps
    working instead of sitting on disk under an id nothing points to any more.

    Only overlays need this: previews and thumbnails are keyed by the image's
    md5, which import never changes, so they are already correctly linked.

    Best-effort and silent about individual failures. Nothing depends on this
    succeeding - a folder left unrenamed is simply an orphan, and the viewer
    rebuilds that one experiment's cache on first use exactly as it would for
    an experiment whose cache was never exported at all.
    """
    root = project_cache_dir(project_name) / "overlays"
    if not root.is_dir():
        return 0

    relinked = 0
    seen_old = set()
    for old_id, new_id in id_map.items():
        old_id, new_id = str(old_id), str(new_id)
        if old_id in seen_old or old_id == new_id:
            continue
        seen_old.add(old_id)

        old_dir = overlay_dir(project_name, old_id)
        new_dir = overlay_dir(project_name, new_id)
        if not old_dir.is_dir() or new_dir.exists():
            continue
        try:
            old_dir.rename(new_dir)
            relinked += 1
        except OSError:
            pass
    return relinked


def legacy_roots():
    """The old app-root cache folders, kept only so they can be removed."""
    return [settings.BASE_DIR / name for name in _LEGACY_ROOTS]
