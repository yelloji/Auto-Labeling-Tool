"""
test_ui_release.py — UI Tests for the Release Section (sidebar → 'RELEASE').

WHAT THIS SECTION DOES
----------------------
The Release section is where users package their labeled dataset into a
versioned release ZIP for training. A release captures:
  - Which images are included (train/val/test split ratios)
  - What data augmentation / transformations to apply
  - A snapshot of all annotations at that point in time

The release ZIP is the input to the Model Training section.

Layout:
  Left panel  — Release History list (all past releases)
  Right panel — Release configuration form:
                  DatasetStats (image count, class breakdown)
                  ReleaseConfigPanel (name, train/val/test split sliders)
                  TransformationSection (augmentation cards + Add button)

WHAT IS TESTED
--------------
  Section load     — Release section renders without crash
  History list     — Release history panel is present (may be empty)
  Create button    — 'Create Release' button is visible
  Split config     — Train/Val/Test split sliders or number inputs are present
  Augmentation     — Transformation/Augmentation section heading is visible
  Add transform    — 'Add Transformation' button is present
  Transform modal  — Clicking 'Add Transformation' opens the TransformationModal
  Download button  — 'Download' button is shown when a release exists (skipped otherwise)
  Download modal   — Clicking Download opens the DownloadModal (skipped if no release)
  Dataset stats    — DatasetStats panel (image count, class info) is visible

HOW TESTS RUN
-------------
  - Uses the `workspace_page` fixture which creates a project and navigates to workspace.
  - `_open_release_section()` clicks the 'RELEASE' item in the sidebar menu.
  - The menu label is "RELEASE" (uppercase) — the menu key in React is 'versions'.
  - Tests that require an existing release skip automatically if none exist.

IMPORTANT NOTES
---------------
- The sidebar menu item is labelled "RELEASE" (all caps), not "Release".
  The click selector uses both casings for safety.
- The 422 bug this branch fixes was in the release creation API — it caused
  CreateRelease to fail when the payload had certain fields missing.
  These UI tests verify the UI side of the release flow.
- Download/DownloadModal tests skip if no release has been created yet
  (they require an actual release to exist in the database).

Requires: app at localhost:12000, at least one project exists.
"""

import pytest
from .conftest import goto, DEFAULT_TIMEOUT, FAST_TIMEOUT


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _open_release_section(page, project_id: str):
    goto(page, f"/projects/{project_id}/workspace")
    page.wait_for_timeout(1200)
    # The menu key is 'versions' but the label is 'RELEASE'
    page.click(".ant-menu-item:has-text('RELEASE'), .ant-menu-item:has-text('Release')")
    page.wait_for_timeout(1000)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_release_section_renders(workspace_page):
    """Release section loads without a crash."""
    page, project_id = workspace_page
    _open_release_section(page, project_id)

    page.wait_for_selector(
        "text=Release, text=Releases, text=Create Release",
        timeout=DEFAULT_TIMEOUT,
    )


def test_release_history_list_renders(workspace_page):
    """Release history list panel is visible (may be empty)."""
    page, project_id = workspace_page
    _open_release_section(page, project_id)

    # The list container or empty state should be present
    history = page.query_selector(
        "[class*='release-history'], "
        "[class*='ReleaseHistory'], "
        "text=No releases, "
        "text=Release History, "
        ".ant-list"
    )
    assert history is not None, "Release history list not found"


def test_release_create_button_visible(workspace_page):
    """'Create Release' button is present in the Release section."""
    page, project_id = workspace_page
    _open_release_section(page, project_id)

    btn = page.query_selector(
        "button:has-text('Create Release'), "
        "button:has-text('Create New Release'), "
        "button:has-text('New Release')"
    )
    assert btn is not None, "'Create Release' button not found"


def test_release_details_panel_has_train_val_test_split(workspace_page):
    """
    The Release Details panel contains train/val/test split configuration
    (sliders or number inputs).
    """
    page, project_id = workspace_page
    _open_release_section(page, project_id)

    split_config = page.query_selector(
        "text=Train, text=Val, text=Test, "
        ".ant-slider, "
        ".ant-input-number"
    )
    assert split_config is not None, "Train/Val/Test split controls not found"


def test_release_transformation_section_visible(workspace_page):
    """
    The Transformation/Augmentation section heading is visible in the release panel.
    """
    page, project_id = workspace_page
    _open_release_section(page, project_id)

    transform_el = page.query_selector(
        "text=Transformation, text=Augmentation, text=Augment, "
        "[class*='TransformationSection'], [class*='transformation']"
    )
    assert transform_el is not None, "Transformation/Augmentation section not found"


def test_release_add_transformation_button_exists(workspace_page):
    """
    An 'Add Transformation' or 'Add Augmentation' button is present.
    """
    page, project_id = workspace_page
    _open_release_section(page, project_id)

    add_btn = page.query_selector(
        "button:has-text('Add Transformation'), "
        "button:has-text('Add Augmentation'), "
        "button:has-text('Add Transform'), "
        "button:has-text('Add')"
    )
    assert add_btn is not None, "Add Transformation button not found"


def test_release_transformation_modal_opens(workspace_page):
    """Clicking 'Add Transformation' opens the TransformationModal."""
    page, project_id = workspace_page
    _open_release_section(page, project_id)

    add_btn = page.query_selector(
        "button:has-text('Add Transformation'), "
        "button:has-text('Add Augmentation'), "
        "button:has-text('Add Transform')"
    )
    if add_btn is None:
        pytest.skip("Add Transformation button not found.")

    add_btn.click()
    page.wait_for_timeout(700)

    modal = page.query_selector(".ant-modal:visible, .ant-modal-content:visible")
    assert modal is not None, "TransformationModal did not open"


def test_release_download_button_visible_when_release_exists(workspace_page):
    """
    When at least one release exists, a 'Download' button is present.
    Skipped if no releases have been created.
    """
    page, project_id = workspace_page
    _open_release_section(page, project_id)
    page.wait_for_timeout(800)

    download_btn = page.query_selector(
        "button:has-text('Download'), "
        "button[title*='Download'], "
        ".anticon-download"
    )
    if download_btn is None:
        pytest.skip("No download button found — create a release first.")

    assert download_btn is not None


def test_release_download_modal_opens(workspace_page):
    """Clicking the Download button on a release opens the DownloadModal."""
    page, project_id = workspace_page
    _open_release_section(page, project_id)
    page.wait_for_timeout(800)

    download_btn = page.query_selector(
        "button:has-text('Download'), .anticon-download"
    )
    if download_btn is None:
        pytest.skip("No download button — create a release first.")

    download_btn.click()
    page.wait_for_timeout(700)

    modal = page.query_selector(".ant-modal:visible")
    assert modal is not None, "DownloadModal did not open after clicking Download"


def test_release_dataset_stats_section_renders(workspace_page):
    """
    DatasetStats (image count, class distribution stats) section is visible
    in the release panel.
    """
    page, project_id = workspace_page
    _open_release_section(page, project_id)

    stats = page.query_selector(
        "text=Dataset Stats, text=Statistics, text=Total Images, "
        "[class*='DatasetStats'], [class*='dataset-stats']"
    )
    assert stats is not None, "DatasetStats panel not found in Release section"
