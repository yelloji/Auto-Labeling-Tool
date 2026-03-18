What to send the coding agent: “Decision Explanation v2” spec
1) Rename + structure

Rename card title: Decision Explanation

Card has two template sets:

production_explanation

retrain_explanation

Each template outputs 4–6 bullet lines max

Must reuse same labels as graph legend: TP / FP / FN / MODEL CEILING / REJECTED

2) Production explanation (template + rules)
Inputs

selected_t

metrics at selected: TPs, FPs, FNs, Automation

ceiling_t

Also need neighbor metrics at:

t_low = selected_t - CONF_STEP (if exists)

t_high = selected_t + CONF_STEP (if exists)

Compute helper deltas (for “why not 10%”)

ΔTP_down = TP(t_low) - TP(selected_t) (gain if we go lower)

ΔFP_down = FP(t_low) - FP(selected_t)

ΔFN_up = FN(t_high) - FN(selected_t) (penalty if we go higher)

Bullet output (exact order)

Hard rule: below 15% Automation is REJECTED (Silent Model).

MODEL CEILING 🛑 at ~{ceiling_t}%: TP collapses beyond this point.

Production setting: {selected_t}% confidence.

At {selected_t}%: TP={TPs}, FP={FPs}, FN={FNs} → Automation={Automation}%.

Why this value (if neighbors exist):

If ΔFP_down > ΔTP_down:
Why not lower ({t_low}%): FP rises faster than TP (more false alarms than value).

Else:
Why not lower ({t_low}%): only small TP gain with higher FP cost.

Why not higher (if neighbor exists):

Why not higher ({t_high}%): FN increases and Automation drops (more missed defects).

If a neighbor doesn’t exist, skip that bullet.

✅ This will finally answer “why not 10%” in a real engineer way.

3) Retrain explanation (template + rules)
Inputs

ceiling_t, ceiling_drop

target_conf

target_iou (can be null)

metrics at target: TP, FP, FN, Automation

GT_total

Bullet output (exact order)

Hard rule: below 15% Automation is REJECTED (Silent Model).

MODEL CEILING 🛑 at ~{ceiling_t}% (Automation drop {ceiling_drop}%).

TargetConfidence (pre-wall): {target_conf}% (best usable region before collapse).

At {target_conf}%: TP={TP}, FP={FP}, FN={FN} → Automation={Automation}%.

If target_iou != null:
TargetIoU: {target_iou} (box quality goal for next training).
else:
TargetIoU: not available (not enough matched TP IoUs).

Diagnosis line:

If FN/GT_total > 0.50:
Diagnosis: Recall/Coverage limit (many missed defects).

Else:
Diagnosis: Improve confidence strength to push ceiling right.

4) UI text rules (style)

Always show % as integer percent (15%, 30%), not decimals

Use the same emojis/icons as graph:

🛑 for ceiling

⚠️ for rejected/silent

Never use vague phrases:

ban: “Balanced operating point”

ban: “Optimal threshold”

Always use:

“Production setting”

“Why not lower”

“Why not higher”

“MODEL CEILING”

“REJECTED”

5) Backend vs frontend responsibility

Tell your agent to implement this either way:

Option A (recommended): backend returns ready bullet arrays

Backend returns:

"explanation": { "production": [...], "retrain": [...] }