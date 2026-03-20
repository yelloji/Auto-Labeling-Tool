"""
Tests for the /api/v1/datasets endpoints.

Route prefix registered in main.py:
    app.include_router(datasets.router, prefix="/api/v1/datasets", ...)

Key endpoints:
    GET    /api/v1/datasets/              -> list datasets (optional ?project_id=)
    POST   /api/v1/datasets/              -> create dataset (JSON body)
    GET    /api/v1/datasets/{id}          -> get one dataset
    PUT    /api/v1/datasets/{id}          -> rename / update dataset
    DELETE /api/v1/datasets/{id}          -> delete dataset
    PUT    /api/v1/datasets/images/{id}/split-section  -> update split stage
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient

DATASETS_BASE = "/api/v1/datasets"
PROJECTS_BASE = "/api/v1/projects"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_project(client: TestClient, name: str = "DS Test Project") -> dict:
    resp = client.post(f"{PROJECTS_BASE}/", json={
        "name": name,
        "description": "",
        "project_type": "Object Detection",
        "confidence_threshold": 0.5,
        "iou_threshold": 0.45,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _create_dataset(client: TestClient, project_id, name: str = "My Dataset") -> dict:
    resp = client.post(f"{DATASETS_BASE}/", json={
        "name": name,
        "description": "test dataset",
        "project_id": str(project_id),
        "auto_label_enabled": False,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def test_create_dataset_returns_success(test_client: TestClient):
    """POST /api/v1/datasets/ creates a dataset and returns 200/201."""
    project = _create_project(test_client)
    resp = test_client.post(f"{DATASETS_BASE}/", json={
        "name": "New Dataset",
        "description": "fresh dataset",
        "project_id": str(project["id"]),
        "auto_label_enabled": False,
    })
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "id" in data
    assert data["name"] == "New Dataset"


def test_create_dataset_stores_project_id(test_client: TestClient):
    """Dataset must reference the correct project_id."""
    project = _create_project(test_client, name="ProjForDS")
    ds = _create_dataset(test_client, project["id"], name="Child DS")
    assert str(ds["project_id"]) == str(project["id"])


def test_create_dataset_missing_project_returns_error(test_client: TestClient):
    """Creating a dataset for a non-existent project must fail (404 or 422)."""
    resp = test_client.post(f"{DATASETS_BASE}/", json={
        "name": "Orphan Dataset",
        "description": "",
        "project_id": "999999",
        "auto_label_enabled": False,
    })
    assert resp.status_code in (400, 404, 422, 500)


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def test_list_datasets_returns_200(test_client: TestClient):
    """GET /api/v1/datasets/ returns 200 with a list."""
    resp = test_client.get(f"{DATASETS_BASE}/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_datasets_filtered_by_project(test_client: TestClient):
    """?project_id= filter must return only that project's datasets."""
    project = _create_project(test_client, name="FilterProj")
    _create_dataset(test_client, project["id"], name="FilterDS")

    resp = test_client.get(f"{DATASETS_BASE}/", params={"project_id": project["id"]})
    assert resp.status_code == 200
    datasets = resp.json()
    assert all(str(d["project_id"]) == str(project["id"]) for d in datasets)
    names = [d["name"] for d in datasets]
    assert "FilterDS" in names


def test_list_datasets_contains_created(test_client: TestClient):
    """A newly created dataset appears in the full list."""
    project = _create_project(test_client, name="ListDSProj")
    _create_dataset(test_client, project["id"], name="ShouldAppear")

    resp = test_client.get(f"{DATASETS_BASE}/")
    names = [d["name"] for d in resp.json()]
    assert "ShouldAppear" in names


# ---------------------------------------------------------------------------
# Get one
# ---------------------------------------------------------------------------

def test_get_dataset_by_id(test_client: TestClient):
    """GET /api/v1/datasets/{id} returns 200 and the correct dataset."""
    project = _create_project(test_client, name="GetDSProj")
    ds = _create_dataset(test_client, project["id"], name="GetDS")

    resp = test_client.get(f"{DATASETS_BASE}/{ds['id']}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "GetDS"


def test_get_nonexistent_dataset_returns_404(test_client: TestClient):
    """GET /api/v1/datasets/nonexistent-id returns 404."""
    resp = test_client.get(f"{DATASETS_BASE}/nonexistent-dataset-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def test_update_dataset_name(test_client: TestClient):
    """PUT /api/v1/datasets/{id} can rename a dataset."""
    project = _create_project(test_client, name="UpdateDSProj")
    ds = _create_dataset(test_client, project["id"], name="OldName")

    resp = test_client.put(f"{DATASETS_BASE}/{ds['id']}", json={"name": "NewName"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "NewName"


def test_update_nonexistent_dataset_returns_404(test_client: TestClient):
    """PUT on a non-existent dataset must return 404."""
    resp = test_client.put(f"{DATASETS_BASE}/no-such-dataset", json={"name": "X"})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def test_delete_dataset_returns_success(test_client: TestClient):
    """DELETE /api/v1/datasets/{id} returns 200."""
    project = _create_project(test_client, name="DelDSProj")
    ds = _create_dataset(test_client, project["id"], name="ToDelete")

    resp = test_client.delete(f"{DATASETS_BASE}/{ds['id']}")
    assert resp.status_code == 200


def test_delete_dataset_removes_from_list(test_client: TestClient):
    """After deletion the dataset must not appear in the project list."""
    project = _create_project(test_client, name="DelDSProj2")
    ds = _create_dataset(test_client, project["id"], name="GoneDS")
    ds_id = ds["id"]

    test_client.delete(f"{DATASETS_BASE}/{ds_id}")

    resp = test_client.get(f"{DATASETS_BASE}/", params={"project_id": project["id"]})
    ids = [d["id"] for d in resp.json()]
    assert ds_id not in ids


def test_delete_nonexistent_dataset_returns_404(test_client: TestClient):
    """DELETE on a non-existent id must return 404."""
    resp = test_client.delete(f"{DATASETS_BASE}/no-such-id")
    assert resp.status_code == 404
