#!/usr/bin/env python3
"""
Run all tests and print a clean PASS/FAIL summary.
Also saves a formatted report to test-results/latest-report.md

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

import os
import subprocess
import sys
import time
from datetime import datetime
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
    mode = "UI only"
elif NO_UI:
    SUITES = BACKEND_SUITES
    mode = "Backend + DB only"
else:
    SUITES = BACKEND_SUITES + UI_SUITES
    mode = "Full (Backend + DB + UI)"

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

# Always run from the test-suites/ folder itself (where this file lives)
PROJECT_ROOT = Path(os.path.abspath(__file__)).parent
# Use os.getcwd()-relative path for writing (avoids pathlib V: drive issues)
RESULTS_STR  = "test-results"
os.makedirs(RESULTS_STR, exist_ok=True)

run_at = datetime.now()

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

    # Extract individual test lines (PASSED / FAILED) from pytest -v output
    test_lines = [
        line.strip()
        for line in (r.stdout + r.stderr).splitlines()
        if " PASSED" in line or " FAILED" in line or " ERROR" in line
    ]

    results.append((name, passed, skipped, elapsed, r.stdout, r.stderr, test_lines))

# ---------------------------------------------------------------------------
# Console summary
# ---------------------------------------------------------------------------

print()
print("=" * 68)
print("  TEST SUMMARY")
print("=" * 68)

for name, passed, skipped, elapsed, stdout, stderr, _ in results:
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

# ---------------------------------------------------------------------------
# Save markdown report
# ---------------------------------------------------------------------------

overall = "ALL PASSED" if n_fail == 0 else f"{n_fail} SUITE(S) FAILED"
report_lines = [
    f"# Test Report",
    f"",
    f"**Date:** {run_at.strftime('%Y-%m-%d %H:%M:%S')}  ",
    f"**Mode:** {mode}  ",
    f"**Result:** {overall}  ",
    f"**Total:** {len(results)}  |  PASS: {n_pass}  |  FAIL: {n_fail}  |  SKIP: {n_skip}",
    f"",
    f"---",
    f"",
    f"## Suite Results",
    f"",
    f"| Status | Suite | Time |",
    f"|--------|-------|------|",
]

for name, passed, skipped, elapsed, _, _, _ in results:
    if skipped:
        icon, status = "SKIP", "SKIP"
    elif passed:
        icon, status = "PASS", "PASS"
    else:
        icon, status = "FAIL", "FAIL"
    report_lines.append(f"| {icon} | {name} | {elapsed:.1f}s |")

report_lines += ["", "---", "", "## Individual Tests", ""]

for name, passed, skipped, elapsed, stdout, stderr, test_lines in results:
    if skipped:
        status = "SKIP"
    elif passed:
        status = "PASS"
    else:
        status = "FAIL"

    report_lines.append(f"### {status} — {name}")
    report_lines.append("")

    if test_lines:
        for line in test_lines:
            # Shorten long pytest paths for readability
            short = line.split("::")[-1] if "::" in line else line
            marker = "PASS" if "PASSED" in line else ("FAIL" if "FAILED" in line else "ERROR")
            report_lines.append(f"- `{marker}` {short}")
    else:
        report_lines.append("- *(no individual test output captured)*")

    if not passed and not skipped:
        report_lines.append("")
        report_lines.append("**Failure details:**")
        report_lines.append("```")
        combined = (stdout + stderr).strip().split("\n")
        for line in combined[-30:]:
            report_lines.append(line)
        report_lines.append("```")

    report_lines.append("")

os.makedirs(RESULTS_STR, exist_ok=True)  # recreate if pytest cleanup removed it
report_path = os.path.join(RESULTS_STR, "latest-report.md")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines))

print(f"  Report saved: {report_path}")
print()

sys.exit(0 if n_fail == 0 else 1)
