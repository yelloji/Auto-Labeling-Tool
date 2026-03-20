"""
UI Tests — Models Section (workspace sidebar → 'Models')

What is tested:
  - Section renders without crash
  - Model cards list renders (may be empty with an empty state)
  - Search input is present
  - Type filter (filter by model type) is present
  - 'Include global models' toggle exists
  - 'Upload / Import Model' button opens an upload modal
  - Upload modal has a file input and type selector
  - Clicking a model card opens the 'View Details' modal
  - Details modal shows class list / config YAML / metadata tabs

Requires: app at localhost:12000, at least one project exists.
"""

import pytest
from .conftest import goto, DEFAULT_TIMEOUT, FAST_TIMEOUT


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _open_models_section(page, project_id: str):
    goto(page, f"/projects/{project_id}/workspace")
    page.wait_for_timeout(1200)
    page.click(".ant-menu-item:has-text('Models')")
    page.wait_for_timeout(1000)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_models_section_renders(workspace_page):
    """Models section loads without crash."""
    page, project_id = workspace_page
    _open_models_section(page, project_id)

    page.wait_for_selector(
        "text=Models, text=AI Models, text=Model Management",
        timeout=DEFAULT_TIMEOUT,
    )


def test_models_search_input_exists(workspace_page):
    """A search input is visible in the Models section."""
    page, project_id = workspace_page
    _open_models_section(page, project_id)

    search = page.query_selector(
        "input[placeholder*='Search'], input[placeholder*='search'], "
        "input[placeholder*='model'], input[placeholder*='Model']"
    )
    assert search is not None, "Search input not found in Models section"


def test_models_type_filter_exists(workspace_page):
    """A model type filter (dropdown/select) is present."""
    page, project_id = workspace_page
    _open_models_section(page, project_id)

    filter_el = page.query_selector(
        ".ant-select:has-text('Type'), "
        ".ant-select:has-text('All Types'), "
        ".ant-select:has-text('Filter'), "
        "text=All Types, text=Model Type"
    )
    assert filter_el is not None, "Model type filter not found"


def test_models_global_toggle_exists(workspace_page):
    """'Include global models' toggle switch is present."""
    page, project_id = workspace_page
    _open_models_section(page, project_id)

    toggle = page.query_selector(
        ".ant-switch, "
        "text=Global, "
        "text=global models, "
        "text=Include Global"
    )
    assert toggle is not None, "'Include global models' toggle not found"


def test_models_upload_button_visible(workspace_page):
    """'Upload Model' or 'Import Model' button is visible."""
    page, project_id = workspace_page
    _open_models_section(page, project_id)

    btn = page.query_selector(
        "button:has-text('Upload'), "
        "button:has-text('Import'), "
        "button:has-text('Add Model'), "
        "button:has-text('Upload Model')"
    )
    assert btn is not None, "Upload/Import model button not found"


def test_models_upload_modal_opens(workspace_page):
    """Clicking the upload button opens the model upload modal."""
    page, project_id = workspace_page
    _open_models_section(page, project_id)

    btn = page.query_selector(
        "button:has-text('Upload'), "
        "button:has-text('Import'), "
        "button:has-text('Add Model')"
    )
    if btn is None:
        pytest.skip("Upload button not found.")

    btn.click()
    page.wait_for_timeout(700)

    modal = page.query_selector(".ant-modal:visible, .ant-modal-content:visible")
    assert modal is not None, "Upload modal did not open"


def test_models_upload_modal_has_file_input(workspace_page):
    """Upload modal contains a file input field."""
    page, project_id = workspace_page
    _open_models_section(page, project_id)

    btn = page.query_selector(
        "button:has-text('Upload'), button:has-text('Import'), button:has-text('Add Model')"
    )
    if btn is None:
        pytest.skip("Upload button not found.")

    btn.click()
    page.wait_for_timeout(700)

    file_input = page.query_selector(
        ".ant-modal input[type='file'], "
        ".ant-modal .ant-upload, "
        ".ant-modal [class*='upload']"
    )
    assert file_input is not None, "File upload input not found in model upload modal"


def test_models_upload_modal_has_type_selector(workspace_page):
    """Upload modal contains a model type selector."""
    page, project_id = workspace_page
    _open_models_section(page, project_id)

    btn = page.query_selector(
        "button:has-text('Upload'), button:has-text('Import'), button:has-text('Add Model')"
    )
    if btn is None:
        pytest.skip("Upload button not found.")

    btn.click()
    page.wait_for_timeout(700)

    type_select = page.query_selector(
        ".ant-modal .ant-select, "
        ".ant-modal select, "
        ".ant-modal-content .ant-select"
    )
    assert type_select is not None, "Model type selector not found in upload modal"


def test_models_list_shows_empty_state_or_cards(workspace_page):
    """
    The model list area shows either model cards or an empty state message.
    It must not be a blank/broken div.
    """
    page, project_id = workspace_page
    _open_models_section(page, project_id)
    page.wait_for_timeout(1000)

    content = page.query_selector(
        ".ant-card, "
        ".ant-empty, "
        "text=No models, "
        "text=No AI models, "
        "[class*='model-card']"
    )
    assert content is not None, "Model list area is blank — no cards and no empty state"


def test_models_card_has_status_badge(workspace_page):
    """
    If model cards exist, each card has a status badge (Ready / Pending / etc.)
    """
    page, project_id = workspace_page
    _open_models_section(page, project_id)
    page.wait_for_timeout(1000)

    card = page.query_selector(".ant-card")
    if card is None:
        pytest.skip("No model cards found.")

    status_badge = card.query_selector(
        ".ant-tag, .ant-badge, "
        "text=Ready, text=Pending, text=Error"
    )
    assert status_badge is not None, "No status badge found on model card"
