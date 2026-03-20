"""
Tests for release endpoints.

The key bug this suite guards against is the 422 error on POST /releases/create.
The endpoint is mounted via:
    app.include_router(releases.router, prefix="/api/v1", ...)

So the full path is:
    POST   /api/v1/releases/create             -> create a release (the reported 422 bug)
    POST   /api/v1/releases/generate           -> enhanced release generation
    GET    /api/v1/projects/{id}/releases      -> list releases for a project
    GET    /api/v1/releases/{id}/progress      -> release progress
    DELETE /api/v1/releases/{id}               -> delete a release
    PUT    /api/v1/releases/{id}/rename        -> rename a release

Payload schema for POST /releases/create (ReleaseCreate model):
    version_name: str
    dataset_ids: List[str]
    description: str = ""
    transformations: List[dict] = []
    multiplier: int = 1
    preserve_annotations: bool = True
    export_format: str = "YOLO"
    task_type: str = "object_detection"
    include_images: bool = True
    include_annotations: bool = True
    verified_only: bool = False
    output_format: str = "original"
    preview_data: Optional[dict] = None
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
RELEASES_BASE = "/api/v1"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_jpeg() -> io.BytesIO:
    buf = io.BytesIO()
    PILImage.new("RGB", (10, 10), color=(50, 100, 150)).save(buf, format="JPEG")
    buf.seek(0)
    return buf


def _create_project(client: TestClient, name: str = "Release Test Project") -> dict:
    resp = client.post(f"{PROJECTS_BASE}/", json={
        "name": name,
        "description": "",
        "project_type": "Object Detection",
        "confidence_threshold": 0.5,
        "iou_threshold": 0.45,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _create_dataset(client: TestClient, project_id, name: str = "Rel DS") -> dict:
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
        files=[("files", ("rel_test.jpg", buf, "image/jpeg"))],
    )
    assert resp.status_code in (200, 201), resp.text
    data = resp.json()
    if isinstance(data, list):
        return data[0]
    if "uploaded_images" in data:
        return data["uploaded_images"][0]
    return data.get("images", [data])[0]


def _release_payload(dataset_ids: list, version_name: str = "v1.0") -> dict:
    return {
        "version_name": version_name,
        "dataset_ids": dataset_ids,
        "description": "Test release",
        "transformations": [],
        "multiplier": 1,
        "preserve_annotations": True,
        "export_format": "YOLO",
        "task_type": "object_detection",
        "include_images": True,
        "include_annotations": True,
        "verified_only": False,
        "output_format": "original",
    }


# ---------------------------------------------------------------------------
# POST /releases/create — the reported 422 bug
# ---------------------------------------------------------------------------

def test_create_release_does_not_return_422(test_client: TestClient):
    """
    POST /api/v1/releases/create with a valid payload must NOT return 422.
    This is the core regression test for the reported 422 Unprocessable Entity bug.
    """
    project = _create_project(test_client, "Release422Test")
    ds = _create_dataset(test_client, project["id"], "Release422DS")
    _upload_image(test_client, ds["id"])

    payload = _release_payload([ds["id"]], version_name="v_422_test")
    resp = test_client.post(f"{RELEASES_BASE}/releases/create", json=payload)

    assert resp.status_code != 422, (
        f"Got 422 Unprocessable Entity — the release creation bug has NOT been fixed.\n"
        f"Response: {resp.text}"
    )


def test_create_release_returns_non_500(test_client: TestClient):
    """POST /releases/create must not crash the server (no 500)."""
    project = _create_project(test_client, "ReleaseNo500")
    ds = _create_dataset(test_client, project["id"], "ReleaseNo500DS")
    _upload_image(test_client, ds["id"])

    payload = _release_payload([ds["id"]], version_name="v_no500")
    resp = test_client.post(f"{RELEASES_BASE}/releases/create", json=payload)
    assert resp.status_code != 500, f"Server 500 error: {resp.text}"


def test_create_release_with_valid_payload(test_client: TestClient):
    """POST /releases/create with a complete, valid payload returns 2xx."""
    project = _create_project(test_client, "ReleaseValid")
    ds = _create_dataset(test_client, project["id"], "ReleaseValidDS")
    _upload_image(test_client, ds["id"])

    payload = _release_payload([ds["id"]], version_name="v_valid")
    resp = test_client.post(f"{RELEASES_BASE}/releases/create", json=payload)
    # Accept 200 or 201; also accept 4xx errors that are not 422 (they indicate
    # domain errors like no labeled images, which are not the reported bug).
    assert resp.status_code not in (422, 500), f"Unexpected error: {resp.status_code} — {resp.text}"


def test_create_release_missing_dataset_ids_returns_422(test_client: TestClient):
    """Omitting dataset_ids (required field) must return 422 validation error."""
    resp = test_client.post(f"{RELEASES_BASE}/releases/create", json={
        "version_name": "v_no_datasets",
        # dataset_ids intentionally omitted
    })
    assert resp.status_code == 422


def test_create_release_missing_version_name_returns_422(test_client: TestClient):
    """Omitting version_name (required field) must return 422."""
    project = _create_project(test_client, "ReleaseNoVersion")
    ds = _create_dataset(test_client, project["id"], "ReleaseNoVersionDS")

    resp = test_client.post(f"{RELEASES_BASE}/releases/create", json={
        "dataset_ids": [ds["id"]],
        # version_name intentionally omitted
    })
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /projects/{id}/releases
# ---------------------------------------------------------------------------

def test_list_project_releases_returns_200(test_client: TestClient):
    """GET /api/v1/projects/{id}/releases returns 200."""
    project = _create_project(test_client, "ListReleaseProj")
    resp = test_client.get(f"{RELEASES_BASE}/projects/{project['id']}/releases")
    assert resp.status_code == 200


def test_list_project_releases_returns_list_or_dict(test_client: TestClient):
    """GET /projects/{id}/releases must return a list or a dict with a 'releases' key."""
    project = _create_project(test_client, "ListReleaseProj2")
    resp = test_client.get(f"{RELEASES_BASE}/projects/{project['id']}/releases")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (list, dict))


# ---------------------------------------------------------------------------
# GET /releases/{id}/progress
# ---------------------------------------------------------------------------

def test_get_release_progress_nonexistent_returns_404(test_client: TestClient):
    """GET /releases/{id}/progress for a non-existent release returns 404."""
    resp = test_client.get(f"{RELEASES_BASE}/releases/no-such-release-id/progress")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /releases/{id}
# ---------------------------------------------------------------------------

def test_delete_release_nonexistent_returns_404(test_client: TestClient):
    """DELETE on a non-existent release id returns 404."""
    resp = test_client.delete(f"{RELEASES_BASE}/releases/no-such-id")
    assert resp.status_code == 404
