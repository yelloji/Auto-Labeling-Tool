# App Optimization & Deployment Plan

## Rules
- One task at a time
- Explain before coding
- No UI changes unless asked
- Caching fix does NOT affect Electron exe — safe to do

---

## Phase 1 — Performance (Do Now)

### Task 1 — Browser Caching for Images ✅ READY
- **What:** Tell browser to remember images instead of re-downloading every time
- **Affects:** Web server deployment (big win) / Electron app (no effect, harmless)
- **Risk:** Zero
- **File:** `backend/main.py` — 1 line change

---

### Task 2 — Image Thumbnails
- **What:** When showing image list/grid → load small version (thumbnail)
  Load full image only when user opens it to annotate
- **Why:** Right now loading 500 images = loads 500 full-size images
  After fix = loads 500 small thumbnails (10x less data)
- **Affects:** Both localhost AND Windows app AND web server
- **Files:** Backend (generate thumbnail on upload) + Frontend (use thumbnail URL in grid)

---

### Task 3 — Lazy Loading
- **What:** Only load images that are visible on screen
  If user has 1000 images but only sees 20 → only load those 20
- **Why:** No point loading image 800 when user is looking at image 1
- **Affects:** Both localhost AND Windows app AND web server
- **Files:** Frontend only (small change to image grid component)

---

### Task 4 — Database Query Check
- **What:** Review slow database queries, add indexes if missing
- **Why:** Fast data = fast UI load
- **Affects:** All platforms
- **Files:** `backend/database/models.py` + heavy query routes

---

## Phase 2 — Electron Windows App (When Features Are Ready)

### Task 5 — Electron Setup
- **What:** Wrap React frontend in Electron window
- **Result:** App opens like a normal Windows program, no browser needed

### Task 6 — PyInstaller Backend Bundle
- **What:** Bundle Python + FastAPI + ML models into single exe
- **Result:** User does not need Python installed

### Task 7 — Installer Creation
- **What:** Package everything into one `.exe` installer (using electron-builder)
- **Result:** User double clicks → installs → runs. Done.

### Task 8 — Data Folder Setup
- **What:** Set up user data folder in `AppData\Local\YourApp\`
  - `database.db` → replaceable manually
  - `images\` → replaceable manually
  - `models\` → replaceable manually
- **Result:** Migration = copy paste folder. Anyone can do it.

---

## Phase 3 — Web Server Deployment (Future)

### Task 9 — Switch SQLite to PostgreSQL
- **What:** Replace local database file with proper server database
- **Why:** SQLite is single-user, PostgreSQL handles multiple users

### Task 10 — Nginx for Image Serving
- **What:** Serve images directly via nginx, bypass Python completely
- **Why:** Fastest possible image delivery on web server

### Task 11 — Docker Setup
- **What:** Package entire app in Docker container
- **Why:** Easy to deploy on any server, consistent environment

---

## Current Status
- [x] Task 1 — Caching fix (63da314)
- [x] Task 2 — Thumbnails (40f679f, 37e5fdb)
- [x] Task 3 — Lazy loading (d1ab16c)
- [x] Task 4 — DB query check (f76954f, dc60cfe)
- [ ] Task 5 — Electron setup
- [ ] Task 6 — PyInstaller
- [ ] Task 7 — Installer
- [ ] Task 8 — Data folder
- [ ] Task 9 — PostgreSQL
- [ ] Task 10 — Nginx
- [ ] Task 11 — Docker
