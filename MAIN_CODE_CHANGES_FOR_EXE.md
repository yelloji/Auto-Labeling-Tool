# Main Code Changes for Exe (Electron Build)

This document tracks every change made to existing backend/frontend code files
for the Electron exe. No change should happen without being listed here first.

---

## Changes Made

### 1. frontend/src/config.js
**What:** Removed hardcoded cloud URL, always use localhost:12000
**Why:** Production build was pointing to a dead cloud URL — all API calls would fail in exe
**Before:**
```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://work-1-digwbshcauwokcgm.prod-runtime.all-hands.dev'
  : 'http://localhost:12000';
```
**After:**
```javascript
const API_BASE_URL = 'http://localhost:12000';
```
**Impact:** Dev mode unchanged. Exe works correctly.

---

### 2. backend/main.py
**What:** Added root route + catch-all route to serve React frontend build
**Why:** FastAPI was not serving frontend/build/ at all. Electron needs to load the UI from localhost:12000. Catch-all ensures React Router navigation works (/projects, /datasets etc.)
**Added at end of routes (before shutdown event):**
```python
@app.get("/")
async def root():
    # serves frontend/build/index.html if built, else JSON fallback

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # catch-all: serves index.html for all non-API routes
```
**Impact:** Dev mode unchanged (still use localhost:12001). localhost:12000 now serves full app.

---

### 3. backend/core/config.py
**What:** Detect exe mode via `GEVIS_EXE_MODE=1` env variable — use AppData for db + projects in exe, root folder in dev
**Why:** `Program Files` is read-only on Windows — database.db and projects/ must live in AppData for the exe. Dev environment must stay unchanged.
**How:**
- `GEVIS_EXE_MODE=1` is set ONLY by `electron/backend_runner.js` when starting backend in exe
- Dev mode: env var not set → BASE_DIR = root folder → database.db + projects/ at root (unchanged)
- Exe mode: env var set → BASE_DIR = AppData\Local\Gevis AI Studio\
**Impact:** Dev workflow 100% unchanged. Both `start.py` and manual two-terminal dev unaffected.

---

## Pending Changes (not done yet)

None currently.

---

## Rules
- Every backend or frontend code change for exe must be listed here before or immediately after
- Include: what changed, why, before/after, impact on dev mode
