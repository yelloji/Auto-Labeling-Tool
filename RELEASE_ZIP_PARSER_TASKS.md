# Release ZIP Parser — Implementation Log

A living document that tracks every task for enriching Release History with ZIP-derived statistics and thumbnail overlays.  Update each entry once the work is delivered so future debugging is effortless.

---
## Legend
- ✅ **Completed**
- 🟡 **In-Progress**
- 🔴 **Pending** / Not started

---
## Task List & Status
| ID   | Description                                                         | Status |
|------|---------------------------------------------------------------------|--------|
| T-01 | Clarify ZIP-parsing requirements (folder rules, formats, counts)    | ✅ |
| T-02 | Design backend ZIP extractor service & `/releases/{id}/stats` API   | 🟡 |
| T-03 | Design frontend Release card to show counts & thumbnail badges      | 🔴 |
| T-04 | Implement Python ZIP parser, DB updates, background job             | 🔴 |
| T-05 | Extend parser to other export formats once YOLO flow is stable      | 🔴 |

---
## Solutions
### T-01 – Clarify ZIP-Parsing Requirements (✅ Completed)
*Date:* 2025-01-09

**Outcome:**
1. We will support YOLO-style archives (`data.yaml`, `train/`, `val/`, `test/`).
2. Image extensions counted: `.jpg`, `.jpeg`, `.png`.
3. Counts needed: `train_image_count`, `val_image_count`, `test_image_count`, `class_count`.
4. Split badge for thumbnails will be derived on the frontend from the image path.

### T-02 – Backend ZIP Extractor Service & API (🟡 In-Progress)
*Notes will be added once finalized.*

### T-03 – Frontend Stats Display (🔴 Pending)
*Placeholder.*

### T-04 – Implement ZIP Parser & DB Update (🔴 Pending)
*Placeholder.*

### T-05 – Extend Parser to Other Export Formats (🔴 Pending)
*Pending until export-format issues (e.g., COCO) are resolved; implement alongside YOLO pipeline.*