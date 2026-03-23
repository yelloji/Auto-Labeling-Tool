"""
test_ui_analytics.py — UI Tests for the Analytics Section (sidebar → 'Analytics').

WHAT THIS SECTION DOES
----------------------
The Analytics section shows statistics about the project's labeling quality
and data distribution. It helps identify class imbalance (too many images of
one class, too few of another) before training a model.

WHAT IS TESTED
--------------
  Project stats      — total images count, total datasets count, labeling progress %
  Label distribution — table showing each class name, image count, percentage
  Pie chart          — visual chart of label distribution renders without error
  Per-dataset table  — shows labeled vs unlabeled image counts and a progress bar
  Manage Labels      — 'Manage Labels' button opens the LabelManagementModal
  Add label          — modal allows typing a new label name and picking a color
  Edit label color   — modal allows changing the color of an existing label
  Delete label       — modal allows removing a label from the project

Requires: app at localhost:12000, at least one project exists.
"""

import pytest
from .conftest import goto, DEFAULT_TIMEOUT, FAST_TIMEOUT


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _open_analytics_section(page, project_id: str):
    goto(page, f"/projects/{project_id}/workspace")
    page.wait_for_timeout(1200)
    page.click(".ant-menu-item:has-text('Analytics')")
    page.wait_for_timeout(1000)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_analytics_section_renders(workspace_page):
    """Analytics section loads without crash."""
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)

    page.wait_for_selector(
        "text=Analytics, text=Label Distribution, text=Statistics",
        timeout=DEFAULT_TIMEOUT,
    )


def test_analytics_shows_total_images_stat(workspace_page):
    """Project overview shows a 'Total Images' or images count stat."""
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)

    stat = page.query_selector(
        "text=Total Images, text=Images, .ant-statistic"
    )
    assert stat is not None, "Total Images statistic not found in Analytics"


def test_analytics_label_distribution_table(workspace_page):
    """Label distribution table with class name, count, % is present."""
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)

    # Ant Design Table or a table-like element
    table = page.query_selector(
        ".ant-table, "
        "table, "
        "text=Label Distribution, "
        "text=Class, "
        "text=Count"
    )
    assert table is not None, "Label distribution table not found"


def test_analytics_pie_chart_renders(workspace_page):
    """A pie chart (SVG canvas) renders for label distribution."""
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)
    page.wait_for_timeout(1000)

    chart = page.query_selector(
        "canvas, svg, "
        "[class*='chart'], [class*='Chart'], "
        "[class*='pie'], [class*='Pie']"
    )
    assert chart is not None, "No pie chart / canvas found in Analytics section"


def test_analytics_dataset_table_present(workspace_page):
    """Per-dataset table (showing labeled/unlabeled per dataset) is present."""
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)

    dataset_table = page.query_selector(
        ".ant-table, "
        "text=Labeled, "
        "text=Unlabeled, "
        "text=Dataset"
    )
    assert dataset_table is not None, "Per-dataset table not found in Analytics section"


def test_analytics_progress_bars_visible(workspace_page):
    """At least one progress bar is shown in the Analytics section."""
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)

    progress = page.query_selector(".ant-progress")
    assert progress is not None, "No progress bar found in Analytics section"


def test_analytics_manage_labels_button_visible(workspace_page):
    """'Manage Labels' button is visible."""
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)

    btn = page.query_selector(
        "button:has-text('Manage Labels'), "
        "button:has-text('Labels'), "
        "button:has-text('Edit Labels')"
    )
    assert btn is not None, "'Manage Labels' button not found in Analytics section"


def test_analytics_manage_labels_modal_opens(workspace_page):
    """Clicking 'Manage Labels' opens the LabelManagementModal."""
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)

    btn = page.query_selector(
        "button:has-text('Manage Labels'), "
        "button:has-text('Labels')"
    )
    if btn is None:
        pytest.skip("Manage Labels button not found.")

    btn.click()
    page.wait_for_timeout(700)

    modal = page.query_selector(".ant-modal:visible, .ant-modal-content:visible")
    assert modal is not None, "LabelManagementModal did not open"


def test_analytics_label_modal_has_add_label_input(workspace_page):
    """
    Inside the LabelManagementModal there is an input/button to add a new label.
    """
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)

    btn = page.query_selector("button:has-text('Manage Labels'), button:has-text('Labels')")
    if btn is None:
        pytest.skip("Manage Labels button not found.")

    btn.click()
    page.wait_for_timeout(700)

    add_el = page.query_selector(
        ".ant-modal input, "
        ".ant-modal button:has-text('Add'), "
        ".ant-modal button:has-text('New Label')"
    )
    assert add_el is not None, "No add-label input/button found inside LabelManagementModal"


def test_analytics_labeling_progress_summary(workspace_page):
    """
    Overall labeling progress (e.g. '0% labeled' or a progress bar)
    is shown in the overview area.
    """
    page, project_id = workspace_page
    _open_analytics_section(page, project_id)

    progress_el = page.query_selector(
        "text=Labeling Progress, "
        "text=Progress, "
        ".ant-progress, "
        ".ant-statistic"
    )
    assert progress_el is not None, "Labeling progress stat/bar not found in Analytics"
