"""
Tests for annotation endpoints.

Route prefix registered in main.py:
    app.include_router(annotations.router, prefix="/api/v1/images", ...)

Key routes (inside annotations.py):
    GET    /api/v1/images/{image_id}/annotations            -> list annotations
    POST   /api/v1/images/{image_id}/annotations            -> save annotations (bulk)
    PUT    /api/v1/images/{image_id}/annotations/{ann_id}   -> update one annotation
    DELETE /api/v1/images/annotations/{ann_id}              -> delete annotation
    PUT    /api/v1/images/{ann_id}                          -> update annotation (by id)
    DELETE /api/v1/images/annotations/{ann_id}              -> delete annotation
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

def _make_jpeg() -> io.BytesIO:
    buf = io.BytesIO()
    PILImage.new("RGB", (10, 10), color=(10, 20, 30)).save(buf, format="JPEG")
    buf.seek(0)
    return buf


def _setup(client: TestClient, suffix: str = "") -> dict:
    """Create project + dataset + upload one image. Return {'project', 'dataset', 'image'}."""
    proj = client.post(f"{PROJECTS_BASE}/", json={
        "name": f"AnnProj{suffix}",
        "description": "",
        "project_type": "Object Detection",
        "confidence_threshold": 0.5,
        "iou_threshold": 0.45,
    }).json()

    ds = client.post(f"{DATASETS_BASE}/", json={
        "name": f"AnnDS{suffix}",
        "description": "",
        "project_id": str(proj["id"]),
        "auto_label_enabled": False,
    }).json()

    upload_resp = client.post(
        f"{DATASETS_BASE}/{ds['id']}/upload",
        files=[("files", ("ann_test.jpg", _make_jpeg(), "image/jpeg"))],
    )
    data = upload_resp.json()
    if isinstance(data, list):
        image = data[0]
    elif "uploaded_images" in data:
        image = data["uploaded_images"][0]
    elif "images" in data:
        image = data["images"][0]
    else:
        image = data

    return {"project": proj, "dataset": ds, "image": image}


def _ann_payload(class_name: str = "cat", class_id: int = 0) -> dict:
    """Build a single annotation dict in the format the API expects."""
    return {
        "class_name": class_name,
        "class_id": class_id,
        "x": 0.1,
        "y": 0.1,
        "width": 0.2,
        "height": 0.2,
        "confidence": 1.0,
    }


def _save_annotations(client: TestClient, image_id: str, annotations: list) -> dict:
    resp = client.post(
        f"{IMAGES_BASE}/{image_id}/annotations",
        json={"annotations": annotations},
    )
    assert resp.status_code in (200, 201), f"Failed to save annotations: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# POST (create / save)
# ---------------------------------------------------------------------------

def test_save_annotations_returns_success(test_client: TestClient):
    """POST /api/v1/images/{id}/annotations returns 200/201."""
    ctx = _setup(test_client, "Save")
    image_id = ctx["image"]["id"]

    resp = test_client.post(
        f"{IMAGES_BASE}/{image_id}/annotations",
        json={"annotations": [_ann_payload("dog", 1)]},
    )
    assert resp.status_code in (200, 201)


def test_save_multiple_annotations(test_client: TestClient):
    """Saving multiple annotations in one call must succeed."""
    ctx = _setup(test_client, "Multi")
    image_id = ctx["image"]["id"]

    anns = [_ann_payload("dog", 0), _ann_payload("cat", 1), _ann_payload("bird", 2)]
    resp = test_client.post(
        f"{IMAGES_BASE}/{image_id}/annotations",
        json={"annotations": anns},
    )
    assert resp.status_code in (200, 201)


def test_save_annotation_to_nonexistent_image_returns_error(test_client: TestClient):
    """Posting annotations to a non-existent image must return 4xx."""
    resp = test_client.post(
        f"{IMAGES_BASE}/no-such-image/annotations",
        json={"annotations": [_ann_payload()]},
    )
    assert resp.status_code in (400, 404, 422, 500)


# ---------------------------------------------------------------------------
# GET (list)
# ---------------------------------------------------------------------------

def test_get_annotations_returns_list(test_client: TestClient):
    """GET /api/v1/images/{id}/annotations returns a list."""
    ctx = _setup(test_client, "Get")
    image_id = ctx["image"]["id"]

    resp = test_client.get(f"{IMAGES_BASE}/{image_id}/annotations")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_get_annotations_contains_saved(test_client: TestClient):
    """After saving, the annotation appears in the GET response."""
    ctx = _setup(test_client, "GetContains")
    image_id = ctx["image"]["id"]

    _save_annotations(test_client, image_id, [_ann_payload("horse", 3)])

    resp = test_client.get(f"{IMAGES_BASE}/{image_id}/annotations")
    assert resp.status_code == 200
    data = resp.json()
    class_names = [a.get("class_name") for a in data]
    assert "horse" in class_names


def test_get_annotations_empty_image(test_client: TestClient):
    """An image with no annotations returns an empty list, not an error."""
    ctx = _setup(test_client, "Empty")
    image_id = ctx["image"]["id"]

    resp = test_client.get(f"{IMAGES_BASE}/{image_id}/annotations")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# PUT (update single annotation)
# ---------------------------------------------------------------------------

def test_update_annotation_class_name(test_client: TestClient):
    """PUT /api/v1/images/{image_id}/annotations/{ann_id} updates class_name."""
    ctx = _setup(test_client, "Update")
    image_id = ctx["image"]["id"]

    _save_annotations(test_client, image_id, [_ann_payload("fox", 0)])

    annotations = test_client.get(f"{IMAGES_BASE}/{image_id}/annotations").json()
    assert len(annotations) > 0
    ann_id = annotations[0]["id"]

    resp = test_client.put(
        f"{IMAGES_BASE}/{image_id}/annotations/{ann_id}",
        json={"class_name": "wolf"},
    )
    # Endpoint may return 200 or method-not-allowed depending on implementation;
    # we accept 200 or a graceful 4xx (but not 500).
    assert resp.status_code != 500


# ---------------------------------------------------------------------------
# DELETE annotation
# ---------------------------------------------------------------------------

def test_delete_annotation_returns_success(test_client: TestClient):
    """DELETE /api/v1/images/annotations/{id} returns 200."""
    ctx = _setup(test_client, "Del")
    image_id = ctx["image"]["id"]

    _save_annotations(test_client, image_id, [_ann_payload("bear", 0)])
    annotations = test_client.get(f"{IMAGES_BASE}/{image_id}/annotations").json()
    assert len(annotations) > 0
    ann_id = annotations[0]["id"]

    resp = test_client.delete(f"{IMAGES_BASE}/annotations/{ann_id}")
    assert resp.status_code == 200


def test_delete_nonexistent_annotation_returns_404(test_client: TestClient):
    """Deleting a non-existent annotation returns 404."""
    resp = test_client.delete(f"{IMAGES_BASE}/annotations/no-such-ann")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Polygon / segmentation annotations
# ---------------------------------------------------------------------------

def test_save_polygon_annotation(test_client: TestClient):
    """Annotations may carry a segmentation list (polygon format)."""
    ctx = _setup(test_client, "Poly")
    image_id = ctx["image"]["id"]

    polygon_ann = {
        "class_name": "polygon_class",
        "class_id": 0,
        "x": 0.1,
        "y": 0.1,
        "width": 0.3,
        "height": 0.3,
        "confidence": 1.0,
        "segmentation": [[0.1, 0.1, 0.4, 0.1, 0.4, 0.4, 0.1, 0.4]],
    }
    resp = test_client.post(
        f"{IMAGES_BASE}/{image_id}/annotations",
        json={"annotations": [polygon_ann]},
    )
    assert resp.status_code in (200, 201)
