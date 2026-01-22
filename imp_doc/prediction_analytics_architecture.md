# Prediction Analytics - Complete Architecture Vision

> **PURPOSE**: This document connects ALL existing features into one cohesive, informative analytics experience that tells users **everything** about their prediction results.

---

## 🎯 MISSION STATEMENT

Build a **world-class prediction analytics interface** that:
1. Shows users **EVERY insight** available from their predictions
2. Connects **ALL data sources** (predictions, ground truth, human verifications, historical hints)
3. Provides **ACTIONABLE intelligence** through expert filters and diagnostics
4. Creates a **narrative-driven** user experience that guides decision-making

---

## 📊 CURRENT STATE AUDIT

### 1. DATA SOURCES

#### A. Primary Prediction Data
- **Source**: `experiment.predictions` (object detections from YOLO model)
- **Structure**: `{ imageName: [{ class, confidence, bbox, segmentation }] }`
- **Metadata**: 
  - Confidence scores (0-1)
  - Bounding boxes `[x1, y1, x2, y2]`
  - Segmentation polygons (optional)
  - Class labels

#### B. Ground Truth Data
- **Source**: Project annotation files
- **Purpose**: Compare model predictions vs. reality
- **Used For**:
  - Missed Detection identification (IoU < threshold)
  - False Positive detection (no GT match)
  - Accuracy metrics

#### C. Human Verification System
- **Source**: `verifications` table (project-level)
- **Types**:
  - **PASS**: User confirmed prediction is correct
  - **FAIL**: User confirmed prediction is wrong
  - **MISSING**: User manually drew a missed defect
- **Metadata**:
  - `image_hash_md5`: For duplicate detection across filenames
  - `experiment_id`: Which prediction session
  - `is_manual`: Manually drawn boxes
  - `created_at`: Timestamp for historical analysis

#### D. Historical Hints
- **Source**: Verifications from OTHER experiments
- **Purpose**: Cross-experiment knowledge transfer
- **Features**:
  - Multi-experiment aggregation
  - Behavioral evolution tracking
  - Consistency scoring

#### E. Image Metadata
- **Source**: `experiment.input_images` (MD5 hash map)
- **Purpose**: Detect 100% identical images with different names
- **Used For**:
  - Duplicate group identification
  - Data quality insights

#### F. Missed Detections & False Positives (Phase 7)
- **API**: `missedDetectionsAPI.getMissedDetections()`
- **Returns**: `{ missed: [...], fp_indices: [...] }`
- **Logic**:
  - IoU-based matching (default: 0.3)
  - Ground truth vs predictions comparison
  - Real-time calculation per image

#### G. Analytics Summary
- **Source**: `experiment.analytics_summary`
- **Computed On**: Backend after prediction completion
- **Contains**:
  - Total detections count
  - Class distribution `{ className: count }`
  - Confidence statistics
  - Image-level aggregates

---

### 2. FILTER SYSTEM (Complete Inventory)

#### BASIC FILTERS

**A. Class Selection** (Multi-select)
- **Type**: Array of selected classes
- **Logic**: OR logic (show if ANY selected class present)
- **UI**: Ant Design `Select` with `mode="multiple"`
- **State**: `filters.selectedClasses: string[]`

**B. Confidence Range** (Slider)
- **Type**: Range `[min%, max%]`
- **Default**: `[10%, 100%]`
- **Logic**: Filter detections within range
- **UI**: Ant Design `Slider` with `range=true`
- **State**: `filters.confidenceRange: [number, number]`

**C. Detection Count** (Dropdown)
- **Options**: `any | no | yes | 1-5 | 6-10 | 10+`
- **Logic**: Filter images by number of matching detections
- **State**: `filters.detectionCount: string`

**D. Image Search** (Text Input)
- **Type**: Substring match (case-insensitive)
- **Scope**: Image filenames
- **State**: `filters.imageSearch: string`

#### EXPERT DIAGNOSTICS

**E. Overlap Detection** (Advanced IoU Analysis)
- **Toggle**: `filters.showOverlapping: boolean`
- **IoU Threshold**: `filters.overlapIoU: number` (default: 0.5)
- **Isolation Mode**: `filters.isolateOverlaps: boolean`
- **Logic**: 
  - Scan ALL pairs of boxes in each image
  - Flag if IoU ≥ threshold
  - Isolation: ONLY show images WITH overlaps
- **Use Case**: Find double-counting errors

**F. Content Duplicates** (MD5 Hash Matching)
- **Toggle**: `filters.showOnlyDuplicates: boolean`
- **Logic**:
  - Hash-based grouping via `experiment.input_images`
  - Only show images with ≥2 identical hashes
- **Metadata**: `duplicateMatchMap` for group IDs
- **Use Case**: Quality control, data efficiency

 **G. Object Size Groups** (Dynamic Quartile Bucketing)
- **Selector**: `filters.selectedSizeGroup: 'all' | 'tiny' | 'small' | 'medium' | 'large'`
- **Isolation**: `filters.isolateBySize: boolean`
- **Calculation**:
  - Collect ALL detection areas across experiment
  - Compute Q25, Q50, Q75 percentiles
  - Bucket: Tiny (0-Q25), Small (Q25-Q50), Medium (Q50-Q75), Large (Q75+)
- **State**: `sizeGroups: { thresholds: [q25, q50, q75], count: number }`
- **Use Case**: Scale diagnostic, identify tiny hard-to-see defects

#### QUALITY ASSURANCE

**H. Risk Level** (Confidence-Based Tiers)
- **Options**: `any | high | medium | low`
- **Thresholds**:
  - **High Risk**: < 40% confidence 🔴
  - **Medium Risk**: 40-70% confidence 🟡
  - **Low Risk**: > 70% confidence 🟢
- **Logic**: Filter images containing detections in risk tier
- **State**: `filters.riskLevel: string`

**I. Review Status** (Human Verification Filter)
- **Options**: `any | pass | fail | unverified`
- **Logic**:
  - Match `verifications` by image hash OR filename
  - `unverified`: Has detections, no verifications
  - `pass/fail`: Has specific verification status
- **State**: `filters.reviewStatus: string`
- **Use Case**: Audit progress, find unverified predictions

---

### 3. IMAGE VIEWER MODAL (Detailed View)

#### VIEWING CAPABILITIES

**A. Image Rendering**
- Original image with pixel-perfect overlay
- SVG-based annotations
- Zoom & Pan (1x to 5x)
- Click-to-focus precision zoom

**B. Layer Toggles**
- **Boxes**: Show/hide bounding rectangles
- **Contours**: Show/hide segmentation polygons
- **Labels**: Show/hide detection labels
- **Missed**: Show/hide ground truth gaps
- **Manual**: Show/hide user-drawn boxes

**C. Detection Visualization**
- **Risk Coloring**:
  - Red: High risk (< 40%)
  - Yellow: Medium risk (40-70%)
  - Green: Low risk (> 70%)
- **False Positives**: Orange border + `[FALSE POSITIVE]` tag
- **Missed Detections**: Gray dashed box + label
- **Manual Boxes**: Purple solid + class label
- **Historical Hints**: Orange dashed + experiment badge

**D. Interactive Features**
- **Hover**: Premium frosted-glass tooltips
- **Click**: Zoom to detection
- **Selection**: Individual box checkboxes
- **Download**: Canvas composite with all annotations

#### HUMAN VERIFICATION SYSTEM

**E. PASS/FAIL Actions** (Footer Buttons)
- **Workflow**:
  1. User hovers detection → tooltip appears
  2. User clicks PASS or FAIL
  3. Status saved to project database
  4. Immediately visible across all experiments
- **API**: `projectsAPI.verifyDetection()`
- **State**: `verifications[]` array

**F. Manual Defect Drawing**
- **Mode**: Drawing mode toggle
- **Workflow**:
  1. Click "+ Manual Box" button
  2. Draw rectangle on image
  3. Select class from popup
  4. Box saved as "missing" verification
- **API**: `projectsAPI.saveManualVerification()`
- **Visual**: Purple border, manual badge

**G. Historical Hints** (Cross-Experiment Intelligence)
- **Source**: Verifications from OTHER experiments
- **Display**: Orange dashed boxes
- **Click Action**: Accept hint → copies to current experiment
- **Story Engine**: Dynamic tooltip showing:
  - Which experiments verified this
  - Behavioral evolution (changed mind?)
  - Consistency metrics

---

### 4. INSIGHTS & ANALYTICS

#### A. False Positive Detection (Phase 7.2)
- **Trigger**: IoU comparison with ground truth
- **Threshold**: 0.3 (configurable via slider in modal)
- **Logic**: Predictions with NO GT match
- **Visual**:
  - Orange label background
  - `[FALSE POSITIVE]` tag
  - Custom tooltip with ACTION instructions
- **API**: `missedDetectionsAPI.getMissedDetections()`
- **State**: `fpIndices: number[]`

#### B. Missed Detections (Phase 7.1)
- **Trigger**: Ground truth with NO prediction match
- **Display**: Gray dashed boxes
- **Toggle**: `showMissed` boolean
- **IoU Slider**: Adjustable threshold (0.1 - 0.9)
- **Purpose**: Show what model missed

#### C. Duplicate Insights
- **Visual**: Badge showing "DUP GROUP #1"
- **Purpose**: Flag data quality issues
- **Metadata**: `duplicateMatchMap[imageName] → groupId`

#### D. Size Distribution
- **Purpose**: Scale diagnostic
- **Use Cases**:
  - Identify if model struggles with tiny objects
  - Balance dataset representation
  - Understand detection patterns

#### E. Analytics Modal
- **Component**: `AnalyticsModal.jsx`
- **Content**: (NEEDS INVESTIGATION)
  - Likely: Charts, metrics, distributions
  - Purpose: High-level experiment analysis

#### F. Comparison Modal
- **Component**: `ComparisonModal.jsx`
- **Content**: (NEEDS INVESTIGATION)
  - Likely: Multi-experiment comparison
  - Purpose: A/B testing, model improvement tracking

---

## 🎬 USER JOURNEY NARRATIVE

### ACT 1: EXPERIMENT SELECTION & OVERVIEW
*"What did I run, and what's the high-level story?"*

**Scene**: User lands on Prediction Tab
- See experiment history (left sidebar)
- Click latest "completed" experiment
- See KPI cards: Total Detections, Class Distribution, etc.
- Get immediate sense of scale

### ACT 2: FILTERING & EXPLORATION
*"Let me find the specific images that matter"*

**Scene**: User opens filter panel
- Starts broad: "Show all High Risk detections"
- Adds class filter: "Only show scratches"
- Enables expert diagnostic: "Are there overlapping boxes?"
- Refines: "Only tiny size group"
- **Result**: Gallery updates in real-time

### ACT 3: DETAILED INSPECTION
*"Let me look closely at this specific case"*

**Scene**: User clicks image thumbnail
- Modal opens with full image
- Sees all detections with risk coloring
- Hovers False Positive → reads tooltip → clicks FAIL
- Sees missed detection (gray box) → draws manual box
- Clicks historical hint → accepts for current experiment
- Downloads annotated image for reporting

### ACT 4: VERIFICATION & QUALITY CONTROL
*"Let me audit and correct the model's work"*

**Scene**: User systematically reviews
- Filters: "Review Status → Unverified"
- Opens each image
- PASS/FAIL workflow for each detection
- Draws manual boxes for missed defects
- Tracks progress via "X of Y images" counter

### ACT 5: INSIGHTS & REPORTING
*"What did I learn? What's next?"*

**Scene**: User opens Analytics Modal (future)
- See charts: Confidence distribution, class balance
- Identify patterns: "Model struggles with tiny scratches"
- Compare to previous experiments
- Export report for stakeholders

---

## 🔧 TECHNICAL ARCHITECTURE

### FRONTEND COMPONENTS

```
PredictionView.jsx (Main Container)
├── Left Sidebar: Experiment History
├── Right Column:
│   ├── Configuration Section (Run new predictions)
│   ├── KPI Cards Row (Quick metrics)
│   ├── Filter Panel (All filter controls)
│   └── Results Gallery (Paginated thumbnails)
└── Modals:
    ├── ImageViewerModal.jsx (Detailed view + verification)
    ├── AnalyticsModal.jsx (Charts & insights)
    └── ComparisonModal.jsx (Multi-experiment A/B)
```

### BACKEND APIs

```
projectsAPI
├── getTrainingExperiments() → List predictions
├── getExperimentImages() → Image filenames
├── verifyDetection() → Save PASS/FAIL
├── getProjectVerifications() → Load verifications
├── saveManualVerification() → Save manual boxes
├── deleteManualVerification() → Remove manual box
└── getProjectLabels() → Available classes

missedDetectionsAPI
└── getMissedDetections() → { missed, fp_indices }
```

### DATA FLOW

```
1. User selects experiment
   ↓
2. Frontend fetches:
   - experiment.predictions
   - experiment.input_images (hashes)
   - experiment.analytics_summary
   - verifications (project-level)
   ↓
3. Computed State:
   - duplicateMatchMap (hash grouping)
   - sizeGroups (quartile thresholds)
   - filteredImages (apply ALL filters)
   ↓
4. User opens image
   ↓
5. Modal fetches:
   - missedDetections + fpIndices
   - verifications for THIS image
   ↓
6. User verifies → Save → Refresh verifications
   ↓
7. State updates across ALL views immediately
```

---

## 📋 FEATURE MATRIX (Complete Inventory)

| Feature | Status | Location | Purpose |
|---------|--------|----------|---------|
| **Experiment History** | ✅ | Left Sidebar | Browse past predictions |
| **Run New Prediction** | ✅ | Config Section | Trigger new inference |
| **KPI Cards** | ✅ | Top Row | Quick metrics |
| **Class Filter** | ✅ | Filter Panel | Focus on specific classes |
| **Confidence Range** | ✅ | Filter Panel | Debug quality issues |
| **Detection Count** | ✅ | Filter Panel | Find rare/crowded cases |
| **Image Search** | ✅ | Filter Panel | Filename lookup |
| **Overlap Detection** | ✅ | Expert Diagnostics | Find double-counting |
| **IoU Threshold** | ✅ | Expert Diagnostics | Tune overlap sensitivity |
| **Isolate Overlaps** | ✅ | Expert Diagnostics | ONLY show overlaps |
| **Content Duplicates** | ✅ | Expert Diagnostics | Hash-based duplicate finder |
| **Object Size Groups** | ✅ | Expert Diagnostics | Scale diagnostic (quartiles) |
| **Isolate by Size** | ✅ | Expert Diagnostics | Focus on size tier |
| **Risk Level Filter** | ✅ | Quality Assurance | Confidence-based priority |
| **Review Status** | ✅ | Quality Assurance | Audit progress tracking |
| **Image Gallery** | ✅ | Main View | Thumbnail preview |
| **Paginat ion** | ✅ | Gallery Footer | 30 images/page |
| **Image Viewer Modal** | ✅ | Click Image | Detailed inspection |
| **Zoom & Pan** | ✅ | Modal | Precision viewing |
| **Layer Toggles** | ✅ | Modal Footer | Control visibility |
| **Risk Coloring** | ✅ | Modal | Visual confidence tiers |
| **False Positive Tag** | ✅ | Modal | Orange + [FP] label |
| **FP Tooltip** | ✅ | Modal Hover | Dynamic class-aware message |
| **Missed Detections** | ✅ | Modal | Gray dashed boxes |
| **IoU Slider** | ✅ | Modal Footer | Tune missed threshold |
| **Manual Box Drawing** | ✅ | Modal | User adds missing defects |
| **Class Popup** | ✅ | After Draw | Classify manual box |
| **PASS/FAIL Buttons** | ✅ | Modal Footer | Verify predictions |
| **Historical Hints** | ✅ | Modal | Cross-experiment insights |
| **Hint Acceptance** | ✅ | Click Hint | Import to current exp |
| **Verification Story** | ✅ | Hint Tooltip | Behavioral evolution |
| **Download Composite** | ✅ | Modal Toolbar | Export annotated image |
| **Detection Selection** | ✅ | Modal Sidebar | Individual box toggle |
| **Manual Box Delete** | ✅ | Double-click | Remove user box |
| **Manual Box Details** | ✅ | Single-click | Show metadata popup |
| **Analytics Modal** | 🔴 **TODO** | Button → Modal | Charts & insights |
| **Comparison Modal** | 🔴 **TODO** | Button → Modal | Multi-experiment A/B |
| **Keyboard Navigation** | ✅ | Modal | Arrow keys = prev/next |
| **Help Guide** | ✅ | Info Button | UI instructions |

---

## 🚀 NEXT STEPS: UNIFIED ANALYTICS EXPERIENCE

### VISION: The Complete Story

Instead of just showing filtered images, we need to **connect ALL insights into one narrative flow**:

```
┌─────────────────────────────────────────────────────┐
│         PREDICTION ANALYTICS DASHBOARD              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  📊 OVERVIEW                                        │
│  ├─ Total Images: 150                              │
│  ├─ Total Detections: 487                          │
│  ├─ Classes: scratch (320), dent (167)            │
│  ├─ FP Rate: 12% (58 false positives)             │
│  ├─ Recall: 89% (missed 22 defects)               │
│  └─ Human Verified: 45 images (30%)                │
│                                                      │
│  🔍 INSIGHTS                                        │
│  ├─ ⚠️ 12 images have overlapping boxes            │
│  ├─ ⚠️ 8 duplicate files found (wasting compute)   │
│  ├─ ⚠️ Tiny scratches have 45% FP rate             │
│  └─ ✅ Dents: 95% accuracy (validated)             │
│                                                      │
│  🎯 RECOMMENDED ACTIONS                             │
│  ├─ Review 28 "High Risk" images first            │
│  ├─ Verify 105 unverified detections              │
│  ├─ Remove 8 duplicate images                      │
│  └─ Consider retraining with tiny scratch focus   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### PROPOSED ENHANCEMENTS

1. **Dashboard View** (NEW Top Section)
   - Real-time insight cards
   - Auto-calculated metrics
   - Actionable recommendations

2. **Smart Filters** (Auto-Suggest)
   - "Show me problem areas" → Auto-applies high-risk + FP filter
   - "What needs verification?" → Unverified filter
   - "Data quality issues" → Duplicates + Overlaps

3. **Analytics Modal** (Deep Dive)
   - Confidence histogram
   - Class balance charts
   - Size distribution graph
   - FP rate by class
   - Recall/Precision curves

4. **Comparison Modal** (Multi-Experiment)
   - Side-by-side metrics
   - Improvement tracking
   - "Which model is better?" analysis

5. **Automated Reporting**
   - Export PDF with all insights
   - Executive summary
   - Technical details appendix

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Documentation & Planning ✅ (THIS DOCUMENT)
- [x] Audit all existing features
- [x] Map all data sources
- [x] Document all filters
- [x] Create unified architecture vision

### Phase 2: Analytics Dashboard (NEW)
- [ ] Create dashboard component above gallery
- [ ] Compute real-time metrics
- [ ] Add insight cards
- [ ] Implement recommendation engine

### Phase 3: Smart Filter Presets
- [ ] Add "Quick Filters" dropdown
- [ ] Implement preset logic
- [ ] Add custom preset saving

### Phase 4: Enhanced Analytics Modal
- [ ] Build chart components (Recharts/Chart.js)
- [ ] Compute advanced metrics
- [ ] Add export functionality

### Phase 5: Comparison Modal
- [ ] Multi-experiment selector
- [ ] Side-by-side metrics
- [ ] Visual diff tool

 ### Phase 6: Reporting & Export
- [ ] PDF generator
- [ ] Email integration (optional)
- [ ] Share link generation

---

## 🎓 DEVELOPMENT PRINCIPLES

1. **No Feature Left Behind**: This plan captures EVERYTHING. Review regularly.
2. **Data-Driven Decisions**: Every UI element must serve a clear analytical purpose.
3. **Progressive Disclosure**: Start simple, reveal complexity on demand.
4. **Unified State**: All features share ONE source of truth (experiment data).
5. **User-Centric Language**: Ban "IoU" etc in UI. Use "Overlapping Boxes" instead.
6. **Visual Hierarchy**: Most important insights should be immediately visible.
7. **Actionable First**: Every insight must suggest a next step.

---

## 📝 CONCLUSION

This architecture connects:
- **9 Data Sources** (predictions, GT, verifications, hashes, analytics, etc.)
- **14 Filter Types** (class, confidence, count, search, overlaps, duplicates, size, risk, review status)
- **30+ Features** (viewer, zoom, layers, tooltips, PASS/FAIL, manual drawing, hints, etc.)
- **3 Modals** (ImageViewer, Analytics, Comparison)
- **6 APIs** (projects, experiments, verifications, missed detections)

into ONE cohesive analytics experience that tells users **the complete story** of their predictions.

**Next Action**: Review this plan with stakeholder, then proceed to Phase 2 implementation!
