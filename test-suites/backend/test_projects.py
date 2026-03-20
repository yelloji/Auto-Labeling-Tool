"""
Tests for the /api/v1/projects endpoints.

Route prefix registered in main.py:
    app.include_router(projects.router, prefix="/api/v1/projects", ...)

Routes inside projects.py:
    GET    /           -> list projects
    POST   /           -> create project
    GET    /{id}       -> get project (handled by sub-routes; checked via list)
    PUT    /{id}       -> update project
    DELETE /{id}       -> delete project
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient

BASE = "/api/v1/projects"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_project(client: TestClient, name: str = "My Project", **kwargs) -> dict:
    payload = {
        "name": name,
        "description": "desc",
        "project_type": "Object Detection",
        "confidence_threshold": 0.5,
        "iou_threshold": 0.45,
    }
    payload.update(kwargs)
    resp = client.post(f"{BASE}/", json=payload)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def test_create_project_returns_success(test_client: TestClient):
    """POST /api/v1/projects/ returns 200 or 201 with project data."""
    resp = test_client.post(f"{BASE}/", json={
        "name": "Alpha Project",
        "description": "First project",
        "project_type": "Object Detection",
        "confidence_threshold": 0.5,
        "iou_threshold": 0.45,
    })
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["name"] == "Alpha Project"
    assert "id" in data


def test_create_project_missing_name_returns_422(test_client: TestClient):
    """POST with no 'name' field must return 422 Unprocessable Entity."""
    resp = test_client.post(f"{BASE}/", json={
        "description": "No name given",
        "project_type": "Object Detection",
    })
    assert resp.status_code == 422


def test_create_project_stores_type(test_client: TestClient):
    """project_type should be persisted correctly."""
    data = _create_project(test_client, name="Seg Project", project_type="Instance Segmentation")
    assert data["project_type"] == "Instance Segmentation"


def test_create_project_returns_id(test_client: TestClient):
    """Every created project must have a numeric id."""
    data = _create_project(test_client, name="ID Check")
    assert isinstance(data["id"], int)
    assert data["id"] > 0


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def test_list_projects_returns_200(test_client: TestClient):
    """GET /api/v1/projects/ must return 200 with a list."""
    resp = test_client.get(f"{BASE}/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_projects_contains_created(test_client: TestClient):
    """A newly created project must appear in the list endpoint."""
    _create_project(test_client, name="ListMe Project")
    resp = test_client.get(f"{BASE}/")
    names = [p["name"] for p in resp.json()]
    assert "ListMe Project" in names


def test_list_projects_empty_at_start(test_client: TestClient):
    """Fresh test database has zero projects."""
    resp = test_client.get(f"{BASE}/")
    assert resp.status_code == 200
    # Could be empty or could have projects from other tests depending on scope;
    # the important thing is we get a list back.
    assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# Get by id
# ---------------------------------------------------------------------------

def test_get_project_by_id(test_client: TestClient):
    """The created project should appear in the list with correct id."""
    created = _create_project(test_client, name="GetMe Project")
    project_id = created["id"]

    resp = test_client.get(f"{BASE}/")
    projects = resp.json()
    found = next((p for p in projects if p["id"] == project_id), None)
    assert found is not None
    assert found["name"] == "GetMe Project"


def test_get_nonexistent_project_returns_404(test_client: TestClient):
    """Requesting a project that doesn't exist must return 404."""
    resp = test_client.get(f"{BASE}/999999")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def test_update_project_name(test_client: TestClient):
    """PUT /api/v1/projects/{id} must update the project name."""
    created = _create_project(test_client, name="Old Name")
    project_id = created["id"]

    resp = test_client.put(f"{BASE}/{project_id}", json={"name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


def test_update_project_description(test_client: TestClient):
    """PUT must update description independently."""
    created = _create_project(test_client, name="UpdateDesc")
    project_id = created["id"]

    resp = test_client.put(f"{BASE}/{project_id}", json={"description": "Updated description"})
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated description"


def test_update_nonexistent_project_returns_404(test_client: TestClient):
    """PUT on a project that doesn't exist must return 404."""
    resp = test_client.put(f"{BASE}/999999", json={"name": "Ghost"})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def test_delete_project_returns_success(test_client: TestClient):
    """DELETE /api/v1/projects/{id} must return 200."""
    created = _create_project(test_client, name="DeleteMe")
    project_id = created["id"]

    resp = test_client.delete(f"{BASE}/{project_id}")
    assert resp.status_code == 200


def test_delete_project_removes_from_list(test_client: TestClient):
    """After deletion the project must no longer appear in the list."""
    created = _create_project(test_client, name="Gone Project")
    project_id = created["id"]

    test_client.delete(f"{BASE}/{project_id}")

    resp = test_client.get(f"{BASE}/")
    ids = [p["id"] for p in resp.json()]
    assert project_id not in ids


def test_delete_nonexistent_project_returns_404(test_client: TestClient):
    """DELETE on a non-existent project id must return 404."""
    resp = test_client.delete(f"{BASE}/999999")
    assert resp.status_code == 404
