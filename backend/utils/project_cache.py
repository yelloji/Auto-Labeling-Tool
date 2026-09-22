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


def legacy_roots():
    """The old app-root cache folders, kept only so they can be removed."""
    return [settings.BASE_DIR / name for name in _LEGACY_ROOTS]
