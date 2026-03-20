#!/usr/bin/env python3
"""
Run all tests and print a clean PASS/FAIL summary.

Run from INSIDE the test-suites folder:
  cd test-suites
  python run_all.py              # run everything (backend + DB + UI)
  python run_all.py --no-ui      # backend + DB only  (no app needed)
  python run_all.py --ui-only    # UI only            (app must be running)

UI tests require:
  - App running at http://localhost:12000
  - playwright + pytest-playwright installed
  - Browsers installed: playwright install chromium
"""

import subprocess
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------

args = sys.argv[1:]
UI_ONLY  = "--ui-only"  in args
NO_UI    = "--no-ui"    in args

# ---------------------------------------------------------------------------
# Test suite definitions
# ---------------------------------------------------------------------------

BACKEND_SUITES = [
    ("Health",          ["pytest", "backend/test_health.py",      "-v"]),
    ("Projects API",    ["pytest", "backend/test_projects.py",    "-v"]),
    ("Datasets API",    ["pytest", "backend/test_datasets.py",    "-v"]),
    ("Images API",      ["pytest", "backend/test_images.py",      "-v"]),
    ("Annotations API", ["pytest", "backend/test_annotations.py", "-v"]),
    ("Labels API",      ["pytest", "backend/test_labels.py",      "-v"]),
    ("Releases API",    ["pytest", "backend/test_releases.py",    "-v"]),
    ("Analytics API",   ["pytest", "backend/test_analytics.py",   "-v"]),
    ("DB Schema",       ["pytest", "database/test_schema.py",     "-v"]),
    ("DB CRUD",         ["pytest", "database/test_crud.py",       "-v"]),
]

UI_SUITES = [
    ("UI Projects",    ["pytest", "ui/test_ui_projects.py",    "-v"]),
    ("UI Upload",      ["pytest", "ui/test_ui_upload.py",      "-v"]),
    ("UI Management",  ["pytest", "ui/test_ui_management.py",  "-v"]),
    ("UI Dataset",     ["pytest", "ui/test_ui_dataset.py",     "-v"]),
    ("UI Release",     ["pytest", "ui/test_ui_release.py",     "-v"]),
    ("UI Analytics",   ["pytest", "ui/test_ui_analytics.py",   "-v"]),
    ("UI Models",      ["pytest", "ui/test_ui_models.py",      "-v"]),
    ("UI Training",    ["pytest", "ui/test_ui_training.py",    "-v"]),
    ("UI Model Lab",   ["pytest", "ui/test_ui_modellab.py",    "-v"]),
    ("UI Annotation",  ["pytest", "ui/test_ui_annotation.py",  "-v"]),
]

if UI_ONLY:
    SUITES = UI_SUITES
elif NO_UI:
    SUITES = BACKEND_SUITES
else:
    SUITES = BACKEND_SUITES + UI_SUITES

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

# Always run from the test-suites/ folder itself (where this file lives)
PROJECT_ROOT = Path(__file__).resolve().parent

results = []
for name, cmd in SUITES:
    t0 = time.time()
    r = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    elapsed = time.time() - t0
    passed  = r.returncode == 0

    # pytest exits with 5 when ALL tests are skipped (no collected tests)
    # — treat that as a skip, not a failure
    skipped = r.returncode == 5 or (
        r.returncode != 0 and "no tests ran" in (r.stdout + r.stderr).lower()
    )

    results.append((name, passed, skipped, elapsed, r.stdout, r.stderr))

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

print()
print("=" * 68)
print("  TEST SUMMARY")
print("=" * 68)

for name, passed, skipped, elapsed, stdout, stderr in results:
    if skipped:
        status = "SKIP"
    elif passed:
        status = "PASS"
    else:
        status = "FAIL"

    print(f"  {status}  {name:<24} ({elapsed:.1f}s)")

    if not passed and not skipped:
        # Show last 25 lines of output so the failure is diagnosable
        combined = (stdout + stderr).strip().split("\n")
        for line in combined[-25:]:
            print(f"       {line}")

print("=" * 68)

n_pass = sum(1 for _, p, s, *_ in results if p and not s)
n_fail = sum(1 for _, p, s, *_ in results if not p and not s)
n_skip = sum(1 for _, p, s, *_ in results if s)

print(f"\n  Total: {len(results)}  |  "
      f"PASS: {n_pass}  |  "
      f"FAIL: {n_fail}  |  "
      f"SKIP: {n_skip}")

if n_fail == 0:
    print("\n  ALL TESTS PASSED" + (" (some skipped)" if n_skip else ""))
else:
    print(f"\n  {n_fail} SUITE(S) FAILED")

print()
sys.exit(0 if n_fail == 0 else 1)
