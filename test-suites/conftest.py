"""
Shared test fixtures for the Auto-Labeling-Tool test suite.

Uses an in-memory SQLite database so tests never touch the production database.db.
The FastAPI dependency `get_db` is overridden for every request so every test
gets a clean, isolated session.
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
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# In-memory SQLite engine — one per test *session* so table creation is fast,
# but each test function gets its own transaction that is rolled back.
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
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

from database.database import get_db  # noqa: E402 — must come after sys.path patch

from main import app  # noqa: E402

app.dependency_overrides[get_db] = override_get_db


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
    # The endpoint may return a list of uploaded images or a dict with an
    # "images" key — handle both shapes.
    if isinstance(data, list):
        return data[0]
    if "images" in data:
        return data["images"][0]
    return data
