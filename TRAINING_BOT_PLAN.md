# Training Bot Plan

## Final Design Status
- This is the current merged Training bot plan.
- Use this file as the single source of truth for Training bot design.
- Older draft structure and older appended review notes should not be followed separately.
- This version already includes the valid concerns raised in earlier Claude reviews.
- Training bot implementation has now started from this plan.

## Implementation Progress
- Added `frontend/src/components/guide-bot/pages/trainingBot.js`
  - real Training snapshot detection
  - explanation branches
  - real actions for `Start Training`, `Open AI Console`, and `Hide AI Console`
- Added `frontend/src/components/project-workspace/ModelTrainingSection/trainingGuideState.js`
  - centralized `window.__trainingGuideState` publisher helpers
- Wired Training bot into `frontend/src/components/guide-bot/GuideBot.jsx`
  - direct-open detection
  - workspace refresh listener
  - wizard answer routing
  - close behavior for `training-*`
- Updated `frontend/src/components/project-workspace/ModelTrainingSection/ModelTrainingSection.jsx`
  - publishes Training guide state
  - distinguishes:
    - initializing
    - running
    - failed
    - last-result status
  - publishes preflight, mode, dataset-release, model, preview/status, and AI Console context
- Updated Training subcomponents to publish protected modal state:
  - `ModeToggle/ModeToggle.jsx`
  - `Preset/PresetSection.jsx`
  - `Terminal/TerminalPanel.jsx`
- Disabled the old static Training fallback in `frontend/src/components/guide-bot/guideScript.js`

## Current Testing Focus
- direct open on Training page should use the new Training bot, not legacy script
- user mode empty vs ready
- developer mode password and change-password dialogs
- GPU selection dialog
- AI Console and terminal password modal
- `Start Training` action
- initializing -> running -> failed / last-result transitions
- status tab showing last completed result when no active run exists

## Accepted Review Corrections Already Included
- Dataset release help and pretrained model help are treated as help branches, not fake standalone snapshot states.
- A real `training-failed` state is included.
- Snapshot priority order is defined.
- Running / initializing / last-result are treated as mode-neutral Training states.
- Dataset selection guidance now reflects the real selected / extract / extracted flow.
- The plan now includes explicit expert branches for:
  - single-class guidance
  - smart-auto optimizer guidance
  - YOLO26 / MuSGD guidance
  - grouped developer parameter guidance
- `Start Training` is treated as a real bot -> UI action.
- Required detection/event work is listed before coding starts.

## Goal
- Build a Training bot that feels like a real expert guide inside the app.
- Keep it deterministic, state-aware, lightweight, and product-safe.
- Cover both User mode and Developer mode without generic filler.

## Core Product Intent
- The bot should guide a real user through model training like an experienced person would.
- It should explain the workflow, warn about risky settings, and help users complete the real UI safely.
- It should not depend on live internet or a runtime LLM.
- Guidance should come from:
  - real UI state
  - selected mode
  - selected task
  - selected model
  - selected release
  - parameter values
  - training status
  - deterministic rules

## Central Sync Rule
- UI -> bot must update correctly
- bot -> UI must update correctly
- modal open/close must sync
- protected subflows must sync
- no stale bot state
- no duplicate explanations under different button names

## Real Training UI Map

### Main Page Structure
- Header:
  - `Model Training`
  - `Mode` toggle
  - `AI Console` button in Developer mode only
- Step bar:
  - `Identity`
  - `Dataset`
  - `Train`
- Left column:
  - `Identity`
  - `Framework & Task`
  - `Pretrained Model`
  - `Dataset`
  - `Training Preset`
- Right column:
  - readiness/preflight tags:
    - `Name`
    - `Dataset`
    - `Model`
  - `Start Training`
  - `Config Preview`
  - `Status`

### Important Real Subflows
- User mode
- Developer mode
- Developer password dialog
- Change developer password dialog
- GPU selection dialog
- AI Console panel
- AI Console terminal password dialog
- Initializing state
- Live running state
- Last completed training result shown in `Status` when no run is active
- Failed training state
- Dataset release selection, extraction, and prepared state

## Snapshot States

### 1. `training-terminal-password`
Meaning:
- AI Console terminal password modal is open

Bot should explain:
- terminal access is separately protected

Buttons:
- `Why is terminal access protected?`

### 2. `training-dev-password`
Meaning:
- developer mode password modal is open

Bot should explain:
- developer mode is protected because it exposes advanced controls

Buttons:
- `Why is Developer mode protected?`
- `What changes in Developer mode?`

### 3. `training-dev-change-password`
Meaning:
- change-password modal is open

Bot should explain:
- this changes the developer password for advanced training controls

Buttons:
- `What is this for?`

### 4. `training-gpu-dialog`
Meaning:
- GPU selection dialog is open

Bot should explain:
- switching to GPU opens hardware selection
- choose one detected GPU
- if no compatible GPU is available, training should stay on CPU
- after selection, that GPU becomes the training device for this run

Buttons:
- `How do I choose a GPU?`
- `What if no GPU is available?`

### 5. `training-ai-console`
Meaning:
- AI Console panel is open
- terminal password modal is not currently open

Bot should explain:
- this is a live diagnostics and terminal console for developer workflows
- it is more technical than the normal `Status` view

Buttons:
- `What is AI Console for?`
- `How is this different from Status?`

### 6. `training-initializing`
Meaning:
- training started
- first live metrics are not available yet
- `TrainingInitializing` UI is visible

Bot should explain:
- model, release, and training pipeline are being prepared
- the dashboard will update when the first epoch metrics arrive

Buttons:
- `What is happening now?`

### 7. `training-running`
Meaning:
- active training session is running
- `Status` tab is active
- live dashboard is visible

Bot should explain:
- training is live
- status panel is showing current progress and metrics
- avoid changing important setup fields during the run

Buttons:
- `How do I read the live metrics?`
- `What does Status show?`

### 8. `training-failed`
Meaning:
- training failed
- `Status` tab is active
- failed or error result is visible

Bot should explain:
- training did not complete successfully
- this is an error state, not a valid result

Buttons:
- `What might have caused this?`
- `How do I start a new training?`

### 9. `training-status-last-result`
Meaning:
- no active run
- `Status` tab is active
- last completed training result is visible

Bot should explain:
- this is the last completed training result, not a currently running job
- these metrics are useful for comparing previous runs

Buttons:
- `How do I read these results?`
- `What is Config Preview?`

### 10. `training-developer-empty`
Meaning:
- developer mode
- preflight incomplete

Bot should explain:
- developer mode exposes advanced controls
- but training still depends on the same preflight:
  - `Name`
  - `Dataset`
  - `Model`

Buttons:
- `What changes in Developer mode?`
- `Why can't training start yet?`
- `How should I use advanced settings?`
- `How do I pick a dataset release?`
- `How do I choose a pretrained model?`

### 11. `training-developer-ready`
Meaning:
- developer mode
- preflight complete

Bot should explain:
- advanced controls are available now
- change advanced settings only when you know why you are changing them

Buttons:
- `How should I approach advanced settings?`
- `Start Training`
- `What does Status show?`

### 12. `training-user-empty`
Meaning:
- user mode
- missing one or more of `Name` / `Dataset` / `Model`

Bot should explain:
- this page configures model training
- training cannot start until:
  - training name
  - dataset release
  - pretrained model
  are ready

Buttons:
- `How does this page work?`
- `Why can't training start yet?`
- `What is User mode?`
- `How do I pick a dataset release?`
- `How do I choose a pretrained model?`

### 13. `training-user-ready`
Meaning:
- user mode
- `Name` + `Dataset` + `Model` are ready
- Start Training is available

Bot should explain:
- preflight is complete
- review Config Preview or Status
- training can start safely from user mode

Buttons:
- `What should I check before training?`
- `Start Training`
- `What does Status show?`

## Snapshot Priority Order
Highest wins:
1. `training-terminal-password`
2. `training-dev-password`
3. `training-dev-change-password`
4. `training-gpu-dialog`
5. `training-ai-console`
6. `training-initializing`
7. `training-running`
8. `training-failed`
9. `training-status-last-result`
10. `training-developer-empty`
11. `training-developer-ready`
12. `training-user-empty`
13. `training-user-ready`

## Core Help Branches

### `How does this page work?`
Explain:
- left side sets up the training
- right side is the readiness check, config preview, and status/results area
- training starts only after `Name`, `Dataset`, and `Model` are ready

### `Why can't training start yet?`
Explain:
- training is blocked until the preflight tags are ready:
  - `Name`
  - `Dataset`
  - `Model`

### `What is User mode?`
Explain:
- User mode is the safer, simpler training workflow
- it hides many advanced controls
- it is best for normal project training

### `What changes in Developer mode?`
Explain:
- Developer mode exposes advanced training controls
- it is meant for people who understand why they are changing optimization, augmentation, and validation settings
- it is protected because risky changes can hurt results

### `How should I approach advanced settings?`
Explain:
- change advanced settings only when you know why you are changing them
- adjust one group at a time, not everything at once
- keep defaults unless you have a clear reason to override them
- review `Config Preview` before starting training after advanced changes
- if you do not need deep control, stay in User mode

### `How do I pick a dataset release?`
Explain:
- the Release dropdown shows releases from this same project
- training uses a release package, not incomplete raw data
- after selection, the UI can show that the zip is only selected, still needs extraction, or is already extracted and prepared

### `What happens after I select a release?`
Explain:
- the selected release zip becomes the dataset source for training
- the UI may show:
  - `ZIP selected`
  - `Extracted`
  - or an `Extract` action if preparation is still pending
- training should use the prepared release directory, not an unprepared zip state

### `How do I choose a pretrained model?`
Explain:
- only compatible trainable models are shown
- framework and task affect the list
- trainable selection currently favors `.pt` models

### `What should I check before training?`
Explain:
- training name is clear
- dataset release is correct
- pretrained model matches the task
- presets and core settings look sensible

### `What does Status show?`
Explain:
- if training is running:
  - live progress
  - losses
  - GPU memory
  - validation metrics
- if no run is active:
  - the last completed result may still be shown

### `How do I read the live metrics?`
Explain:
- epoch progress
- batch progress
- losses
- validation metrics
- class-level cards

### `How do I read these results?`
Explain:
- precision
- recall
- mAP50
- mAP50-95
- box vs mask results for segmentation
- per-class metrics

### `What is Config Preview?`
Explain:
- this shows the effective training configuration that will be used
- it is a final check before starting training

### `What is happening now?`
Explain:
- training is initializing
- model setup, release preparation, and first training loop steps are still being prepared

### `What might have caused this?`
Explain common causes:
- dataset not prepared or extracted correctly
- wrong task type vs model type
- GPU memory issue
- incompatible settings

### `How do I start a new training?`
Explain:
- review the failed setup
- correct the blocking issue
- then start training again with a clean configuration

### `Why is Single Class important here?`
Explain:
- if the selected dataset has exactly one class, `Single Class` should usually be enabled
- otherwise the training setup can be unnecessarily inconsistent for a one-class problem

### `How does Smart Auto choose the optimizer?`
Explain:
- smart auto resolves the optimizer from real training conditions like device, batch size, and selected model context
- it is meant to choose a sensible default without the user manually tuning optimizer settings

### `Why is MuSGD recommended for YOLO26?`
Explain:
- when a YOLO26 model is selected, the app recommends MuSGD because that model family is designed to work best with it
- this is a specific model-aware recommendation, not a generic optimizer rule

### `What does Optimization control?`
Explain:
- optimizer choice
- learning rate and momentum behavior
- weight decay and schedule behavior
- these settings directly change how the model learns during training

### `What do Loss Weights do?`
Explain:
- they change how strongly the training prioritizes different objectives like box accuracy, class prediction, and distribution quality
- changing them without understanding the dataset can hurt results

### `What do Augmentation settings change?`
Explain:
- these change how training images are varied during training
- heavier augmentation may improve generalization, but can also make learning slower or less stable

### `What are Task & Segmentation settings for?`
Explain:
- these settings affect task-specific training behavior
- segmentation adds mask-related behavior that does not apply to plain detection
- mismatched task, model, and dataset settings can cause bad results or failed runs

### `What does Validation control?`
Explain:
- validation settings control how predictions are checked during training
- these values affect how strict the reported metrics are and how much feedback the user gets

### `What is AI Console for?`
Explain:
- AI Console is a developer-only diagnostics and terminal view
- it is meant for more technical inspection than the standard training status view

### `How is this different from Status?`
Explain:
- `Status` is the user-facing training/result view
- `AI Console` is the developer-facing technical diagnostics view

### `Why is terminal access protected?`
Explain:
- terminal access is more sensitive than ordinary status viewing
- it is protected to avoid accidental technical misuse

### `How do I choose a GPU?`
Explain:
- select one available GPU if hardware is detected
- the chosen GPU becomes the device for this training run

### `What if no GPU is available?`
Explain:
- training should stay on CPU
- CPU is slower, but still valid

## Parameter Guidance Strategy

### User Mode Guidance
Focus on:
- presets
- device
- epochs
- image size
- batch size
- AMP
- early stop
- resume
- optimizer
- single class when relevant

Style:
- simple
- practical
- safety-first

Examples:
- `Quick`
  - faster testing, lighter training
- `Standard`
  - balanced default
- `High-Accuracy`
  - slower, heavier, more expensive
- `CPU`
  - slower but always available
- `GPU`
  - faster if hardware exists
- `Resume`
  - continue a previous run instead of starting from scratch
- `Single Class`
  - important when the dataset truly has one class

### Developer Mode Guidance
- Do not explain every parameter at once.
- Group guidance by section:
  - `Optimization`
  - `Loss Weights`
  - `Augmentation`
  - `Task & Segmentation`
  - `Validation`

## Expert-Style Deterministic Guidance
Use rule-based help, not runtime LLM.

Examples:
- if dataset has one class and `single_cls` is off:
  - warn clearly
- if GPU selected and batch is high:
  - warn about memory pressure
- if segmentation + large image size:
  - explain heavier cost and slower training
- if resume is on:
  - explain that this continues a previous checkpoint
- if optimizer is smart auto:
  - explain what the system resolved to
- if YOLO26 model selected:
  - explain MuSGD recommendation

## Status Guidance

### Live Status
- epoch progress
- batch progress
- GPU memory
- live losses
- validation metrics
- per-class cards

### Last Completed Result
- result remains visible even when no training is currently running
- use it for comparison and review

### Failed Status
- treat as error guidance, not performance guidance

## Real Action Decisions
- `Start Training` should be a real bot -> UI action
- bot should click the real `Start Training` button in the Training UI
- after firing, the bot should close and reopen through the central sync flow when the Training state changes
- dataset/model selection help should stay explanation-first, not auto-pick values for the user

## Synchronization Risks To Cover In Implementation
- mode switch user <-> developer
- developer password modal open/close
- change-password modal open/close
- GPU dialog open/close
- AI Console panel open/close
- terminal password modal open/close
- training start -> initializing -> running -> completed/failed
- `Status` tab showing last result when no active run
- dataset release selection and extraction/prepared status
- task/framework change invalidating model selection
- `Start Training` bot action -> initializing/running state transition

## Required Detection / Event Work Before Coding
- confirm the exact signal for:
  - last-result status visible
  - failed status visible
  - live running status visible
- running / initializing / last-result states are mode-neutral because the `Status` tab can be visible in both User and Developer mode
- last-result detection must require:
  - `Status` tab active
  - no active run
  - `liveMetrics` still present after reset
- failed detection must require:
  - `Status` tab active
  - failed/error result visible
- dataset guidance must reflect the real selected/extract/extracted subflow
- terminal password state wins only when the terminal password modal itself is open, not just when AI Console exists
- add event plan for:
  - `trainingCompleted`
  - `trainingFailed`
  - optional `trainingStatusChanged`
- explicit reopen mapping:
  - `trainingCompleted` -> bot reopens into `training-status-last-result`
  - `trainingFailed` -> bot reopens into `training-failed`

## Collaboration Split
- I:
  - design the main Training bot state model and synchronization architecture
  - define useful explanation/action branches
  - keep the bot deterministic and product-safe
- Claude:
  - inspect remaining Training subflows for missed states
  - challenge the design for gaps and better expert guidance opportunities
  - help improve the implementation plan before coding
- User:
  - review whether the bot feels like a real AI guide and not a generic form helper
  - approve design before code changes

## Final Review Rule
- Before implementation, Claude should review this exact file again and only point out real remaining gaps.
- If a suggestion is already merged here, it should not be raised again as an unresolved issue.
- Implementation should begin only after both:
  - this file feels clear to the user
  - remaining Claude review is narrow and concrete
