# Auto-Labeling Tool — Feature Map
> Full audit of all existing features in PredictionView, Analytics, and Image Viewer.

---

## 💎 Core Capabilities & Differentiators (Why this app wins)

### 1. The Core Data Engine: Image Hashing & Silent Ground Truth
*   **The Math:** We use SHA-256 Hashes instead of fragile file paths.
*   **Silent Ground Truth:** Uploading raw images instantly applies historical ground truth based purely on hash-matching. Zero manual work.
*   **The Verification Story:** Pulls historical `PASS/FAIL` exceptions from totally different experiments and projects them as "hints" onto the current image. The app remembers everything across time.

### 2. The Microscopic Image Viewer (Hyper-Speed QA)
*   **Click-to-Focus Precision:** Clicking a detection instantly teleports, zooms, and centers on that exact microscopic defect.
*   **Direct Database Mutation:** Clicking `FAIL` or drawing a new box (`FN`) writes directly to the remote database instantly. No save buttons.
*   **Pro Composite Export:** One-click download of a flattened PNG comprising the original image + all active SVG overlays (boxes, labels, contours).

### 3. The Executive Analytics Engine (Math Translated to English)
*   **Dual Mode:** Operates flawlessly on full dataset ground truth (Split Mode) or entirely blind on human exceptions only (Upload Mode).
*   **The Sweeper:** System automatically sweeps confidence from 1% to 95% in the background to stress-test the model parameters.
*   **Plain-English Synthesis:** The engine writes sentences instead of just plotting graphs (e.g., *"Optimal Production Threshold is 62%"*, *"Retrain target located"*).

### 4. The 4 Killer Graphs (Deep Visual Intelligence)
*   📊 **The Spatial Error Heatmap:** Proves *where* (physically) the model fails. Reveals hardware issues like camera smudges or systemic shadows.
*   📊 **The Scaled Stress Fingerprint:** Proves *what size* the model struggles with across all confidence levels (e.g., 95% accurate on Large, 0% on Tiny).
*   📊 **Live Interactive PR Simulator:** Live marker moves along the curve as the user drags the confidence slider to instantly visualize the tradeoff between safety (Recall) and false alarms (Precision).
*   📊 **Live Confidence Histogram:** Proves *calibration* by showing the exact volume of TP vs FP stacked at every confidence bin.

### 5. The Comparison Engine & Delta Arena
*   **Strict Pixel Math:** Calculates a 3D matrix (Ground Truth ↔ Model A ↔ Model B) using precise IoU thresholds.
*   **The Verdict Row:** Instant scorecard declaring the winner (e.g., *"Baseline 2/6 vs Model B 4/6 🏆 Model B wins"*).
*   **Delta Cards:** 4 plain-English cards isolating exact behavioral changes (Fixed FPs, Fixed Misses, New FPs, New Misses) with precise image and detection counts.

---

## 🗂️ PredictionView — Top Level (1,785 lines)
**File:** `PredictionView/PredictionView.jsx`

### Left Sidebar — Experiment History
- List of all prediction experiments for the selected training
- Status tags: QUEUED / RUNNING / COMPLETED / FAILED
- Polling every 3 seconds when a run is active
- Per-experiment: delete button, click to select

### Right Panel — Config Form (for new/queued runs)
- **Name** field (auto-saves draft when ≥ 3 chars)
- **Dataset Source**: Split (Train / Val / Test — auto-detected from training) or Upload
- **Confidence** slider
- **IoU Threshold** slider  
- **Batch size**, **Image size (imgsz)**, **Max detections**, **Weights** (best/last)
- **Image upload** drag-and-drop (Upload mode)
- Run / Reset buttons

### Gallery (Completed experiment)
- Grid of prediction result images (30 per page, paginated)
- Detection overlay rendered as SVG on each thumbnail
- Click thumbnail → opens **ImageViewerModal**
- KPI cards: total detections, images, confidence avg
- Download button (ZIP of results)

### 8 Gallery Filters (real-time)
| Filter | Options |
|--------|--------|
| Detection Count | Any / None / Yes / 1–5 / 6–10 / 10+ |
| Class | Multi-select from predicted classes |
| Confidence Range | Slider 0–100% |
| Image Search | Text search by filename |
| Risk Level | Any / High / Medium / Low |
| Review Status | Any / Unverified / Pass / Fail |
| Size Group | All / Tiny / Small / Medium / Large |
| Overlap | Toggle (show only overlapping boxes) + IoU threshold |
| Duplicate | Toggle (show only duplicate images by hash) |

### AnalyticsModal (opens full-screen analytics)
- Hosts: **ChartsView**, **QualityView**, **ReportView**, **ExportView**

---

## 🖼️ ImageViewerModal (2,455 lines)
**File:** `PredictionView/ImageViewerModal.jsx`

### Core Navigation
- Full-screen modal with keyboard navigation (←/→ arrow keys)
- Previous / Next image buttons

### Zoom & Pan
- Zoom In / Zoom Out / Reset Zoom buttons
- **Click-to-Focus** (Precision Zoom) — click on a detection → auto-zooms and centers on it

### Bounding Box Overlay System
- Renders AI prediction boxes on image (SVG layer, pixel-perfect)
- Visibility toggles: **Boxes / Contours / Labels**
- Box hover → custom tooltip with detection details
- Box confidence color-coded

### PASS / FAIL Verification System
- Click box → mark as **PASS** (True Positive) or **FAIL** (False Positive)
- Double-click drawn box → delete confirmation
- Marks stored as HumanVerification records in DB

### Manual Box Drawing
- Mouse drag on blank area → draw a new bounding box
- Class selector popup appears on release → label the missing defect
- Manual boxes = "Missing Defect" (FN) → sent to backend as `status='missing'`

### Historical Hints ("Verification Story")
- Loads verifications from **other experiments** for same image (cross-experiment history)
- Renders as semi-transparent "hint" boxes
- Click hint → accept/dismiss with confirmation popup
- `generateVerificationStory()` narrates what was wrong in history

### Download
- **Pro Composite Download**: renders original image + all visible overlays to a canvas → saves as PNG
- Respects visibility toggles (Boxes/Contours/Labels) and confidence filters

### Detection List Panel
- Right sidebar showing all detections for current image
- Per-detection: class, confidence, size group
- Click detection → focus/zoom on it
- Toggle visibility per detection
- Select All / Select None

### Metadata
- Shows image filename, dataset source, experiment name
- Duplicate group insights badge
- Size group bucketing (Tiny/Small/Medium/Large)

---

## 📊 ChartsView (2,087 lines)
**File:** `AnalyticsViews/ChartsView.jsx`

### Dual Mode
| Mode | Source |
|------|--------|
| **Split Mode** (has ground truth) | Backend `quality-stats` — TP/FP/FN matched via IoU |
| **Upload Mode** (no ground truth) | Exception-based: all AI dets = TP unless marked FAIL |

### Interactive Filters
- **Confidence Range Slider** (0–100%) — real-time recalculation
- **IoU Threshold Slider**
- **Class Filter** — multi-select
- **Size Slice** — Tiny / Small / Medium / Large / All

### Metrics Dashboard
- TP / FP / FN counts
- Precision / Recall / F1 calculation
- AI-to-GT Ratio
- Verified Alarms, Human Discoveries, Human Confirmations counts

### Charts
1. **Confidence Distribution** — histogram of detections by confidence
2. **Class Performance Bar Chart** — Precision/Recall/F1 per class
3. **Precision-Recall Trade-off Curve**
4. **Scaled Stress Fingerprint (Graph 4)** — per-size-group performance across all confidence thresholds

### 🏭 Industrial Performance Engine
- Sweeps confidence from 1%→95% in 1% steps
- Identifies **Model Ceiling** (first material automation drop)
- Recommends **Optimal Production Threshold** (best F1)
- Recommends **Retrain Target** (pre-wall sweet spot)
- **2 Mode Briefings**: Production (best F1) vs. Training (recall focus)
- **Scale Diagnostic Narrative** — per-size analysis + actionable text

### Error Detail Modals
- Click on FP/FN count → modal showing list of error images

---

## 🔬 QualityView (285 lines)
**File:** `AnalyticsViews/QualityView.jsx`

- **Split mode only** — fetches `quality-stats` from backend
- Shows: Precision, Recall, F1, mAP@50, mAP@50:95
- AnimatedNumber counter on load
- LuxuryMetricCard UI with color gradients and insights text

---

## 📝 ReportView (1,632 lines)
**File:** `AnalyticsViews/ReportView.jsx`

### Dual Mode (Split vs Upload)
- Handles both `has_ground_truth` and upload-only experiments

### Dataset Details Panel
- Total images, class distribution, split breakdown

### Training Metrics
- Box metrics (mAP50, mAP50-95, Precision, Recall)
- Mask metrics for Segmentation tasks
- Class-wise performance table

### Error Analysis
- Grid-based spatial error distribution
- Pattern synthesis (**Executive Point of View** language)
- Error descriptions per category

### PR Curve Table
- Table of Precision/Recall at different confidence thresholds
- Highlights best F1 row

### Actions
- Export report to PDF/download

---

## 📤 ExportView (1,291 bytes)
**File:** `AnalyticsViews/ExportView.jsx`
- Minimal stub — placeholder for future export functionality

---

## 🔗 Comparison Engine — Master Build Plan

### ✅ Already Built
- Model A vs B selectors + optional Model C toggle
- Dataset image overlap indicator (shows common images before running)
- Delta gallery (Resolved FPs, Resolved FNs, Regressions, Persistent errors)

> **Current limitation:** Requires baseline human verifications — being redesigned below.

---

### 🛠️ Phase 1: Split Mode (Auto GT — no human input needed)

| Step | Feature | Notes |
|------|---------|-------|
| 1.1 | **Overview panel** | mAP50, F1, Precision, Recall side-by-side. Better = green, worse = red |
| 1.2 | **Individual Delta Gallery** | Fixed FP, Fixed FN, New FP, New FN. Filter to only changed images |
| 1.3 | **Side-by-side image viewer** | A’s boxes (blue) vs B’s boxes (orange) on the same image |
| 1.4 | **Confidence Delta** | Same box matched, but different confidence score — did B get more/less sure? |
| 1.5 | **Class Confusion Diff** | Same box location, different class label — did B mislabel what A got right? |
| 1.6 | **Per-image verdict** | Each image tagged: “B strictly better / worse / no change” |

---

### 🛠️ Phase 2: Upload Mode (Human GT — progressive quality)

| Step | Feature | Notes |
|------|---------|-------|
| 2.1 | **Raw predictions view** | If no human input — show what the model found, no quality metrics |
| 2.2 | **FAIL mark → FP** | User clicks box → FAIL — becomes confirmed false positive |
| 2.3 | **Manual draw → FN** | User draws missing box — becomes confirmed false negative |
| 2.4 | **PASS mark (hint-based)** | Cross-experiment hint was FAIL, now detected — user confirms PASS = fixed TP |
| 2.5 | **Hash-match bonus** | Uploaded images match stored dataset hashes → real GT applied silently, no manual work |

> **Design rule:** Never force user to mark. More marks = better analytics. Zero marks still works.

---

### 📅 Build Order (one by one, no rush)
1. Phase 1 — Step 1.1: Overview Panel
2. Phase 1 — Step 1.2: Individual Delta Gallery (split-mode, auto GT)
3. Phase 1 — Step 1.3: Side-by-side image viewer
4. Phase 1 — Steps 1.4 + 1.5 + 1.6: Confidence Delta, Class Confusion, Per-image verdict
5. Phase 2 — Steps 2.1–2.5: Upload mode progressive GT

**File:** `ComparisonEngine/ComparisonEngineView.jsx`

### What It Does
- Selects baseline + challenger prediction runs
- Shows **dataset overlap** count (images in common)
- Optional **Model C** toggle for 3-way comparison
- Runs delta analysis: Baseline verifications vs Challenger raw predictions
- Shows: Resolved FPs, Resolved FNs, New Regressions, Persistent FPs, Persistent Misses
- Click any count → **DeltaGalleryModal** shows the affected images

### Current Limitation ⚠️
- Requires baseline to have **human verifications (PASS/FAIL)**
- If no verifications on baseline → returns "No manual verifications found"

---

## 🗺️ What's Missing / Opportunity Areas

| Gap | Impact |
|-----|--------|
| **Compare Engine works without verifications** (raw prediction vs prediction) | HIGH — currently unusable without prior verification work |
| **Side-by-side image comparison** in DeltaGallery (Model A box vs Model B box on same image) | HIGH |
| **Per-class comparison** in Compare Engine | MEDIUM |
| **Confidence distribution comparison** (A's confidence profile vs B's) | MEDIUM |
| ExportView is empty | LOW |
