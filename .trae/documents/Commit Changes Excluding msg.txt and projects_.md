## Scope

* Commit everything except `msg.txt` and `projects/`

* Also keep `.trae/` uncommitted (workspace metadata)

## Included (from current status)

* All tracked M/D files across backend, frontend, exports, and `database.db`

* New: `backend/models/training/`, `frontend/.../compact.css`

## Commands

* Stage all: `git add -A`

* Unstage exclusions: `git reset msg.txt projects/ .trae/`

* Commit: `git commit -m "Commit all changes except msg.txt and projects/"`

* Verify: `git status -sb`

## Result

* Clean working tree; only `msg.txt`, `projects/`, `.trae/` remain untracked

* No push

