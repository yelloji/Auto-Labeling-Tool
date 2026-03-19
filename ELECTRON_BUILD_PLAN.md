# Gevis AI Studio — Electron Windows App Build Plan

## App Identity
- Name: Gevis AI Studio
- Version: 1.0.0
- Publisher: Gevis
- Ports: Backend 12000 (FastAPI serves everything)
- Data folder: AppData\Local\Gevis AI Studio\

---

## Three Modes — Same Codebase

| Mode | How to run | Who uses it |
|---|---|---|
| Dev (browser) | `python start.py` | Developer — daily coding, debugging |
| Dev (window) | `npm run electron:dev` | Developer — test Electron feel |
| Exe (client) | Double click installer | Client — production use |

**Nothing in React or FastAPI changes between modes.**

---

## Current Folder Structure (before)

```
root/
  start.py                        ← starts backend + frontend dev server
  backend/
    venv/                         ← Python packages (gitignored)
    main.py                       ← FastAPI app
    requirements.txt              ← CPU requirements
    requirements-cuda121.txt      ← CUDA requirements
  frontend/
    src/                          ← ALL React source code (components, pages, services, hooks)
    build/                        ← compiled UI output (npm run build output, FastAPI serves this)
    package.json                  ← React scripts only
    node_modules/                 ← (gitignored)
  scripts/
    setup_active_learning.py      ← dev tool
    setup_backend_env.py          ← dev tool
  projects/                       ← user images, labels, trained models
  database.db                     ← SQLite database
```

---

## New Folder Structure (after)

```
root/
  start.py                        ← UNCHANGED (dev mode only)
  ELECTRON_BUILD_PLAN.md          ← this doc

  backend/                        ← UNCHANGED — zero code changes
    venv/                         ← UNCHANGED (gitignored, always recreated fresh)
    main.py                       ← UNCHANGED
    requirements.txt              ← UNCHANGED
    requirements-cuda121.txt      ← UNCHANGED

  frontend/                       ← src/ and all React code UNCHANGED
    src/                          ← UNCHANGED — all React components, pages, services, hooks
    build/                        ← UNCHANGED — compiled UI (npm run build output)
    package.json                  ← MODIFIED: add electron deps + build config (no React code touched)
    node_modules/                 ← UNCHANGED (gitignored)
    public/
      electron-icon.png           ← NEW: placeholder app icon (replace with real logo later)

  electron/                       ← NEW FOLDER — all Electron launcher code lives here
    main.js                       ← NEW: Electron entry point (opens window, manages lifecycle)
    preload.js                    ← NEW: secure bridge between Electron and React
    splash.html                   ← NEW: loading screen shown while backend starts
    setup.js                      ← NEW: first-run setup (download Python, pip install)
    backend_runner.js             ← NEW: starts and stops Python backend process
    icon.ico                      ← NEW: Windows app icon (placeholder, replace with real later)

  scripts/
    setup_active_learning.py      ← UNCHANGED
    setup_backend_env.py          ← UNCHANGED
    build_exe.py                  ← NEW: developer runs this to build the exe

  dist/                           ← AUTO-CREATED by electron-builder on build (gitignored)
    Gevis-AI-Studio-Setup-1.0.0.exe  ← final installer output

  projects/                       ← UNCHANGED
  database.db                     ← UNCHANGED
```

---

## What Changes and What Does Not

| File / Folder | Status | Notes |
|---|---|---|
| `backend/` | UNCHANGED | Zero code changes |
| `frontend/src/` | UNCHANGED | All React components untouched |
| `frontend/build/` | UNCHANGED | Rebuilt by npm run build |
| `start.py` | UNCHANGED | Dev mode works exactly as before |
| `frontend/package.json` | MODIFIED | Add electron deps + build config only |
| `electron/` | NEW FOLDER | All Electron launcher code |
| `scripts/build_exe.py` | NEW FILE | Build script for developer |
| `dist/` | AUTO-CREATED | Output folder, gitignored |

---

## What Goes INTO the Exe (included by electron-builder)

```
FROM SOURCE                        INCLUDED?   WHY
backend/                           YES         FastAPI app code
backend/requirements.txt           YES         pip install on client
backend/requirements-cuda121.txt   YES         pip install on client (CUDA)
backend/venv/                      NO          Too big, recreated fresh on client
frontend/build/                    YES         Compiled React UI (all src/ compiled into this)
frontend/src/                      NO          Source only, build/ is enough
frontend/node_modules/             NO          Not needed at runtime
electron/                          YES         Launcher code
```

**Note:** `frontend/src/` is your UI source. `npm run build` compiles it into `frontend/build/`.
The exe includes `frontend/build/` — so ALL your UI is included, just in compiled form.

---

## AppData Structure (on client machine)

```
AppData\Local\Gevis AI Studio\     ← USER DATA — never deleted on reinstall
  python\                          ← embedded Python (downloaded first run, ~30MB)
    python.exe
    Lib\
    Scripts\
      pip.exe
  site-packages\                   ← pip installed packages (torch, ultralytics, etc.)
  database.db                      ← user database (copy here when migrating)
  projects\                        ← user projects, images, trained models
  logs\                            ← app logs
  .setup_complete                  ← flag file: first run setup is done
  .version                         ← installed version number (e.g. 1.0.0)
```

---

## Installed App Structure (on client machine — Program Files)

```
C:\Program Files\Gevis AI Studio\  ← app code — installed by exe, read only
  GevisAIStudio.exe                ← Electron runtime
  resources\
    app\
      backend\                     ← FastAPI code
      frontend\build\              ← compiled React UI
      electron\                    ← main.js, setup.js, etc.
      requirements.txt
      requirements-cuda121.txt
```

---

## Files to CREATE

### 1. electron/main.js
- Entry point for Electron
- Creates native window (no address bar, no browser chrome)
- Shows splash.html immediately while backend starts
- Polls localhost:12000 every 500ms until backend ready
- Switches from splash to full app when ready
- On close: kills backend process cleanly

### 2. electron/splash.html
- Loading screen: Gevis AI Studio name + progress bar + status text
- Shows steps: "Starting backend...", "Loading models...", "Ready"
- Plain HTML/CSS — no React needed

### 3. electron/backend_runner.js
- Finds embedded Python in AppData\Local\Gevis AI Studio\python\
- Runs: python.exe backend\main.py
- Captures stdout/stderr to log file in AppData\logs\
- Handles crash detection

### 4. electron/setup.js
- Runs ONCE on first launch (checks .setup_complete flag file)
- Downloads Python 3.11 embeddable zip from python.org (~30MB)
- Extracts to AppData\Local\Gevis AI Studio\python\
- Auto-detects CUDA — runs pip install requirements-cuda121.txt or requirements.txt
- Creates projects\ and logs\ folders in AppData
- Writes .setup_complete and .version when done
- On all future launches: skipped entirely (instant)

### 5. electron/preload.js
- Secure bridge between Electron and React
- Exposes: app version, platform info

### 6. scripts/build_exe.py
- Developer runs: python scripts/build_exe.py
- Step 1: npm run build (compiles React src/ → build/)
- Step 2: electron-builder (packages into installer)
- Output: dist/Gevis-AI-Studio-Setup-1.0.0.exe (~150MB)

---

## Files to MODIFY

### frontend/package.json
Add:
- `"electron"` and `"electron-builder"` to devDependencies
- `"electron:dev"` script — run Electron in dev mode (points to localhost:12000)
- `"electron:build"` script — build the exe
- `"build"` config block for electron-builder:
  - appId, productName, publisher
  - include: backend/, frontend/build/, electron/, requirements files
  - exclude: backend/venv/, frontend/src/, node_modules/
  - windows: target nsis (installer), icon path, minimum Windows 10

---

## How Exe Build Works (developer)

```
1. npm run build                  → compiles React src/ into frontend/build/
2. python scripts/build_exe.py    → triggers electron-builder
3. electron-builder packages:
   - Electron runtime
   - electron/ (main.js, splash.html, setup.js, backend_runner.js, preload.js)
   - backend/ (all FastAPI code + requirements files, NO venv/)
   - frontend/build/ (compiled UI — all src/ compiled into this)
4. Output: dist/Gevis-AI-Studio-Setup-1.0.0.exe (~150MB)
```

---

## How Exe Works (client — first run)

```
1. Client double clicks Gevis-AI-Studio-Setup-1.0.0.exe
2. NSIS installer: accepts license → installs to Program Files\Gevis AI Studio\
3. Desktop shortcut + Start Menu entry created
4. Client double clicks desktop icon
5. Electron opens → shows splash screen immediately (no blank screen)
6. setup.js checks: AppData\Local\Gevis AI Studio\.setup_complete exists?

   NO (first run):
     a. Splash shows "Downloading Python runtime..."
        → downloads python-3.11-embed-amd64.zip from python.org
     b. Extracts to AppData\Local\Gevis AI Studio\python\
     c. Splash shows "Installing dependencies..."
        → auto-detects CUDA → pip install requirements-cuda121.txt or requirements.txt
     d. Splash shows "Setting up data folders..."
        → creates projects\, logs\ in AppData
     e. Writes .setup_complete and .version=1.0.0
        → total first run time: ~5-10 mins (depends on internet + GPU deps)

   YES (normal run):
     → skip setup entirely, go straight to step 7

7. backend_runner.js starts: AppData\python\python.exe backend\main.py
8. main.js polls localhost:12000 every 500ms
9. Backend ready → splash replaced with full app window
10. User sees Gevis AI Studio — ready to use
    → normal startup time after first run: ~5-10 seconds
```

---

## How Migration Works (client — moving to new machine or version)

```
1. Open AppData\Local\Gevis AI Studio\
2. Copy: database.db + projects\ → safe location
3. Uninstall old version (Start Menu → Add/Remove Programs)
4. Install new Gevis-AI-Studio-Setup-1.0.1.exe
5. Paste database.db + projects\ back into AppData\Local\Gevis AI Studio\
6. Open app — all data restored, zero data loss
```

---

## How Developer Releases New Version

```
1. Make code changes in backend/ or frontend/src/
2. Update version in frontend/package.json (e.g. 1.0.0 → 1.0.1)
3. npm run build
4. python scripts/build_exe.py
5. Send dist/Gevis-AI-Studio-Setup-1.0.1.exe to client
```

---

## Dev Workflow — Unchanged

```
Daily development (browser):
  python start.py              → starts backend (port 12000) + React dev server (port 12001)
  Open browser → localhost:12001

Test Electron feel (window):
  python start.py              → start backend first
  npm run electron:dev         → opens Electron window → localhost:12000
```

---

## Coding Order

| Step | What | File |
|---|---|---|
| 1 | Add electron deps + scripts + build config | frontend/package.json |
| 2 | Create loading splash screen | electron/splash.html |
| 3 | Create backend process runner | electron/backend_runner.js |
| 4 | Create first-run Python setup | electron/setup.js |
| 5 | Create Electron main entry point | electron/main.js |
| 6 | Create secure preload bridge | electron/preload.js |
| 7 | Create developer build script | scripts/build_exe.py |
| 8 | Test dev mode (electron:dev) | — |
| 9 | Test full build → exe | — |

---

## Decisions

- Python version: 3.11 (stable, ultralytics compatible)
- Electron version: latest stable (33.x)
- Installer type: NSIS (standard Windows installer)
- Minimum Windows version: Windows 10
- App name: Gevis AI Studio
- Icon: placeholder for now — replace icon.ico with real logo when ready
