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

### 4. frontend/package.json
**What:** Added electron + electron-builder deps, scripts, and build config
**Why:** Required to install Electron, run it in dev mode, and build the Windows exe
**Added:**
- `devDependencies`: electron ^33.0.0, electron-builder ^25.0.0
- `scripts`: electron:dev (dev window mode), electron:build (build exe)
- `build` block: appId, productName, files to include/exclude, Windows NSIS installer config
**Impact:** Dev workflow unchanged. All existing scripts (start, build, test) untouched.

---

### 5. backend/main.py — React static asset mounts (blank screen fix)
**What:** Added 3 StaticFiles mounts for React build's `/static/js/`, `/static/css/`, `/static/media/` — inserted BEFORE the existing `/static` mount
**Why:** React build references `/static/js/main.xxx.js` and `/static/css/main.xxx.css`. FastAPI's existing `/static` mount points to the empty `backend/static/` folder, so those requests returned 404 → React never loaded → blank white screen in Electron window.
**Root cause:** FastAPI route/mount priority — first matching mount wins. The general `/static` mount was stealing requests meant for the React build assets.
**Added at line 341 (before existing /static mount):**
```python
frontend_static = Path(__file__).parent.parent / "frontend" / "build" / "static"
if frontend_static.exists():
    if (frontend_static / "js").exists():
        app.mount("/static/js",    StaticFiles(directory=...), name="frontend-js")
    if (frontend_static / "css").exists():
        app.mount("/static/css",   StaticFiles(directory=...), name="frontend-css")
    if (frontend_static / "media").exists():
        app.mount("/static/media", StaticFiles(directory=...), name="frontend-media")
```
**Impact:** Dev browser mode (12001) — zero impact, build/ does not exist in dev. Electron/exe — React app now loads correctly.

---

### 6. backend/main.py — Skip logging for static file requests (thumbnail speed fix)
**What:** Added early-return in `LoggingMiddleware.dispatch()` for `/static/`, `/projects/`, `/health` paths
**Why:** In Electron mode every image request (gallery thumbnails) went through LoggingMiddleware — logging + timing added per-request overhead making thumbnails load noticeably slower than in web browser dev mode. Full images in annotation view loaded fast because they bypass this path. API routes still log as before.
**Added at top of dispatch():**
```python
path = request.url.path
if path.startswith(("/static/", "/projects/", "/health")):
    return await call_next(request)
```
**Impact:** Gallery thumbnails load at same speed as web browser mode. All `/api/` logging unchanged.

---

### 7. frontend/public/index.html — Window title
**What:** Changed `<title>` from `Auto-Labeling-Tool` to `Gevis AI Studio`
**Why:** Electron uses the HTML page title for the window title bar. The old title showed "Auto-Labeling-Tool" in the Electron window instead of the product name.
**Impact:** Web browser tab also shows "Gevis AI Studio". No functional change.

---

### 8. frontend/src/components/project-workspace/DatasetSection/DatasetSection.jsx — Remove spinner and lazy loading from gallery
**What:** Removed `loading="lazy"`, removed `display: imageLoaded ? 'block' : 'none'` toggle, removed `<Spin>` placeholder from `DatasetImageCard`
**Why:** Images in the dataset gallery were hidden behind a spinner until `onLoad` fired. This caused visible delay even with small thumbnails. AnnotateProgress never had this pattern — it just shows the `<img>` directly and it streams in. Applied the same approach here.
**Kept:** `onLoad` handler and `imageLoaded` state — still needed so the SVG annotation overlay only renders after image dimensions are captured.
**Impact:** Gallery images appear immediately as they load. No spinner. Consistent with AnnotateProgress behaviour.

---

## Pending Changes (not done yet)

None currently.

---

## Rules
- Every backend or frontend code change for exe must be listed here before or immediately after
- Include: what changed, why, before/after, impact on dev mode
