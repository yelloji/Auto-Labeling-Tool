# UI Test Issues — To Fix Later

## Issue 1: `_get_first_dataset_id` still uses DOM scraping (broken)

**File:** `ui/test_ui_annotation.py` — function `_get_first_dataset_id()` (line 72)

**Problem:**
The function navigates to `/projects` and looks for `a[href*='/projects/']` links in the DOM.
Project cards use `onClick + navigate()` — there are NO `<a href>` tags.
So `project_link` is always `None` → function returns `None` → all annotation tests skip
with "No annotatable dataset found — upload images first."

**Fix needed:**
Replace DOM scraping with direct API calls, same pattern as the `get_first_project_id` fix in `conftest.py`:

```python
def _get_first_dataset_id(page) -> str | None:
    # 1. Get first project via API
    response = page.request.get(f"{BASE_URL}/api/projects")
    if response.status != 200:
        return None
    projects = response.json()
    if not projects:
        return None
    project_id = projects[0]["id"]

    # 2. Get first dataset for that project via API
    response = page.request.get(f"{BASE_URL}/api/datasets?project_id={project_id}")
    if response.status != 200:
        return None
    datasets = response.json()
    if not datasets:
        return None
    return str(datasets[0]["id"])
```

**Verify:** Check the actual datasets API endpoint path — it may be `/api/datasets?project_id=X` or `/api/projects/{id}/datasets`.

---

## Issue 2: `page` fixture `--headed` flag now fixed

**File:** `ui/conftest.py`

**Status:** FIXED — `request.config.getoption("--headed")` now passed to `playwright.chromium.launch(headless=not headed)`.

---

## Issue 3: Other test files may have the same DOM scraping problem

Check these files for any `a[href*='/projects/']` selectors that need the same API fix:
- `ui/test_ui_release.py`
- `ui/test_ui_modellab.py`
- `ui/test_ui_dataset.py`
