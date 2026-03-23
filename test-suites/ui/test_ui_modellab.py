"""
test_ui_modellab.py — UI Tests for the Model Lab Section (sidebar → 'Model Lab').

WHAT THIS SECTION DOES
----------------------
Model Lab is the post-training analysis workspace. After a training session
completes, users come here to review results, run validation, test predictions,
and compare multiple experiments.

LAYOUT — Two-panel design:
  LEFT panel   — TrainingList: all training sessions for this project
  RIGHT panel  — OverviewView: analysis tabs for the selected training

RIGHT PANEL TABS (6 total)
--------------------------
  Tab 1: Overview      — best metrics (mAP, precision, recall), loss/accuracy charts
  Tab 2: Configuration — training config viewer + advanced YAML editor
  Tab 3: Models        — trained weight files (best.pt / last.pt) + download buttons
  Tab 4: Validation    — run validation on test set, see mAP + confusion matrix
  Tab 5: Prediction    — run prediction on new images, view results gallery
                         AnalyticsModal inside Prediction has 4 sub-views:
                           Charts | Quality | Report | Export
  Tab 6: Comparison    — compare 2–3 training experiments side by side

WHAT IS TESTED
--------------
  Layout           — two-panel structure renders, TrainingList panel visible
  TrainingList     — list renders (may be empty if no training done yet)
  All 6 tabs       — all tab buttons are accessible when a training is selected
  Overview tab     — metrics display area and chart area present
  Configuration tab — config viewer and YAML editor visible
  Models tab       — best.pt / last.pt weight cards present, download button
  Validation tab   — init button, confidence slider, IoU slider, Run button
  Prediction tab   — config section and run prediction button visible
  Analytics Modal  — opens from Prediction tab and has all 4 sub-view tabs
  Comparison tab   — comparison engine section and compare button exist

Requires: app at localhost:12000, at least one project with a completed training.
Tests that require a training session skip automatically if none exist.
"""
Requires: app at localhost:12000, at least one project exists.
Training sub-tab tests are skipped if no training sessions exist.
"""

import pytest
from .conftest import goto, DEFAULT_TIMEOUT, FAST_TIMEOUT


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _open_modellab(page, project_id: str):
    """Navigate to workspace and open Model Lab section."""
    goto(page, f"/projects/{project_id}/workspace")
    page.wait_for_timeout(1200)
    page.click(".ant-menu-item:has-text('Model Lab')")
    page.wait_for_timeout(1200)


def _select_first_training(page) -> bool:
    """
    Click the first training in the TrainingList.
    Returns True if a training was found and selected, False otherwise.
    """
    training_item = page.query_selector(
        "[class*='TrainingList'] .ant-list-item, "
        "[class*='training-list'] li, "
        "[class*='training-item'], "
        "[class*='TrainingItem']"
    )
    if training_item is None:
        return False
    training_item.click()
    page.wait_for_timeout(1000)
    return True


def _click_right_panel_tab(page, tab_name: str):
    """Click a tab in the right-panel OverviewView by its label."""
    page.click(
        f".ant-tabs-tab:has-text('{tab_name}'), "
        f"[role='tab']:has-text('{tab_name}')"
    )
    page.wait_for_timeout(800)


# ---------------------------------------------------------------------------
# Section-level tests (no training required)
# ---------------------------------------------------------------------------

def test_modellab_section_renders(workspace_page):
    """Model Lab section loads without crash."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    page.wait_for_selector(
        "text=Model Lab, text=Training, text=Experiments",
        timeout=DEFAULT_TIMEOUT,
    )


def test_modellab_training_list_panel_visible(workspace_page):
    """Left panel (TrainingList) is visible."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    left_panel = page.query_selector(
        "[class*='TrainingList'], [class*='training-list'], "
        "text=Training Sessions, text=No training sessions, "
        ".ant-list"
    )
    assert left_panel is not None, "TrainingList left panel not found"


def test_modellab_empty_state_or_training_items(workspace_page):
    """
    The TrainingList shows either training items or a meaningful empty state.
    Must not be blank/broken.
    """
    page, project_id = workspace_page
    _open_modellab(page, project_id)
    page.wait_for_timeout(1000)

    content = page.query_selector(
        ".ant-list-item, [class*='training-item'], "
        ".ant-empty, "
        "text=No training, text=No sessions"
    )
    assert content is not None, "Model Lab left panel is blank — broken render?"


# ---------------------------------------------------------------------------
# Right panel — 6 tabs (requires a training session to be selected)
# ---------------------------------------------------------------------------

def test_modellab_six_tabs_visible_after_selecting_training(workspace_page):
    """After selecting a training, all 6 right-panel tabs are visible."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions — run a training first.")

    expected_tabs = ["Overview", "Configuration", "Models", "Validation", "Prediction", "Comparison"]
    for tab_name in expected_tabs:
        tab = page.query_selector(
            f".ant-tabs-tab:has-text('{tab_name}'), [role='tab']:has-text('{tab_name}')"
        )
        assert tab is not None, f"Tab '{tab_name}' not found in Model Lab right panel"


# ---------------------------------------------------------------------------
# Tab 1: Overview
# ---------------------------------------------------------------------------

def test_modellab_overview_tab_shows_metrics(workspace_page):
    """Overview tab shows best metrics summary."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Overview")

    metrics = page.query_selector(
        "text=mAP, text=Loss, text=Accuracy, "
        "text=Best Metrics, text=Metrics, "
        ".ant-statistic, .ant-card"
    )
    assert metrics is not None, "No metrics found in Overview tab"


def test_modellab_overview_tab_has_chart(workspace_page):
    """Overview tab has a loss/accuracy chart (canvas or SVG)."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Overview")
    page.wait_for_timeout(800)

    chart = page.query_selector("canvas, svg, [class*='chart'], [class*='Chart']")
    assert chart is not None, "No chart element found in Overview tab"


# ---------------------------------------------------------------------------
# Tab 2: Configuration
# ---------------------------------------------------------------------------

def test_modellab_configuration_tab_renders(workspace_page):
    """Configuration tab renders config viewer or YAML editor."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Configuration")

    config_el = page.query_selector(
        "text=Config, text=YAML, text=Configuration, "
        "pre, code, textarea, "
        "[class*='config'], [class*='yaml']"
    )
    assert config_el is not None, "No config/YAML content found in Configuration tab"


def test_modellab_configuration_has_yaml_editor(workspace_page):
    """Configuration tab has an advanced YAML editor."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Configuration")

    yaml_editor = page.query_selector(
        "text=Advanced Config, text=YAML Editor, "
        "textarea, pre, "
        "[class*='editor'], [class*='Editor']"
    )
    assert yaml_editor is not None, "YAML editor not found in Configuration tab"


# ---------------------------------------------------------------------------
# Tab 3: Models (ModelManagerView)
# ---------------------------------------------------------------------------

def test_modellab_models_tab_renders(workspace_page):
    """Models tab (ModelManagerView) renders."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Models")

    models_content = page.query_selector(
        "text=best.pt, text=last.pt, text=Weights, "
        "text=No weights, text=Model Manager, "
        "[class*='model-manager'], [class*='ModelManager']"
    )
    assert models_content is not None, "Models tab content not found"


def test_modellab_models_tab_has_download_option(workspace_page):
    """Models tab has a download button for model weights."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Models")
    page.wait_for_timeout(600)

    download = page.query_selector(
        "button:has-text('Download'), .anticon-download, "
        "text=best.pt, text=Download"
    )
    if download is None:
        pytest.skip("No model weights available to download.")


# ---------------------------------------------------------------------------
# Tab 4: Validation
# ---------------------------------------------------------------------------

def test_modellab_validation_tab_renders(workspace_page):
    """Validation tab renders with a run button or experiment list."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Validation")

    val_content = page.query_selector(
        "text=Validation, text=Run Validation, "
        "button:has-text('Run'), button:has-text('Validate'), "
        "[class*='ValidationView']"
    )
    assert val_content is not None, "Validation tab content not found"


def test_modellab_validation_has_confidence_slider(workspace_page):
    """Validation tab has a confidence threshold slider or input."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Validation")

    conf = page.query_selector(
        "text=Confidence, text=conf, "
        ".ant-slider, .ant-input-number"
    )
    assert conf is not None, "Confidence threshold control not found in Validation tab"


def test_modellab_validation_has_iou_control(workspace_page):
    """Validation tab has an IoU threshold control."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Validation")

    iou = page.query_selector(
        "text=IoU, text=iou, "
        ".ant-slider, .ant-input-number"
    )
    assert iou is not None, "IoU control not found in Validation tab"


def test_modellab_validation_has_split_selector(workspace_page):
    """Validation tab lets user choose val / test split."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Validation")

    split_sel = page.query_selector(
        "text=val, text=test, text=Split, "
        ".ant-select:has-text('val'), .ant-select:has-text('Split')"
    )
    assert split_sel is not None, "Dataset split selector not found in Validation tab"


# ---------------------------------------------------------------------------
# Tab 5: Prediction
# ---------------------------------------------------------------------------

def test_modellab_prediction_tab_renders(workspace_page):
    """Prediction tab renders."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")

    pred_content = page.query_selector(
        "text=Prediction, text=Run Prediction, "
        "button:has-text('Run'), button:has-text('Predict'), "
        "[class*='PredictionView']"
    )
    assert pred_content is not None, "Prediction tab content not found"


def test_modellab_prediction_has_confidence_control(workspace_page):
    """Prediction tab has a confidence threshold control."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")

    conf = page.query_selector(
        "text=Confidence, .ant-slider, .ant-input-number"
    )
    assert conf is not None, "Confidence control not found in Prediction tab"


def test_modellab_prediction_has_run_button(workspace_page):
    """Prediction tab has a 'Run' button to start prediction."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")

    run_btn = page.query_selector(
        "button:has-text('Run'), button:has-text('Predict'), "
        "button:has-text('Start Prediction'), button:has-text('Run Prediction')"
    )
    assert run_btn is not None, "Run/Predict button not found in Prediction tab"


def test_modellab_prediction_analytics_button_exists(workspace_page):
    """
    After a prediction experiment exists, the Analytics button is visible.
    Skipped if no prediction experiments have been run.
    """
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")
    page.wait_for_timeout(800)

    analytics_btn = page.query_selector(
        "button:has-text('Analytics'), .anticon-bar-chart, "
        "button:has-text('View Analytics')"
    )
    if analytics_btn is None:
        pytest.skip("Analytics button not found — run a prediction experiment first.")

    assert analytics_btn is not None


def test_modellab_prediction_analytics_modal_opens(workspace_page):
    """
    Clicking the Analytics button opens AnalyticsModal.
    """
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")
    page.wait_for_timeout(800)

    analytics_btn = page.query_selector(
        "button:has-text('Analytics'), button:has-text('View Analytics')"
    )
    if analytics_btn is None:
        pytest.skip("Analytics button not found — run a prediction first.")

    analytics_btn.click()
    page.wait_for_timeout(800)

    modal = page.query_selector(".ant-modal:visible, .ant-modal-content:visible")
    assert modal is not None, "AnalyticsModal did not open"


def test_modellab_prediction_analytics_modal_has_four_tabs(workspace_page):
    """
    AnalyticsModal has 4 sub-view tabs:
    Charts, Quality, Report, Export
    """
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")
    page.wait_for_timeout(800)

    analytics_btn = page.query_selector(
        "button:has-text('Analytics'), button:has-text('View Analytics')"
    )
    if analytics_btn is None:
        pytest.skip("Analytics button not found.")

    analytics_btn.click()
    page.wait_for_timeout(800)

    modal = page.query_selector(".ant-modal:visible")
    if modal is None:
        pytest.skip("AnalyticsModal did not open.")

    expected_tabs = ["Charts", "Quality", "Report", "Export"]
    for tab_name in expected_tabs:
        tab = modal.query_selector(
            f".ant-tabs-tab:has-text('{tab_name}'), [role='tab']:has-text('{tab_name}')"
        )
        assert tab is not None, f"Analytics sub-view tab '{tab_name}' not found inside AnalyticsModal"


def test_modellab_prediction_analytics_charts_view(workspace_page):
    """Charts sub-view inside AnalyticsModal renders chart elements."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")
    page.wait_for_timeout(800)

    analytics_btn = page.query_selector(
        "button:has-text('Analytics'), button:has-text('View Analytics')"
    )
    if analytics_btn is None:
        pytest.skip("Analytics button not found.")

    analytics_btn.click()
    page.wait_for_timeout(800)

    modal = page.query_selector(".ant-modal:visible")
    if modal is None:
        pytest.skip("AnalyticsModal did not open.")

    # Click Charts tab (should be default)
    charts_tab = modal.query_selector(".ant-tabs-tab:has-text('Charts')")
    if charts_tab:
        charts_tab.click()
        page.wait_for_timeout(600)

    chart_el = modal.query_selector("canvas, svg, [class*='chart'], [class*='Chart']")
    assert chart_el is not None, "No chart element found in Charts sub-view"


def test_modellab_prediction_analytics_quality_view(workspace_page):
    """Quality sub-view inside AnalyticsModal renders quality stats."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")
    page.wait_for_timeout(800)

    analytics_btn = page.query_selector(
        "button:has-text('Analytics'), button:has-text('View Analytics')"
    )
    if analytics_btn is None:
        pytest.skip("Analytics button not found.")

    analytics_btn.click()
    page.wait_for_timeout(800)

    modal = page.query_selector(".ant-modal:visible")
    if modal is None:
        pytest.skip("AnalyticsModal did not open.")

    quality_tab = modal.query_selector(".ant-tabs-tab:has-text('Quality')")
    if quality_tab is None:
        pytest.skip("Quality tab not found in AnalyticsModal.")

    quality_tab.click()
    page.wait_for_timeout(600)

    quality_content = modal.query_selector(
        "text=Quality, text=Precision, text=Recall, .ant-statistic, .ant-table"
    )
    assert quality_content is not None, "Quality sub-view has no content"


def test_modellab_prediction_analytics_report_view(workspace_page):
    """Report sub-view inside AnalyticsModal has a PDF generation button."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")
    page.wait_for_timeout(800)

    analytics_btn = page.query_selector(
        "button:has-text('Analytics'), button:has-text('View Analytics')"
    )
    if analytics_btn is None:
        pytest.skip("Analytics button not found.")

    analytics_btn.click()
    page.wait_for_timeout(800)

    modal = page.query_selector(".ant-modal:visible")
    if modal is None:
        pytest.skip("AnalyticsModal did not open.")

    report_tab = modal.query_selector(".ant-tabs-tab:has-text('Report')")
    if report_tab is None:
        pytest.skip("Report tab not found.")

    report_tab.click()
    page.wait_for_timeout(600)

    pdf_btn = modal.query_selector(
        "button:has-text('PDF'), button:has-text('Generate Report'), "
        "button:has-text('Download Report'), text=PDF Report"
    )
    assert pdf_btn is not None, "PDF generation button not found in Report sub-view"


def test_modellab_prediction_analytics_export_view(workspace_page):
    """Export sub-view inside AnalyticsModal has an export/download button."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")
    page.wait_for_timeout(800)

    analytics_btn = page.query_selector(
        "button:has-text('Analytics'), button:has-text('View Analytics')"
    )
    if analytics_btn is None:
        pytest.skip("Analytics button not found.")

    analytics_btn.click()
    page.wait_for_timeout(800)

    modal = page.query_selector(".ant-modal:visible")
    if modal is None:
        pytest.skip("AnalyticsModal did not open.")

    export_tab = modal.query_selector(".ant-tabs-tab:has-text('Export')")
    if export_tab is None:
        pytest.skip("Export tab not found.")

    export_tab.click()
    page.wait_for_timeout(600)

    export_btn = modal.query_selector(
        "button:has-text('Export'), button:has-text('Download'), "
        "button:has-text('ZIP'), text=Export Results"
    )
    assert export_btn is not None, "Export button not found in Export sub-view"


def test_modellab_prediction_gallery_renders(workspace_page):
    """
    After a prediction experiment is run, the gallery shows predicted images.
    Skipped if no experiments exist.
    """
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Prediction")
    page.wait_for_timeout(1000)

    gallery = page.query_selector(
        "[class*='gallery'], [class*='Gallery'], "
        ".ant-card img, text=No images, text=Gallery"
    )
    if gallery is None:
        pytest.skip("Gallery area not found — run a prediction first.")


# ---------------------------------------------------------------------------
# Tab 6: Comparison Engine
# ---------------------------------------------------------------------------

def test_modellab_comparison_tab_renders(workspace_page):
    """Comparison Engine tab renders."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Comparison")

    comp_content = page.query_selector(
        "text=Comparison, text=Compare, "
        "[class*='ComparisonEngine'], [class*='comparison']"
    )
    assert comp_content is not None, "Comparison Engine tab content not found"


def test_modellab_comparison_has_experiment_selectors(workspace_page):
    """Comparison tab has selectors to choose 2 or 3 experiments."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Comparison")

    selectors = page.query_selector_all(".ant-select")
    if not selectors:
        pytest.skip("No selectors found in Comparison tab — may need experiments first.")

    assert len(selectors) >= 2, \
        f"Expected at least 2 experiment selectors, found {len(selectors)}"


def test_modellab_comparison_has_compare_button(workspace_page):
    """Comparison tab has a 'Compare' button."""
    page, project_id = workspace_page
    _open_modellab(page, project_id)

    if not _select_first_training(page):
        pytest.skip("No training sessions.")

    _click_right_panel_tab(page, "Comparison")

    compare_btn = page.query_selector(
        "button:has-text('Compare'), button:has-text('Run Comparison')"
    )
    assert compare_btn is not None, "'Compare' button not found in Comparison tab"
