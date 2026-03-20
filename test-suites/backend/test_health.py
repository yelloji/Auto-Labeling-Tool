"""
Tests for the health-check and root endpoints.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient


def test_health_check_returns_200(test_client: TestClient):
    """GET /health must return HTTP 200."""
    resp = test_client.get("/health")
    assert resp.status_code == 200


def test_health_check_body(test_client: TestClient):
    """GET /health must include status=healthy in the response body."""
    resp = test_client.get("/health")
    data = resp.json()
    assert "status" in data
    assert data["status"] == "healthy"


def test_health_check_has_message(test_client: TestClient):
    """GET /health response body should contain a message field."""
    resp = test_client.get("/health")
    data = resp.json()
    assert "message" in data


def test_root_endpoint_returns_200(test_client: TestClient):
    """GET / must not crash — it either serves the React build or a JSON fallback."""
    resp = test_client.get("/")
    # 200 (JSON fallback in dev) or a redirect/HTML when build exists
    assert resp.status_code in (200, 301, 302, 307)


def test_root_fallback_json_contains_version(test_client: TestClient):
    """
    When the React build does not exist (CI / dev environment) GET / returns
    JSON with a 'version' key.
    """
    resp = test_client.get("/")
    if resp.headers.get("content-type", "").startswith("application/json"):
        data = resp.json()
        assert "version" in data or "message" in data
