"""
conftest.py — Shared test infrastructure for ALL backend and database tests.

HOW THE TEST DATABASE WORKS
----------------------------
Tests never touch the real database.db file on disk.
Instead we create a fresh SQLite database IN MEMORY for every test run.

Why StaticPool?
  SQLite ":memory:" databases are connection-specific by default.
  If two different connections open the same ":memory:" URL they each
  get a blank, separate database.  StaticPool forces every connection
  to share the SAME underlying SQLite connection, so all sessions see
  the same tables and rows.

Why override_get_db?
  The FastAPI app injects a database session into every route via the
  get_db dependency.  We replace get_db with override_get_db so that
  every API request during a test uses our in-memory session — not the
  real production database.

Why patch file_handler.SessionLocal?
  Some backend modules (e.g. core/file_handler.py) open their own
  database session directly via SessionLocal() instead of using FastAPI
  dependency injection.  We patch that reference so those calls also
  land in the in-memory test database.

Why DB_EXPORT_ENABLE_AUTO_EXPORT=0?
  The app starts a background export thread that writes to disk and
  uses emoji in print() calls.  On Windows the terminal encoding
  (cp1252) cannot handle emoji, which causes a fatal crash at pytest
  shutdown.  Setting this env var disables the thread entirely during
  tests.

FIXTURES PROVIDED
-----------------
  db_session    — raw SQLAlchemy session, rolled back after each test
  test_client   — FastAPI TestClient, uses in-memory DB, no server needed
  sample_project — a project created via the API, returned as JSON dict
  sample_dataset — a dataset inside sample_project, returned as JSON dict
  sample_image  — a 10x10 JPEG uploaded to sample_dataset, returned as JSON dict

HOW TO RUN
----------
  cd test-suites
  python run_all.py --no-ui          # run all backend + DB suites
  pytest backend/test_projects.py -v # run one suite directly
"""

import sys
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Make sure the backend package is importable without installing it.
# All route modules do `from database.database import get_db`, so `backend/`
# must be on sys.path just like it is when uvicorn launches main.py.
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# In-memory SQLite engine — StaticPool forces ALL connections to share the
# same underlying SQLite connection so the in-memory database (and its tables)
# is visible to every session, including the ones created by override_get_db().
# Without StaticPool each new connection gets a blank empty database.
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_all_tables():
    """Create all ORM tables in the in-memory engine."""
    from database.base import Base
    # Import every model so SQLAlchemy registers the table metadata.
    from database.models import (
        Project, Dataset, Image, Annotation,
        AutoLabelJob, Label, DatasetSplit, LabelAnalytics,
        Release, ImageTransformation, ImageVariant,
        AiModel, TrainingSession, DevModeSetting,
        ModelExperiment, HumanVerification,
    )
    Base.metadata.create_all(bind=engine)


# Create tables once when the module is loaded.
create_all_tables()


# ---------------------------------------------------------------------------
# Dependency override: replace the real get_db with a test version that uses
# the in-memory engine.
# ---------------------------------------------------------------------------
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Import the FastAPI app and patch the dependency BEFORE the TestClient is
# constructed.  Importing main.py triggers module-level code (middleware setup,
# router registration, static-file mounts).  We guard against side effects by
# setting environment variables that disable optional startup work.
# ---------------------------------------------------------------------------
os.environ.setdefault("GEVIS_EXE_MODE", "0")
os.environ.setdefault("DB_EXPORT_ENABLE_AUTO_EXPORT", "0")   # disable background export threads in tests

from database.database import get_db  # noqa: E402 — must come after sys.path patch

from main import app  # noqa: E402

app.dependency_overrides[get_db] = override_get_db

# ---------------------------------------------------------------------------
# Patch modules that create their own SessionLocal() bypassing FastAPI DI.
# Without this, file_handler and any other direct SessionLocal callers would
# open a connection to the real production database during tests.
# ---------------------------------------------------------------------------
import core.file_handler as _file_handler  # noqa: E402
_file_handler.SessionLocal = TestingSessionLocal


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def db_session():
    """
    Yield a fresh SQLAlchemy session for every test function.
    All changes are rolled back after the test so tests are isolated.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def test_client():
    """
    FastAPI TestClient wired to the in-memory database.
    The startup event (init_db) is intentionally skipped because we already
    created the tables above; we don't want it to reach out to the real DB.
    """
    with TestClient(app, raise_server_exceptions=True) as client:
        yield client


@pytest.fixture(scope="function")
def sample_project(test_client):
    """Create a project via the API and return the response JSON."""
    resp = test_client.post("/api/v1/projects/", json={
        "name": "Test Project",
        "description": "A project created for testing",
        "project_type": "Object Detection",
        "confidence_threshold": 0.5,
        "iou_threshold": 0.45,
    })
    assert resp.status_code in (200, 201), f"Failed to create sample project: {resp.text}"
    return resp.json()


@pytest.fixture(scope="function")
def sample_dataset(test_client, sample_project):
    """Create a dataset inside sample_project and return the response JSON."""
    resp = test_client.post("/api/v1/datasets/", json={
        "name": "Test Dataset",
        "description": "A dataset created for testing",
        "project_id": str(sample_project["id"]),
        "auto_label_enabled": False,
    })
    assert resp.status_code in (200, 201), f"Failed to create sample dataset: {resp.text}"
    return resp.json()


@pytest.fixture(scope="function")
def sample_image(test_client, sample_dataset):
    """
    Upload a minimal 1×1 JPEG to the sample dataset and return the image dict.
    The JPEG bytes are constructed in-memory — no file on disk required.
    """
    import io
    from PIL import Image as PILImage

    buf = io.BytesIO()
    img = PILImage.new("RGB", (10, 10), color=(255, 0, 0))
    img.save(buf, format="JPEG")
    buf.seek(0)

    resp = test_client.post(
        f"/api/v1/datasets/{sample_dataset['id']}/upload",
        files=[("files", ("test.jpg", buf, "image/jpeg"))],
    )
    assert resp.status_code in (200, 201), f"Failed to upload sample image: {resp.text}"
    data = resp.json()
    # Handle all response shapes from the upload endpoint.
    if isinstance(data, list):
        return data[0]
    if "uploaded_images" in data:
        return data["uploaded_images"][0]
    if "images" in data:
        return data["images"][0]
    return data
