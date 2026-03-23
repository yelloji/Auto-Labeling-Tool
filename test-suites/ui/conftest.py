"""
ui/conftest.py — Shared Playwright fixtures for ALL UI tests.

HOW UI TESTS WORK
-----------------
UI tests use Playwright to automate a real Chromium browser.
The browser navigates to the running app, clicks buttons, fills forms,
and checks that elements are visible — exactly as a real user would.

Unlike backend tests (which use an in-memory database and no server),
UI tests require the FULL app to be running at localhost:12000.
This means both the backend (FastAPI) and the frontend (React) must be served.

REQUIREMENTS
------------
  1. Start the backend before running UI tests:
       cd backend && python main.py
     Wait for: "Uvicorn running on http://0.0.0.0:12000"

  2. Run UI tests:
       cd test-suites
       python run_all.py --ui-only       # headless (invisible browser)
       pytest ui/ --headed               # visible browser — you can watch it click

  3. One-time setup (already done if requirements-dev.txt was installed):
       pip install playwright pytest-playwright
       playwright install chromium

AUTO-SKIP BEHAVIOUR
-------------------
  If the backend is not running, every UI test automatically SKIPS (shows 's')
  instead of failing. This is intentional — a skip means "could not test",
  not "the feature is broken". This prevents false failures in CI.

FIXTURES PROVIDED
-----------------
  page           — fresh Chromium browser page per test, 1440x900 viewport
                   browser console errors are printed to pytest output
  workspace_page — navigates to the first available project workspace
                   skips the test if no projects exist

HELPER FUNCTIONS (importable in test files)
-------------------------------------------
  goto(page, path)         navigate to BASE_URL + path and wait for React to render
  wait_for_text(page, txt) wait until text is visible anywhere on the page
  click_menu_item(page, lbl) click an Ant Design sidebar menu item by label
  get_first_project_id(page) return the ID of the first project card (or None)

TIMEOUTS
--------
  DEFAULT_TIMEOUT = 15 000 ms  — for first page load (React + API calls)
  FAST_TIMEOUT    =  5 000 ms  — for elements already present on the page
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
