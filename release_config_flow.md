# 🧠 Auto-Labeling Tool — Release & Augmentation System: Full Architecture

## 🔷 GOAL

Design a modular, scalable system where users can:

- Select transformation tools (e.g., Brightness, Contrast, Resize)
- Apply them to original images using smart sampling strategies
- Automatically update annotations (polygons or boxes)
- Organize augmented images based on original split (train/val/test)
- Export datasets in various formats (YOLO, COCO, Pascal VOC)
- Output a structured ZIP with both images + annotations

---

## 🔁 SYSTEM FLOW OVERVIEW

```plaintext
[Frontend UI]
   |
   └──▶ ReleaseConfigPanel.jsx (User selects tools + config)

[Backend - FastAPI]
   |
   └──▶ release.py (Controller entrypoint)
            |
            ├── Loads image_transformations (PENDING, same release_version)
            ├── Calls schema.py → generate all tool combinations
            ├── Calls image_generator.py → apply tools to image
            ├── Receives new image paths + updated annotation
            └── Prepares for export
                    |
                    └──▶ enhanced_export.py
                             └── Creates ZIP (images + labels + data.yaml)
```

---

## 🧱 CORE FILE RESPONSIBILITIES

| File                  | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `release.py`          | Central controller for full pipeline                |
| `schema.py`           | Defines transformation tool logic, ranges, sampling |
| `image_generator.py`  | Applies transformations, updates annotations        |
| `enhanced_export.py`  | Creates final ZIP output (images, labels, YAML)     |
| `image_utils.py`      | Helper functions for OpenCV/PIL transformations     |
| `annotation_utils.py` | Helper functions to transform bbox or polygon       |

---

## 🧩 COMPONENT DESIGN

### ✅ 1. schema.py — Tool Range & Combination Builder

- Each tool has:
  - `type`: brightness, contrast, etc.
  - `min`, `max`, `step`: e.g., brightness = 0.8 → 1.2 (step 0.2)
- Tool value list:
  - Brightness → `[0.8, 1.0, 1.2]`
  - Contrast → `[0.9, 1.0, 1.1]`

🧠 For 2 tools → combinations:

```python
[ (brightness=0.8, contrast=0.9),
  (brightness=0.8, contrast=1.0),
  ... up to 9 total ]
```

- User defines `images_per_original` = 4
- First 1–2 combinations: fixed
- Remaining: random from remaining pool

→ Output: List of sampled configs per original image

---

### ✅ 2. image\_generator.py — Image Augmentation & Annotation Updater

**Input:**

- Original image
- Sampled transformation config
- Task type (`object_detection`, `segmentation`)
- Export image format (jpg, png, bmp)
- Original annotations (polygon or bbox)

**Tasks:**

- Applies transformation combo (OpenCV or PIL)
- Updates annotation accordingly:
  - Flip → reverse X/Y
  - Rotate → rotate polygon points or adjust bbox
- Assigns new name: `car_aug1.jpg`, `car_aug2.jpg`
- Saves image to `augmented/train/`, etc.

**Output:**

- Augmented image saved to disk
- Updated annotation saved to memory (used in export)

---

### ✅ 3. enhanced\_export.py — Dataset Finalizer

After augmentation:

- Reads from `augmented/train/val/test`
- Groups all augmented images + their annotations
- Converts to export format:
  - YOLO: `.txt` files per image
  - COCO: `annotations.json`
  - VOC: `.xml` per image
- Writes `data.yaml` (class names, paths)
- Creates ZIP:

```plaintext
release/
└── release_name.zip
    ├── images/
    │   ├── train/
    │   ├── val/
    │   └── test/
    ├── labels/
    │   ├── train/
    │   ├── val/
    │   └── test/
    └── data.yaml
```

---

## 🗂️ FINAL PROJECT FOLDER STRUCTURE

```
projects/
└── gevis/
    ├── dataset/
    │   ├── animal/
    │   │   ├── train/
    │   │   ├── val/
    │   │   └── test/
    ├── unassigned/
    ├── annotating/
    ├── augmented/
    │   ├── train/
    │   ├── val/
    │   └── test/
    └── release/
        └── v1_brightness_yolo.zip
```

---

## 📌 DESIGN PRINCIPLES

- **Original dataset is never changed**
- **Augmented images are stored temporarily, not saved permanently**
- **Release history allows re-export anytime**
- **Annotation transformations are auto-updated**
- **Images & labels are always synced and versioned**
- **No redundant data saved in DB — only metadata in **``** table**

---

## ✅ TASK BREAKDOWN

### 🔹 TASK 1: `schema.py`

- Build tool range parser (min/max/step → list)
- Generate all combinations using itertools
- Apply fixed + random sampling
- Output: N configs per image

### 🔹 TASK 2: `image_generator.py`

- Accept image + config
- Apply all tool values
- Update annotation
- Save to `augmented/{split}/`
- Return filename + new annotation

### 🔹 TASK 3: `release.py`

- Load tools with status = PENDING
- Get release config (images per original, export format, task type)
- Call schema + image\_generator
- Hold all new annotations in memory
- Trigger export if user clicks Export

### 🔹 TASK 4: `enhanced_export.py`

- Copy images from `augmented/`
- Write annotations in correct format
- Add data.yaml
- Zip into `/release/{release_name}.zip`

---

## 🧠 FINAL NOTES

- No need to permanently store augmented images
- Augmented folder is temporary; deleted after ZIP is made
- UI always shows release history from DB (`releases` table)
- Any release can be regenerated anytime from DB configs

