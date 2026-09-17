# GT Coverage Report — Down-AllLights-15-09

**Experiment:** `downLight`  
**Images:** 51  |  **GT cracks:** 130  
**Settings:** confidence 0.4, duplicates removed at 5%  

This measures **how much of each real crack was covered**, not merely whether something was detected. **Length** is the number that matters most: it is the percentage of the crack's centerline that was found, ignoring thickness — so a low length means a real piece of the crack was genuinely missed, while a low **width** with high length means the crack was followed correctly but drawn thinner than it was labelled.

## Summary

Average length coverage: **68.7%**  |  Average width coverage: **66.6%**

| Band | Length coverage | Cracks | Share |
|---|---|---|---|
| **MISSED** | 0% — nothing found | 27 | 21% |
| **BAD** | under 50% | 6 | 5% |
| **WEAK** | 50–80% | 23 | 18% |
| **GOOD** | 80–95% | 24 | 18% |
| **FULL** | 95–100% | 50 | 38% |

## Parts ranked worst → best (by average length coverage)

Ranked per **part**, not per image, because the left/center/right views are the same physical part and must stay together in one split to avoid leakage.

| Rank | Part | GT cracks | Avg length | Avg width | Worst crack | Cracks under 80% |
|---|---|---|---|---|---|---|
| 1 | disk-10-down | 6 | 0.0% | 0.0% | 0.0% | 6 |
| 2 | disk-1-down | 6 | 38.0% | 45.0% | 0.0% | 6 |
| 3 | disk-8-down | 7 | 47.6% | 47.6% | 0.0% | 5 |
| 4 | disk-22-2-down | 6 | 48.2% | 48.2% | 0.0% | 3 |
| 5 | disk-13-1-down | 8 | 61.5% | 54.9% | 0.0% | 3 |
| 6 | disk-3-down | 9 | 68.8% | 67.0% | 0.0% | 5 |
| 7 | disk-22-3-down | 7 | 70.1% | 67.4% | 27.1% | 4 |
| 8 | disk-9-down | 9 | 70.8% | 66.9% | 0.0% | 4 |
| 9 | disk-16-down | 6 | 72.2% | 78.3% | 0.0% | 3 |
| 10 | disk-22-1-down | 8 | 77.7% | 66.3% | 37.6% | 3 |
| 11 | disk-18-down | 8 | 78.1% | 86.5% | 0.0% | 3 |
| 12 | disk-15-down | 8 | 79.4% | 84.6% | 0.0% | 3 |
| 13 | disk-14-down | 7 | 81.9% | 83.1% | 0.0% | 2 |
| 14 | disk-5-down | 14 | 82.2% | 68.6% | 6.7% | 2 |
| 15 | disk-13-3-down | 6 | 82.3% | 77.5% | 38.3% | 2 |
| 16 | disk-6-down | 9 | 84.4% | 81.1% | 0.0% | 1 |
| 17 | disk-13-2-down | 6 | 91.8% | 90.6% | 71.3% | 1 |

## Every GT crack

| Part | View | Image | GT # | Length | Width | Total | Preds | Best conf | Band |
|---|---|---|---|---|---|---|---|---|---|
| disk-1-down | center | disk-1-down-center-AllLights.png | 1 | 75.0% | 90.5% | 67.9% | 1 | 86.9% | WEAK |
| disk-1-down | center | disk-1-down-center-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-1-down | left | disk-1-down-left-AllLights.png | 1 | 78.9% | 86.6% | 68.4% | 1 | 92.8% | WEAK |
| disk-1-down | left | disk-1-down-left-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-1-down | right | disk-1-down-right-AllLights.png | 1 | 74.1% | 93.1% | 69.0% | 1 | 86.6% | WEAK |
| disk-1-down | right | disk-1-down-right-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-10-down | center | disk-10-down-center-AllLights.png | 1 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-10-down | center | disk-10-down-center-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-10-down | left | disk-10-down-left-AllLights.png | 1 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-10-down | left | disk-10-down-left-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-10-down | right | disk-10-down-right-AllLights.png | 1 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-10-down | right | disk-10-down-right-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-13-1-down | center | disk-13-1-down-center-AllLights.png | 1 | 97.4% | 96.5% | 94.0% | 1 | 89.4% | FULL |
| disk-13-1-down | center | disk-13-1-down-center-AllLights.png | 2 | 100.0% | 91.3% | 91.3% | 1 | 87.0% | FULL |
| disk-13-1-down | center | disk-13-1-down-center-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-13-1-down | left | disk-13-1-down-left-AllLights.png | 1 | 100.0% | 97.3% | 97.3% | 1 | 87.4% | FULL |
| disk-13-1-down | left | disk-13-1-down-left-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-13-1-down | right | disk-13-1-down-right-AllLights.png | 1 | 100.0% | 98.1% | 98.1% | 2 | 94.8% | FULL |
| disk-13-1-down | right | disk-13-1-down-right-AllLights.png | 2 | 94.8% | 56.0% | 53.1% | 3 | 94.8% | GOOD |
| disk-13-1-down | right | disk-13-1-down-right-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-13-2-down | center | disk-13-2-down-center-AllLights.png | 1 | 95.4% | 96.7% | 92.2% | 1 | 60.3% | FULL |
| disk-13-2-down | center | disk-13-2-down-center-AllLights.png | 2 | 71.3% | 79.8% | 56.9% | 1 | 43.9% | WEAK |
| disk-13-2-down | left | disk-13-2-down-left-AllLights.png | 1 | 88.3% | 96.2% | 85.0% | 2 | 80.5% | GOOD |
| disk-13-2-down | left | disk-13-2-down-left-AllLights.png | 2 | 100.0% | 98.0% | 98.0% | 1 | 59.8% | FULL |
| disk-13-2-down | right | disk-13-2-down-right-AllLights.png | 1 | 96.1% | 90.3% | 86.8% | 3 | 62.2% | FULL |
| disk-13-2-down | right | disk-13-2-down-right-AllLights.png | 2 | 100.0% | 82.5% | 82.5% | 1 | 58.3% | FULL |
| disk-13-3-down | center | disk-13-3-down-center-AllLights.png | 1 | 82.7% | 57.0% | 47.1% | 2 | 93.1% | GOOD |
| disk-13-3-down | center | disk-13-3-down-center-AllLights.png | 2 | 100.0% | 98.9% | 98.9% | 1 | 89.8% | FULL |
| disk-13-3-down | left | disk-13-3-down-left-AllLights.png | 1 | 72.5% | 60.4% | 43.7% | 2 | 89.9% | WEAK |
| disk-13-3-down | left | disk-13-3-down-left-AllLights.png | 2 | 100.0% | 94.2% | 94.2% | 1 | 83.6% | FULL |
| disk-13-3-down | right | disk-13-3-down-right-AllLights.png | 1 | 100.0% | 98.8% | 98.8% | 1 | 90.0% | FULL |
| disk-13-3-down | right | disk-13-3-down-right-AllLights.png | 2 | 38.3% | 55.7% | 21.3% | 1 | 80.8% | BAD |
| disk-14-down | center | disk-14-down-center-AllLights.png | 1 | 98.4% | 95.8% | 94.2% | 2 | 67.9% | FULL |
| disk-14-down | center | disk-14-down-center-AllLights.png | 2 | 100.0% | 96.8% | 96.8% | 1 | 64.5% | FULL |
| disk-14-down | left | disk-14-down-left-AllLights.png | 1 | 100.0% | 97.9% | 97.9% | 1 | 78.6% | FULL |
| disk-14-down | left | disk-14-down-left-AllLights.png | 2 | 100.0% | 96.3% | 96.3% | 1 | 76.8% | FULL |
| disk-14-down | left | disk-14-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-14-down | right | disk-14-down-right-AllLights.png | 1 | 76.5% | 100.0% | 78.7% | 1 | 64.4% | WEAK |
| disk-14-down | right | disk-14-down-right-AllLights.png | 2 | 98.6% | 95.3% | 94.0% | 1 | 88.5% | FULL |
| disk-15-down | center | disk-15-down-center-AllLights.png | 1 | 91.9% | 97.5% | 89.6% | 2 | 82.7% | GOOD |
| disk-15-down | center | disk-15-down-center-AllLights.png | 2 | 100.0% | 98.8% | 98.8% | 1 | 56.7% | FULL |
| disk-15-down | center | disk-15-down-center-AllLights.png | 3 | 75.5% | 93.5% | 70.6% | 1 | 93.2% | WEAK |
| disk-15-down | left | disk-15-down-left-AllLights.png | 1 | 100.0% | 98.5% | 98.5% | 1 | 86.8% | FULL |
| disk-15-down | left | disk-15-down-left-AllLights.png | 2 | 100.0% | 97.7% | 97.7% | 1 | 82.7% | FULL |
| disk-15-down | left | disk-15-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-15-down | right | disk-15-down-right-AllLights.png | 1 | 75.8% | 96.5% | 73.2% | 1 | 89.9% | WEAK |
| disk-15-down | right | disk-15-down-right-AllLights.png | 2 | 92.3% | 94.2% | 86.9% | 1 | 71.3% | GOOD |
| disk-16-down | center | disk-16-down-center-AllLights.png | 1 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-16-down | center | disk-16-down-center-AllLights.png | 2 | 75.2% | 93.2% | 70.1% | 1 | 59.2% | WEAK |
| disk-16-down | left | disk-16-down-left-AllLights.png | 1 | 100.0% | 98.3% | 98.3% | 1 | 42.7% | FULL |
| disk-16-down | left | disk-16-down-left-AllLights.png | 2 | 62.8% | 83.4% | 52.4% | 1 | 70.7% | WEAK |
| disk-16-down | right | disk-16-down-right-AllLights.png | 1 | 95.2% | 97.2% | 92.5% | 2 | 62.0% | FULL |
| disk-16-down | right | disk-16-down-right-AllLights.png | 2 | 100.0% | 97.4% | 97.4% | 1 | 50.8% | FULL |
| disk-18-down | center | disk-18-down-center-AllLights.png | 1 | 100.0% | 98.3% | 98.3% | 1 | 89.6% | FULL |
| disk-18-down | center | disk-18-down-center-AllLights.png | 2 | 64.1% | 100.0% | 65.4% | 1 | 82.1% | WEAK |
| disk-18-down | left | disk-18-down-left-AllLights.png | 1 | 60.4% | 98.6% | 59.6% | 1 | 92.3% | WEAK |
| disk-18-down | left | disk-18-down-left-AllLights.png | 2 | 100.0% | 98.9% | 98.9% | 1 | 83.4% | FULL |
| disk-18-down | left | disk-18-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-18-down | right | disk-18-down-right-AllLights.png | 1 | 100.0% | 98.5% | 98.5% | 1 | 86.5% | FULL |
| disk-18-down | right | disk-18-down-right-AllLights.png | 2 | 100.0% | 98.4% | 98.4% | 1 | 82.5% | FULL |
| disk-18-down | right | disk-18-down-right-AllLights.png | 3 | 100.0% | 99.6% | 99.6% | 1 | 75.0% | FULL |
| disk-22-1-down | center | disk-22-1-down-center-AllLights.png | 1 | 83.4% | 69.8% | 58.2% | 3 | 88.3% | GOOD |
| disk-22-1-down | center | disk-22-1-down-center-AllLights.png | 2 | 94.6% | 68.0% | 64.3% | 2 | 85.4% | GOOD |
| disk-22-1-down | center | disk-22-1-down-center-AllLights.png | 3 | 64.6% | 59.1% | 38.2% | 2 | 82.3% | WEAK |
| disk-22-1-down | left | disk-22-1-down-left-AllLights.png | 1 | 90.1% | 56.1% | 50.6% | 3 | 93.7% | GOOD |
| disk-22-1-down | left | disk-22-1-down-left-AllLights.png | 2 | 37.6% | 52.9% | 19.9% | 1 | 87.0% | BAD |
| disk-22-1-down | right | disk-22-1-down-right-AllLights.png | 1 | 54.1% | 75.7% | 40.9% | 1 | 95.3% | WEAK |
| disk-22-1-down | right | disk-22-1-down-right-AllLights.png | 2 | 100.0% | 96.5% | 96.5% | 1 | 87.6% | FULL |
| disk-22-1-down | right | disk-22-1-down-right-AllLights.png | 3 | 97.0% | 52.0% | 50.4% | 1 | 78.2% | FULL |
| disk-22-2-down | center | disk-22-2-down-center-AllLights.png | 1 | 100.0% | 97.2% | 97.2% | 1 | 86.0% | FULL |
| disk-22-2-down | center | disk-22-2-down-center-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-2-down | left | disk-22-2-down-left-AllLights.png | 1 | 100.0% | 97.8% | 97.8% | 1 | 86.5% | FULL |
| disk-22-2-down | left | disk-22-2-down-left-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-2-down | right | disk-22-2-down-right-AllLights.png | 1 | 89.3% | 94.3% | 84.3% | 1 | 91.1% | GOOD |
| disk-22-2-down | right | disk-22-2-down-right-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-3-down | center | disk-22-3-down-center-AllLights.png | 1 | 91.8% | 60.2% | 55.2% | 2 | 92.9% | GOOD |
| disk-22-3-down | center | disk-22-3-down-center-AllLights.png | 2 | 87.6% | 44.3% | 38.8% | 1 | 53.9% | GOOD |
| disk-22-3-down | center | disk-22-3-down-center-AllLights.png | 3 | 27.1% | 68.2% | 18.4% | 1 | 44.5% | BAD |
| disk-22-3-down | left | disk-22-3-down-left-AllLights.png | 1 | 69.1% | 53.4% | 36.9% | 3 | 94.3% | WEAK |
| disk-22-3-down | left | disk-22-3-down-left-AllLights.png | 2 | 100.0% | 92.7% | 92.7% | 1 | 69.6% | FULL |
| disk-22-3-down | right | disk-22-3-down-right-AllLights.png | 1 | 42.9% | 57.6% | 24.7% | 1 | 91.7% | BAD |
| disk-22-3-down | right | disk-22-3-down-right-AllLights.png | 2 | 72.0% | 95.4% | 68.7% | 1 | 84.1% | WEAK |
| disk-3-down | center | disk-3-down-center-AllLights.png | 1 | 100.0% | 98.2% | 98.2% | 1 | 85.6% | FULL |
| disk-3-down | center | disk-3-down-center-AllLights.png | 2 | 77.6% | 93.2% | 72.3% | 1 | 79.3% | WEAK |
| disk-3-down | center | disk-3-down-center-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-3-down | left | disk-3-down-left-AllLights.png | 1 | 67.9% | 93.4% | 63.4% | 1 | 89.0% | WEAK |
| disk-3-down | left | disk-3-down-left-AllLights.png | 2 | 100.0% | 96.9% | 96.9% | 1 | 83.6% | FULL |
| disk-3-down | left | disk-3-down-left-AllLights.png | 3 | 94.7% | 66.3% | 62.8% | 2 | 86.3% | GOOD |
| disk-3-down | right | disk-3-down-right-AllLights.png | 1 | 99.7% | 95.9% | 95.6% | 1 | 83.6% | FULL |
| disk-3-down | right | disk-3-down-right-AllLights.png | 2 | 79.1% | 58.7% | 46.4% | 1 | 73.1% | WEAK |
| disk-3-down | right | disk-3-down-right-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-5-down | center | disk-5-down-center-AllLights.png | 1 | 84.2% | 77.7% | 65.5% | 1 | 94.5% | GOOD |
| disk-5-down | center | disk-5-down-center-AllLights.png | 2 | 81.0% | 59.5% | 48.2% | 2 | 73.9% | GOOD |
| disk-5-down | center | disk-5-down-center-AllLights.png | 3 | 87.9% | 57.7% | 50.7% | 1 | 84.4% | GOOD |
| disk-5-down | center | disk-5-down-center-AllLights.png | 4 | 6.7% | 9.4% | 0.6% | 1 | 83.4% | BAD |
| disk-5-down | center | disk-5-down-center-AllLights.png | 5 | 100.0% | 97.9% | 97.9% | 1 | 68.3% | FULL |
| disk-5-down | left | disk-5-down-left-AllLights.png | 1 | 84.5% | 62.4% | 52.7% | 1 | 91.9% | GOOD |
| disk-5-down | left | disk-5-down-left-AllLights.png | 2 | 93.7% | 51.0% | 47.8% | 1 | 90.2% | GOOD |
| disk-5-down | left | disk-5-down-left-AllLights.png | 3 | 85.5% | 57.1% | 48.8% | 2 | 87.0% | GOOD |
| disk-5-down | left | disk-5-down-left-AllLights.png | 4 | 100.0% | 97.6% | 97.6% | 1 | 85.2% | FULL |
| disk-5-down | left | disk-5-down-left-AllLights.png | 5 | 100.0% | 98.0% | 98.0% | 1 | 73.8% | FULL |
| disk-5-down | left | disk-5-down-left-AllLights.png | 6 | 100.0% | 97.9% | 97.9% | 1 | 67.7% | FULL |
| disk-5-down | right | disk-5-down-right-AllLights.png | 1 | 38.6% | 57.6% | 22.2% | 1 | 89.9% | BAD |
| disk-5-down | right | disk-5-down-right-AllLights.png | 2 | 95.7% | 52.6% | 50.3% | 1 | 87.7% | FULL |
| disk-5-down | right | disk-5-down-right-AllLights.png | 3 | 92.9% | 84.0% | 78.1% | 1 | 92.2% | GOOD |
| disk-6-down | center | disk-6-down-center-AllLights.png | 1 | 94.3% | 58.1% | 54.8% | 2 | 93.0% | GOOD |
| disk-6-down | center | disk-6-down-center-AllLights.png | 2 | 92.6% | 95.4% | 88.3% | 1 | 82.6% | GOOD |
| disk-6-down | center | disk-6-down-center-AllLights.png | 3 | 100.0% | 97.3% | 97.3% | 1 | 77.5% | FULL |
| disk-6-down | left | disk-6-down-left-AllLights.png | 1 | 100.0% | 97.0% | 97.0% | 1 | 92.6% | FULL |
| disk-6-down | left | disk-6-down-left-AllLights.png | 2 | 84.9% | 87.7% | 74.4% | 1 | 90.3% | GOOD |
| disk-6-down | left | disk-6-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-6-down | right | disk-6-down-right-AllLights.png | 1 | 100.0% | 98.5% | 98.5% | 1 | 91.4% | FULL |
| disk-6-down | right | disk-6-down-right-AllLights.png | 2 | 100.0% | 99.0% | 99.0% | 1 | 90.8% | FULL |
| disk-6-down | right | disk-6-down-right-AllLights.png | 3 | 87.8% | 97.3% | 85.4% | 1 | 70.2% | GOOD |
| disk-8-down | center | disk-8-down-center-AllLights.png | 1 | 99.3% | 97.3% | 96.7% | 1 | 62.7% | FULL |
| disk-8-down | center | disk-8-down-center-AllLights.png | 2 | 62.7% | 85.0% | 53.3% | 2 | 89.9% | WEAK |
| disk-8-down | left | disk-8-down-left-AllLights.png | 1 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-8-down | left | disk-8-down-left-AllLights.png | 2 | 74.4% | 84.5% | 62.9% | 3 | 92.7% | WEAK |
| disk-8-down | right | disk-8-down-right-AllLights.png | 1 | 96.9% | 66.3% | 64.2% | 1 | 87.4% | FULL |
| disk-8-down | right | disk-8-down-right-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-8-down | right | disk-8-down-right-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-9-down | center | disk-9-down-center-AllLights.png | 1 | 100.0% | 98.7% | 98.7% | 1 | 85.7% | FULL |
| disk-9-down | center | disk-9-down-center-AllLights.png | 2 | 100.0% | 98.4% | 98.4% | 1 | 83.3% | FULL |
| disk-9-down | center | disk-9-down-center-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-9-down | left | disk-9-down-left-AllLights.png | 1 | 100.0% | 98.7% | 98.7% | 1 | 88.2% | FULL |
| disk-9-down | left | disk-9-down-left-AllLights.png | 2 | 92.0% | 63.4% | 58.3% | 1 | 84.3% | GOOD |
| disk-9-down | left | disk-9-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-9-down | right | disk-9-down-right-AllLights.png | 1 | 100.0% | 98.6% | 98.6% | 1 | 89.3% | FULL |
| disk-9-down | right | disk-9-down-right-AllLights.png | 2 | 77.0% | 65.2% | 50.2% | 1 | 78.3% | WEAK |
| disk-9-down | right | disk-9-down-right-AllLights.png | 3 | 68.2% | 79.5% | 54.2% | 1 | 51.9% | WEAK |

## Cracks needing attention (missed or under 50%)

| Part | Image | GT # | Length | Width | Preds |
|---|---|---|---|---|---|
| disk-1-down | disk-1-down-center-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-1-down | disk-1-down-left-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-1-down | disk-1-down-right-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-10-down | disk-10-down-center-AllLights.png | 1 | 0.0% | 0.0% | 0 |
| disk-10-down | disk-10-down-center-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-10-down | disk-10-down-left-AllLights.png | 1 | 0.0% | 0.0% | 0 |
| disk-10-down | disk-10-down-left-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-10-down | disk-10-down-right-AllLights.png | 1 | 0.0% | 0.0% | 0 |
| disk-10-down | disk-10-down-right-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-13-1-down | disk-13-1-down-center-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-13-1-down | disk-13-1-down-left-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-13-1-down | disk-13-1-down-right-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-14-down | disk-14-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-15-down | disk-15-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-16-down | disk-16-down-center-AllLights.png | 1 | 0.0% | 0.0% | 0 |
| disk-18-down | disk-18-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-22-2-down | disk-22-2-down-center-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-22-2-down | disk-22-2-down-left-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-22-2-down | disk-22-2-down-right-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-3-down | disk-3-down-center-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-3-down | disk-3-down-right-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-6-down | disk-6-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-8-down | disk-8-down-left-AllLights.png | 1 | 0.0% | 0.0% | 0 |
| disk-8-down | disk-8-down-right-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-8-down | disk-8-down-right-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-9-down | disk-9-down-center-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-9-down | disk-9-down-left-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-5-down | disk-5-down-center-AllLights.png | 4 | 6.7% | 9.4% | 1 |
| disk-22-3-down | disk-22-3-down-center-AllLights.png | 3 | 27.1% | 68.2% | 1 |
| disk-22-1-down | disk-22-1-down-left-AllLights.png | 2 | 37.6% | 52.9% | 1 |
| disk-13-3-down | disk-13-3-down-right-AllLights.png | 2 | 38.3% | 55.7% | 1 |
| disk-5-down | disk-5-down-right-AllLights.png | 1 | 38.6% | 57.6% | 1 |
| disk-22-3-down | disk-22-3-down-right-AllLights.png | 1 | 42.9% | 57.6% | 1 |
