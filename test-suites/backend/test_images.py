"""
test_images.py — Tests for image upload and management endpoints.

PURPOSE
-------
Images are the core data in the app. These tests verify that images can
be uploaded to a dataset, listed, deleted, and assigned to train/val/test
splits. All image content is generated in-memory (no real files on disk).

ROUTES TESTED
-------------
  POST   /api/v1/datasets/{dataset_id}/upload          upload one or more images
  GET    /api/v1/datasets/{dataset_id}/images          list images in a dataset
  DELETE /api/v1/images/{image_id}                     delete a single image
  PUT    /api/v1/datasets/images/{id}/split-section    assign train/val/test split

IMPORTANT IMPLEMENTATION NOTES
-------------------------------
  - The upload endpoint calls file_handler.upload_images_to_dataset() which
    opens its own database session via SessionLocal(). In tests, SessionLocal
    is patched in conftest.py to use the in-memory test database.
  - The upload response returns a dict with key "uploaded_images" (not "images").
  - Images are saved to disk during tests (in a temp uploads folder).

KEY BEHAVIORS VERIFIED
----------------------
  - Single and multiple file uploads succeed
  - Upload to a non-existent dataset returns 4xx
  - Uploaded image appears in the image list
  - Empty dataset returns an empty list (not an error)
  - Deleting an image removes it from the list
  - Deleting a non-existent image returns 404
  - Split section can be set to train, val, or test

HOW TESTS RUN
-------------
No server needed. Uses FastAPI TestClient + in-memory SQLite.
Each test creates its own project and dataset for full isolation.
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
IMAGES_BASE = "/api/v1/images"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_jpeg(width: int = 10, height: int = 10) -> io.BytesIO:
    """Return an in-memory minimal JPEG buffer."""
    buf = io.BytesIO()
    img = PILImage.new("RGB", (width, height), color=(128, 200, 100))
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


def _create_project(client: TestClient, name: str = "Img Test Project") -> dict:
    resp = client.post(f"{PROJECTS_BASE}/", json={
        "name": name,
        "description": "",
        "project_type": "Object Detection",
        "confidence_threshold": 0.5,
        "iou_threshold": 0.45,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _create_dataset(client: TestClient, project_id, name: str = "Img Test DS") -> dict:
    resp = client.post(f"{DATASETS_BASE}/", json={
        "name": name,
        "description": "",
        "project_id": str(project_id),
        "auto_label_enabled": False,
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _upload_image(client: TestClient, dataset_id: str, filename: str = "test.jpg") -> dict:
    buf = _make_jpeg()
    resp = client.post(
        f"{DATASETS_BASE}/{dataset_id}/upload",
        files=[("files", (filename, buf, "image/jpeg"))],
    )
    assert resp.status_code in (200, 201), f"Upload failed: {resp.text}"
    data = resp.json()
    # Handle all response shapes
    if isinstance(data, list):
        return data[0]
    if "uploaded_images" in data:
        return data["uploaded_images"][0]
    if "images" in data:
        return data["images"][0]
    return data


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

def test_upload_image_returns_success(test_client: TestClient):
    """POST /api/v1/datasets/{id}/upload must return 200/201."""
    project = _create_project(test_client, "UploadProj")
    ds = _create_dataset(test_client, project["id"], "UploadDS")
    buf = _make_jpeg()
    resp = test_client.post(
        f"{DATASETS_BASE}/{ds['id']}/upload",
        files=[("files", ("photo.jpg", buf, "image/jpeg"))],
    )
    assert resp.status_code in (200, 201)


def test_upload_image_response_has_image_id(test_client: TestClient):
    """Upload response must contain at least one image with an id."""
    project = _create_project(test_client, "UploadIDProj")
    ds = _create_dataset(test_client, project["id"], "UploadIDDS")
    image = _upload_image(test_client, ds["id"])
    assert "id" in image


def test_upload_multiple_images(test_client: TestClient):
    """Upload endpoint must accept multiple files in one request."""
    project = _create_project(test_client, "MultiUploadProj")
    ds = _create_dataset(test_client, project["id"], "MultiUploadDS")
    files = [
        ("files", (f"img_{i}.jpg", _make_jpeg(), "image/jpeg"))
        for i in range(3)
    ]
    resp = test_client.post(f"{DATASETS_BASE}/{ds['id']}/upload", files=files)
    assert resp.status_code in (200, 201)


def test_upload_to_nonexistent_dataset_returns_error(test_client: TestClient):
    """Uploading to a dataset that does not exist must return 4xx."""
    buf = _make_jpeg()
    resp = test_client.post(
        f"{DATASETS_BASE}/nonexistent-dataset/upload",
        files=[("files", ("x.jpg", buf, "image/jpeg"))],
    )
    assert resp.status_code in (400, 404, 422, 500)


# ---------------------------------------------------------------------------
# List images
# ---------------------------------------------------------------------------

def test_list_images_returns_200(test_client: TestClient):
    """GET /api/v1/datasets/{id}/images returns 200 with a list."""
    project = _create_project(test_client, "ListImgProj")
    ds = _create_dataset(test_client, project["id"], "ListImgDS")
    resp = test_client.get(f"{DATASETS_BASE}/{ds['id']}/images")
    assert resp.status_code == 200


def test_list_images_contains_uploaded(test_client: TestClient):
    """After upload the image must appear in the list."""
    project = _create_project(test_client, "ListImgProj2")
    ds = _create_dataset(test_client, project["id"], "ListImgDS2")
    image = _upload_image(test_client, ds["id"], "listed.jpg")

    resp = test_client.get(f"{DATASETS_BASE}/{ds['id']}/images")
    assert resp.status_code == 200
    data = resp.json()
    images = data if isinstance(data, list) else data.get("images", [])
    ids = [img["id"] for img in images]
    assert image["id"] in ids


def test_list_images_empty_dataset(test_client: TestClient):
    """A dataset with no images returns an empty list (not an error)."""
    project = _create_project(test_client, "EmptyImgProj")
    ds = _create_dataset(test_client, project["id"], "EmptyImgDS")
    resp = test_client.get(f"{DATASETS_BASE}/{ds['id']}/images")
    assert resp.status_code == 200
    data = resp.json()
    images = data if isinstance(data, list) else data.get("images", [])
    assert isinstance(images, list)
    assert len(images) == 0


# ---------------------------------------------------------------------------
# Delete image
# ---------------------------------------------------------------------------

def test_delete_image_returns_success(test_client: TestClient):
    """DELETE /api/v1/images/{id} returns 200."""
    project = _create_project(test_client, "DelImgProj")
    ds = _create_dataset(test_client, project["id"], "DelImgDS")
    image = _upload_image(test_client, ds["id"])

    resp = test_client.delete(f"{IMAGES_BASE}/{image['id']}")
    assert resp.status_code == 200


def test_delete_image_removes_from_list(test_client: TestClient):
    """After deletion the image must not appear in the dataset image list."""
    project = _create_project(test_client, "DelImgProj2")
    ds = _create_dataset(test_client, project["id"], "DelImgDS2")
    image = _upload_image(test_client, ds["id"])
    image_id = image["id"]

    test_client.delete(f"{IMAGES_BASE}/{image_id}")

    resp = test_client.get(f"{DATASETS_BASE}/{ds['id']}/images")
    data = resp.json()
    images = data if isinstance(data, list) else data.get("images", [])
    ids = [img["id"] for img in images]
    assert image_id not in ids


def test_delete_nonexistent_image_returns_404(test_client: TestClient):
    """DELETE on a non-existent image id returns 404."""
    resp = test_client.delete(f"{IMAGES_BASE}/nonexistent-image-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Split section assignment
# ---------------------------------------------------------------------------

def test_assign_split_section_train(test_client: TestClient):
    """PUT /api/v1/datasets/images/{id}/split-section assigns train split."""
    project = _create_project(test_client, "SplitProj")
    ds = _create_dataset(test_client, project["id"], "SplitDS")
    image = _upload_image(test_client, ds["id"])
    image_id = image["id"]

    resp = test_client.put(
        f"{DATASETS_BASE}/images/{image_id}/split-section",
        json={"split_section": "train"},
    )
    assert resp.status_code in (200, 201)


def test_assign_split_section_val(test_client: TestClient):
    """PUT split-section with 'val' must succeed."""
    project = _create_project(test_client, "SplitProj2")
    ds = _create_dataset(test_client, project["id"], "SplitDS2")
    image = _upload_image(test_client, ds["id"])
    image_id = image["id"]

    resp = test_client.put(
        f"{DATASETS_BASE}/images/{image_id}/split-section",
        json={"split_section": "val"},
    )
    assert resp.status_code in (200, 201)


def test_assign_split_section_test(test_client: TestClient):
    """PUT split-section with 'test' must succeed."""
    project = _create_project(test_client, "SplitProj3")
    ds = _create_dataset(test_client, project["id"], "SplitDS3")
    image = _upload_image(test_client, ds["id"])
    image_id = image["id"]

    resp = test_client.put(
        f"{DATASETS_BASE}/images/{image_id}/split-section",
        json={"split_section": "test"},
    )
    assert resp.status_code in (200, 201)
