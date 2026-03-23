"""
test_labels.py — Tests for the Labels API (/api/v1/projects/{id}/labels).

PURPOSE
-------
Labels are the class names (e.g. "cat", "dog", "car") that annotations
are assigned to. Each label has a name and a colour (hex string).
Labels belong to a project — not a dataset — so they are shared across
all datasets in the same project.

ROUTES TESTED
-------------
  GET    /api/v1/projects/{project_id}/labels                  list all labels for a project
  POST   /api/v1/projects/{project_id}/labels                  create a new label
  PUT    /api/v1/projects/{project_id}/labels/{label_id}       update label name or colour
  DELETE /api/v1/projects/{project_id}/labels/{label_id}       delete a label

LABEL PAYLOAD FORMAT
--------------------
  {
    "name":  "cat",      # class name shown in the annotation tool
    "color": "#FF0000"   # hex colour displayed on the bounding box
  }

KEY BEHAVIORS VERIFIED
----------------------
  - Creating a label with valid name + color returns 200/201
  - Missing name returns 400 (required field)
  - Missing color returns 400 (required field)
  - Duplicate label name in the same project returns an error
  - The reserved label name "null" is rejected (it's used internally)
  - GET returns a list containing the created label
  - GET on a non-existent project returns 404
  - PUT updates the label name and color correctly
  - PUT on a non-existent label returns 404
  - DELETE removes the label from the list
  - DELETE on a non-existent label returns 404

HOW TESTS RUN
-------------
No server needed. Uses FastAPI TestClient + in-memory SQLite.
Each test creates its own project so label lists start empty.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient

PROJECTS_BASE = "/api/v1/projects"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_project(client: TestClient, name: str = "Label Test Project") -> dict:
    resp = client.post(f"{PROJECTS_BASE}/", json={
        "name": name,
        "description": "",
        "project_type": "Object Detection",
        "confidence_threshold": 0.5,
        "iou_threshold": 0.45,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _create_label(client: TestClient, project_id: int,
                  name: str = "car", color: str = "#ff0000") -> dict:
    resp = client.post(
        f"{PROJECTS_BASE}/{project_id}/labels",
        json={"name": name, "color": color},
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def test_create_label_returns_success(test_client: TestClient):
    """POST /api/v1/projects/{id}/labels returns 200/201 with label data."""
    project = _create_project(test_client, "LabelCreate")
    resp = test_client.post(
        f"{PROJECTS_BASE}/{project['id']}/labels",
        json={"name": "truck", "color": "#00ff00"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "id" in data
    assert data["name"] == "truck"


def test_create_label_stores_color(test_client: TestClient):
    """Label color must be persisted correctly."""
    project = _create_project(test_client, "LabelColor")
    label = _create_label(test_client, project["id"], "bus", "#0000ff")
    assert label["color"] == "#0000ff"


def test_create_label_missing_name_returns_400(test_client: TestClient):
    """POST without a name must return 400 (label name is required)."""
    project = _create_project(test_client, "LabelNoName")
    resp = test_client.post(
        f"{PROJECTS_BASE}/{project['id']}/labels",
        json={"color": "#ff0000"},
    )
    assert resp.status_code in (400, 422)


def test_create_label_missing_color_returns_400(test_client: TestClient):
    """POST without a color must return 400."""
    project = _create_project(test_client, "LabelNoColor")
    resp = test_client.post(
        f"{PROJECTS_BASE}/{project['id']}/labels",
        json={"name": "plane"},
    )
    assert resp.status_code in (400, 422)


def test_create_duplicate_label_returns_error(test_client: TestClient):
    """Creating a label with the same name twice in one project must fail."""
    project = _create_project(test_client, "LabelDupe")
    _create_label(test_client, project["id"], "motorbike", "#aaaaaa")
    resp = test_client.post(
        f"{PROJECTS_BASE}/{project['id']}/labels",
        json={"name": "motorbike", "color": "#bbbbbb"},
    )
    assert resp.status_code in (400, 409, 422)


def test_create_reserved_null_label_returns_400(test_client: TestClient):
    """The label name 'null' is reserved and must be rejected."""
    project = _create_project(test_client, "LabelNull")
    resp = test_client.post(
        f"{PROJECTS_BASE}/{project['id']}/labels",
        json={"name": "null", "color": "#ffffff"},
    )
    assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def test_list_labels_returns_200(test_client: TestClient):
    """GET /api/v1/projects/{id}/labels returns 200 with a list."""
    project = _create_project(test_client, "LabelList")
    resp = test_client.get(f"{PROJECTS_BASE}/{project['id']}/labels")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_labels_contains_created(test_client: TestClient):
    """A newly created label must appear in the list."""
    project = _create_project(test_client, "LabelListContains")
    _create_label(test_client, project["id"], "van", "#123456")
    resp = test_client.get(f"{PROJECTS_BASE}/{project['id']}/labels")
    names = [lbl["name"] for lbl in resp.json()]
    assert "van" in names


def test_list_labels_nonexistent_project_returns_404(test_client: TestClient):
    """GET labels for a project that doesn't exist must return 404."""
    resp = test_client.get(f"{PROJECTS_BASE}/999999/labels")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def test_update_label_name(test_client: TestClient):
    """PUT /api/v1/projects/{pid}/labels/{lid} can change the label name."""
    project = _create_project(test_client, "LabelUpdate")
    label = _create_label(test_client, project["id"], "old_label", "#ff0000")
    label_id = label["id"]

    resp = test_client.put(
        f"{PROJECTS_BASE}/{project['id']}/labels/{label_id}",
        json={"name": "new_label", "color": "#ff0000"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "new_label"


def test_update_label_color(test_client: TestClient):
    """PUT can change a label's color."""
    project = _create_project(test_client, "LabelColorUpdate")
    label = _create_label(test_client, project["id"], "thing", "#000000")
    label_id = label["id"]

    resp = test_client.put(
        f"{PROJECTS_BASE}/{project['id']}/labels/{label_id}",
        json={"name": "thing", "color": "#ffffff"},
    )
    assert resp.status_code == 200
    assert resp.json()["color"] == "#ffffff"


def test_update_nonexistent_label_returns_404(test_client: TestClient):
    """PUT on a non-existent label id must return 404."""
    project = _create_project(test_client, "LabelUpdateGhost")
    resp = test_client.put(
        f"{PROJECTS_BASE}/{project['id']}/labels/999999",
        json={"name": "ghost", "color": "#ff0000"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def test_delete_label_returns_success(test_client: TestClient):
    """DELETE /api/v1/projects/{pid}/labels/{lid} returns 200."""
    project = _create_project(test_client, "LabelDelete")
    label = _create_label(test_client, project["id"], "deleteme", "#ff0000")
    label_id = label["id"]

    resp = test_client.delete(f"{PROJECTS_BASE}/{project['id']}/labels/{label_id}")
    assert resp.status_code == 200


def test_delete_label_removes_from_list(test_client: TestClient):
    """After deletion the label must not appear in the list."""
    project = _create_project(test_client, "LabelDeleteGone")
    label = _create_label(test_client, project["id"], "gone_label", "#ff0000")
    label_id = label["id"]

    test_client.delete(f"{PROJECTS_BASE}/{project['id']}/labels/{label_id}")

    resp = test_client.get(f"{PROJECTS_BASE}/{project['id']}/labels")
    ids = [lbl["id"] for lbl in resp.json()]
    assert label_id not in ids


def test_delete_nonexistent_label_returns_404(test_client: TestClient):
    """DELETE on a non-existent label must return 404."""
    project = _create_project(test_client, "LabelDeleteGhost")
    resp = test_client.delete(f"{PROJECTS_BASE}/{project['id']}/labels/999999")
    assert resp.status_code == 404
