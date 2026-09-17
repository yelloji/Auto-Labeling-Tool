# Train / Val / Test split — by how many views a crack is missing in

37 parts · 111 images · 93 GT cracks

## The rule applied

The decision is made per **crack slot** — the same crack seen in the part's left, center and right views — and then rolled up to the part, because a part can never be split across sets.

| Crack state | Meaning | Goes to |
|---|---|---|
| gone in all 3 views | the model cannot see this crack at all | **TRAIN** |
| gone in 2 of 3 views | mostly blind | **TRAIN** |
| under 50% covered | clipped one end, did not really find it | **TRAIN** |
| gone in 1 view only | visible from other angles, model failed on one | VAL / TEST |
| 50–80% covered | follows the crack but stops short | VAL / TEST |
| nothing missing | clean | VAL / TEST |

A partial is graded, not treated as one thing. A crack covered 20% and a crack covered 70% are different failures: the first was clipped and has nothing honest to measure, the second is the realistic production failure mode and is the most informative thing val and test can contain.

Where you reviewed an image, your Missing / Partial Missing mark decides. Elsewhere the measured coverage stands in (≤25% = gone, <80% = partial), which matched your marks on 82% of the 54 images you reviewed.

## TRAIN — 25 parts, 75 images, 63 cracks

Every part holding a crack the model is blind to or has clipped, plus every eligible part not needed for the val/test budget. Measuring against a blind part would only depress the score without telling you anything, and a part parked in val is a part the model never learns from.

Sides: {'down': 11, 'upper': 14} · average coverage **61.9%**

| Part | Side | Cracks | Blind (3 views) | 2 views | 1 view | Partial | Clean | Avg coverage |
|---|---|---|---|---|---|---|---|---|
| disk-10-down | down | 2 | 2 | 0 | 0 | 0 | 0 | 0.0% |
| disk-22-2-up | upper | 2 | 2 | 0 | 0 | 0 | 0 | 0.0% |
| disk-8-down | down | 3 | 0 | 0 | 3 | 0 | 0 | 37.0% |
| disk-1-down | down | 2 | 1 | 0 | 0 | 1 | 0 | 38.0% |
| disk-17-up | upper | 2 | 1 | 0 | 0 | 1 | 0 | 39.6% |
| disk-22-1-up | upper | 2 | 1 | 0 | 0 | 0 | 1 | 43.6% |
| disk-22-2-down | down | 2 | 1 | 0 | 0 | 0 | 1 | 48.2% |
| disk-1-up | upper | 1 | 0 | 0 | 0 | 1 | 0 | 53.1% |
| disk-13-1-down | down | 3 | 0 | 1 | 1 | 0 | 1 | 54.7% |
| disk-15-up | upper | 3 | 0 | 1 | 0 | 1 | 1 | 56.5% |
| disk-22-3-down | down | 3 | 0 | 0 | 1 | 2 | 0 | 60.5% |
| disk-21-up | upper | 3 | 0 | 0 | 0 | 2 | 1 | 64.7% |
| disk-12-1-up | upper | 2 | 0 | 1 | 0 | 0 | 1 | 65.9% |
| disk-3-down | down | 3 | 0 | 0 | 0 | 3 | 0 | 68.8% |
| disk-9-down | down | 3 | 0 | 1 | 0 | 1 | 1 | 70.8% |
| disk-12-2-up | upper | 3 | 0 | 0 | 0 | 2 | 1 | 71.8% |
| disk-15-down | down | 3 | 0 | 0 | 1 | 1 | 1 | 74.8% |
| disk-2-up | upper | 2 | 0 | 0 | 1 | 0 | 1 | 75.0% |
| disk-22-1-down | down | 3 | 0 | 0 | 2 | 1 | 0 | 78.0% |
| disk-5-down | down | 6 | 0 | 0 | 1 | 1 | 4 | 83.6% |
| disk-6-up | upper | 2 | 0 | 0 | 1 | 0 | 1 | 83.7% |
| disk-14-up | upper | 2 | 0 | 0 | 0 | 1 | 1 | 91.2% |
| disk-9-up | upper | 2 | 0 | 0 | 0 | 1 | 1 | 93.0% |
| disk-11-up | upper | 2 | 0 | 0 | 0 | 0 | 2 | 97.0% |
| disk-10-up | upper | 2 | 0 | 0 | 0 | 0 | 2 | 99.1% |

## VALIDATION — 8 parts, 24 images, 21 cracks

Used to choose the best epoch. Mixed difficulty on purpose.

Sides: {'upper': 4, 'down': 4} · average coverage **82.1%**

| Part | Side | Cracks | Blind (3 views) | 2 views | 1 view | Partial | Clean | Avg coverage |
|---|---|---|---|---|---|---|---|---|
| disk-16-up | upper | 3 | 0 | 0 | 1 | 2 | 0 | 58.4% |
| disk-14-down | down | 3 | 0 | 0 | 1 | 1 | 1 | 63.7% |
| disk-18-down | down | 3 | 0 | 0 | 1 | 2 | 0 | 74.9% |
| disk-6-down | down | 3 | 0 | 0 | 2 | 0 | 1 | 84.4% |
| disk-8-up | upper | 3 | 0 | 0 | 1 | 0 | 2 | 86.5% |
| disk-13-2-down | down | 2 | 0 | 0 | 0 | 1 | 1 | 91.8% |
| disk-19-up | upper | 2 | 0 | 0 | 0 | 0 | 2 | 97.0% |
| disk-7-up | upper | 2 | 0 | 0 | 0 | 0 | 2 | 100.0% |

## TEST — 4 parts, 12 images, 9 cracks

Touched once at the end. Mixed difficulty — this is the number you carry into the deployment decision.

Sides: {'down': 2, 'upper': 2} · average coverage **82.2%**

| Part | Side | Cracks | Blind (3 views) | 2 views | 1 view | Partial | Clean | Avg coverage |
|---|---|---|---|---|---|---|---|---|
| disk-16-down | down | 2 | 0 | 0 | 1 | 1 | 0 | 72.2% |
| disk-5-up | upper | 2 | 0 | 0 | 0 | 1 | 1 | 80.7% |
| disk-13-3-down | down | 2 | 0 | 0 | 1 | 1 | 0 | 82.3% |
| disk-4-up | upper | 3 | 0 | 0 | 0 | 1 | 2 | 93.6% |
