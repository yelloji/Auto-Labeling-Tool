# Prediction Analytics UI Design Specification

> **PURPOSE**: Crystal-clear visual plan for how ALL analytics features will be organized and displayed in the UI

---

## 🎨 UI VISION: THE COMPLETE ANALYTICS INTERFACE

### GOAL
Create a **single, unified analytics dashboard** that shows users EVERYTHING about their predictions in one glance, with progressive disclosure for deep dives.

---

## 📐 LAYOUT STRUCTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PREDICTION TAB - MAIN LAYOUT                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌────────────────────────────────────────────────┐  │
│  │              │  │  CONFIGURATION SECTION (Always visible)         │  │
│  │  EXPERIMENT  │  │  • Run new prediction                           │  │
│  │  HISTORY     │  │  • Select dataset, model params                 │  │
│  │  SIDEBAR     │  ├────────────────────────────────────────────────┤  │
│  │              │  │  ⭐ NEW: ANALYTICS DASHBOARD (When completed)  │  │
│  │  (List of    │  │  ┌──────────────────────────────────────────┐  │  │
│  │   past       │  │  │  📊 QUICK INSIGHTS ROW                   │  │  │
│  │   runs)      │  │  │  [Total] [Avg Conf] [FP Rate] [Recall]  │  │  │
│  │              │  │  ├──────────────────────────────────────────┤  │  │
│  │              │  │  │  ⚠️ ALERTS & RECOMMENDATIONS             │  │  │
│  │              │  │  │  • 12 images with overlapping boxes      │  │  │
│  │              │  │  │  • 28 high-risk detections need review   │  │  │
│  │              │  │  │  • Tiny scratches: 45% false positive    │  │  │
│  │              │  │  ├──────────────────────────────────────────┤  │  │
│  │              │  │  │  🎯 QUICK ACTIONS                        │  │  │
│  │              │  │  │  [Review High Risk] [Show Duplicates]    │  │  │
│  │              │  │  │  [View Analytics] [Compare Experiments]  │  │  │
│  │              │  │  │  [Export Report]                         │  │  │
│  │              │  │  └──────────────────────────────────────────┘  │  │
│  │              │  ├────────────────────────────────────────────┤  │  │
│  │              │  │  🔍 FILTERS PANEL (Collapsible)            │  │  │
│  │              │  │  • Class Selection (multi-select)           │  │  │
│  │              │  │  • Confidence Range (slider)                │  │  │
│  │              │  │  • Detection Count (dropdown)               │  │  │
│  │              │  │  • Image Search (text input)                │  │  │
│  │              │  │  ─ EXPERT DIAGNOSTICS ─                    │  │  │
│  │              │  │  • Overlap Detection (toggle + IoU slider)  │  │  │
│  │              │  │  • Content Duplicates (toggle)              │  │  │
│  │              │  │  • Object Size Groups (4 tiers + isolate)   │  │  │
│  │              │  │  ─ QUALITY ASSURANCE ─                     │  │  │
│  │              │  │  • Risk Level (high/med/low)                │  │  │
│  │              │  │  • Review Status (pass/fail/unverified)     │  │  │
│  │              │  │  [🧹 Clear All Filters]                     │  │  │
│  │              │  ├────────────────────────────────────────────┤  │  │
│  │              │  │  🖼️ RESULTS GALLERY (Paginated)           │  │  │
│  │              │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐       │  │  │
│  │              │  │  │IMG1│ │IMG2│ │IMG3│ │IMG4│ │IMG5│       │  │  │
│  │              │  │  └────┘ └────┘ └────┘ └────┘ └────┘       │  │  │
│  │              │  │   Each with: Thumbnail, badges, metrics    │  │  │
│  │              │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐       │  │  │
│  │              │  │  │IMG6│ │IMG7│ │IMG8│ │IMG9│ │IM10│       │  │  │
│  │              │  │  └────┘ └────┘ └────┘ └────┘ └────┘       │  │  │
│  │              │  │                                             │  │  │
│  │              │  │  [< Previous]  Page 1 of 5  [Next >]       │  │  │
│  └──────────────┘  └────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ⭐ NEW SECTION: ANALYTICS DASHBOARD

### Location
**Appears between Configuration and Filters** when an experiment is completed

### Purpose
Show **instant insights** without any filtering - give users the full story at a glance

---

### 📊 PART 1: QUICK INSIGHTS ROW

**Layout**: 4 metric cards in a horizontal row

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  📍 TOTAL        │  │  ✓ AVERAGE       │  │  ⚠️ FALSE POS   │  │  🎯 RECALL      │
│  487 Detections  │  │  76.3% Conf      │  │  12% (58 boxes) │  │  89% Coverage   │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Card 1: Total Detections**
- **Icon**: 📍 Dot
- **Color**: Blue
- **Value**: `experiment.analytics_summary.total_detections`
- **Label**: "Total Detections"

**Card 2: Average Confidence**
- **Icon**: ✓ Check
- **Color**: Green
- **Value**: `(avg_confidence * 100).toFixed(1)%`
- **Label**: "Avg Confidence"

**Card 3: False Positive Rate** (NEW!)
- **Icon**: ⚠️ Warning
- **Color**: Orange
- **Value**: Calculate from `fpIndices.length / total_detections`
- **Label**: "False Positive Rate"
- **Tooltip**: "Predictions that don't match ground truth"

**Card 4: Recall** (NEW!)
- **Icon**: 🎯 Target
- **Color**: Purple
- **Value**: Calculate from `(total - missed) / (total + missed)`
- **Label**: "Recall (Coverage)"
- **Tooltip**: "Percentage of real defects found"

---

### ⚠️ PART 2: SMART ALERTS & RECOMMENDATIONS

**Layout**: Expandable alert banner with icon-coded insights

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ QUALITY ALERTS (3 issues found)                           [Expand ▼]│
├─────────────────────────────────────────────────────────────────────────┤
│  🔴 HIGH PRIORITY                                                        │
│  • 28 images contain high-risk detections (< 40% confidence)            │
│    [Filter Now →]                                                        │
│                                                                          │
│  🟡 MEDIUM PRIORITY                                                      │
│  • 12 images have overlapping bounding boxes (possible double-counting) │
│    [Show Overlaps →]                                                     │
│  • 8 duplicate image files detected (MD5 hash match)                    │
│    [View Duplicates →]                                                   │
│                                                                          │
│  🔵 INSIGHTS                                                             │
│  • Tiny size group has 45% false positive rate (vs 8% overall)          │
│    [Analyze Tiny Objects →]                                              │
│  • Class "scratch" shows 15% lower confidence than "dent"               │
│    [Class Analysis →]                                                    │
│                                                                          │
│  ✅ GOOD NEWS                                                            │
│  • 95% of "dent" predictions verified correct by humans                 │
│  • No missed detections in 78% of images                                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Alert Types**:
1. **🔴 High Priority** (Red)
   - High-risk detections count
   - Critical errors
   - Action required

2. **🟡 Medium Priority** (Yellow)
   - Overlaps detected
   - Duplicates found
   - Data quality issues

3. **🔵 Insights** (Blue)
   - Pattern discoveries
   - Class-specific analysis
   - Size/confidence correlations

4. **✅ Good News** (Green)
   - What's working well
   - Validation successes
   - Quality confirmations

**Smart Logic** (Auto-generates based on data):
```javascript
// Pseudocode for alert generation
if (highRiskImages.length > 0) {
    alerts.push({
        priority: 'high',
        message: `${highRiskImages.length} images contain high-risk detections`,
        action: 'Filter Now',
        filterPreset: { riskLevel: 'high' }
    });
}

if (overlappingImages.length > 0) {
    alerts.push({
        priority: 'medium',
        message: `${overlappingImages.length} images have overlapping boxes`,
        action: 'Show Overlaps',
        filterPreset: { showOverlapping: true }
    });
}

// ... more smart detection logic
```

---

### 🎯 PART 3: QUICK ACTION BUTTONS

**Layout**: Button group with one-click presets

```
┌─────────────────────────────────────────────────────────────────────────┐
│  QUICK ACTIONS                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  [🔴 Review High Risk]  [📋 Show Duplicates]  [📊 View Analytics]      │
│  [⚖️ Compare Experiments]  [💾 Export Report]  [🧹 Reset All Filters]  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Buttons**:

1. **Review High Risk** (Red)
   - **Action**: Apply filter `{ riskLevel: 'high' }`
   - **Icon**: 🔴
   - **Purpose**: Jump straight to problematic images

2. **Show Duplicates** (Yellow)
   - **Action**: Apply filter `{ showOnlyDuplicates: true }`
   - **Icon**: 📋
   - **Purpose**: Quality control workflow

3. **View Analytics** (Blue)
   - **Action**: Open `AnalyticsModal`
   - **Icon**: 📊
   - **Purpose**: Deep dive into charts/metrics

4. **Compare Experiments** (Purple)
   - **Action**: Open `ComparisonModal`
   - **Icon**: ⚖️
   - **Purpose**: A/B test different runs

5. **Export Report** (Green) - NEW!
   - **Action**: Generate PDF/CSV with all insights
   - **Icon**: 💾
   - **Purpose**: Share results with team

6. **Reset All Filters** (Gray)
   - **Action**: Clear all active filters
   - **Icon**: 🧹
   - **Purpose**: Start fresh

---

## 📊 ENHANCED ANALYTICS MODAL

### Trigger
Click "View Analytics" button OR "Analytics" icon in toolbar

### Layout
**Width**: 1200px (larger for charts)
**Sections**: 4 tabs

---

### TAB 1: OVERVIEW (Default)

**Current State** (Already exists):
```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Prediction Analytics: experiment_name              [X Close]    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  487     │  │  76.3%   │  │  142     │  │  3.4     │           │
│  │Total Dets│  │Avg Conf  │  │w/ Hits   │  │Dets/Img  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                      │
│  ┌──────────────────────────────┐  ┌────────────────────────────┐  │
│  │  CLASS DISTRIBUTION TABLE    │  │  CONFIDENCE RANGES         │  │
│  │  ┌────────┬───────┬─────┐   │  │  • 0-30%:   45 objects    │  │
│  │  │ Class  │ Count │  %  │   │  │  • 30-50%:  89 objects    │  │
│  │  │ scratch│  320  │ 66% │   │  │  • 50-70%: 156 objects    │  │
│  │  │ dent   │  167  │ 34% │   │  │  • 70-100%: 197 objects   │  │
│  │  └────────┴───────┴─────┘   │  │                            │  │
│  └──────────────────────────────┘  │  Peak: 70-100% range      │  │
│                                     └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### TAB 2: CHARTS (NEW!)

**Layout**: Visual data exploration

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Charts                                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  CONFIDENCE DISTRIBUTION (Histogram)                         │  │
│  │  ┃                                                            │  │
│  │  ┃         ▁▁▁                                                │  │
│  │  ┃     ▁▁▁███▁▁▁                                              │  │
│  │  ┃ ▁▁▁█████████████▁▁▁                                        │  │
│  │  ┃███████████████████████                                     │  │
│  │  └─0%──20%──40%──60%──80%──100%─                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐   │
│  │  CLASS PIE CHART         │  │  SIZE DISTRIBUTION           │   │
│  │      ╱───╲                │  │  (Quartile Breakdown)        │   │
│  │   ╱ 66%  ╲                │  │  Tiny:   25% (122 boxes)    │   │
│  │  │scratch │               │  │  Small:  25% (121 boxes)    │   │
│  │   ╲ 34% ╱                │  │  Medium: 25% (122 boxes)    │   │
│  │     ╲─╱dent               │  │  Large:  25% (122 boxes)    │   │
│  └──────────────────────────┘  └──────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  RISK BREAKDOWN (Stacked Bar)                                │  │
│  │  Low (>70%)   ████████████████████ 197                       │  │
│  │  Med (40-70%) ████████████ 156                               │  │
│  │  High (<40%)  ████ 134                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Charts to Include**:
1. **Confidence Histogram**: Show distribution curve
2. **Class Pie Chart**: Visual class balance
3. **Size Distribution**: Quartile breakdown
4. **Risk Breakdown**: Stacked bar by confidence tier
5. **False Positive Rate by Class** (NEW): Bar chart comparing FP% per class

**Library**: Use **Recharts** (React-friendly, beautiful)

---

### TAB 3: QUALITY REPORT (NEW!)

**Layout**: Detailed quality metrics

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ Quality Report                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📈 DETECTION PERFORMANCE                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Metric                 │ Value     │ Status                 │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Total Detections       │ 487       │ ✅ Good Volume        │  │
│  │  False Positives (FP)   │ 58 (12%)  │ ⚠️ Needs Review       │  │
│  │  Missed Detections      │ 22        │ ⚠️ Low Recall         │  │
│  │  Precision              │ 88%       │ ✅ Acceptable         │  │
│  │  Recall                 │ 89%       │ ✅ Good Coverage      │  │
│  │  F1 Score               │ 88.5%     │ ✅ Balanced           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  🎯 CLASS-SPECIFIC ANALYSIS                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Class    │ Count │ Avg Conf │ FP Rate │ Recall │ Status    │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  scratch  │  320  │  72.1%   │  15%    │  85%   │ ⚠️ Review │  │
│  │  dent     │  167  │  83.5%   │   5%    │  95%   │ ✅ Good   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  🔍 SIZE IMPACT ANALYSIS                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Size    │ Count │ Avg Conf │ FP Rate │ Insight             │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Tiny    │  122  │  58.3%   │  45%    │ ⚠️ Struggles here   │  │
│  │  Small   │  121  │  71.2%   │  12%    │ ✅ Acceptable       │  │
│  │  Medium  │  122  │  82.1%   │   5%    │ ✅ Strong           │  │
│  │  Large   │  122  │  91.7%   │   2%    │ ✅ Excellent        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  📊 DATA QUALITY CHECKS                                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ✅ No duplicate images (all unique MD5 hashes)              │  │
│  │  ⚠️ 12 images contain overlapping boxes (check for errors)   │  │
│  │  ✅ All images have at least 1 detection                     │  │
│  │  ⚠️ 28 images flagged as high-risk (low confidence)          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [📥 Export Full Report as PDF]                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Metrics to Calculate**:
- **Precision**: `TP / (TP + FP)` where TP = verifications with "pass", FP = false positives
- **Recall**: `TP / (TP + FN)` where FN = missed detections
- **F1 Score**: `2 * (Precision * Recall) / (Precision + Recall)`
- **FP Rate by Class**: Per-class false positive percentage
- **FP Rate by Size**: Per-size-group false positive percentage

---

### TAB 4: HUMAN VERIFICATION (NEW!)

**Layout**: Show verification progress

```
┌─────────────────────────────────────────────────────────────────────┐
│  👤 Human Verification Status                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📊 VERIFICATION PROGRESS                                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░  45 / 150 images  │  │
│  │                                              30% verified     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  ✅ PASS     │  │  ❌ FAIL     │  │  ➕ MANUAL   │             │
│  │  98 boxes    │  │  23 boxes    │  │  12 boxes    │             │
│  │  (Correct)   │  │  (Wrong)     │  │  (Added)     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
│  📋 VERIFICATION BREAKDOWN                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Status       │ Images │ Detections │ Percentage            │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  ✅ Verified  │   45   │    133     │  27% of total dets    │  │
│  │  ⚠️ Pending   │  105   │    354     │  73% needs review     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  🏆 TOP CONTRIBUTORS (Historical)                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  User        │ Verifications │ Last Active                   │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  You (This)  │     133       │ Today                         │  │
│  │  Past Exp #1 │      45       │ 3 days ago                    │  │
│  │  Past Exp #2 │      67       │ 1 week ago                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [Filter: Show Only Unverified Images]                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ⚖️ ENHANCED COMPARISON MODAL

### Trigger
Click "Compare Experiments" button

### Current State (Already exists):
Shows side-by-side table with:
- Experiment names + dates
- Config params (confidence, IoU, imgsz, max_det)
- Basic metrics (total objects, avg confidence, image count, duration)

### Proposed Enhancements:

**ADD: Visual Comparison Charts**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚖️ Multi-Experiment Comparison                        [X Close]   │
├─────────────────────────────────────────────────────────────────────┤
│  [📊 Table View]  [📈 Chart View] ◀── NEW TAB                      │
│                                                                      │
│  📊 TABLE VIEW (Current)                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Metric        │ Exp1 (Jan 20) │ Exp2 (Jan 21) │ Winner     │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Total Objects │     487       │     512       │ Exp2 🏆    │  │
│  │  Avg Conf      │    76.3%      │    78.1%      │ Exp2 🏆    │  │
│  │  FP Rate       │     12%       │      8%       │ Exp2 🏆    │  │
│  │  Recall        │     89%       │     91%       │ Exp2 🏆    │  │
│  │  Duration      │     45s       │     52s       │ Exp1 🏆    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  📈 CHART VIEW (NEW)                                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  CONFIDENCE COMPARISON (Side-by-side Histograms)            │  │
│  │  Exp1:  ▁▁▁███████▁▁▁     Exp2:  ▁▁███████▁                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  CLASS DISTRIBUTION (Grouped Bar Chart)                      │  │
│  │  scratch:  [████Exp1] [█████Exp2]                            │  │
│  │  dent:     [████Exp1] [███Exp2]                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  🎯 RECOMMENDATION                                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Based on 4/5 metrics, Experiment 2 shows better performance │  │
│  │  ✅ Higher confidence (+1.8%)                                │  │
│  │  ✅ Lower false positive rate (-4%)                          │  │
│  │  ✅ Better recall (+2%)                                       │  │
│  │  ⚠️ Slightly slower (+7s)                                    │  │
│  │                                                                │  │
│  │  Recommended: Use Exp2 settings for production               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [Export Comparison Report]                                         │
└─────────────────────────────────────────────────────────────────────┘
```

**NEW Features**:
1. **Winner Column**: Auto-highlight best performer per metric
2. **Chart Tab**: Visual comparison graphs
3. **AI Recommendation**: Auto-suggest best experiment with reasoning
4. **Export Comparison**: PDF report with side-by-side analysis

---

## 🖼️ GALLERY ENHANCEMENTS

### Current State
Grid of image thumbnails with overlays

### Proposed Enhancements

**Add Info Badges on Thumbnails**:

```
┌─────────────────────────┐
│  ┌─────────────────────┐│
│  │                     ││  ← Thumbnail
│  │     IMAGE.JPG       ││
│  │                     ││
│  └─────────────────────┘│
│  🔴 3 High Risk         │  ← NEW: Risk badge
│  ⚠️ FALSE POS (2)       │  ← NEW: FP badge
│  📋 DUP GROUP #1        │  ← Duplicate badge (exists)
│  ✓ Verified            │  ← NEW: Human verification badge
│  12 detections         │  ← Detection count (exists)
└─────────────────────────┘
```

**Badge Types**:
1. **Risk Badge**: 🔴 High / 🟡 Med / 🟢 Low
2. **FP Badge**: ⚠️ Shows count of false positives
3. **Duplicate Badge**: 📋 Group number
4. **Verification Badge**: ✓ Pass / ❌ Fail / ⚪ Pending
5. **Detection Count**: Total boxes in image

---

## 💡 SMART FILTER PRESETS (NEW!)

### Location
Top of filter panel

### UI Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  🎯 QUICK FILTER PRESETS                                 [+ Save]   │
├─────────────────────────────────────────────────────────────────────┤
│  [🔴 High Risk]  [⚠️ Problem Areas]  [✓ Verified]  [Custom ▼]      │
└─────────────────────────────────────────────────────────────────────┘
```

**Presets**:

1. **High Risk**
   - Applies: `riskLevel: 'high'`
   - Purpose: Jump to low-confidence detections

2. **Problem Areas**
   - Applies: `showOverlapping: true` + `showOnlyDuplicates: true`
   - Purpose: Data quality check

3. **Verified**
   - Applies: `reviewStatus: 'pass'` or `'fail'`
   - Purpose: See what's been reviewed

4. **Custom** (Dropdown)
   - User-saved custom filter combinations
   - "Save Current Filters" button
   - Manage saved presets

---

## 📱 RESPONSIVE DESIGN NOTES

### Desktop (> 1200px)
- Full 2-column layout (sidebar + main)
- All features visible
- Analytics dashboard expanded

### Tablet (768px - 1200px)
- Collapsible sidebar (hamburger menu)
- Analytics dashboard stacked vertically
- Filters panel collapsible by default

### Mobile (< 768px)
- Single column
- Bottom navigation tabs
- Swipeable image gallery
- Simplified analytics (cards only, no charts)

---

## 🎨 DESIGN SYSTEM

### Colors

**Risk Tiers**:
- 🔴 High Risk: `#ff4d4f` (Red)
- 🟡 Medium Risk: `#faad14` (Orange/Yellow)
- 🟢 Low Risk: `#52c41a` (Green)

**Status Colors**:
- ✅ Pass/Success: `#52c41a` (Green)
- ❌ Fail/Error: `#ff4d4f` (Red)
- ⚠️ Warning: `#faad14` (Orange)
- 🔵 Info: `#1890ff` (Blue)
- ⚪ Neutral/Pending: `#d9d9d9` (Gray)

**Specialty**:
- 🟣 Manual Boxes: `#a335ee` (Purple)
- 🟠 False Positives: `#ff8c00` (Dark Orange)
- ⚫ Missed Detections: `#d0d0d0` (Light Gray)
- 🟤 Historical Hints: `#ff8c00` (Orange, dashed)

### Typography

**Headers**: 
- Dashboard Title: 18px, Bold
- Section Headers: 16px, Semi-Bold
- Card Titles: 14px, Medium

**Body**:
- Primary: 14px, Regular
- Secondary: 12px, Regular (`color: #666`)

**Metrics**:
- Large Numbers: 32px, Bold
- Percentages: 24px, Medium

### Spacing

- **Card Padding**: 16px
- **Section Gap**: 24px
- **Button Margin**: 8px
- **Grid Gap**: 16px

---

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1: Foundation (Week 1)
1. ✅ Analytics Dashboard component structure
2. ✅ Quick Insights Row (4 metric cards)
3. ✅ Basic alert detection logic

### Phase 2: Intelligence (Week 2)
1. ✅ Smart Alerts & Recommendations engine
2. ✅ Quick Action Buttons
3. ✅ Filter preset system

### Phase 3: Deep Analytics (Week 3)
1. ✅ Enhanced Analytics Modal tabs
2. ✅ Chart integration (Recharts)
3. ✅ Quality Report calculations

### Phase 4: Comparison & Export (Week 4)
1. ✅ Enhanced Comparison Modal
2. ✅ Winner detection logic
3. ✅ PDF export functionality

### Phase 5: Polish (Week 5)
1. ✅ Gallery badge enhancements
2. ✅ Responsive design
3. ✅ Animation & transitions

---

## ✅ SUCCESS CRITERIA

**User can answer these questions in < 10 seconds:**
1. ✅ "How many detections did I get?"
2. ✅ "What's the average confidence?"
3. ✅ "Are there any problems I should know about?"
4. ✅ "Which images need my review first?"
5. ✅ "How does this compare to my last run?"
6. ✅ "What's the false positive rate?"
7. ✅ "Which class is performing worst?"
8. ✅ "Are there any duplicate images?"

**Every insight is actionable:**
- Alert → One-click filter to relevant images
- Chart → Clickable to drill down
- Metric → Tooltip explaining what to do

**Progressive disclosure:**
- Glance → Dashboard shows key metrics
- Inspect → Analytics modal for deep dive
- Compare → Comparison modal for A/B testing
- Act → Filters lead to specific images

---

## 📝 FINAL NOTES

This UI design connects:
- **4 Major Sections**: Dashboard, Filters, Gallery, Modals
- **12 metric cards**: Instant insights
- **8 chart types**: Visual analysis
- **4 modal tabs**: Deep dives
- **6 quick actions**: One-click workflows
- **5 alert priorities**: Smart recommendations

**Every pixel has a purpose** - show users what matters, guide them to action!

---

**Next Step**: Review this UI specification, then build Phase 1!
