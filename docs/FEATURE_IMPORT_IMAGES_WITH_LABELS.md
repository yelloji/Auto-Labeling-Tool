# Feature: Import Images with Labels (YOLO + COCO)

## Purpose

Allow users to upload a folder of images **together with their existing label files** (YOLO `.txt` or COCO `.json` format). The app will:

1. Store images on disk and create `Image` records (same as normal upload)
2. Parse label files and create `Annotation` records automatically — no re-labeling from scratch
3. Create new `Label` (class) records for any classes not yet in the project

This lets users bring labeled data from any tool (Roboflow, LabelImg, CVAT, etc.) into the app without losing existing annotation work.

---

## Scope

- **Supported formats:** YOLO (`.txt` + `data.yaml`) and COCO (`.json`)
- **Not supported:** Pascal VOC (removed from app entirely)
- **Task types:** Both detection (bounding box) and segmentation (polygon)
- **New API endpoint:** Separate from existing `/datasets/upload` — does not touch existing upload logic
- **New UI button:** Separate section in Upload page — does not change existing upload UI

---

## How the App Currently Works (Reference)

### Image Storage Path
```
projects/{project_name}/unassigned/{dataset_name}/{filename}
```
Example: `projects/MyProject/unassigned/my_batch/image_01.jpg`

### DB: Image Record (table: `images`)
| Column | Type | Value |
|--------|------|-------|
| `id` | UUID string | auto-generated |
| `filename` | string | `image_01.jpg` |
| `original_filename` | string | `image_01.jpg` |
| `file_path` | string | `projects/MyProject/unassigned/my_batch/image_01.jpg` |
| `dataset_id` | UUID | FK to dataset |
| `width` | int | from PIL |
| `height` | int | from PIL |
| `file_size` | int | bytes |
| `format` | string | `jpeg` |
| `is_labeled` | bool | `False` initially, `True` after annotations saved |
| `split_type` | string | `unassigned` |
| `split_section` | string | `train` |
| `image_hash_md5` | string(32) or null | MD5 of image bytes — **new column** |

#### Image Hash Strategy (where hashes live)

| Image type | Where hash is stored | Reason |
|-----------|---------------------|--------|
| Dataset images (uploaded) | `Image.image_hash_md5` (DB column, indexed) | Long-lived, needs to be searched across whole project |
| Prediction run images | `ModelExperiment.input_images` JSON `{filename: md5}` | Already implemented in `prediction_executor.py` — no change |
| Verification records | `HumanVerification.image_hash_md5` (DB column) | Already exists — links verifications back to original image |

This separation means:
- Normal uploads → `Image.image_hash_md5` (filled by import now, filled by normal upload later)
- Prediction runs → JSON (already working)
- Auto-verification feature (future) → matches `Image.image_hash_md5` with `ModelExperiment.input_images` JSON hash

### DB: Annotation Record (table: `annotations`)
| Column | Type | Value |
|--------|------|-------|
| `id` | UUID string | auto-generated |
| `image_id` | UUID string | FK to image |
| `class_name` | string | e.g., `person` |
| `class_id` | int | `Label.id` (auto-increment integer) |
| `confidence` | float | `1.0` for imported labels |
| `x_min` | float | normalized 0–1 |
| `y_min` | float | normalized 0–1 |
| `x_max` | float | normalized 0–1 |
| `y_max` | float | normalized 0–1 |
| `segmentation` | JSON or null | `[[x1,y1],[x2,y2],...]` normalized, or `null` for bbox-only |
| `is_auto_generated` | bool | `False` (user-provided label, not AI) |

### DB: Label/Class Record (table: `labels`)
| Column | Type | Value |
|--------|------|-------|
| `id` | int | auto-increment (1, 2, 3...) |
| `name` | string | class name e.g., `car` |
| `color` | string | hex e.g., `#ff0000` |
| `project_id` | int | FK to project |

### Coordinate System
- All coordinates stored **normalized (0.0–1.0)** — NOT pixels
- Bounding box stored as corners: `x_min, y_min, x_max, y_max`
- Segmentation stored as array of coordinate pairs: `[[x,y],[x,y],...]` also normalized
- When source has segmentation: **store both** polygon in `segmentation` AND compute bbox from polygon min/max
- When source has bbox only: store bbox, `segmentation = null`

---

## Label Format Specifications

### YOLO Format

**Folder structure:**
```
upload_folder/
  image_01.jpg
  image_01.txt        ← one .txt per image, same base name
  image_02.jpg
  image_02.txt
  data.yaml           ← required: defines class names
```

**`data.yaml` format:**
```yaml
names:
  - cat
  - dog
  - car
# class index 0 = cat, 1 = dog, 2 = car
```

**`.txt` file — Detection (bounding box):**
```
{class_id} {cx} {cy} {w} {h}
0 0.5 0.4 0.3 0.2
```
- All values normalized 0–1
- `cx, cy` = center of box
- `w, h` = width and height

**Conversion to DB format:**
```
x_min = cx - w/2
y_min = cy - h/2
x_max = cx + w/2
y_max = cy + h/2
segmentation = null
```

**`.txt` file — Segmentation (polygon):**
```
{class_id} x1 y1 x2 y2 x3 y3 x4 y4 ...
0 0.1 0.2 0.5 0.1 0.6 0.4 0.2 0.5
```
- All values normalized 0–1
- Flat list of x,y pairs (not nested)

**Conversion to DB format:**
```
segmentation = [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]  (nested pairs)
x_min = min of all x values
y_min = min of all y values
x_max = max of all x values
y_max = max of all y values
```

**Error cases:**
- No `data.yaml` found → reject entire import, return error: "data.yaml required for YOLO format"
- `.txt` file found but no matching image → skip that `.txt`, log warning
- Image found but no `.txt` → import image with no annotations (`is_labeled = False`)

---

### COCO Format

**Folder structure:**
```
upload_folder/
  image_01.jpg
  image_02.jpg
  annotations.json    ← one JSON file for all images
```

**`annotations.json` structure:**
```json
{
  "images": [
    {"id": 1, "file_name": "image_01.jpg", "width": 1920, "height": 1080},
    {"id": 2, "file_name": "image_02.jpg", "width": 1920, "height": 1080}
  ],
  "categories": [
    {"id": 1, "name": "cat"},
    {"id": 2, "name": "dog"}
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "bbox": [100, 200, 300, 400],   ← [x, y, width, height] in PIXELS
      "segmentation": [[100,200, 400,200, 400,600, 100,600]]  ← flat pixel coords, optional
    }
  ]
}
```

**Conversion to DB format (bbox):**
```
x_min = bbox[0] / image_width
y_min = bbox[1] / image_height
x_max = (bbox[0] + bbox[2]) / image_width
y_max = (bbox[1] + bbox[3]) / image_height
segmentation = null  (if no segmentation in annotation)
```

**Conversion to DB format (segmentation):**
```
# COCO segmentation is flat list: [x1,y1,x2,y2,x3,y3,...]
flat = annotation['segmentation'][0]  # first polygon
pairs = [[flat[i]/w, flat[i+1]/h] for i in range(0, len(flat), 2)]
segmentation = pairs  → [[x1_norm,y1_norm],[x2_norm,y2_norm],...]

x_min = min of all normalized x
y_min = min of all normalized y
x_max = max of all normalized x
y_max = max of all normalized y
```

**Class ID mapping:**
- COCO uses its own `category_id` integers — do NOT use these as `Label.id`
- Map: `coco_category_id → class_name` (from `categories` array)
- Then: look up or create `Label` record by class_name → use `Label.id` as `class_id`

**Error cases:**
- No `.json` file found → reject, return error: "No COCO annotations.json found"
- `image_id` in annotation has no matching entry in `images` array → skip annotation, log warning
- Image referenced in JSON but file not in upload → skip that image's annotations

---

## Format Auto-Detection Logic

Backend detects format from uploaded files:

```python
def detect_format(files):
    has_txt   = any(f.endswith('.txt') for f in files if f != 'data.yaml')
    has_yaml  = 'data.yaml' in files
    has_json  = any(f.endswith('.json') for f in files)

    if has_json:
        return 'coco'
    elif has_txt and has_yaml:
        return 'yolo'
    elif has_txt and not has_yaml:
        return 'error: yolo_missing_yaml'
    else:
        return 'error: no_labels_found'
```

---

## Class/Label Handling

For each class name found in label files:

```python
def get_or_create_label(db, project_id, class_name):
    existing = db.query(Label).filter(
        Label.project_id == project_id,
        Label.name == class_name  # case-sensitive match
    ).first()

    if existing:
        return existing.id  # reuse

    # Create new label with random color
    new_label = Label(
        name=class_name,
        color=random_hex_color(),
        project_id=project_id
    )
    db.add(new_label)
    db.flush()  # get auto-incremented id
    return new_label.id
```

**Rules:**
- Match is case-sensitive (e.g., `Cat` ≠ `cat`)
- New classes are added to the project label list
- Existing classes are reused — their color and ID are preserved
- COCO `category_id` integers are ignored — only `name` is used

---

## New API Endpoint

### `POST /api/v1/datasets/import-with-labels`

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | int | yes | Target project |
| `name` | string | yes | Batch/dataset name |
| `files` | File[] | yes | Images + label files (mixed) |

**Response (success):**
```json
{
  "dataset_id": "{uuid}",
  "total_images": 50,
  "total_annotations": 312,
  "classes_created": ["new_class_1"],
  "classes_reused": ["cat", "dog"],
  "format_detected": "yolo",
  "warnings": ["image_03.txt has no matching image — skipped"],
  "errors": []
}
```

**Response (format error):**
```json
{
  "error": "data.yaml required for YOLO format",
  "detail": "Found .txt label files but no data.yaml with class names"
}
```

---

## New Frontend UI

**Location:** Upload page — new section below existing drag & drop

**Section title:** `Import Images with Labels`

**UI elements:**
- Folder picker button: `Select Folder (images + labels)`
- Shows detected format badge after selection: `YOLO detected` or `COCO detected`
- Shows file count preview: `12 images, 12 label files, data.yaml found`
- Warning if `data.yaml` missing for YOLO: `data.yaml not found — required for YOLO`
- Import button: `Import`
- After import: shows summary card with counts (images, annotations, new classes)

**Uses separate API call** — does NOT reuse existing `uploadDataset()` function

---

## Processing Flow (Backend)

```
POST /datasets/import-with-labels
    │
    ├── 1. Separate files by type:
    │       images = [.jpg, .png, .jpeg, ...]
    │       labels = [.txt files] or [.json file]
    │       yaml   = data.yaml (YOLO only)
    │
    ├── 2. Detect format (yolo / coco / error)
    │
    ├── 3. Create Dataset record (same as normal upload)
    │
    ├── 4. For each image file:
    │       a. Save to disk → projects/{name}/unassigned/{batch}/{filename}
    │       b. Create Image record (is_labeled=False initially)
    │
    ├── 5. Parse labels:
    │       YOLO: read data.yaml → build class_id→name map
    │             for each image, read matching .txt file
    │       COCO: read annotations.json
    │             build image_id→filename map
    │             build category_id→name map
    │
    ├── 6. For each annotation found:
    │       a. Convert coordinates to normalized x_min,y_min,x_max,y_max
    │       b. If polygon: also build segmentation [[x,y],...] normalized
    │       c. get_or_create_label(project_id, class_name) → class_id
    │       d. AnnotationOperations.create_annotation(...)
    │
    ├── 7. Update Image.is_labeled=True for images that got annotations
    │
    └── 8. Return summary response
```

---

## Files to Create / Modify

### New Files
| File | Purpose |
|------|---------|
| `backend/api/routes/import_labels.py` | New API endpoint + format parsers |
| `frontend/src/components/.../ImportWithLabels/ImportWithLabelsSection.jsx` | New UI section |

### Modified Files
| File | Change |
|------|--------|
| `backend/api/main.py` (or router include file) | Include new router |
| `frontend/src/services/api.js` | Add `importWithLabels()` API call |
| `frontend/src/components/.../UploadSection/UploadPage.jsx` | Add new section below existing upload |

### NOT Modified (existing logic untouched)
| File | Reason |
|------|--------|
| `backend/api/routes/datasets.py` | Existing upload endpoint unchanged |
| `backend/core/file_handler.py` | Reused as-is for image saving |
| `backend/database/operations.py` | Reused `AnnotationOperations.create_annotation()` as-is |
| `backend/database/models.py` | No schema changes needed |

---

## Key Constraints / Rules

1. **Never modify existing upload flow** — new endpoint only, existing `/datasets/upload` untouched
2. **Reuse `AnnotationOperations.create_annotation()`** — do not duplicate annotation creation logic
3. **Reuse `FileHandler.save_uploaded_file()`** — do not duplicate image save logic
4. **Image with no label file** → import image normally, `is_labeled = False` (not an error)
5. **Label file with no matching image** → skip, add to warnings (not a hard error)
6. **`confidence = 1.0`** for all imported annotations (human labels, not AI predictions)
7. **`is_auto_generated = False`** for all imported annotations
8. **Class matching is case-sensitive**
9. **COCO `category_id` integers are ignored** — only class names matter
10. **YOLO without `data.yaml`** → hard error, reject entire import
11. **Coordinates always stored normalized 0–1** — convert from pixels if needed (COCO)
12. **Segmentation stored as `[[x,y],[x,y],...]`** (nested pairs, normalized) — same as how labeling UI stores it
