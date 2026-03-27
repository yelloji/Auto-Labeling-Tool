# Project Commands Reference

All commands for running, building, testing, and packaging the Gevis AI Studio app.

---

## Backend (FastAPI)

### Start the backend server (dev mode)
```bash
cd backend
python main.py
```
- Runs on **http://localhost:12000**
- Serves the API and the built React frontend (from `frontend/build/`)
- Also serves project image files statically from the `projects/` folder
- Auto-reloads Python code changes? **No** — restart required after any `.py` change

---

## Frontend (React)

> All frontend commands run from the `frontend/` folder.

```bash
cd frontend
```

### Start React dev server (local development)
```bash
npm start
```
- Runs on **http://localhost:12001**
- Hot-reloads JSX/JS/CSS changes automatically — no rebuild needed
- Requires backend also running on port 12000 for API calls
- Use this when actively developing frontend code

### Build React for production / exe
```bash
npm run build
```
- Compiles React into `frontend/build/` folder
- **Required before building the exe**
- **Required if you only run the backend** (no React dev server) and made frontend changes
- Output is served automatically by the backend at http://localhost:12000

### Build Windows exe installer
```bash
npm run electron:build
```
- Must run **after** `npm run build` (React must be compiled first)
- Packages the full app (backend Python + React build + Electron) into a Windows installer
- Output goes to `dist-exe/` folder in the project root
- The installer file is the `.exe` you distribute to users

---

## Tests

> All test commands run from the `test-suites/` folder.

```bash
cd test-suites
```

### Run all backend + database tests (no server needed)
```bash
python run_all.py --no-ui
```
- Runs 10 suites: 8 backend API + 2 database
- No running server required — uses an in-memory test database
- Saves a report to `test-results/latest-report.md`

### Run all UI tests (requires backend running)
```bash
python run_all.py --ui-only
```
- Runs 10 UI suites using Playwright (headless Chrome)
- Backend must be running at http://localhost:12000 first
- Tests skip automatically if backend is not reachable

### Run everything (backend + database + UI)
```bash
python run_all.py
```

### Watch UI tests run in a real browser window
```bash
python -m pytest ui/ --headed
```
- Opens a visible Chrome window so you can watch every click
- Backend must be running at http://localhost:12000

### Run a single test suite
```bash
python -m pytest backend/test_projects.py -v
python -m pytest database/test_schema.py -v
python -m pytest ui/test_ui_annotation.py -v
```

---

## Quick Reference

| Task | Folder | Command |
|---|---|---|
| Start backend | `backend/` | `python main.py` |
| Start React dev server | `frontend/` | `npm start` |
| Build React | `frontend/` | `npm run build` |
| Build exe | `frontend/` | `npm run electron:build` |
| All tests (no UI) | `test-suites/` | `python run_all.py --no-ui` |
| All tests (UI only) | `test-suites/` | `python run_all.py --ui-only` |
| All tests | `test-suites/` | `python run_all.py` |
| Watch UI tests | `test-suites/` | `python -m pytest ui/ --headed` |

---

## Notes

- **Dev workflow**: run `backend/python main.py` + `frontend/npm start` together
- **Exe workflow**: `npm run build` → `npm run electron:build` → install from `dist-exe/`
- **After any Python change**: restart backend (no auto-reload)
- **After any JSX/JS change in dev mode**: React dev server auto-reloads, no action needed
- **After any JSX/JS change without dev server**: run `npm run build` then restart backend
- **Test results**: always saved to `test-suites/test-results/latest-report.md`
