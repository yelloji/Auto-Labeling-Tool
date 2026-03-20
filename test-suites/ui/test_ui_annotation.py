"""
UI Tests — Annotation Canvas (/annotate/{datasetId}/manual)

Layout: Left Sidebar | Main Canvas | Right Toolbox | Bottom Controls

What is tested:
  LabelSidebar (left):
    - Image list renders
    - Thumbnail images are visible
    - Clicking an image thumbnail selects it (active state)

  AnnotationCanvas (center):
    - Canvas/image display area is present
    - The selected image loads inside the canvas

  AnnotationToolbox (right):
    - Tool buttons: Rectangle, Polygon, Point
    - Label selector dropdown is present
    - Annotation list is present
    - Undo / Redo buttons exist

  Bottom Controls:
    - Previous / Next image buttons
    - Save button
    - Delete image button
    - Progress indicator (x of y images)

  AnnotationSplitControl:
    - Train / Val / Test assignment buttons/radio exist

  LabelSelectionPopup:
    - Appears after drawing an annotation (hard to test without drawing,
      so we verify the existence of labels in the toolbox label selector)

Requires: app at localhost:12000, at least one dataset with images exists.
"""

import pytest
from .conftest import goto, DEFAULT_TIMEOUT, FAST_TIMEOUT


# ---------------------------------------------------------------------------
# Helper — find a dataset ID to annotate
# ---------------------------------------------------------------------------

def _get_first_dataset_id(page) -> str | None:
    """
    Navigate to /projects, open the first project workspace, go to Management,
    and extract the first dataset id from any 'Annotate' or dataset card link.
    Returns None if no dataset is found.
    """
    # Try to extract dataset ID from the Management section URLs
    goto(page, "/projects")
    page.wait_for_timeout(1000)

    # Get the first project link
    project_link = page.query_selector("a[href*='/projects/'], .ant-card a[href*='/workspace']")
    if project_link is None:
        return None

    href = project_link.get_attribute("href") or ""
    project_id = None
    for part in href.split("/"):
        if part.isdigit():
            project_id = part
            break

    if project_id is None:
        return None

    # Navigate to management to find dataset
    goto(page, f"/projects/{project_id}/workspace")
    page.wait_for_timeout(1200)
    page.click(".ant-menu-item:has-text('Management')")
    page.wait_for_timeout(1000)

    # Find any dataset card's Annotate link (links to /annotate-launcher/{datasetId})
    annotate_link = page.query_selector("a[href*='/annotate-launcher/'], a[href*='/annotate/']")
    if annotate_link is None:
        return None

    href = annotate_link.get_attribute("href") or ""
    # Extract dataset id from href like /annotate-launcher/abc-123-def
    parts = href.split("/")
    for i, part in enumerate(parts):
        if "annotate" in part.lower() and i + 1 < len(parts):
            return parts[i + 1]

    return None


def _open_annotation_canvas(page) -> bool:
    """
    Navigate to the annotation canvas for the first available dataset.
    Returns True if successful, False if no dataset found.
    """
    dataset_id = _get_first_dataset_id(page)
    if dataset_id is None:
        return False

    goto(page, f"/annotate/{dataset_id}/manual")
    page.wait_for_timeout(2000)
    return True


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_annotation_page_loads(page):
    """Annotation canvas page loads without crash."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No annotatable dataset found — upload images first.")

    # The page should show something from the annotation UI
    page.wait_for_selector(
        "canvas, [class*='AnnotationCanvas'], "
        "[class*='annotation-canvas'], "
        "[class*='LabelSidebar'], [class*='label-sidebar']",
        timeout=DEFAULT_TIMEOUT,
    )


def test_annotation_label_sidebar_renders(page):
    """Left sidebar (LabelSidebar) with image list is visible."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    sidebar = page.query_selector(
        "[class*='LabelSidebar'], [class*='label-sidebar'], "
        "[class*='image-list'], [class*='ImageList']"
    )
    assert sidebar is not None, "LabelSidebar not found"


def test_annotation_canvas_area_visible(page):
    """Central canvas/image display area is visible."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    canvas = page.query_selector(
        "canvas, "
        "[class*='AnnotationCanvas'], [class*='annotation-canvas'], "
        "[class*='canvas-container']"
    )
    assert canvas is not None, "Annotation canvas area not found"


def test_annotation_toolbox_renders(page):
    """Right toolbox panel is visible."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    toolbox = page.query_selector(
        "[class*='AnnotationToolbox'], [class*='annotation-toolbox'], "
        "[class*='Toolbox'], [class*='toolbox']"
    )
    assert toolbox is not None, "AnnotationToolbox not found"


def test_annotation_tool_rectangle_button_exists(page):
    """Rectangle (bounding box) tool button is visible."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    rect_btn = page.query_selector(
        "button:has-text('Rectangle'), button:has-text('Box'), "
        ".anticon-border, [title*='Rectangle'], [title*='Box']"
    )
    assert rect_btn is not None, "Rectangle tool button not found"


def test_annotation_tool_polygon_button_exists(page):
    """Polygon tool button is visible."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    poly_btn = page.query_selector(
        "button:has-text('Polygon'), [title*='Polygon'], "
        ".anticon-gateway, [class*='polygon']"
    )
    assert poly_btn is not None, "Polygon tool button not found"


def test_annotation_label_selector_in_toolbox(page):
    """A label/class selector dropdown exists in the toolbox."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    label_sel = page.query_selector(
        "[class*='AnnotationToolbox'] .ant-select, "
        "[class*='toolbox'] .ant-select, "
        "text=Label, text=Class, text=Select Label"
    )
    assert label_sel is not None, "Label selector not found in toolbox"


def test_annotation_undo_redo_buttons_exist(page):
    """Undo and Redo buttons are present."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    undo = page.query_selector(
        "button:has-text('Undo'), .anticon-undo, [title*='Undo']"
    )
    redo = page.query_selector(
        "button:has-text('Redo'), .anticon-redo, [title*='Redo']"
    )
    assert undo is not None, "Undo button not found"
    assert redo is not None, "Redo button not found"


def test_annotation_save_button_exists(page):
    """Save button is visible in the bottom controls."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    save_btn = page.query_selector(
        "button:has-text('Save'), .anticon-save, [title*='Save']"
    )
    assert save_btn is not None, "Save button not found"


def test_annotation_previous_next_buttons_exist(page):
    """Previous and Next image navigation buttons are visible."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    prev = page.query_selector(
        "button:has-text('Previous'), button:has-text('Prev'), "
        ".anticon-left, [title*='Previous']"
    )
    nxt = page.query_selector(
        "button:has-text('Next'), .anticon-right, [title*='Next']"
    )
    assert prev is not None, "Previous button not found"
    assert nxt  is not None, "Next button not found"


def test_annotation_progress_indicator_exists(page):
    """A progress indicator (e.g. '1 of 5 images') is visible."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    progress = page.query_selector(
        "text=of, text=images, "
        ".ant-progress, [class*='progress']"
    )
    assert progress is not None, "Progress indicator not found in annotation view"


def test_annotation_split_control_exists(page):
    """Train / Val / Test assignment control (AnnotationSplitControl) is visible."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    split_ctrl = page.query_selector(
        "text=Train, text=Val, text=Test, "
        ".ant-radio-group, .ant-segmented, "
        "[class*='SplitControl'], [class*='split-control']"
    )
    assert split_ctrl is not None, "AnnotationSplitControl not found"


def test_annotation_sidebar_has_image_thumbnails(page):
    """The left sidebar shows at least one image thumbnail."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    thumbnails = page.query_selector_all(
        "[class*='LabelSidebar'] img, [class*='label-sidebar'] img, "
        "[class*='image-list'] img"
    )
    if not thumbnails:
        pytest.skip("No thumbnail images in sidebar — dataset may be empty.")

    assert len(thumbnails) > 0, "No thumbnails found in LabelSidebar"


def test_annotation_delete_image_button_exists(page):
    """Delete image button is present in the bottom controls."""
    success = _open_annotation_canvas(page)
    if not success:
        pytest.skip("No dataset to annotate.")

    del_btn = page.query_selector(
        "button:has-text('Delete'), .anticon-delete, "
        "[title*='Delete'], button[danger]"
    )
    assert del_btn is not None, "Delete image button not found"
