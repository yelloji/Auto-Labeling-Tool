# Update Log - 2024-06-29

This document tracks the planned changes, actual modifications, and solutions implemented today. Use it as a reference for future debugging or roll-backs.

---

## 1. Planned Changes
1. **Flip Probability Logic**
   - Force `h_probability` / `v_probability` to `1.0` when UI toggles horizontal or vertical flips without explicit probability.
2. **Flip Combination Generation**
   - When both horizontal and vertical flips are enabled, generate **three** images:
     1. Horizontal-only
     2. Vertical-only
     3. Both (horizontal + vertical)
3. **Priority-3 Combination Logic**
   - Ensure all active transformations (single-value and dual-value) are included equally in the Cartesian product for Priority 3.
4. **Unit / Regression Tests**
   - Add unit test for flip export.
   - Run full transformation regression suite.

## 2. Implementation Notes
- **Files expected to change**
  - `backend/utils/image_transformer.py`  — flip application logic
  - `backend/core/transformation_schema.py`  — combination generator
  - New/updated tests under `tests/`
- **No public APIs are modified**; existing endpoints stay intact.
- **Resize** remains a baseline step and is **not** part of combination counts.

## 2.1 Priority Phases Clarification
- **Priority 1 & 2 (Single-Value Phase)**  
  Each selected transformation is applied with exactly one parameter value, producing **one** unique derivative per original. Example: a 15° rotation or a brightness factor of 1.2.
- **Priority 3 (Max-Combination Phase)**  
  The system enumerates every active transformation's value list and performs a Cartesian product, yielding the **maximum possible** unique combinations. For flips this means the three variants (H, V, H+V) flow into subsequent transforms, multiplying the final count.
- The *max-images-per-original* figure used by the release controller and UI is computed from Priority 3 logic so queues and user estimates are always safe.

## 3. Completed Changes (to be updated)
| Timestamp | File | Description |
|-----------|------|-------------|
| _pending_ | _pending_ | _pending_ |

*(Fill this table as commits are made.)*

## 4. Roll-back Strategy
- Each change is small and isolated.
- Git commits are atomic; revert commit SHA to roll back.
- No database migrations required.

---

**Author:** Auto-labeling Assistant