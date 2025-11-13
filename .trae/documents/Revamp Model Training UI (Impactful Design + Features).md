## Goals
- Make the UI beautiful, exciting, and efficient
- Clear flow with strong visual hierarchy and minimal friction

## Layout & Flow
- Two-column layout: Left = forms; Right = sticky Action & Tabs
- Stepper: Identity → Dataset → Train (active step highlights)
- Sticky Action: Preflight + Start Training; Tabs: Config Preview | Status

## Dataset Experience
- Release summary tile: name, size, splits, class count, last updated
- Card selector with preview thumbnail; collapsible details
- Auto-read data.yaml → classes and split stats; show friendly badges

## Model Selection
- Pretrained model list with task filters, search, and size badges (n/s/m/l/x)
- Compatibility hints per task; clear empty state

## Presets & Device
- Preset chips: Fast, Balanced, Accurate (set epochs/imgsz/batch/AMP)
- Device capsule: CPU/GPU with CUDA status; GPU selector (done) polished
- Developer Advanced panel (collapsed): LR, wd, scheduler, augmentation, resume

## Status & Feedback
- Preflight check → toast (success/warn/error)
- Status tab: progress bar, ETA, last 10 log lines, checkpoint links

## Visual Polish
- Compact spacing, accent color, subtle dividers
- Icons on section titles and actions; micro animations on selection

## Files to Update
- `frontend/src/components/project-workspace/ModelTrainingSection/ModelTrainingSection.jsx`
- `frontend/src/components/project-workspace/ModelTrainingSection/Dataset/DatasetSection.jsx`
- `frontend/src/components/project-workspace/ModelTrainingSection/PretrainedModel/PretrainedModelSelect.jsx`
- `frontend/src/components/project-workspace/ModelTrainingSection/Preset/PresetSection.jsx`
- `frontend/src/components/project-workspace/ModelTrainingSection/compact.css`
- Optional preflight endpoint hookup in `frontend/src/services/api.js`

## Milestones
1) Preset chips + sticky Action/Status tabs
2) Dataset summary tile + card selector
3) Model list enhancements (badges, filters)
4) Advanced panel (Developer) with guardrails

## Acceptance
- Start button enabled only with name/dataset/model
- Dataset shows classes and splits from ZIP
- Preset chips update preview instantly
- GPU selection visible and device reflected in config

Proceed to implement now?