"""
Shared Playwright fixtures for all UI tests.

REQUIREMENTS:
  - Backend must be running at http://localhost:12000
  - Install:  pip install playwright pytest-playwright
  - Install browsers: playwright install chromium

USAGE:
  pytest tests/ui/ -v
  pytest tests/ui/ --headed              # see browser window
  pytest tests/ui/ --slowmo=500          # slow down for debugging

Every test that uses `page` or `workspace_page` gets a clean browser context.
Tests skip automatically if the backend is unreachable — they do NOT fail.
"""

import time
import socket
import pytest


# ---------------------------------------------------------------------------
# Base URL
# ---------------------------------------------------------------------------

BASE_URL = "http://localhost:12000"
DEFAULT_TIMEOUT = 15_000   # 15 seconds — generous for first load
FAST_TIMEOUT   = 5_000    # 5 seconds — for elements that should already be there


# ---------------------------------------------------------------------------
# Backend availability check
# ---------------------------------------------------------------------------

def _backend_is_up() -> bool:
    """Return True if the backend is listening on port 12000."""
    try:
        with socket.create_connection(("localhost", 12000), timeout=2):
            return True
    except OSError:
        return False


@pytest.fixture(scope="session", autouse=True)
def require_backend():
    """
    Session-scoped fixture: skip the entire UI test session if the backend
    is not running.  This avoids misleading FAIL results when the app simply
    isn't started yet.
    """
    if not _backend_is_up():
        pytest.skip(
            "Backend not running at localhost:12000 — "
            "start the app first, then re-run UI tests.",
            allow_module_level=True,
        )


# ---------------------------------------------------------------------------
# Browser setup  (pytest-playwright provides `playwright` fixture)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def page(playwright):
    """
    Fresh Chromium page per test.
    - No persistent storage — every test starts clean.
    - Console errors are printed to stdout so failures are diagnosable.
    """
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    # Log browser console errors so we can see them in pytest output
    page.on("console", lambda msg: (
        print(f"  [browser {msg.type}] {msg.text}") if msg.type in ("error", "warning") else None
    ))

    page.set_default_timeout(DEFAULT_TIMEOUT)

    yield page

    context.close()
    browser.close()


# ---------------------------------------------------------------------------
# Helpers — reusable navigation + wait helpers available to every test
# ---------------------------------------------------------------------------

def goto(page, path: str = "/"):
    """Navigate to a path and wait for the page to settle."""
    page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
    # Small pause: lets React finish the first render cycle
    page.wait_for_timeout(800)


def wait_for_text(page, text: str, timeout: int = DEFAULT_TIMEOUT):
    """Wait until `text` is visible somewhere on the page."""
    page.wait_for_selector(f"text={text}", timeout=timeout)


def click_menu_item(page, label: str):
    """
    Click an Ant Design sidebar menu item by its visible label text.
    Works for the ProjectWorkspace sidebar navigation.
    """
    page.click(f".ant-menu-item:has-text('{label}'), "
               f".ant-menu-submenu-title:has-text('{label}')")
    page.wait_for_timeout(600)


def get_first_project_id(page) -> str | None:
    """
    Navigate to /projects, grab the first project card's 'Open' link href,
    and return the project id extracted from the URL.
    Returns None if no projects exist.
    """
    goto(page, "/projects")
    page.wait_for_timeout(1000)
    links = page.query_selector_all("a[href*='/projects/']")
    for link in links:
        href = link.get_attribute("href") or ""
        parts = [p for p in href.split("/") if p.isdigit()]
        if parts:
            return parts[0]
    return None


@pytest.fixture(scope="function")
def workspace_page(page):
    """
    Navigate to the first available project workspace.
    Yields (page, project_id).
    If no project exists the test is skipped with a clear message.
    """
    project_id = get_first_project_id(page)
    if project_id is None:
        pytest.skip("No projects found — create at least one project before running workspace UI tests.")

    goto(page, f"/projects/{project_id}/workspace")
    page.wait_for_timeout(1200)
    yield page, project_id
