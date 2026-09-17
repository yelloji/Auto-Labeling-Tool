# False Positive Report — Down-AllLights-15-09

**Experiment:** `downLight`  
**Images:** 51  
**Prediction settings:** confidence 0.4, remove duplicates True at 5%  

A detection counts as a **false positive** only when its pixels overlap **no ground-truth crack at all**. Fragments of a real crack split across SAHI tiles are grouped to their crack first, so they are not counted here.

## Summary

| | Count |
|---|---|
| Ground-truth cracks | 130 |
| Total detections | 137 |
| **False positives** | **14** |
| FP rate | 10.2% of detections |

### False positive confidence spread

| | Confidence |
|---|---|
| Lowest | 40.5% |
| Median | 70.6% |
| Highest | 85.9% |

| Confidence band | False positives |
|---|---|
| 40–50% | 3 |
| 50–60% | 4 |
| 70–80% | 5 |
| 80–90% | 2 |

## False positives by image

Only images that have at least one false positive are listed.

| Part | Image | GT cracks | Detections | FP | FP confidences |
|---|---|---|---|---|---|
| disk-1-down | disk-1-down-left-AllLights.png | 2 | 3 | 2 | 70.6%, 53.0% |
| disk-13-2-down | disk-13-2-down-center-AllLights.png | 2 | 3 | 1 | 56.0% |
| disk-13-3-down | disk-13-3-down-center-AllLights.png | 2 | 4 | 1 | 54.3% |
| disk-13-3-down | disk-13-3-down-right-AllLights.png | 2 | 3 | 1 | 76.3% |
| disk-18-down | disk-18-down-center-AllLights.png | 2 | 3 | 1 | 49.8% |
| disk-22-2-down | disk-22-2-down-left-AllLights.png | 2 | 2 | 1 | 58.6% |
| disk-22-3-down | disk-22-3-down-right-AllLights.png | 2 | 3 | 1 | 85.9% |
| disk-3-down | disk-3-down-left-AllLights.png | 3 | 5 | 1 | 79.6% |
| disk-5-down | disk-5-down-left-AllLights.png | 6 | 8 | 1 | 42.3% |
| disk-5-down | disk-5-down-right-AllLights.png | 3 | 5 | 2 | 74.6%, 40.5% |
| disk-8-down | disk-8-down-left-AllLights.png | 2 | 5 | 2 | 85.3%, 74.7% |

## False positives by part (all 3 views together)

Grouped because the left/center/right views are the same physical part — train/val/test decisions must be made per part, not per image.

| Part | Views | Total FP | FP confidences |
|---|---|---|---|
| disk-5-down | 3 | 3 | 74.6%, 42.3%, 40.5% |
| disk-1-down | 3 | 2 | 70.6%, 53.0% |
| disk-13-3-down | 3 | 2 | 76.3%, 54.3% |
| disk-8-down | 3 | 2 | 85.3%, 74.7% |
| disk-13-2-down | 3 | 1 | 56.0% |
| disk-18-down | 3 | 1 | 49.8% |
| disk-22-2-down | 3 | 1 | 58.6% |
| disk-22-3-down | 3 | 1 | 85.9% |
| disk-3-down | 3 | 1 | 79.6% |
| disk-10-down | 3 | 0 | — |
| disk-13-1-down | 3 | 0 | — |
| disk-14-down | 3 | 0 | — |
| disk-15-down | 3 | 0 | — |
| disk-16-down | 3 | 0 | — |
| disk-22-1-down | 3 | 0 | — |
| disk-6-down | 3 | 0 | — |
| disk-9-down | 3 | 0 | — |

**Parts with zero false positives (8):** disk-10-down, disk-13-1-down, disk-14-down, disk-15-down, disk-16-down, disk-22-1-down, disk-6-down, disk-9-down
