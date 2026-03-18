FINAL SPEC (Send this to coding agent)
0) What to build (deliverables)

Build a Performance Decision Engine with:

Backend computation of a confidence sweep table (0.00→0.95 step 0.05) using IoU matching on validation

Backend outputs for two modes:

Production: chosen confidence

Retrain: model ceiling + target confidence + target IoU

Backend also generates Integral Briefing bullet text for both modes

Frontend renders one storytelling graph (stacked TP/FP/FN bars + silent zone + ceiling marker + chosen marker) + briefing

1) Constants (hard-coded v1)

CONF_STEP = 0.05

CONF_LIST = [0.00, 0.05, 0.10, …, 0.95]

IOU_MATCH_EVAL = 0.30 (evaluation matching only)

MIN_AUTOMATION = 0.15 (absolute, no override)

Score weights:

W_TP = 2

W_FP = 1

W_FN = 10

Score:
score(t) = W_TP*TP(t) - W_FP*FP(t) - W_FN*FN(t)

2) Inputs (backend receives)

Per image:

gt_boxes[image_id] = list of boxes

pred_boxes[image_id] = list of (x1,y1,x2,y2, conf)

IoU function available

3) Core evaluation (build sweep table)

Let GT_total = total number of GT boxes across all images.

For each threshold t in CONF_LIST:

3.1 Filter predictions

For each image:

P = {pred | pred.conf >= t}

3.2 Greedy matching (per image)

Compute IoU matrix between P and GT.

Repeat:

pick pair (pred_i, gt_j) with highest IoU

if IoU < IOU_MATCH_EVAL: stop

else: mark as matched, remove that pred and GT, continue

After matching:

TP_img = #matches

FP_img = #unmatched predictions

FN_img = #unmatched GT

Also collect IoUs of matched pairs:

append each matched IoU into TP_IoUs(t) list

Sum across all images:

TP(t) = Σ TP_img

FP(t) = Σ FP_img

FN(t) = Σ FN_img

3.3 Compute automation + score

automation(t) = TP(t) / GT_total

score(t) = 2*TP(t) - 1*FP(t) - 10*FN(t)

3.4 Store row

Store one row per t:

{
  "t": 0.30,
  "tp": 123,
  "fp": 45,
  "fn": 60,
  "automation": 0.67,
  "score": 0,
  "tp_ious": [0.81, 0.62, ...]
}

4) Silent failure zones (for UI shading)

From rows sorted by confidence:

Find all contiguous ranges where automation < MIN_AUTOMATION
Return:

"silent_zones": [{ "from": 0.55, "to": 0.95 }]


(If multiple ranges, return multiple objects.)

5) Model ceiling (wall)

Using only rows where automation >= MIN_AUTOMATION (valid zone):

Sort by increasing t

For each adjacent pair:
drop_i = automation(t_i) - automation(t_{i+1})

Pick max drop:

model_ceiling.t = t_{i+1}

model_ceiling.drop = max_drop

Return:

"model_ceiling": { "t": 0.45, "drop": 0.18 }


If valid zone has <2 points, ceiling can be null.

6) Mode outputs
6.1 Valid thresholds (absolute rule)

Valid = rows where automation >= MIN_AUTOMATION

If Valid is empty:

status = "no_recommendation"

reason = "silent_model_below_floor"

production.chosen = null

retrain.targets = null

still return rows + silent_zones so UI shows truth
STOP.

6.2 Production mode (Confidence only)

Pick:

production.chosen = argmax score(t) over Valid

Return:

"production": {
  "chosen": { "t": 0.20, "tp":..., "fp":..., "fn":..., "automation":..., "score":... }
}

6.3 Retrain mode (Targets + ceiling)

Require model_ceiling.t exists (else set targets from Valid max score and ceiling null).

Define:

PreWall = { row in Valid | row.t <= model_ceiling.t }
Pick:

TargetConfidence = argmax score(t) over PreWall
Compute TargetIoU:

ious = row(TargetConfidence).tp_ious

if empty → TargetIoU = null

else → TargetIoU = percentile(ious, 75)

Return:

"retrain": {
  "targets": { "confidence": 0.20, "iou": 0.78 }
}

7) Integral Briefing generation (backend outputs bullet arrays)
7.1 Production briefing bullets (in this order)

Always:

Hard Floor: 15% minimum automation (no override).

Selected confidence: {t}.

At {t}: TP={tp}, FP={fp}, FN={fn}, Automation={automation%}.

Then add ONE diagnosis line (first match):

if automation < 0.20 → Running near the minimum utility floor (low automation volume).

else if fn/GT_total > 0.50 → High escape risk: most defects are still missed (FN dominant).

else if fp > tp → High review waste: more junk than useful detections (FP dominant).

else → Balanced operating point: useful automation with controlled review load.

7.2 Retrain briefing bullets (in this order)

Always:

Hard Floor: 15% minimum automation (no override).

MODEL CEILING 🛑 at confidence {ceiling_t} (largest automation drop: {drop%}).

TargetConfidence: {target_conf} (best utility before ceiling).

If TargetIoU not null:
TargetIoU: {target_iou} (75th percentile of TP match IoUs at target confidence).
else:
TargetIoU: not available (not enough matched TPs at target confidence).

Then add ONE diagnosis line (first match):

if ceiling_t < 0.25 → Ceiling occurs early: model becomes silent quickly as confidence increases.

else if target_iou != null and target_iou < 0.60 → Localization quality limit: boxes are not tight enough (low IoU gate).

else if FN(target_conf)/GT_total > 0.50 → Recall limit: missed defects remain dominant (FN).

else → Primary goal: push the ceiling right while keeping FP stable.

Backend returns:

"briefing": { "production": [...], "retrain": [...] }

8) Final backend response schema (single endpoint)
{
  "gt_total": 288,
  "conf_step": 0.05,
  "iou_match_eval": 0.30,
  "min_automation": 0.15,

  "rows": [...],
  "silent_zones": [...],
  "model_ceiling": { "t": 0.45, "drop": 0.18 },

  "production": { "chosen": {...} },
  "retrain": { "targets": { "confidence": 0.20, "iou": 0.78 } },

  "briefing": { "production": [...], "retrain": [...] },

  "status": "ok"
}


If silent:

{
  "status": "no_recommendation",
  "reason": "silent_model_below_floor",
  "rows": [...],
  "silent_zones": [...]
}

9) Frontend graph spec (one graph)

Render using backend payload:

Stacked bars per confidence t: TP (bottom), FP (middle), FN (top) — counts only

Silent zone shading from silent_zones with label “SILENT FAILURE ZONE (Rejected)”

Model ceiling vertical line at model_ceiling.t labeled “MODEL CEILING 🛑”

Chosen line:

Production view: at production.chosen.t

Retrain view: at retrain.targets.confidence

Tooltip shows: t, TP, FP, FN, Automation%, Score

Below chart show bullet list from briefing.production or briefing.retrain