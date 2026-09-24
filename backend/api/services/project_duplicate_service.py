"""
Full project duplication, staying on this one machine.

Export/Import exists to move a project to a different app installation, which
is why it has to go through a zip: the destination might be a different
computer with no shared filesystem access. Duplicate never leaves this
machine, so it skips the zip entirely - it reads the source project's rows
straight from the live database and copies its folder directly, which is
faster and simpler for exactly the same result.

It reuses two pieces already built and tested for Import rather than writing
a second version of either:
  - _apply_project_tables_with_new_ids: gives every row a new id and rewrites
    every reference to the old ids and the old project name.
  - relink_overlay_cache_ids: points the cached GT overlays at the new
    experiment ids afterward, so the duplicate opens images at full speed
    immediately instead of rebuilding its cache on first use.

The source project is only ever read from and copied from. Nothing here
writes to it, deletes from it, or modifies it in any way - even if the
duplicate fails partway through, the source is completely unaffected.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from database.models import Project
from api.services.project_export_service import _collect_snapshot
from api.services.project_import_service import (
    _apply_project_tables_with_new_ids,
    _relink_cache_after_apply,
    _project_folder,
    _windows_long_path,
)


class ProjectDuplicateError(Exception):
    """Raised when a project cannot be duplicated."""


def _unique_copy_name(db: Session, source_name: str) -> str:
    """'<name> (Copy)', then '<name> (Copy 2)', '(Copy 3)', ... until one is
    free as both a project name and a project folder - either could already
    exist from an earlier duplicate of the same source."""
    candidate = f"{source_name} (Copy)"
    n = 2
    while db.query(Project).filter(Project.name == candidate).first() or _project_folder(candidate).exists():
        candidate = f"{source_name} (Copy {n})"
        n += 1
    return candidate


def _is_staging_path(relative: Path) -> bool:
    """Release .staging_* folders are temporary build folders, not project
    data - matches the same exclusion import already applies when extracting
    a zip, so a duplicate does not pick up half-built release output either."""
    return any(part.startswith(".staging_") for part in relative.parts)


def _copy_project_folder(source_dir: Path, target_dir: Path) -> int:
    """
    Copies the whole project folder one file at a time, the same way Import
    already extracts a zip - resolving each individual path with Windows
    long-path support, rather than trusting one bulk recursive copy to handle
    this project's genuinely deep folders correctly on its own.

    Every nested name - dataset, release, training session - is left exactly
    as it is in the source. Only the top-level project folder gets a new name.
    This matters: it is the same assumption the reused id-remapping logic
    already relies on, since it only ever rewrites the project-name portion of
    a stored path, never anything nested inside it. Keeping nested names
    identical is what makes the physical files and the freshly written
    database paths agree, by construction, rather than by two separate pieces
    of logic happening to compute the same string.
    """
    if target_dir.exists():
        raise ProjectDuplicateError(f"Destination folder already exists: {target_dir}")
    os.makedirs(_windows_long_path(target_dir), exist_ok=True)

    file_count = 0
    for root, _dirs, files in os.walk(source_dir):
        rel_root = Path(root).relative_to(source_dir)
        for filename in files:
            rel_path = rel_root / filename
            if _is_staging_path(rel_path):
                continue
            src_path = Path(root) / filename
            dst_path = target_dir / rel_path
            os.makedirs(_windows_long_path(dst_path.parent), exist_ok=True)
            shutil.copy2(_windows_long_path(src_path), _windows_long_path(dst_path))
            file_count += 1
    return file_count


def duplicate_project(db: Session, project_id: Any) -> Dict[str, Any]:
    """
    Create a full, independent copy of a project on this machine: every
    dataset, image, annotation, release, training session, experiment and
    model, each given a brand new id, with its own physical copy of every
    file. No zip involved - direct database reads and a direct folder copy.

    Read-only against the source throughout. If anything fails partway
    through, the new project's database rows are rolled back and its folder is
    removed; the source project is never touched either way.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ProjectDuplicateError(f"Project {project_id} not found")

    source_dir = _project_folder(project.name)
    if not source_dir.exists():
        raise ProjectDuplicateError(f"Source project folder does not exist: {source_dir}")

    target_project_name = _unique_copy_name(db, project.name)
    target_dir = _project_folder(target_project_name)

    # Read-only: builds an in-memory snapshot of the source project's rows,
    # the same collection Export already uses. Nothing here writes anything.
    snapshot = _collect_snapshot(db, project)
    tables = snapshot["tables"]

    final_project_dir: Optional[Path] = None
    try:
        _copy_project_folder(source_dir, target_dir)
        final_project_dir = target_dir

        result = _apply_project_tables_with_new_ids(db, tables, target_project_name)
        new_project, id_maps = result["project"], result["id_maps"]

        _relink_cache_after_apply(target_project_name, id_maps)

        return {
            "success": True,
            "project_id": new_project.id,
            "project_name": new_project.name,
            "project_folder": str(final_project_dir),
            "counts": snapshot.get("counts", {}),
        }
    except Exception:
        if final_project_dir and final_project_dir.exists():
            shutil.rmtree(final_project_dir, ignore_errors=True)
        raise
