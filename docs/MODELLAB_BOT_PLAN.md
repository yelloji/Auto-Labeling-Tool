# Model Lab Bot Plan

## Status
- This is the current single source of truth for Model Lab bot design.
- It now reflects the real UI flow you explained from start to end.
- The only small visual detail still not fully confirmed is the exact layout of `Prediction Analytics -> Export`.
- No other major Model Lab flow is currently missing from this understanding doc.

## Product Intent
- Model Lab bot should help users inspect, validate, compare, reuse, and operationally judge trained models.
- It should feel like an expert reviewer of model performance, not a generic tab explainer.
- It should be explanation-first, with real actions only where they reduce user effort safely.
- It must stay centrally synchronized:
  - UI -> bot
  - bot -> UI
  - modal/view -> bot
  - no stale state

## Synchronization Strategy

### Required Runtime Pattern
- Model Lab should use centralized guide state just like the stronger bot sections.
- Source of truth:
  - `window.__modellabGuideState`
  - `modellabGuideStateChanged`
- Bot should trust published state first and only use DOM fallback as a last resort.

### What Must Be Published
- whether any trained models exist in the left panel
- currently selected training id / name
- active top-level tab
- active subtab where relevant
- task type of selected training:
  - detection
  - segmentation
- whether confusion matrix modal is open
- whether prediction image viewer is open
- whether prediction help modal is open
- whether classify-missing modal is open
- whether prediction analytics is open
- active prediction analytics tab
- whether comparison viewer is open
- whether validation result exists
- whether validation experiment name is valid enough to run
- whether advanced config editor is open
- whether advanced config can be sent back to Training

### Bot -> UI Actions That Should Exist
- `Run Validation`
- `Add Best Model to Project`
- `Add Last Model to Project`
- `Download Best Model`
- `Download Last Model`
- `Open Prediction Analytics`
- `Send Settings to Training`

### Guardrails
- Comparison Engine is only for prediction-run comparison, not validation comparison.
- If the advanced image viewer is open and the user clicks outside, the viewer closes and the bot should return to the underlying Prediction state.
- Validation guidance must respect the validation name gate and should not suggest running validation until the name is valid.
- Overview guidance must be task-aware:
  - detection training -> box metrics
  - segmentation training -> box + mask metrics

## End-to-End UI Order

### Start
- enter `Model Lab`
- left side shows trained model cards
- right side is empty until a training is selected

### Main Working Flow
- select a training from the left list
- inspect tabs in this order:
  - `Overview`
  - `Configuration`
  - `Model Manager`
  - `Validation`
  - `Prediction`
  - `Comparison Engine`

### Deep Drill-Down Flow
- `Overview` can open confusion matrix modal
- `Prediction` can open:
  - advanced image review viewer
  - prediction analytics workspace
- `Comparison Engine` can open:
  - affected-image comparison viewer

## Main Layout

### Left Panel
- `Trained Models` list
- each card represents one training experiment
- clicking a training card updates the right side immediately
- right-side tab/subtab selection stays in place while content switches to the newly selected training

### Right Panel
- empty state first:
  - user must select a training model from the left
- detail workspace after selecting a training card

### Important Empty-State Split
- `modellab-no-trainings`
  - left panel itself has no trained model cards
  - user cannot select a training because none exist yet
- `modellab-empty`
  - trained model cards exist on the left
  - but user has not selected one yet

## Top-Level Tabs
- `Overview`
- `Configuration`
- `Model Manager`
- `Validation`
- `Prediction`
- `Comparison Engine`

## Overview Tab

### Purpose
- show the final result summary of the selected training experiment

### Confirmed Content
- quick stats
  - instances
  - images
  - epochs
  - classes
- final validation metrics
- class-wise performance
- confusion matrix
- training analytics graphs

### Task-Aware Meaning
- detection trainings should be explained in terms of box metrics
- segmentation trainings should be explained in terms of both:
  - box metrics
  - mask metrics

### Confirmed Subflow
- clicking confusion matrix opens a larger modal view

## Configuration Tab

### Two Subsections
- `View Config`
- `Advanced Config Editor`

### View Config
- shows the full configuration actually used in that finished training run
- includes the real parameters saved for that experiment

### Advanced Config Editor
- lets the user reuse and edit settings for a future training
- meant for changing only a few parameters for the next run instead of filling everything again
- default parameters are not all shown there
- this editor focuses on meaningful saved/editable values

### Important Rule
- changes here do **not** affect the current completed training
- they apply only to a future training flow
- this is useful when the user creates a new training with a new name

### Real Reuse Action
- this area includes a real action that sends edited settings back to the Training section for a future run
- the bot must explain:
  - these edits are for the next training, not this completed one
  - sending settings is only useful when there is a real new training context to receive them
  - if there is no active training context, the UI should tell the user to go create a training and come back

### Empty / Blocked Meaning
- if there is no active new/resume training context to receive those values,
  the UI should show the "no training / go create training" kind of guidance

## Model Manager Tab

### Purpose
- manage the files produced by the selected training experiment

### Confirmed Content
- `Best Model (best.pt)`
- `Last Checkpoint (last.pt)`
- `Additional Files`
  - example: `args.yaml`

### Confirmed Actions
- download `best.pt`
- download `last.pt`
- `Add to Project` for each model
- download additional files like `args.yaml`

### Important Meaning
- `Add to Project` sends the trained model into the project Models section
- this is important if the user wants to use that trained model later for retraining or reuse

## Validation Tab

### Purpose
- create and inspect validation experiments for the currently selected training

### Layout
- left side:
  - validation parameters form
- center/right:
  - currently selected validation result
- far right:
  - validation experiment history

### Left Validation Parameters
- experiment name
- validation model choice
- dataset split
- confidence
- IoU threshold
- image size
- `Run Validation`

### Validation Name Gate
- validation should not be treated as runnable until the experiment name is valid
- the bot should not push `Run Validation` too early

### Important Behavior
- validation is tied to the currently selected training experiment
- if the user switches training on the left Model Lab list,
  the Validation tab updates immediately to that training's validation context

### Validation History
- previous validation experiments stay available until deleted
- user can create more than one validation experiment
- selecting one updates the visible validation result

### Validation Result Content
- metric cards:
  - mAP@0.5
  - mAP@0.5:0.95
  - precision
  - recall
  - F1 score
- confusion matrix heatmap
- compare action
- per-class performance breakdown table

### Compare Meaning
- validation compare should stay a validation-local concept
- it should **not** be treated as the Prediction Comparison Engine unless code later proves that routing exists

## Prediction Tab

### Purpose
- create, inspect, filter, and review prediction experiments for the currently selected training

### Main Layout
- left side:
  - prediction experiment history
- top center:
  - prediction configuration panel
- main result area:
  - summary cards
  - image gallery
- left filter rail for detailed result review

### Prediction History
- each prediction experiment is saved in the left history
- selecting one loads that experiment's results immediately
- prediction history items can be deleted
- `New` starts a fresh prediction experiment

### Prediction Configuration
- experiment name
- select prediction data:
  - validation set
  - training set
  - custom upload
- if custom upload is selected:
  - `Select Images or Folders`
- confidence
- IoU threshold
- batch size
- prediction task
- image size
- select prediction model
- `Run Prediction`
- `Analytics` button opens another UI

### Prediction Result Area
- image gallery of prediction outputs
- `Download Result`
- clicking a result image opens an advanced review viewer

### Prediction Filter Panel
- search image by name
- detection count:
  - any
  - with detections
  - no detections
  - 1-5 detections
  - 6-10 detections
  - 10+ detections
- class multi-select
- confidence range
- expert diagnostics:
  - detect overlaps
  - content duplicates
- object size:
  - all sizes
  - tiny
  - small
  - medium
  - large
- risk level:
  - high risk
  - medium risk
  - low risk
- review status:
  - verified correct
  - verified wrong
  - unverified

## Advanced Prediction Image Viewer

### Purpose
- this is an active review and correction workspace, not just a zoomed image modal

### Top Controls
- image name
- matching detections count
- current image index in the run
- load time
- view toggles:
  - `Boxes`
  - `Contours`
  - `Labels`
- zoom controls
- reset
- `Download`
- `Add Missing`
- `Help`
- duplicate / match-group indicator

### On-Image Meaning
- automatic prediction boxes are drawn directly on the image
- false positives can be labeled directly on the image itself
- orange dotted boxes are history / hint marks from other experiments
- purple boxes are manual missing marks
- dashed `MISSED` boxes show missing detections clearly

### Confidence Color Meaning
- red:
  - confidence below 40
- yellow:
  - confidence 40-70
- green:
  - confidence above 70

### Bottom Review Strip
- each detection has its own review chip/card
- each chip can show:
  - class
  - confidence
  - size
  - status
  - history / hint markers
- each detection can be marked:
  - `UNVERIFIED`
  - `PASS`
  - `FAIL`
- hover highlights the matching detection on the image
- clicking a detection chip zooms/focuses that prediction on the image

### Missing Mark Flow
- user can draw a missing mark manually
- after drawing, a class picker appears
- user must choose which class is missing
- this creates reusable missing-object knowledge for that image region

### Prediction Help State
- `modellab-prediction-help`
  - should explain:
    - confidence colors
    - box / contour / label toggles
    - pass / fail / unverified
    - duplicate / hint meaning
    - how this review feeds future experiments

### Classify Missing State
- `modellab-prediction-classify-missing`
  - should explain:
    - user is assigning the missing object's class
    - this creates reusable missing-detection knowledge
    - accurate marking matters because it teaches later review/comparison flows

### Persistent Review Memory
- `PASS / FAIL` is not temporary UI only
- it is saved in the project database as reusable review memory
- this memory can appear later across:
  - different training experiments
  - different prediction experiments
  - different confidence settings
- the system uses the same image identity / hash matching strategy to find previous reviewed areas

### Hint / Verification Story
- orange hint means a previous reviewed mark was found on the same image region
- user can accept that old decision into the current experiment
- `Verification Story` shows where that old review came from:
  - previous training / prediction context
  - previous PASS / FAIL decision

### Custom Upload Meaning
- for uploaded custom images there may be no ground truth by default
- in that case, missing detections may need to be marked manually by the user
- those manual marks can then become reusable review knowledge in later experiments

## Prediction Analytics

### Purpose
- this is a second-layer analytics workspace opened from Prediction
- it interprets prediction quality, confidence behavior, object-size performance, blind spots, and deployment readiness
- it also generates recommendation text and exportable reporting

### Top-Level Tabs
- `Overview`
- `Quality`
- `Charts`
- `Report`

### Overview Tab
- summary cards:
  - total detections
  - average confidence
  - coverage
  - density
- smart insights panel
  - alerts such as images with no detections
  - retraining recommendations
- class distribution
- confidence ranges
- overview text appears to be dynamic based on the actual prediction result

### Dynamic Size Grouping
- object-size categories are not fixed static labels
- the system dynamically groups detections by relative size distribution in the analyzed prediction result
- example size groups:
  - tiny
  - small
  - medium
  - large
- this is important for industrial defect datasets where object scale distribution matters

### Quality Tab
- focuses on deeper interpretation of prediction quality
- main cards:
  - precision
  - recall
  - F1 score
- deep diagnostics:
  - false positives
  - missed objects
  - average IoU / geometric accuracy
- quality conclusions and warnings are presented in more actionable language, not just raw metrics

### Charts Tab
- advanced dark-theme analytics / telemetry style view
- includes:
  - quality score
  - detection ratio
  - true positives
  - false positives
  - misaligned
  - missed objects
  - precision
  - recall
  - F1 score
- left-side control panel includes:
  - split selector
  - class filter
  - confidence threshold
  - IoU alignment threshold
  - global scale distribution scan
- operational integrity / reliability audit chart:
  - shows how TP / FP / missed objects shift across confidence thresholds
  - highlights:
    - production baseline
    - max safe confidence
    - target confidence
- accuracy-by-object-size chart:
  - separate lines for tiny / small / medium / large units
  - channel selector supports:
    - global average
    - class-specific views
- visual blindspot / spatial bias diagnostic:
  - grid heatmap of where errors cluster
  - can filter by class
  - can inspect scale-specific risk areas

### Dynamic Recommendation Logic
- recommendation text appears to be generated dynamically from the analyzed results
- examples:
  - prediction confidence recommendations
  - retraining recommendations
  - size-specific suggestions
  - spatial blindspot warnings
  - confidence ceiling / production threshold suggestions
- this text should be treated as a first-class part of the UI, not decorative filler

### Report Tab
- generates a more formal report view
- includes:
  - dataset details
  - training analytics detail
  - segmentation / detection metrics
  - class-wise performance
  - evidence-based diagnostics
  - deployment readiness summary
- includes export action like:
  - `Export PDF Report`

### Deployment Readiness
- prediction analytics includes an explicit deployment-readiness section
- example outputs:
  - reliability limit
  - optimal balance point
  - automation rate
  - deployment status
- also explains:
  - why the model is not ready
  - production assessment
  - training assessment
- this is not just metric display; it is decision-support output

### Export Behavior
- there does not need to be a separate `Export` analytics subtab
- the useful export flow is already covered inside `Report`
- PDF export should be treated as part of the report UI itself
- if an old or temporary export-only sub-UI still exists, it can be removed later without blocking Model Lab bot design

## Comparison Engine Tab

### Purpose
- compare prediction runs between different models / training sessions

### Setup Area
- `Model A (Baseline)`
  - training session
  - prediction run
- `Model B (Challenger)`
  - training session
  - prediction run
- optional third model toggle exists

### Comparison Preconditions
- comparison becomes meaningful after both sides are selected
- common images are detected and shown

### Comparison Results
- quality comparison between baseline and challenger
- metric comparison including:
  - precision
  - recall
  - F1 score
  - average IoU
  - true positives
  - false positives
  - false negatives
  - total GT objects
- overall winner summary

### Error / Improvement Breakdown
- false positives fixed
- missed objects fixed
- new false positives
- new missed objects
- confidence improved
- confidence degraded

### Drill-Down Viewer
- clicking affected-image cards opens a detailed image comparison viewer
- viewer shows what changed between old and new predictions
- example labels:
  - old false alarm
  - remaining false alarm
- viewer supports navigation across affected images
- clicking summary cards like:
  - false positives fixed
  - missed objects fixed
  - new false positives
  - new missed objects
  opens the matching comparison viewer flow

## States
- `modellab-no-trainings`
- `modellab-empty`
- `modellab-overview`
- `modellab-confusion-modal`
- `modellab-config-view`
- `modellab-config-advanced`
- `modellab-model-manager`
- `modellab-validation`
- `modellab-prediction`
- `modellab-prediction-image-viewer`
- `modellab-prediction-help`
- `modellab-prediction-classify-missing`
- `modellab-prediction-analytics`
- `modellab-prediction-analytics-overview`
- `modellab-prediction-analytics-quality`
- `modellab-prediction-analytics-charts`
- `modellab-prediction-analytics-report`
- `modellab-comparison-engine`
- `modellab-comparison-viewer`

## Suggested Priority Order
1. `modellab-prediction-classify-missing`
2. `modellab-prediction-help`
3. `modellab-prediction-image-viewer`
4. `modellab-confusion-modal`
5. `modellab-prediction-analytics-report`
6. `modellab-prediction-analytics-charts`
7. `modellab-prediction-analytics-quality`
8. `modellab-prediction-analytics-overview`
9. `modellab-prediction-analytics`
10. `modellab-comparison-viewer`
11. `modellab-comparison-engine`
12. `modellab-validation`
13. `modellab-model-manager`
14. `modellab-config-advanced`
15. `modellab-config-view`
16. `modellab-overview`
17. `modellab-empty`
18. `modellab-no-trainings`

## Core Bot Content Required At Implementation Time

### Default Entry Help
- explain the 2-panel layout first:
  - left = trained model list
  - right = selected training workspace
- explain that tab/subtab position stays while the training selection changes

### Configuration Help
- `View Config`
  - what was actually used in that finished run
- `Advanced Config Editor`
  - what will be reused in the next training only
  - how `Send Settings to Training` should be understood

### Validation Help
- how to set up a new validation experiment
- why the experiment name matters before run
- how validation history differs from the currently shown result

### Model Manager Help
- difference between:
  - `best.pt`
  - `last.pt`
- why `Add to Project` matters for reuse / retraining

### Prediction Help
- how to create a new prediction run
- what the filter panel means
- what review states mean
- how hint memory and manual missing marks work

### Prediction Analytics Help
- explain this as decision-support, not just charts
- confidence recommendation
- retraining recommendation
- dynamic size analysis
- blind-spot analysis
- deployment readiness

### Comparison Engine Help
- baseline vs challenger
- common-image requirement
- how FP / FN / confidence deltas are interpreted

### Comparison Viewer Help
- explain that this viewer shows one concrete changed image at a time
- explain what changed between baseline and challenger on this image
- explain labels such as:
  - old false alarm
  - remaining false alarm
  - fixed false positive
  - missed object changes
- explain that users opened this viewer from one of the comparison result cards
- explain left/right navigation across affected images

## Remaining Minor Gap
- no separate `Prediction Analytics -> Export` tab is needed for implementation readiness
- the current meaningful export path is the PDF/report export already available from `Report`
- if the product still has an old export-only surface, it should be treated as removable cleanup rather than a required bot flow

## Next Step
- this plan is now ready for one more Claude review focused only on any final real implementation gaps
- after that, it can become the implementation-ready Model Lab bot design
