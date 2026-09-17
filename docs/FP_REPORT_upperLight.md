# False Positive Report — Upper-AllLight-15-09

**Experiment:** `upperLight`  
**Images:** 60  
**Prediction settings:** confidence 0.4, remove duplicates True at 5%  

A detection counts as a **false positive** only when its pixels overlap **no ground-truth crack at all**. Fragments of a real crack split across SAHI tiles are grouped to their crack first, so they are not counted here.

## Summary

| | Count |
|---|---|
| Ground-truth cracks | 127 |
| Total detections | 123 |
| **False positives** | **10** |
| FP rate | 8.1% of detections |

### False positive confidence spread

| | Confidence |
|---|---|
| Lowest | 40.8% |
| Median | 51.0% |
| Highest | 90.0% |

| Confidence band | False positives |
|---|---|
| 40–50% | 5 |
| 50–60% | 1 |
| 60–70% | 1 |
| 70–80% | 1 |
| 80–90% | 2 |

## False positives by image

Only images that have at least one false positive are listed.

| Part | Image | GT cracks | Detections | FP | FP confidences |
|---|---|---|---|---|---|
| disk-12-1-up | disk-12-1-up-right-AllLights.png | 2 | 2 | 1 | 51.0% |
| disk-17-up | disk-17-up-center-AllLights.png | 2 | 2 | 1 | 45.3% |
| disk-22-1-up | disk-22-1-up-center-AllLights.png | 2 | 2 | 1 | 41.8% |
| disk-22-2-up | disk-22-2-up-right-AllLights.png | 2 | 1 | 1 | 43.9% |
| disk-4-up | disk-4-up-left-AllLights.png | 3 | 4 | 1 | 49.3% |
| disk-5-up | disk-5-up-left-AllLights.png | 2 | 4 | 1 | 40.8% |
| disk-6-up | disk-6-up-right-AllLights.png | 2 | 3 | 1 | 90.0% |
| disk-7-up | disk-7-up-center-AllLights.png | 2 | 3 | 1 | 71.3% |
| disk-8-up | disk-8-up-center-AllLights.png | 2 | 3 | 1 | 68.8% |
| disk-8-up | disk-8-up-right-AllLights.png | 2 | 2 | 1 | 80.6% |

## False positives by part (all 3 views together)

Grouped because the left/center/right views are the same physical part — train/val/test decisions must be made per part, not per image.

| Part | Views | Total FP | FP confidences |
|---|---|---|---|
| disk-8-up | 3 | 2 | 80.6%, 68.8% |
| disk-12-1-up | 3 | 1 | 51.0% |
| disk-17-up | 3 | 1 | 45.3% |
| disk-22-1-up | 3 | 1 | 41.8% |
| disk-22-2-up | 3 | 1 | 43.9% |
| disk-4-up | 3 | 1 | 49.3% |
| disk-5-up | 3 | 1 | 40.8% |
| disk-6-up | 3 | 1 | 90.0% |
| disk-7-up | 3 | 1 | 71.3% |
| disk-1-up | 3 | 0 | — |
| disk-10-up | 3 | 0 | — |
| disk-11-up | 3 | 0 | — |
| disk-12-2-up | 3 | 0 | — |
| disk-14-up | 3 | 0 | — |
| disk-15-up | 3 | 0 | — |
| disk-16-up | 3 | 0 | — |
| disk-19-up | 3 | 0 | — |
| disk-2-up | 3 | 0 | — |
| disk-21-up | 3 | 0 | — |
| disk-9-up | 3 | 0 | — |

**Parts with zero false positives (11):** disk-1-up, disk-10-up, disk-11-up, disk-12-2-up, disk-14-up, disk-15-up, disk-16-up, disk-19-up, disk-2-up, disk-21-up, disk-9-up
