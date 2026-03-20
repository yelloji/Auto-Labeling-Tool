"""
Tests for analytics endpoints.

The analytics router registers its own prefix in analytics.py:
    router = APIRouter(prefix="/api/analytics", ...)

So routes are:
    GET /api/analytics/dataset/{dataset_id}/class-distribution
    GET /api/analytics/dataset/{dataset_id}/split-analysis
    GET /api/analytics/dataset/{dataset_id}/imbalance-report
    GET /api/analytics/dataset/{dataset_id}/labeling-progress
    GET /api/analytics/project/{project_id}/label-distribution
"""

import io
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from PIL import Image as PILImage
from fastapi.testclient import TestClient

PROJECTS_BASE = "/api/v1/projects"
DATASETS_BASE = "/api/v1/datasets"
ANALYTICS_BASE = "/api/analytics"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_jpeg() -> io.BytesIO:
    buf = io.BytesIO()
    PILImage.new("RGB", (10, 10), color=(200, 100, 50)).save(buf, format="JPEG")
    buf.seek(0)
    return buf


def _create_project(client: TestClient, name: str = "Analytics Project") -> dict:
    resp = client.post(f"{PROJECTS_BASE}/", json={
        "name": name,
        "description": "",
        "project_type": "Object Detection",
        "confidence_threshold": 0.5,
        "iou_threshold": 0.45,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _create_dataset(client: TestClient, project_id, name: str = "Analytics DS") -> dict:
    resp = client.post(f"{DATASETS_BASE}/", json={
        "name": name,
        "description": "",
        "project_id": str(project_id),
        "auto_label_enabled": False,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _upload_image(client: TestClient, dataset_id: str) -> dict:
    buf = _make_jpeg()
    resp = client.post(
        f"{DATASETS_BASE}/{dataset_id}/upload",
        files=[("files", ("analytics_test.jpg", buf, "image/jpeg"))],
    )
    assert resp.status_code in (200, 201), resp.text
    data = resp.json()
    return data[0] if isinstance(data, list) else data.get("images", [data])[0]


# ---------------------------------------------------------------------------
# Label distribution (per project)
# ---------------------------------------------------------------------------

def test_project_label_distribution_returns_200(test_client: TestClient):
    """GET /api/analytics/project/{id}/label-distribution returns 200."""
    project = _create_project(test_client, "AnaLabelDist")
    resp = test_client.get(f"{ANALYTICS_BASE}/project/{project['id']}/label-distribution")
    assert resp.status_code == 200


def test_project_label_distribution_response_is_json(test_client: TestClient):
    """Label distribution response must be parseable JSON."""
    project = _create_project(test_client, "AnaLabelDistJSON")
    resp = test_client.get(f"{ANALYTICS_BASE}/project/{project['id']}/label-distribution")
    assert resp.status_code == 200
    # Just verifying it parses without exception
    _ = resp.json()


def test_project_label_distribution_nonexistent_project(test_client: TestClient):
    """Label distribution for a non-existent project should return 4xx, not 500."""
    resp = test_client.get(f"{ANALYTICS_BASE}/project/999999/label-distribution")
    assert resp.status_code in (404, 400, 422)


# ---------------------------------------------------------------------------
# Class distribution (per dataset)
# ---------------------------------------------------------------------------

def test_dataset_class_distribution_returns_200(test_client: TestClient):
    """GET /api/analytics/dataset/{id}/class-distribution returns 200."""
    project = _create_project(test_client, "AnaClassDist")
    ds = _create_dataset(test_client, project["id"], "AnaClassDistDS")
    _upload_image(test_client, ds["id"])

    resp = test_client.get(f"{ANALYTICS_BASE}/dataset/{ds['id']}/class-distribution")
    assert resp.status_code == 200


def test_dataset_class_distribution_response_is_json(test_client: TestClient):
    """Class distribution response must be valid JSON."""
    project = _create_project(test_client, "AnaClassDistJSON")
    ds = _create_dataset(test_client, project["id"], "AnaClassDistJSONDS")

    resp = test_client.get(f"{ANALYTICS_BASE}/dataset/{ds['id']}/class-distribution")
    assert resp.status_code == 200
    _ = resp.json()


# ---------------------------------------------------------------------------
# Split analysis (per dataset)
# ---------------------------------------------------------------------------

def test_dataset_split_analysis_returns_200(test_client: TestClient):
    """GET /api/analytics/dataset/{id}/split-analysis returns 200."""
    project = _create_project(test_client, "AnaSplit")
    ds = _create_dataset(test_client, project["id"], "AnaSplitDS")

    resp = test_client.get(f"{ANALYTICS_BASE}/dataset/{ds['id']}/split-analysis")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Labeling progress (per dataset)
# ---------------------------------------------------------------------------

def test_dataset_labeling_progress_returns_200(test_client: TestClient):
    """GET /api/analytics/dataset/{id}/labeling-progress returns 200."""
    project = _create_project(test_client, "AnaProgress")
    ds = _create_dataset(test_client, project["id"], "AnaProgressDS")

    resp = test_client.get(f"{ANALYTICS_BASE}/dataset/{ds['id']}/labeling-progress")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Imbalance report (per dataset)
# ---------------------------------------------------------------------------

def test_dataset_imbalance_report_returns_200(test_client: TestClient):
    """GET /api/analytics/dataset/{id}/imbalance-report returns 200."""
    project = _create_project(test_client, "AnaImbalance")
    ds = _create_dataset(test_client, project["id"], "AnaImbalanceDS")

    resp = test_client.get(f"{ANALYTICS_BASE}/dataset/{ds['id']}/imbalance-report")
    assert resp.status_code == 200
