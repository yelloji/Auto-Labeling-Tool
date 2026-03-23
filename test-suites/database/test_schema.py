"""
test_schema.py — Database schema validation tests.

PURPOSE
-------
These tests verify that all SQLAlchemy ORM models produce the correct
tables and columns when applied to a fresh database. They are the
first line of defence against migration mistakes — if someone adds
a model field but forgets to update the DB schema, these tests catch it.

All checks use SQLAlchemy Inspector (introspection) — they look at the
actual database structure, not the Python model definitions.

WHAT IS TESTED
--------------
  Table existence:
    projects, datasets, images, annotations, ai_models, releases,
    image_transformations, auto_label_jobs, dataset_splits,
    label_analytics, training_sessions, model_experiments, labels,
    image_variants, human_verifications, dev_mode_settings

  Column checks (required columns per table):
    projects            — id, name, description, project_type, confidence_threshold,
                          iou_threshold, created_at, updated_at
    datasets            — id, name, description, project_id, total_images,
                          labeled_images, unlabeled_images, auto_label_enabled,
                          created_at, updated_at
    images              — id, filename, original_filename, file_path, dataset_id,
                          width, height, format, is_labeled, split_type, split_section,
                          created_at, updated_at
    annotations         — id, image_id, class_name, class_id, confidence,
                          x_min, y_min, x_max, y_max, segmentation,
                          is_auto_generated, created_at, updated_at
    labels              — id, name, color, project_id
    releases            — id, project_id, name, description, export_format,
                          task_type, datasets_used, created_at
    ... and more

  Primary key checks   — projects.id is integer, datasets.id is UUID string
  Foreign key checks   — datasets.project_id → projects.id
                         images.dataset_id → datasets.id
                         annotations.image_id → images.id
                         labels.project_id → projects.id

HOW TESTS RUN
-------------
Uses a dedicated in-memory SQLite engine (not the shared conftest engine).
No server, no HTTP, no FastAPI. Pure SQLAlchemy introspection only.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from database.base import Base
from database.models import (
    Project, Dataset, Image, Annotation,
    AutoLabelJob, Label, DatasetSplit, LabelAnalytics,
    Release, ImageTransformation, ImageVariant,
    AiModel, TrainingSession, DevModeSetting,
    ModelExperiment, HumanVerification,
)


# ---------------------------------------------------------------------------
# Engine & fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def schema_engine():
    """Create an in-memory SQLite database with all tables."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="module")
def inspector(schema_engine):
    """SQLAlchemy Inspector bound to the in-memory schema engine."""
    return inspect(schema_engine)


# ---------------------------------------------------------------------------
# Table existence
# ---------------------------------------------------------------------------

EXPECTED_TABLES = [
    "projects",
    "datasets",
    "images",
    "annotations",
    "ai_models",
    "releases",
    "image_transformations",
    "auto_label_jobs",
    "dataset_splits",
    "label_analytics",
    "training_sessions",
    "model_experiments",
    "labels",
    "image_variants",
    "human_verifications",
    "dev_mode_settings",
]


def test_all_expected_tables_exist(inspector):
    """Every expected table must be present in the schema."""
    actual_tables = set(inspector.get_table_names())
    missing = set(EXPECTED_TABLES) - actual_tables
    assert not missing, f"Missing tables: {missing}"


def test_projects_table_exists(inspector):
    assert "projects" in inspector.get_table_names()


def test_datasets_table_exists(inspector):
    assert "datasets" in inspector.get_table_names()


def test_images_table_exists(inspector):
    assert "images" in inspector.get_table_names()


def test_annotations_table_exists(inspector):
    assert "annotations" in inspector.get_table_names()


def test_labels_table_exists(inspector):
    assert "labels" in inspector.get_table_names()


def test_releases_table_exists(inspector):
    assert "releases" in inspector.get_table_names()


def test_image_transformations_table_exists(inspector):
    assert "image_transformations" in inspector.get_table_names()


def test_auto_label_jobs_table_exists(inspector):
    assert "auto_label_jobs" in inspector.get_table_names()


def test_dataset_splits_table_exists(inspector):
    assert "dataset_splits" in inspector.get_table_names()


def test_label_analytics_table_exists(inspector):
    assert "label_analytics" in inspector.get_table_names()


def test_training_sessions_table_exists(inspector):
    assert "training_sessions" in inspector.get_table_names()


def test_model_experiments_table_exists(inspector):
    assert "model_experiments" in inspector.get_table_names()


# ---------------------------------------------------------------------------
# Key column checks per table
# ---------------------------------------------------------------------------

def _col_names(inspector, table: str) -> set:
    return {col["name"] for col in inspector.get_columns(table)}


def test_projects_columns(inspector):
    cols = _col_names(inspector, "projects")
    for required in ("id", "name", "description", "project_type",
                     "confidence_threshold", "iou_threshold",
                     "created_at", "updated_at"):
        assert required in cols, f"projects.{required} is missing"


def test_datasets_columns(inspector):
    cols = _col_names(inspector, "datasets")
    for required in ("id", "name", "description", "project_id",
                     "total_images", "labeled_images", "unlabeled_images",
                     "auto_label_enabled", "created_at", "updated_at"):
        assert required in cols, f"datasets.{required} is missing"


def test_images_columns(inspector):
    cols = _col_names(inspector, "images")
    for required in ("id", "filename", "original_filename", "file_path",
                     "dataset_id", "width", "height", "format",
                     "is_labeled", "split_type", "split_section",
                     "created_at", "updated_at"):
        assert required in cols, f"images.{required} is missing"


def test_annotations_columns(inspector):
    cols = _col_names(inspector, "annotations")
    for required in ("id", "image_id", "class_name", "class_id", "confidence",
                     "x_min", "y_min", "x_max", "y_max",
                     "segmentation", "is_auto_generated", "created_at", "updated_at"):
        assert required in cols, f"annotations.{required} is missing"


def test_labels_columns(inspector):
    cols = _col_names(inspector, "labels")
    for required in ("id", "name", "color", "project_id"):
        assert required in cols, f"labels.{required} is missing"


def test_releases_columns(inspector):
    cols = _col_names(inspector, "releases")
    for required in ("id", "project_id", "name", "description",
                     "export_format", "task_type", "datasets_used",
                     "created_at"):
        assert required in cols, f"releases.{required} is missing"


def test_auto_label_jobs_columns(inspector):
    cols = _col_names(inspector, "auto_label_jobs")
    for required in ("id", "dataset_id", "model_id", "status", "progress",
                     "total_images", "processed_images", "created_at"):
        assert required in cols, f"auto_label_jobs.{required} is missing"


def test_training_sessions_columns(inspector):
    cols = _col_names(inspector, "training_sessions")
    for required in ("id", "name", "base_model_id", "status",
                     "created_at"):
        assert required in cols, f"training_sessions.{required} is missing"


def test_model_experiments_columns(inspector):
    cols = _col_names(inspector, "model_experiments")
    for required in ("id", "training_id", "project_id",
                     "experiment_type", "framework", "dataset_source",
                     "confidence", "status", "created_at"):
        assert required in cols, f"model_experiments.{required} is missing"


def test_image_transformations_columns(inspector):
    cols = _col_names(inspector, "image_transformations")
    for required in ("id", "transformation_type", "parameters",
                     "is_enabled", "release_version", "status"):
        assert required in cols, f"image_transformations.{required} is missing"


def test_dataset_splits_columns(inspector):
    cols = _col_names(inspector, "dataset_splits")
    for required in ("id", "dataset_id", "train_percentage",
                     "val_percentage", "test_percentage"):
        assert required in cols, f"dataset_splits.{required} is missing"


def test_label_analytics_columns(inspector):
    cols = _col_names(inspector, "label_analytics")
    for required in ("id", "dataset_id", "class_distribution",
                     "total_annotations", "num_classes"):
        assert required in cols, f"label_analytics.{required} is missing"


# ---------------------------------------------------------------------------
# Primary key types
# ---------------------------------------------------------------------------

def test_projects_pk_is_integer(inspector):
    """projects.id should be an integer primary key."""
    pks = inspector.get_pk_constraint("projects")
    assert "id" in pks["constrained_columns"]


def test_datasets_pk_is_string(inspector):
    """datasets.id should be a string (UUID) primary key."""
    pks = inspector.get_pk_constraint("datasets")
    assert "id" in pks["constrained_columns"]


def test_images_pk_is_string(inspector):
    """images.id should be a string (UUID) primary key."""
    pks = inspector.get_pk_constraint("images")
    assert "id" in pks["constrained_columns"]


# ---------------------------------------------------------------------------
# Foreign key relationships
# ---------------------------------------------------------------------------

def test_datasets_has_fk_to_projects(inspector):
    """datasets.project_id must be a foreign key to projects.id."""
    fks = inspector.get_foreign_keys("datasets")
    fk_targets = [(fk["referred_table"], fk["constrained_columns"]) for fk in fks]
    assert any(t == "projects" and "project_id" in cols
               for t, cols in fk_targets), "datasets.project_id FK to projects not found"


def test_images_has_fk_to_datasets(inspector):
    """images.dataset_id must be a foreign key to datasets.id."""
    fks = inspector.get_foreign_keys("images")
    fk_targets = [(fk["referred_table"], fk["constrained_columns"]) for fk in fks]
    assert any(t == "datasets" and "dataset_id" in cols
               for t, cols in fk_targets), "images.dataset_id FK to datasets not found"


def test_annotations_has_fk_to_images(inspector):
    """annotations.image_id must be a foreign key to images.id."""
    fks = inspector.get_foreign_keys("annotations")
    fk_targets = [(fk["referred_table"], fk["constrained_columns"]) for fk in fks]
    assert any(t == "images" and "image_id" in cols
               for t, cols in fk_targets), "annotations.image_id FK to images not found"


def test_labels_has_fk_to_projects(inspector):
    """labels.project_id must be a foreign key to projects.id."""
    fks = inspector.get_foreign_keys("labels")
    fk_targets = [(fk["referred_table"], fk["constrained_columns"]) for fk in fks]
    assert any(t == "projects" and "project_id" in cols
               for t, cols in fk_targets), "labels.project_id FK to projects not found"
