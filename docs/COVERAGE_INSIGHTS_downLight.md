# Coverage Insights — downLight

130 GT cracks · 103 found · 27 missed

## 1. Are the missed cracks simply smaller?

Crack size measured as the bounding diagonal of the GT polygon (px) and its area (px²).

| | Found | Missed |
|---|---|---|
| Cracks | 103 | 27 |
| Median diagonal | 523 px | 406 px |
| Average diagonal | 754 px | 432 px |
| Smallest diagonal | 236 px | 123 px |
| Largest diagonal | 1914 px | 968 px |
| Median area | 17402 px² | 9233 px² |
| Average area | 27217 px² | 11492 px² |

| Crack diagonal | Total | Missed | Miss rate |
|---|---|---|---|
| 100–200 px | 5 | 5 | 100% |
| 200–400 px | 23 | 7 | 30% |
| 400–800 px | 57 | 12 | 21% |
| 800+ px | 45 | 3 | 7% |

## 2. Is a failure the crack, or the view?

For each part, the same crack index is compared across its left/center/right views. If all three behave the same, the cause is the crack itself (its type, or how it was labelled). If they differ a lot, it is a visibility/angle effect.

| Part | Crack | left | center | right | Spread | Reading |
|---|---|---|---|---|---|---|
| disk-1-down | #1 | 78.9% | 75.0% | 74.1% | 5 pts | consistently mid |
| disk-1-down | #2 | 0.0% | 0.0% | 0.0% | 0 pts | consistently bad |
| disk-10-down | #1 | 0.0% | 0.0% | 0.0% | 0 pts | consistently bad |
| disk-10-down | #2 | 0.0% | 0.0% | 0.0% | 0 pts | consistently bad |
| disk-13-1-down | #1 | 100.0% | 97.4% | 100.0% | 3 pts | consistently good |
| disk-13-1-down | #2 | 0.0% | 100.0% | 94.8% | 100 pts | view-dependent |
| disk-13-1-down | #3 | — | 0.0% | 0.0% | 0 pts | consistently bad |
| disk-13-2-down | #1 | 88.3% | 95.4% | 96.1% | 8 pts | consistently good |
| disk-13-2-down | #2 | 100.0% | 71.3% | 100.0% | 29 pts | consistently good |
| disk-13-3-down | #1 | 72.5% | 82.7% | 100.0% | 28 pts | consistently good |
| disk-13-3-down | #2 | 100.0% | 100.0% | 38.3% | 62 pts | view-dependent |
| disk-14-down | #1 | 100.0% | 98.4% | 76.5% | 24 pts | consistently good |
| disk-14-down | #2 | 100.0% | 100.0% | 98.6% | 1 pts | consistently good |
| disk-15-down | #1 | 100.0% | 91.9% | 75.8% | 24 pts | consistently good |
| disk-15-down | #2 | 100.0% | 100.0% | 92.3% | 8 pts | consistently good |
| disk-15-down | #3 | 0.0% | 75.5% | — | 76 pts | view-dependent |
| disk-16-down | #1 | 100.0% | 0.0% | 95.2% | 100 pts | view-dependent |
| disk-16-down | #2 | 62.8% | 75.2% | 100.0% | 37 pts | view-dependent |
| disk-18-down | #1 | 60.4% | 100.0% | 100.0% | 40 pts | view-dependent |
| disk-18-down | #2 | 100.0% | 64.1% | 100.0% | 36 pts | view-dependent |
| disk-18-down | #3 | 0.0% | — | 100.0% | 100 pts | view-dependent |
| disk-22-1-down | #1 | 90.1% | 83.4% | 54.1% | 36 pts | view-dependent |
| disk-22-1-down | #2 | 37.6% | 94.6% | 100.0% | 62 pts | view-dependent |
| disk-22-1-down | #3 | — | 64.6% | 97.0% | 32 pts | consistently good |
| disk-22-2-down | #1 | 100.0% | 100.0% | 89.3% | 11 pts | consistently good |
| disk-22-2-down | #2 | 0.0% | 0.0% | 0.0% | 0 pts | consistently bad |
| disk-22-3-down | #1 | 69.1% | 91.8% | 42.9% | 49 pts | view-dependent |
| disk-22-3-down | #2 | 100.0% | 87.6% | 72.0% | 28 pts | consistently good |
| disk-3-down | #1 | 67.9% | 100.0% | 99.7% | 32 pts | consistently good |
| disk-3-down | #2 | 100.0% | 77.6% | 79.1% | 22 pts | consistently good |
| disk-3-down | #3 | 94.7% | 0.0% | 0.0% | 95 pts | view-dependent |
| disk-5-down | #1 | 84.5% | 84.2% | 38.6% | 46 pts | view-dependent |
| disk-5-down | #2 | 93.7% | 81.0% | 95.7% | 15 pts | consistently good |
| disk-5-down | #3 | 85.5% | 87.9% | 92.9% | 7 pts | consistently good |
| disk-5-down | #4 | 100.0% | 6.7% | — | 93 pts | view-dependent |
| disk-5-down | #5 | 100.0% | 100.0% | — | 0 pts | consistently good |
| disk-6-down | #1 | 100.0% | 94.3% | 100.0% | 6 pts | consistently good |
| disk-6-down | #2 | 84.9% | 92.6% | 100.0% | 15 pts | consistently good |
| disk-6-down | #3 | 0.0% | 100.0% | 87.8% | 100 pts | view-dependent |
| disk-8-down | #1 | 0.0% | 99.3% | 96.9% | 99 pts | view-dependent |
| disk-8-down | #2 | 74.4% | 62.7% | 0.0% | 74 pts | view-dependent |
| disk-9-down | #1 | 100.0% | 100.0% | 100.0% | 0 pts | consistently good |
| disk-9-down | #2 | 92.0% | 100.0% | 77.0% | 23 pts | consistently good |
| disk-9-down | #3 | 0.0% | 0.0% | 68.2% | 68 pts | view-dependent |

**Consistently bad:** 5  ·  **Consistently good:** 20  ·  **View-dependent:** 18

## 3. Does the model know when it is only half-covering a crack?

| Coverage band | Cracks | Avg best confidence |
|---|---|---|
| under 50% | 6 | 79.5% |
| 50–80% | 23 | 81.0% |
| 80–95% | 24 | 85.3% |
| 95–100% | 50 | 78.6% |
