# GT Coverage Report — Upper-AllLight-15-09

**Experiment:** `upperLight`  
**Images:** 60  |  **GT cracks:** 127  
**Settings:** confidence 0.4, duplicates removed at 5%  

This measures **how much of each real crack was covered**, not merely whether something was detected. **Length** is the number that matters most: it is the percentage of the crack's centerline that was found, ignoring thickness — so a low length means a real piece of the crack was genuinely missed, while a low **width** with high length means the crack was followed correctly but drawn thinner than it was labelled.

## Summary

Average length coverage: **73.9%**  |  Average width coverage: **72.1%**

| Band | Length coverage | Cracks | Share |
|---|---|---|---|
| **MISSED** | 0% — nothing found | 22 | 17% |
| **BAD** | under 50% | 6 | 5% |
| **WEAK** | 50–80% | 13 | 10% |
| **GOOD** | 80–95% | 21 | 17% |
| **FULL** | 95–100% | 65 | 51% |

## Parts ranked worst → best (by average length coverage)

Ranked per **part**, not per image, because the left/center/right views are the same physical part and must stay together in one split to avoid leakage.

| Rank | Part | GT cracks | Avg length | Avg width | Worst crack | Cracks under 80% |
|---|---|---|---|---|---|---|
| 1 | disk-22-2-up | 6 | 0.0% | 0.0% | 0.0% | 6 |
| 2 | disk-17-up | 6 | 39.6% | 38.9% | 0.0% | 4 |
| 3 | disk-22-1-up | 6 | 43.6% | 30.5% | 0.0% | 3 |
| 4 | disk-1-up | 3 | 53.1% | 75.8% | 48.2% | 3 |
| 5 | disk-15-up | 8 | 63.5% | 70.7% | 0.0% | 4 |
| 6 | disk-16-up | 8 | 64.2% | 74.6% | 0.0% | 5 |
| 7 | disk-12-1-up | 6 | 65.9% | 65.3% | 0.0% | 2 |
| 8 | disk-12-2-up | 9 | 71.8% | 59.1% | 0.0% | 3 |
| 9 | disk-21-up | 8 | 72.7% | 69.0% | 0.0% | 2 |
| 10 | disk-2-up | 5 | 80.0% | 78.3% | 0.0% | 1 |
| 11 | disk-5-up | 6 | 80.7% | 65.7% | 57.4% | 3 |
| 12 | disk-6-up | 6 | 83.7% | 76.6% | 19.4% | 1 |
| 13 | disk-8-up | 7 | 84.1% | 81.8% | 0.0% | 1 |
| 14 | disk-14-up | 6 | 91.2% | 94.5% | 71.5% | 1 |
| 15 | disk-4-up | 8 | 92.8% | 98.4% | 70.4% | 1 |
| 16 | disk-9-up | 6 | 93.0% | 95.5% | 57.9% | 1 |
| 17 | disk-11-up | 5 | 96.4% | 97.6% | 91.7% | 0 |
| 18 | disk-19-up | 6 | 97.0% | 79.4% | 87.6% | 0 |
| 19 | disk-10-up | 6 | 99.1% | 97.4% | 94.8% | 0 |
| 20 | disk-7-up | 6 | 100.0% | 97.5% | 100.0% | 0 |

## Every GT crack

| Part | View | Image | GT # | Length | Width | Total | Preds | Best conf | Band |
|---|---|---|---|---|---|---|---|---|---|
| disk-1-up | center | disk-1-up-center-AllLights.png | 1 | 54.9% | 68.4% | 37.5% | 1 | 43.4% | WEAK |
| disk-1-up | left | disk-1-up-left-AllLights.png | 1 | 48.2% | 100.0% | 49.3% | 1 | 55.3% | BAD |
| disk-1-up | right | disk-1-up-right-AllLights.png | 1 | 56.2% | 58.9% | 33.1% | 1 | 66.1% | WEAK |
| disk-10-up | center | disk-10-up-center-AllLights.png | 1 | 100.0% | 98.4% | 98.4% | 1 | 77.6% | FULL |
| disk-10-up | center | disk-10-up-center-AllLights.png | 2 | 100.0% | 94.2% | 94.2% | 1 | 62.6% | FULL |
| disk-10-up | left | disk-10-up-left-AllLights.png | 1 | 100.0% | 97.7% | 97.7% | 1 | 86.9% | FULL |
| disk-10-up | left | disk-10-up-left-AllLights.png | 2 | 100.0% | 98.4% | 98.4% | 1 | 70.9% | FULL |
| disk-10-up | right | disk-10-up-right-AllLights.png | 1 | 100.0% | 97.8% | 97.8% | 1 | 87.9% | FULL |
| disk-10-up | right | disk-10-up-right-AllLights.png | 2 | 94.8% | 97.7% | 92.6% | 1 | 64.5% | GOOD |
| disk-11-up | center | disk-11-up-center-AllLights.png | 1 | 98.4% | 96.0% | 94.4% | 2 | 89.2% | FULL |
| disk-11-up | left | disk-11-up-left-AllLights.png | 1 | 91.7% | 98.3% | 90.2% | 1 | 85.6% | GOOD |
| disk-11-up | left | disk-11-up-left-AllLights.png | 2 | 100.0% | 97.3% | 97.3% | 1 | 79.3% | FULL |
| disk-11-up | right | disk-11-up-right-AllLights.png | 1 | 91.8% | 98.4% | 90.4% | 2 | 92.6% | GOOD |
| disk-11-up | right | disk-11-up-right-AllLights.png | 2 | 100.0% | 98.1% | 98.1% | 2 | 92.6% | FULL |
| disk-12-1-up | center | disk-12-1-up-center-AllLights.png | 1 | 100.0% | 97.6% | 97.6% | 1 | 80.3% | FULL |
| disk-12-1-up | center | disk-12-1-up-center-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-12-1-up | left | disk-12-1-up-left-AllLights.png | 1 | 100.0% | 98.2% | 98.2% | 1 | 86.0% | FULL |
| disk-12-1-up | left | disk-12-1-up-left-AllLights.png | 2 | 95.6% | 97.3% | 93.0% | 1 | 40.9% | FULL |
| disk-12-1-up | right | disk-12-1-up-right-AllLights.png | 1 | 100.0% | 98.6% | 98.6% | 1 | 83.8% | FULL |
| disk-12-1-up | right | disk-12-1-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-12-2-up | center | disk-12-2-up-center-AllLights.png | 1 | 98.1% | 59.3% | 58.2% | 1 | 90.4% | FULL |
| disk-12-2-up | center | disk-12-2-up-center-AllLights.png | 2 | 85.9% | 74.3% | 63.9% | 1 | 89.0% | GOOD |
| disk-12-2-up | center | disk-12-2-up-center-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-12-2-up | left | disk-12-2-up-left-AllLights.png | 1 | 98.8% | 62.7% | 62.0% | 1 | 86.3% | FULL |
| disk-12-2-up | left | disk-12-2-up-left-AllLights.png | 2 | 75.6% | 78.9% | 59.6% | 1 | 82.1% | WEAK |
| disk-12-2-up | left | disk-12-2-up-left-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-12-2-up | right | disk-12-2-up-right-AllLights.png | 1 | 95.3% | 66.0% | 62.9% | 1 | 91.1% | FULL |
| disk-12-2-up | right | disk-12-2-up-right-AllLights.png | 2 | 100.0% | 98.7% | 98.7% | 1 | 82.6% | FULL |
| disk-12-2-up | right | disk-12-2-up-right-AllLights.png | 3 | 92.3% | 92.2% | 85.1% | 1 | 67.2% | GOOD |
| disk-14-up | center | disk-14-up-center-AllLights.png | 1 | 95.8% | 96.5% | 92.4% | 1 | 80.5% | FULL |
| disk-14-up | center | disk-14-up-center-AllLights.png | 2 | 88.5% | 97.7% | 86.4% | 1 | 80.5% | GOOD |
| disk-14-up | left | disk-14-up-left-AllLights.png | 1 | 100.0% | 97.7% | 97.7% | 1 | 82.2% | FULL |
| disk-14-up | left | disk-14-up-left-AllLights.png | 2 | 71.5% | 100.0% | 74.2% | 1 | 76.6% | WEAK |
| disk-14-up | right | disk-14-up-right-AllLights.png | 1 | 100.0% | 98.2% | 98.2% | 1 | 83.7% | FULL |
| disk-14-up | right | disk-14-up-right-AllLights.png | 2 | 91.2% | 76.7% | 69.9% | 2 | 56.9% | GOOD |
| disk-15-up | center | disk-15-up-center-AllLights.png | 1 | 100.0% | 97.5% | 97.5% | 1 | 86.0% | FULL |
| disk-15-up | center | disk-15-up-center-AllLights.png | 2 | 66.2% | 92.8% | 61.5% | 1 | 57.2% | WEAK |
| disk-15-up | left | disk-15-up-left-AllLights.png | 1 | 99.8% | 97.5% | 97.3% | 1 | 68.8% | FULL |
| disk-15-up | left | disk-15-up-left-AllLights.png | 2 | 46.2% | 89.9% | 41.5% | 1 | 51.2% | BAD |
| disk-15-up | left | disk-15-up-left-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-15-up | right | disk-15-up-right-AllLights.png | 1 | 100.0% | 98.4% | 98.4% | 1 | 94.4% | FULL |
| disk-15-up | right | disk-15-up-right-AllLights.png | 2 | 96.2% | 89.2% | 85.7% | 1 | 74.3% | FULL |
| disk-15-up | right | disk-15-up-right-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-16-up | center | disk-16-up-center-AllLights.png | 1 | 100.0% | 98.8% | 98.8% | 1 | 76.6% | FULL |
| disk-16-up | center | disk-16-up-center-AllLights.png | 2 | 64.7% | 82.8% | 53.6% | 1 | 53.3% | WEAK |
| disk-16-up | center | disk-16-up-center-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 1 | 76.6% | MISSED |
| disk-16-up | left | disk-16-up-left-AllLights.png | 1 | 100.0% | 98.7% | 98.7% | 1 | 88.2% | FULL |
| disk-16-up | left | disk-16-up-left-AllLights.png | 2 | 79.9% | 91.7% | 73.2% | 1 | 77.3% | WEAK |
| disk-16-up | left | disk-16-up-left-AllLights.png | 3 | 23.2% | 52.5% | 12.2% | 1 | 41.6% | BAD |
| disk-16-up | right | disk-16-up-right-AllLights.png | 1 | 100.0% | 98.2% | 98.2% | 1 | 89.9% | FULL |
| disk-16-up | right | disk-16-up-right-AllLights.png | 2 | 45.9% | 74.1% | 34.1% | 1 | 52.9% | BAD |
| disk-17-up | center | disk-17-up-center-AllLights.png | 1 | 64.1% | 79.0% | 50.6% | 1 | 81.7% | WEAK |
| disk-17-up | center | disk-17-up-center-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-17-up | left | disk-17-up-left-AllLights.png | 1 | 88.4% | 70.8% | 62.5% | 2 | 79.8% | GOOD |
| disk-17-up | left | disk-17-up-left-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-17-up | right | disk-17-up-right-AllLights.png | 1 | 85.4% | 83.4% | 71.2% | 2 | 80.9% | GOOD |
| disk-17-up | right | disk-17-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-19-up | center | disk-19-up-center-AllLights.png | 1 | 87.6% | 97.5% | 85.5% | 1 | 83.5% | GOOD |
| disk-19-up | center | disk-19-up-center-AllLights.png | 2 | 100.0% | 58.1% | 58.1% | 1 | 74.9% | FULL |
| disk-19-up | left | disk-19-up-left-AllLights.png | 1 | 95.0% | 66.1% | 62.8% | 1 | 79.3% | GOOD |
| disk-19-up | left | disk-19-up-left-AllLights.png | 2 | 100.0% | 98.4% | 98.4% | 1 | 75.3% | FULL |
| disk-19-up | right | disk-19-up-right-AllLights.png | 1 | 99.4% | 57.4% | 57.0% | 1 | 83.9% | FULL |
| disk-19-up | right | disk-19-up-right-AllLights.png | 2 | 100.0% | 98.8% | 98.8% | 1 | 72.1% | FULL |
| disk-2-up | center | disk-2-up-center-AllLights.png | 1 | 100.0% | 97.9% | 97.9% | 1 | 68.1% | FULL |
| disk-2-up | left | disk-2-up-left-AllLights.png | 1 | 100.0% | 97.1% | 97.1% | 1 | 65.5% | FULL |
| disk-2-up | left | disk-2-up-left-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-2-up | right | disk-2-up-right-AllLights.png | 1 | 100.0% | 97.8% | 97.8% | 1 | 86.5% | FULL |
| disk-2-up | right | disk-2-up-right-AllLights.png | 2 | 100.0% | 98.7% | 98.7% | 1 | 60.0% | FULL |
| disk-21-up | center | disk-21-up-center-AllLights.png | 1 | 100.0% | 98.1% | 98.1% | 1 | 89.3% | FULL |
| disk-21-up | center | disk-21-up-center-AllLights.png | 2 | 100.0% | 98.0% | 98.0% | 1 | 72.9% | FULL |
| disk-21-up | left | disk-21-up-left-AllLights.png | 1 | 100.0% | 97.9% | 97.9% | 1 | 92.3% | FULL |
| disk-21-up | left | disk-21-up-left-AllLights.png | 2 | 80.4% | 65.5% | 52.7% | 1 | 61.9% | GOOD |
| disk-21-up | left | disk-21-up-left-AllLights.png | 3 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-21-up | right | disk-21-up-right-AllLights.png | 1 | 100.0% | 98.4% | 98.4% | 1 | 87.8% | FULL |
| disk-21-up | right | disk-21-up-right-AllLights.png | 2 | 99.9% | 93.9% | 93.8% | 1 | 85.0% | FULL |
| disk-21-up | right | disk-21-up-right-AllLights.png | 3 | 1.4% | 0.0% | 0.0% | 1 | 85.0% | BAD |
| disk-22-1-up | center | disk-22-1-up-center-AllLights.png | 1 | 85.2% | 62.0% | 52.8% | 1 | 54.7% | GOOD |
| disk-22-1-up | center | disk-22-1-up-center-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-1-up | left | disk-22-1-up-left-AllLights.png | 1 | 85.7% | 56.1% | 48.1% | 1 | 81.4% | GOOD |
| disk-22-1-up | left | disk-22-1-up-left-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-1-up | right | disk-22-1-up-right-AllLights.png | 1 | 90.5% | 65.1% | 58.9% | 1 | 77.4% | GOOD |
| disk-22-1-up | right | disk-22-1-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-2-up | center | disk-22-2-up-center-AllLights.png | 1 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-2-up | center | disk-22-2-up-center-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-2-up | left | disk-22-2-up-left-AllLights.png | 1 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-2-up | left | disk-22-2-up-left-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-2-up | right | disk-22-2-up-right-AllLights.png | 1 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-22-2-up | right | disk-22-2-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-4-up | center | disk-4-up-center-AllLights.png | 1 | 100.0% | 96.2% | 96.2% | 2 | 82.1% | FULL |
| disk-4-up | center | disk-4-up-center-AllLights.png | 2 | 100.0% | 98.8% | 98.8% | 1 | 75.7% | FULL |
| disk-4-up | left | disk-4-up-left-AllLights.png | 1 | 84.3% | 99.2% | 83.6% | 1 | 88.9% | GOOD |
| disk-4-up | left | disk-4-up-left-AllLights.png | 2 | 100.0% | 98.6% | 98.6% | 1 | 83.0% | FULL |
| disk-4-up | left | disk-4-up-left-AllLights.png | 3 | 100.0% | 99.3% | 99.3% | 1 | 72.5% | FULL |
| disk-4-up | right | disk-4-up-right-AllLights.png | 1 | 88.0% | 100.0% | 89.5% | 1 | 90.8% | GOOD |
| disk-4-up | right | disk-4-up-right-AllLights.png | 2 | 70.4% | 97.2% | 68.4% | 1 | 78.2% | WEAK |
| disk-4-up | right | disk-4-up-right-AllLights.png | 3 | 100.0% | 98.2% | 98.2% | 1 | 75.9% | FULL |
| disk-5-up | center | disk-5-up-center-AllLights.png | 1 | 57.4% | 60.6% | 34.8% | 2 | 78.1% | WEAK |
| disk-5-up | center | disk-5-up-center-AllLights.png | 2 | 92.6% | 71.7% | 66.4% | 1 | 69.9% | GOOD |
| disk-5-up | left | disk-5-up-left-AllLights.png | 1 | 64.0% | 50.5% | 32.3% | 2 | 50.6% | WEAK |
| disk-5-up | left | disk-5-up-left-AllLights.png | 2 | 98.2% | 67.2% | 66.0% | 1 | 53.0% | FULL |
| disk-5-up | right | disk-5-up-right-AllLights.png | 1 | 71.8% | 64.8% | 46.5% | 2 | 75.6% | WEAK |
| disk-5-up | right | disk-5-up-right-AllLights.png | 2 | 100.0% | 79.2% | 79.2% | 1 | 82.4% | FULL |
| disk-6-up | center | disk-6-up-center-AllLights.png | 1 | 100.0% | 98.0% | 98.0% | 1 | 89.8% | FULL |
| disk-6-up | center | disk-6-up-center-AllLights.png | 2 | 99.9% | 97.1% | 97.0% | 1 | 70.6% | FULL |
| disk-6-up | left | disk-6-up-left-AllLights.png | 1 | 94.6% | 55.9% | 52.9% | 1 | 91.1% | GOOD |
| disk-6-up | left | disk-6-up-left-AllLights.png | 2 | 88.4% | 64.8% | 57.2% | 1 | 89.0% | GOOD |
| disk-6-up | right | disk-6-up-right-AllLights.png | 1 | 19.4% | 45.2% | 8.8% | 1 | 58.5% | BAD |
| disk-6-up | right | disk-6-up-right-AllLights.png | 2 | 100.0% | 98.7% | 98.7% | 1 | 84.0% | FULL |
| disk-7-up | center | disk-7-up-center-AllLights.png | 1 | 100.0% | 97.9% | 97.9% | 1 | 89.2% | FULL |
| disk-7-up | center | disk-7-up-center-AllLights.png | 2 | 100.0% | 97.6% | 97.6% | 1 | 87.4% | FULL |
| disk-7-up | left | disk-7-up-left-AllLights.png | 1 | 100.0% | 94.8% | 94.8% | 1 | 83.4% | FULL |
| disk-7-up | left | disk-7-up-left-AllLights.png | 2 | 100.0% | 98.3% | 98.3% | 1 | 71.3% | FULL |
| disk-7-up | right | disk-7-up-right-AllLights.png | 1 | 100.0% | 98.1% | 98.1% | 1 | 84.4% | FULL |
| disk-7-up | right | disk-7-up-right-AllLights.png | 2 | 100.0% | 98.2% | 98.2% | 1 | 80.4% | FULL |
| disk-8-up | center | disk-8-up-center-AllLights.png | 1 | 100.0% | 98.4% | 98.4% | 1 | 83.6% | FULL |
| disk-8-up | center | disk-8-up-center-AllLights.png | 2 | 100.0% | 92.1% | 92.1% | 1 | 54.6% | FULL |
| disk-8-up | left | disk-8-up-left-AllLights.png | 1 | 100.0% | 98.3% | 98.3% | 1 | 88.5% | FULL |
| disk-8-up | left | disk-8-up-left-AllLights.png | 2 | 99.2% | 95.8% | 95.0% | 2 | 85.5% | FULL |
| disk-8-up | left | disk-8-up-left-AllLights.png | 3 | 95.0% | 92.6% | 88.0% | 1 | 86.5% | FULL |
| disk-8-up | right | disk-8-up-right-AllLights.png | 1 | 94.4% | 95.4% | 90.1% | 1 | 78.9% | GOOD |
| disk-8-up | right | disk-8-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0.0% | 0 | — | MISSED |
| disk-9-up | center | disk-9-up-center-AllLights.png | 1 | 100.0% | 98.2% | 98.2% | 1 | 75.4% | FULL |
| disk-9-up | center | disk-9-up-center-AllLights.png | 2 | 100.0% | 98.1% | 98.1% | 1 | 72.9% | FULL |
| disk-9-up | left | disk-9-up-left-AllLights.png | 1 | 100.0% | 98.6% | 98.6% | 1 | 85.3% | FULL |
| disk-9-up | left | disk-9-up-left-AllLights.png | 2 | 100.0% | 98.4% | 98.4% | 1 | 64.6% | FULL |
| disk-9-up | right | disk-9-up-right-AllLights.png | 1 | 100.0% | 98.5% | 98.5% | 1 | 81.0% | FULL |
| disk-9-up | right | disk-9-up-right-AllLights.png | 2 | 57.9% | 81.0% | 46.9% | 1 | 70.6% | WEAK |

## Cracks needing attention (missed or under 50%)

| Part | Image | GT # | Length | Width | Preds |
|---|---|---|---|---|---|
| disk-12-1-up | disk-12-1-up-center-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-12-1-up | disk-12-1-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-12-2-up | disk-12-2-up-center-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-12-2-up | disk-12-2-up-left-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-15-up | disk-15-up-left-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-15-up | disk-15-up-right-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-16-up | disk-16-up-center-AllLights.png | 3 | 0.0% | 0.0% | 1 |
| disk-17-up | disk-17-up-center-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-17-up | disk-17-up-left-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-17-up | disk-17-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-2-up | disk-2-up-left-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-21-up | disk-21-up-left-AllLights.png | 3 | 0.0% | 0.0% | 0 |
| disk-22-1-up | disk-22-1-up-center-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-22-1-up | disk-22-1-up-left-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-22-1-up | disk-22-1-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-22-2-up | disk-22-2-up-center-AllLights.png | 1 | 0.0% | 0.0% | 0 |
| disk-22-2-up | disk-22-2-up-center-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-22-2-up | disk-22-2-up-left-AllLights.png | 1 | 0.0% | 0.0% | 0 |
| disk-22-2-up | disk-22-2-up-left-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-22-2-up | disk-22-2-up-right-AllLights.png | 1 | 0.0% | 0.0% | 0 |
| disk-22-2-up | disk-22-2-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-8-up | disk-8-up-right-AllLights.png | 2 | 0.0% | 0.0% | 0 |
| disk-21-up | disk-21-up-right-AllLights.png | 3 | 1.4% | 0.0% | 1 |
| disk-6-up | disk-6-up-right-AllLights.png | 1 | 19.4% | 45.2% | 1 |
| disk-16-up | disk-16-up-left-AllLights.png | 3 | 23.2% | 52.5% | 1 |
| disk-16-up | disk-16-up-right-AllLights.png | 2 | 45.9% | 74.1% | 1 |
| disk-15-up | disk-15-up-left-AllLights.png | 2 | 46.2% | 89.9% | 1 |
| disk-1-up | disk-1-up-left-AllLights.png | 1 | 48.2% | 100.0% | 1 |
