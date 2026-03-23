"""
test_ui_training.py — UI Tests for Model Training Section (sidebar → 'Model Training').

WHAT THIS SECTION DOES
----------------------
Model Training lets users configure and launch a YOLO model training job.
Users set the training name, choose a framework (ultralytics), pick a task
(object detection or segmentation), select a pretrained base model, configure
hyperparameters (epochs, image size, batch size), choose device (CPU/GPU),
and click Start Training.

There are two modes:
  User mode       — simplified UI with sensible defaults
  Developer mode  — full access to all hyperparameter settings

WHAT IS TESTED
--------------
  Tab 1 — Config (the setup form):
    Mode toggle      — User / Developer mode switch is visible
    Training name    — text input field for the session name
    Framework        — dropdown to choose ultralytics (YOLO)
    Task type        — object detection / segmentation selector
    Pretrained model — dropdown to pick a base model (e.g. yolo11n)
    Dataset source   — select a release ZIP or local path as training data
    Hyperparameters  — epochs, image size, batch size inputs are visible
    Device           — CPU / GPU selector is visible
    Start Training   — the submit button exists and is visible

  Tab 2 — Training live dashboard:
    Only available after a training is started — not tested here
    (would require actually launching a training job)

Requires: app at localhost:12000, at least one project exists.
"""

import pytest
from .conftest import goto, DEFAULT_TIMEOUT, FAST_TIMEOUT


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _open_training_section(page, project_id: str):
    goto(page, f"/projects/{project_id}/workspace")
    page.wait_for_timeout(1200)
    page.click(".ant-menu-item:has-text('Model Training')")
    page.wait_for_timeout(1000)


# ---------------------------------------------------------------------------
# Config Tab tests
# ---------------------------------------------------------------------------

def test_training_section_renders(workspace_page):
    """Model Training section loads without crash."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    page.wait_for_selector(
        "text=Model Training, text=Training, text=Config",
        timeout=DEFAULT_TIMEOUT,
    )


def test_training_has_two_tabs(workspace_page):
    """Two tabs exist: Config and Training."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    config_tab = page.query_selector(
        ".ant-tabs-tab:has-text('Config'), "
        ".ant-tabs-tab:has-text('Configuration')"
    )
    training_tab = page.query_selector(
        ".ant-tabs-tab:has-text('Training'), "
        ".ant-tabs-tab:has-text('Live')"
    )

    assert config_tab is not None, "'Config' tab not found"
    assert training_tab is not None, "'Training' tab not found"


def test_training_mode_toggle_exists(workspace_page):
    """User / Developer mode toggle is present."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    toggle = page.query_selector(
        ".ant-radio-group, "
        ".ant-segmented, "
        "text=User, text=Developer, text=Mode"
    )
    assert toggle is not None, "User/Developer mode toggle not found"


def test_training_name_input_exists(workspace_page):
    """Training name input is present in the identity section."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    name_input = page.query_selector(
        "input[placeholder*='Training name'], "
        "input[placeholder*='Name'], "
        "input[placeholder*='name'], "
        "input[id*='name']"
    )
    assert name_input is not None, "Training name input not found"


def test_training_framework_selector_exists(workspace_page):
    """Framework selector (ultralytics etc.) is present."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    selector = page.query_selector(
        ".ant-select:has-text('ultralytics'), "
        ".ant-select:has-text('Framework'), "
        "text=Framework, text=ultralytics"
    )
    assert selector is not None, "Framework selector not found"


def test_training_task_selector_exists(workspace_page):
    """Task type selector (detection / segmentation) is present."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    task_sel = page.query_selector(
        "text=detection, text=segmentation, "
        ".ant-select:has-text('detection'), "
        ".ant-select:has-text('Task')"
    )
    assert task_sel is not None, "Task type selector not found"


def test_training_pretrained_model_selector_exists(workspace_page):
    """Pretrained model selector is present."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    model_sel = page.query_selector(
        "text=Pretrained, text=Base Model, "
        ".ant-select:has-text('Pretrained'), "
        ".ant-select:has-text('Model')"
    )
    assert model_sel is not None, "Pretrained model selector not found"


def test_training_epochs_input_exists(workspace_page):
    """Epochs hyperparameter input is visible."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    epochs = page.query_selector(
        "input[placeholder*='epoch'], "
        "text=Epochs, "
        ".ant-input-number"
    )
    assert epochs is not None, "Epochs input not found"


def test_training_image_size_input_exists(workspace_page):
    """Image size hyperparameter input is visible."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    imgsz = page.query_selector(
        "text=Image Size, text=imgsz, "
        "input[placeholder*='size'], "
        "input[placeholder*='Image Size']"
    )
    assert imgsz is not None, "Image size input not found"


def test_training_batch_size_input_exists(workspace_page):
    """Batch size hyperparameter input is visible."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    batch = page.query_selector(
        "text=Batch, text=batch, "
        "input[placeholder*='batch']"
    )
    assert batch is not None, "Batch size input not found"


def test_training_device_selector_exists(workspace_page):
    """CPU / GPU device selector is present."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    device = page.query_selector(
        "text=CPU, text=GPU, "
        "text=Device, "
        ".ant-select:has-text('Device'), "
        ".ant-radio-group:has-text('CPU')"
    )
    assert device is not None, "Device (CPU/GPU) selector not found"


def test_training_start_button_exists(workspace_page):
    """'Start Training' button is present in the Config tab."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    start_btn = page.query_selector(
        "button:has-text('Start Training'), "
        "button:has-text('Start'), "
        "button:has-text('Train')"
    )
    assert start_btn is not None, "'Start Training' button not found"


def test_training_dataset_source_exists(workspace_page):
    """Dataset source selection (release ZIP or local path) is present."""
    page, project_id = workspace_page
    _open_training_section(page, project_id)

    dataset_el = page.query_selector(
        "text=Dataset, text=Release, "
        ".ant-select:has-text('Release'), "
        "text=Dataset Source"
    )
    assert dataset_el is not None, "Dataset source selector not found"
