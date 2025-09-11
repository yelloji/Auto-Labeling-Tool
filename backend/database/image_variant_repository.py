"""Repository module for image_variants table operations (hardened)"""

import json
from pathlib import PurePosixPath
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import text
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()


def _normalize_rel_path(rel_path: str) -> str:
    """
    Ensure the stored path is a safe, normalized *relative* POSIX path.
    - strips leading slashes
    - collapses '.' and '..'
    - forbids path traversal outside root
    """
    if not isinstance(rel_path, str) or not rel_path.strip():
        raise ValueError("Empty path")

    # force posix semantics for DB consistency across OSes
    p = PurePosixPath(rel_path.lstrip("/"))
    # collapse .. and . (PurePosixPath().joinpath(...) is already normalized)
    # ensure no parent traversal remains
    parts = []
    for part in p.parts:
        if part in ("", "."):
            continue
        if part == "..":
            if parts:
                parts.pop()
            # If empty, ignore going above root
            continue
        parts.append(part)
    safe = PurePosixPath(*parts).as_posix()
    if not safe:
        raise ValueError("Invalid relative path after normalization")
    return safe


def _validate_affine_json(affine_json: str) -> None:
    """
    Require a flattened 3x3 matrix (9 numeric values).
    Raises ValueError if invalid.
    """
    try:
        data = json.loads(affine_json)
    except Exception:
        raise ValueError("affine_json must be valid JSON")

    if not isinstance(data, list) or len(data) != 9:
        raise ValueError("affine_json must be a list of 9 numbers")

    for i, v in enumerate(data):
        try:
            float(v)
        except Exception:
            raise ValueError(f"affine_json element at index {i} is not numeric")


class ImageVariantRepository:
    """Repository for image_variants table operations"""

    @staticmethod
    def insert_image_variant(
        db: Session,
        parent_image_id: int,
        rel_path: str,
        width: int,
        height: int,
        affine_json: str,
    ) -> int:
        """
        Insert a new image variant and return its ID.

        Notes:
        - Validates rel_path, width/height and affine_json (must be 9 numbers).
        - Stores *relative* POSIX path in DB.
        """
        # --- validations ---
        if not isinstance(parent_image_id, int):
            raise ValueError("parent_image_id must be int")

        if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
            raise ValueError(f"width/height must be positive integers (got {width}x{height})")

        safe_path = _normalize_rel_path(rel_path)
        _validate_affine_json(affine_json)

        logger.info(
            "app.database",
            "Creating new image variant",
            "image_variant_creation",
            {
                "parent_image_id": parent_image_id,
                "rel_path": safe_path,
                "width": width,
                "height": height,
            },
        )

        try:
            # PostgreSQL supports RETURNING; SQLite does not
            if "sqlite" in db.bind.dialect.name:
                db.execute(
                    text(
                        """
                        INSERT INTO image_variants
                          (parent_image_id, path, width, height, affine_json)
                        VALUES
                          (:parent_image_id, :path, :width, :height, :affine_json)
                        """
                    ),
                    {
                        "parent_image_id": parent_image_id,
                        "path": safe_path,
                        "width": width,
                        "height": height,
                        "affine_json": affine_json,
                    },
                )
                db.flush()
                variant_id = db.execute(text("SELECT last_insert_rowid()")).scalar()
            else:
                variant_id = db.execute(
                    text(
                        """
                        INSERT INTO image_variants
                          (parent_image_id, path, width, height, affine_json)
                        VALUES
                          (:parent_image_id, :path, :width, :height, :affine_json)
                        RETURNING id
                        """
                    ),
                    {
                        "parent_image_id": parent_image_id,
                        "path": safe_path,
                        "width": width,
                        "height": height,
                        "affine_json": affine_json,
                    },
                ).scalar()

            db.commit()

            logger.info(
                "app.database",
                "Image variant created successfully",
                "image_variant_creation_complete",
                {"variant_id": variant_id, "parent_image_id": parent_image_id},
            )
            return int(variant_id)

        except Exception as e:
            db.rollback()
            logger.error(
                "errors.system",
                f"Image variant creation failed: {str(e)}",
                "image_variant_creation_error",
                {
                    "parent_image_id": parent_image_id,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
            )
            raise

    @staticmethod
    def update_image_variant_path(db: Session, variant_id: int, rel_path: str) -> None:
        """Update the stored relative path for an existing variant."""
        if not isinstance(variant_id, int):
            raise ValueError("variant_id must be int")
        safe_path = _normalize_rel_path(rel_path)

        logger.info(
            "app.database",
            "Updating image variant path",
            "image_variant_path_update",
            {"variant_id": variant_id, "rel_path": safe_path},
        )

        try:
            res = db.execute(
                text("UPDATE image_variants SET path = :path WHERE id = :id"),
                {"id": variant_id, "path": safe_path},
            )
            if hasattr(res, "rowcount") and res.rowcount == 0:
                raise ValueError(f"Variant id {variant_id} not found")
            db.commit()

            logger.info(
                "app.database",
                "Image variant path updated successfully",
                "image_variant_path_update_complete",
                {"variant_id": variant_id, "rel_path": safe_path},
            )

        except Exception as e:
            db.rollback()
            logger.error(
                "errors.system",
                f"Image variant path update failed: {str(e)}",
                "image_variant_path_update_error",
                {
                    "variant_id": variant_id,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
            )
            raise

    # -------- optional helpers (use if you need them) --------
    @staticmethod
    def get_by_id(db: Session, variant_id: int) -> Optional[Tuple]:
        """Fetch a single row by id. Returns a tuple or None."""
        row = db.execute(
            text(
                "SELECT id, parent_image_id, path, width, height, affine_json, created_at "
                "FROM image_variants WHERE id = :id"
            ),
            {"id": variant_id},
        ).first()
        return row

    @staticmethod
    def list_by_parent(db: Session, parent_image_id: int) -> List[Tuple]:
        """List variants for a parent image id."""
        rows = db.execute(
            text(
                "SELECT id, parent_image_id, path, width, height, affine_json, created_at "
                "FROM image_variants WHERE parent_image_id = :pid ORDER BY id DESC"
            ),
            {"pid": parent_image_id},
        ).fetchall()
        return rows
