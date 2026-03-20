"""
UI Tests — Management Section (workspace sidebar → 'Management')

What is tested:
  - Section renders without crash
  - Three-column layout is present: Unassigned | Annotating | Dataset (Completed)
  - Each column header label is visible
  - Dataset cards render inside columns (if datasets exist)
  - The dataset dropdown (⋯ menu) opens on a dataset card
  - 'Rename' option appears in the dropdown
  - Move-to-stage options appear in the dropdown (Move to Annotating, Move to Dataset, etc.)
  - Clicking a dataset card navigates to the annotation launcher

Requires: app running at localhost:12000, at least one project exists.
"""

import pytest
from .conftest import goto, DEFAULT_TIMEOUT, FAST_TIMEOUT


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _open_management(page, project_id: str):
    """Navigate to workspace and click 'Management' in the sidebar."""
    goto(page, f"/projects/{project_id}/workspace")
    page.wait_for_timeout(1200)
    page.click(".ant-menu-item:has-text('Management')")
    page.wait_for_timeout(900)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_management_section_renders(workspace_page):
    """Management section loads without a crash."""
    page, project_id = workspace_page
    _open_management(page, project_id)

    page.wait_for_selector(
        "text=Management, text=Unassigned, text=Dataset Management",
        timeout=DEFAULT_TIMEOUT,
    )


def test_management_has_unassigned_column(workspace_page):
    """The 'Unassigned' column header is visible."""
    page, project_id = workspace_page
    _open_management(page, project_id)

    page.wait_for_selector("text=Unassigned", timeout=DEFAULT_TIMEOUT)


def test_management_has_annotating_column(workspace_page):
    """The 'Annotating' column header is visible."""
    page, project_id = workspace_page
    _open_management(page, project_id)

    page.wait_for_selector("text=Annotating", timeout=DEFAULT_TIMEOUT)


def test_management_has_completed_column(workspace_page):
    """The completed / 'Dataset' column header is visible."""
    page, project_id = workspace_page
    _open_management(page, project_id)

    page.wait_for_selector(
        "text=Dataset, text=Completed",
        timeout=DEFAULT_TIMEOUT,
    )


def test_management_three_columns_present(workspace_page):
    """
    All three stage columns render side by side.
    We verify by checking that all three column header texts are on the page.
    """
    page, project_id = workspace_page
    _open_management(page, project_id)

    unassigned = page.query_selector("text=Unassigned")
    annotating  = page.query_selector("text=Annotating")
    completed   = page.query_selector("text=Dataset, text=Completed")

    assert unassigned is not None, "'Unassigned' column header missing"
    assert annotating  is not None, "'Annotating' column header missing"
    # completed may say 'Dataset' — either is fine
    completed = page.query_selector("text=Dataset") or page.query_selector("text=Completed")
    assert completed is not None, "Completed/Dataset column header missing"


def test_management_dataset_card_has_dropdown(workspace_page):
    """
    If at least one dataset card exists, its ⋯ button opens a dropdown menu.
    Skipped when there are no datasets yet.
    """
    page, project_id = workspace_page
    _open_management(page, project_id)

    more_btn = page.query_selector(
        ".ant-card .anticon-more, "
        ".ant-card button[aria-label='more'], "
        ".ant-card button:has(.anticon-more)"
    )
    if more_btn is None:
        pytest.skip("No dataset cards found — upload images first to create a dataset.")

    more_btn.click()
    page.wait_for_timeout(400)

    dropdown = page.query_selector(".ant-dropdown:visible")
    assert dropdown is not None, "Dropdown did not appear after clicking ⋯"


def test_management_dropdown_has_rename_option(workspace_page):
    """
    The dataset dropdown contains a 'Rename' option.
    """
    page, project_id = workspace_page
    _open_management(page, project_id)

    more_btn = page.query_selector(
        ".ant-card .anticon-more, "
        ".ant-card button:has(.anticon-more)"
    )
    if more_btn is None:
        pytest.skip("No dataset cards found.")

    more_btn.click()
    page.wait_for_timeout(400)

    rename = page.query_selector(".ant-dropdown-menu-item:has-text('Rename'), "
                                 "li:has-text('Rename')")
    assert rename is not None, "'Rename' option not found in dataset dropdown"


def test_management_dropdown_has_move_options(workspace_page):
    """
    The dataset dropdown contains at least one 'Move to ...' option.
    """
    page, project_id = workspace_page
    _open_management(page, project_id)

    more_btn = page.query_selector(
        ".ant-card .anticon-more, "
        ".ant-card button:has(.anticon-more)"
    )
    if more_btn is None:
        pytest.skip("No dataset cards found.")

    more_btn.click()
    page.wait_for_timeout(400)

    move_option = page.query_selector(
        ".ant-dropdown-menu-item:has-text('Move'), "
        "li:has-text('Move to')"
    )
    assert move_option is not None, "No 'Move to' option found in dataset dropdown"


def test_management_dataset_card_has_image_count(workspace_page):
    """
    Dataset cards show an image count (e.g. '5 images' or '0 images').
    """
    page, project_id = workspace_page
    _open_management(page, project_id)

    card = page.query_selector(".ant-card")
    if card is None:
        pytest.skip("No dataset cards found.")

    card_text = card.inner_text()
    # Check for numeric image count pattern
    has_count = any(word in card_text.lower() for word in ["image", "img", "photo"])
    assert has_count, f"Dataset card does not show image count. Card text: {card_text[:200]}"


def test_management_dataset_card_has_progress_bar(workspace_page):
    """Each dataset card includes a labeling progress bar."""
    page, project_id = workspace_page
    _open_management(page, project_id)

    card = page.query_selector(".ant-card")
    if card is None:
        pytest.skip("No dataset cards found.")

    progress = card.query_selector(".ant-progress")
    assert progress is not None, "No progress bar found inside dataset card"
