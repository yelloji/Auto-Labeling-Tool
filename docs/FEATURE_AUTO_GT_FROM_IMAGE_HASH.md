# Feature: Auto-Populate Ground Truth from Image Hash Matching

## Summary

When a prediction experiment runs on an **upload dataset**, the system will automatically
check each image's MD5 hash against the split dataset. If a match is found, the system
auto-writes records into the `human_verifications` table using the real YOLO GT labels —
no manual user drawing required.

Users can then review and override any auto-inserted record if they disagree.

---

## Problem It Solves

Upload experiments have no real ground truth (GT). Today:
- Users must manually draw boxes for every missed object (FN)
- Recall is always optimistic (only counts what users explicitly drew)
- Review coverage is low because it's tedious

With this feature:
- Matching images get real GT automatically
- Only truly unique images need manual review
- Metrics become accurate for the overlapping portion

---

## How It Works

### Trigger
Runs automatically when a prediction experiment completes (status → `completed`).

### Step-by-step

```
For each image in the prediction experiment:

  1. Look up the image's MD5 hash (already stored in the DB)

  2. Check: does this hash exist in the split dataset?

  3a. Hash MATCHES a split dataset image:
      → Read the real YOLO GT labels for that image
      → For each GT bbox:
          - Find matching AI prediction (bbox tolerance < 0.1)
          - If match found AND AI confidence is good → insert verification with status='pass'
          - If match found AND AI confidence is low  → insert verification with status='fail'
          - If NO match found (AI missed it)         → insert verification record as FN
            (no matching AI bbox → picked up as humanMissing in metric logic)
      → Set source='auto_gt' on all inserted records

  3b. Hash NOT found in split dataset:
      → Image is unique to upload
      → No auto-insert, user reviews manually as before
```

### Result in `human_verifications` table

| field | value |
|---|---|
| `experiment_id` | the upload experiment ID |
| `image_name` | image filename |
| `image_hash_md5` | MD5 hash |
| `bbox` | GT bounding box |
| `status` | `'pass'` / `'fail'` |
| `source` | `'auto_gt'` (new field, for UI display only) |

---

## Why No Code Changes Needed in Metrics

The `computeUploadMetrics` function (used in ComparisonEngineView) and ChartsView
Exception Mode both read from `human_verifications` table using the same logic:

```
vMap[fileName|bbox] = 'pass' | 'fail'    ← from verifications
humanMissing = verifications with no matching AI bbox  ← FN

TP = AI predictions not marked 'fail'
FP = AI predictions marked 'fail'
FN = humanMissing (GT boxes AI did not detect)

Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 * P * R / (P + R)
```

Whether a record was inserted by a human or by the auto-GT system — the math
is **identical**. Zero changes to metric code when this feature is built.

---

## UI Changes (minor, future)

- In the verification review UI, auto-inserted records could show a small badge:
  `🤖 Auto GT` vs `✏️ Manual`
- User can click any record to override the status
- Filter toggle: "Show auto-verified only" / "Show manual only"

---

## What Remains Manual

Only images whose MD5 hash is **not** in any split dataset require manual review.
These are truly new images the model has never seen in training/validation.

---

## Implementation Notes (for when this is built)

- Backend: hook into the experiment `status` update endpoint (when status → `completed`)
- Query: `SELECT image_hash_md5 FROM split_dataset_images WHERE hash = ?`
- GT source: read existing YOLO label files for the matched split image
- Insert: bulk insert into `human_verifications`, skip if record already exists for that
  `(experiment_id, image_name, bbox)` combination (idempotent)
- New DB column: `source VARCHAR(20) DEFAULT 'manual'` on `human_verifications`

---

## Status
- [ ] Future feature — not yet implemented
- Current workaround: manual user drawing + ComparisonEngine using verifications as proxy GT
