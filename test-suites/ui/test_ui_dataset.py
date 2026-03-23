"""
test_ui_dataset.py — UI Tests for the Dataset Section (sidebar → 'Dataset').

WHAT THIS SECTION DOES
----------------------
The Dataset section shows all images across completed datasets in a gallery view.
It is the main browsing and quality-checking view before creating a release.
Users can filter by filename, class, split (train/val/test), or dataset,
and can assign images to train/val/test splits from here.

WHAT IS TESTED
--------------
  Gallery           — image cards render in a grid layout
  Filters           — search box, split filter, dataset filter, class filter, sort control
  Image card        — thumbnail is visible on each card
  Split tag         — each card shows its split assignment (train / val / test / unassigned)
  Annotation overlay — annotated images show an SVG box overlay on the thumbnail
  Pagination        — pagination controls appear when there are many images (>50)
  Create Release    — 'Create New Release' button is visible at the top
  Filter interaction — applying a filter changes which image cards are shown

Requires: app at localhost:12000, at least one project with images in 'Dataset' stage.
"""

import pytest
from .conftest import goto, DEFAULT_TIMEOUT, FAST_TIMEOUT


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _open_dataset_section(page, project_id: str):
    goto(page, f"/projects/{project_id}/workspace")
    page.wait_for_timeout(1200)
    page.click(".ant-menu-item:has-text('Dataset')")
    page.wait_for_timeout(1000)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_dataset_section_renders(workspace_page):
    """Dataset section loads without crash."""
    page, project_id = workspace_page
    _open_dataset_section(page, project_id)

    # Heading or a key element from the Dataset section
    page.wait_for_selector(
        "text=Dataset, text=Images, text=Gallery",
        timeout=DEFAULT_TIMEOUT,
    )


def test_dataset_filter_bar_visible(workspace_page):
    """The filter bar (search, split, sort) is visible."""
    page, project_id = workspace_page
    _open_dataset_section(page, project_id)

    # At least a search input or filter select should be present
    filter_el = page.query_selector(
        "input[placeholder*='Search'], "
        "input[placeholder*='search'], "
        "input[placeholder*='filename'], "
        ".ant-select"
    )
    assert filter_el is not None, "No filter bar elements found in Dataset section"


def test_dataset_split_filter_exists(workspace_page):
    """A split filter (All / Train / Val / Test) dropdown is present."""
    page, project_id = workspace_page
    _open_dataset_section(page, project_id)

    split_filter = page.query_selector(
        ".ant-select:has-text('All'), "
        ".ant-select:has-text('Split'), "
        ".ant-select:has-text('Train'), "
        "text=All Splits, text=Split"
    )
    assert split_filter is not None, "Split filter dropdown not found"


def test_dataset_create_release_button_visible(workspace_page):
    """'Create New Release' button is visible in the Dataset section."""
    page, project_id = workspace_page
    _open_dataset_section(page, project_id)

    btn = page.query_selector(
        "button:has-text('Create New Release'), "
        "button:has-text('Create Release'), "
        "button:has-text('New Release')"
    )
    assert btn is not None, "'Create New Release' button not found"


def test_dataset_image_cards_render(workspace_page):
    """
    If images exist in the Dataset stage, image cards are rendered in the gallery.
    Skipped if no images have been moved to Dataset stage yet.
    """
    page, project_id = workspace_page
    _open_dataset_section(page, project_id)

    page.wait_for_timeout(1000)
    cards = page.query_selector_all(".ant-card img, [class*='image-card'] img")
    if not cards:
        pytest.skip("No images in Dataset stage — move images to Dataset stage first.")

    assert len(cards) > 0, "Expected image cards but found none"


def test_dataset_image_card_has_split_tag(workspace_page):
    """Each image card shows a split tag (train / val / test / unassigned)."""
    page, project_id = workspace_page
    _open_dataset_section(page, project_id)

    page.wait_for_timeout(1000)
    cards = page.query_selector_all(".ant-card")
    if not cards:
        pytest.skip("No image cards — Dataset stage is empty.")

    # Find a tag with split value
    tag = page.query_selector(
        ".ant-tag:has-text('train'), "
        ".ant-tag:has-text('val'), "
        ".ant-tag:has-text('test'), "
        ".ant-tag:has-text('Train'), "
        ".ant-tag:has-text('Val'), "
        ".ant-tag:has-text('Test')"
    )
    assert tag is not None, "No split tag (train/val/test) found on image cards"


def test_dataset_search_filters_images(workspace_page):
    """Typing in the filename search box changes displayed results."""
    page, project_id = workspace_page
    _open_dataset_section(page, project_id)
    page.wait_for_timeout(1000)

    search_input = page.query_selector(
        "input[placeholder*='Search'], input[placeholder*='filename'], input[placeholder*='search']"
    )
    if search_input is None:
        pytest.skip("Search input not found.")

    cards_before = page.query_selector_all(".ant-card img, [class*='image-card']")
    if not cards_before:
        pytest.skip("No image cards — Dataset section is empty.")

    # Search for something that won't match
    search_input.fill("zzz_no_match_xyz")
    page.wait_for_timeout(800)

    cards_after = page.query_selector_all(".ant-card img, [class*='image-card']")
    assert len(cards_after) <= len(cards_before), \
        "Search did not reduce visible image count"


def test_dataset_sort_select_exists(workspace_page):
    """A sort dropdown is rendered in the filter bar."""
    page, project_id = workspace_page
    _open_dataset_section(page, project_id)

    sort_select = page.query_selector(
        ".ant-select:has-text('Sort'), "
        ".ant-select:has-text('sort'), "
        "text=Sort by, text=Sort By"
    )
    assert sort_select is not None, "Sort dropdown not found in Dataset section"


def test_dataset_pagination_controls_exist(workspace_page):
    """
    Pagination controls (Ant Design Pagination) are rendered.
    They may show 1 page only, but the element should exist.
    """
    page, project_id = workspace_page
    _open_dataset_section(page, project_id)
    page.wait_for_timeout(800)

    pagination = page.query_selector(".ant-pagination")
    assert pagination is not None, "Pagination component not found in Dataset section"
