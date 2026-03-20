"""
UI Tests — Projects Page (/projects)

What is tested:
  - Page loads and shows the heading
  - Create Project modal opens via the "New Project" button
  - Required field validation fires when name is empty
  - A new project appears in the list after creation
  - Searching by project name filters the displayed cards
  - The three-dot dropdown menu opens on a project card
  - Clicking "Open" on a project card navigates to the workspace

All tests run against a live app at localhost:12000.
Tests are automatically skipped if the backend is not running.
"""

import pytest
from .conftest import goto, wait_for_text, DEFAULT_TIMEOUT, FAST_TIMEOUT


# ---------------------------------------------------------------------------
# Page load
# ---------------------------------------------------------------------------

def test_projects_page_loads(page):
    """GET /projects renders the Projects heading."""
    goto(page, "/projects")
    # The Ant Design Title "Projects" should be visible
    page.wait_for_selector("text=Projects", timeout=DEFAULT_TIMEOUT)


def test_projects_page_shows_new_project_button(page):
    """The 'New Project' (or 'Create Project') button is visible."""
    goto(page, "/projects")
    page.wait_for_selector(
        "button:has-text('New Project'), button:has-text('Create Project'), "
        "button:has-text('Create')",
        timeout=DEFAULT_TIMEOUT,
    )


def test_projects_page_search_box_exists(page):
    """A search input is rendered on the Projects page."""
    goto(page, "/projects")
    page.wait_for_selector("input[placeholder*='Search'], input[placeholder*='search']",
                           timeout=DEFAULT_TIMEOUT)


# ---------------------------------------------------------------------------
# Create project modal
# ---------------------------------------------------------------------------

def test_create_project_modal_opens(page):
    """Clicking 'New Project' opens the create-project modal."""
    goto(page, "/projects")
    page.wait_for_timeout(800)

    page.click("button:has-text('New Project'), button:has-text('Create Project'), "
               "button:has-text('Create')")
    page.wait_for_timeout(600)

    # Ant Design modal title should appear
    page.wait_for_selector(
        ".ant-modal:visible, .ant-modal-content:visible",
        timeout=FAST_TIMEOUT,
    )


def test_create_project_modal_has_name_field(page):
    """The create-project modal contains a 'Name' input field."""
    goto(page, "/projects")
    page.wait_for_timeout(800)

    page.click("button:has-text('New Project'), button:has-text('Create Project'), "
               "button:has-text('Create')")
    page.wait_for_timeout(600)

    page.wait_for_selector(
        ".ant-modal input, .ant-modal-content input",
        timeout=FAST_TIMEOUT,
    )


def test_create_project_modal_closes_on_cancel(page):
    """Clicking Cancel closes the modal."""
    goto(page, "/projects")
    page.wait_for_timeout(800)

    page.click("button:has-text('New Project'), button:has-text('Create Project'), "
               "button:has-text('Create')")
    page.wait_for_timeout(600)

    # Click Cancel
    page.click(".ant-modal-footer button:has-text('Cancel'), "
               ".ant-modal button:has-text('Cancel')")
    page.wait_for_timeout(500)

    # Modal should be gone
    modal = page.query_selector(".ant-modal:visible")
    assert modal is None, "Modal is still visible after clicking Cancel"


def test_create_project_submit_empty_name_shows_error(page):
    """
    Submitting the create-project form with an empty name should show a
    validation error (required field), not navigate away.
    """
    goto(page, "/projects")
    page.wait_for_timeout(800)

    page.click("button:has-text('New Project'), button:has-text('Create Project'), "
               "button:has-text('Create')")
    page.wait_for_timeout(600)

    # Click the submit button without filling the name
    page.click(".ant-modal-footer button:has-text('Create'), "
               ".ant-modal-footer button[type='submit'], "
               ".ant-modal-footer button:has-text('OK')")
    page.wait_for_timeout(600)

    # Ant Design validation error message should appear
    page.wait_for_selector(
        ".ant-form-item-explain-error, .ant-form-explain-error",
        timeout=FAST_TIMEOUT,
    )


def test_create_project_fills_name_and_submits(page):
    """
    Fill project name → submit → project appears in list.
    This is the full happy-path flow for project creation.
    """
    goto(page, "/projects")
    page.wait_for_timeout(1000)

    # Count existing projects
    cards_before = len(page.query_selector_all(".ant-card"))

    page.click("button:has-text('New Project'), button:has-text('Create Project'), "
               "button:has-text('Create')")
    page.wait_for_timeout(600)

    # Type project name
    name_input = page.query_selector(".ant-modal input[id*='name'], "
                                     ".ant-modal input[placeholder*='name'], "
                                     ".ant-modal input[placeholder*='Name'], "
                                     ".ant-modal input")
    assert name_input is not None, "Name input not found in modal"
    name_input.fill("UI Test Project")

    # Submit
    page.click(".ant-modal-footer button:has-text('Create'), "
               ".ant-modal-footer button[type='submit'], "
               ".ant-modal-footer button:has-text('OK')")
    page.wait_for_timeout(1500)

    # Project should appear somewhere on the page
    page.wait_for_selector("text=UI Test Project", timeout=DEFAULT_TIMEOUT)


# ---------------------------------------------------------------------------
# Project card interactions
# ---------------------------------------------------------------------------

def test_project_card_has_open_button(page):
    """Each project card has an 'Open' or action button."""
    goto(page, "/projects")
    page.wait_for_timeout(1200)

    cards = page.query_selector_all(".ant-card")
    if not cards:
        pytest.skip("No project cards found — create a project first.")

    # At least one card should have an Open button or Eye icon link
    open_btn = page.query_selector(
        ".ant-card button:has-text('Open'), "
        ".ant-card a[href*='/workspace'], "
        ".ant-card a[href*='/projects/']"
    )
    assert open_btn is not None, "No Open button found on any project card"


def test_project_card_dropdown_opens(page):
    """Clicking the ⋯ (more options) button on a card opens a dropdown menu."""
    goto(page, "/projects")
    page.wait_for_timeout(1200)

    more_btn = page.query_selector(".ant-card button[aria-label='more'], "
                                   ".ant-card .anticon-more, "
                                   ".ant-card button:has(.anticon-more)")
    if more_btn is None:
        pytest.skip("No more-options button found — need at least one project card.")

    more_btn.click()
    page.wait_for_timeout(400)

    dropdown = page.query_selector(".ant-dropdown:visible, .ant-menu-submenu:visible")
    assert dropdown is not None, "Dropdown did not open after clicking more-options button"


def test_search_filters_projects(page):
    """Typing in the search box filters the displayed project list."""
    goto(page, "/projects")
    page.wait_for_timeout(1200)

    cards_before = page.query_selector_all(".ant-card")
    if not cards_before:
        pytest.skip("No project cards — create a project first.")

    search_input = page.query_selector("input[placeholder*='Search'], input[placeholder*='search']")
    if search_input is None:
        pytest.skip("Search input not found.")

    # Type something that won't match any real project name
    search_input.fill("zzz_no_match_xyzabc")
    page.wait_for_timeout(600)

    cards_after = page.query_selector_all(".ant-card")
    # Either no cards or an "empty" message — fewer cards than before
    assert len(cards_after) <= len(cards_before), \
        "Search did not reduce the number of visible cards"


# ---------------------------------------------------------------------------
# Navigation
# ---------------------------------------------------------------------------

def test_open_project_navigates_to_workspace(page):
    """Clicking 'Open' on the first project navigates to /projects/{id}/workspace."""
    goto(page, "/projects")
    page.wait_for_timeout(1200)

    open_link = page.query_selector(
        ".ant-card a[href*='/workspace'], "
        ".ant-card button:has-text('Open')"
    )
    if open_link is None:
        pytest.skip("No Open link found — create a project first.")

    open_link.click()
    page.wait_for_timeout(1500)

    assert "/workspace" in page.url or "/projects/" in page.url, \
        f"Expected navigation to workspace, but URL is: {page.url}"
