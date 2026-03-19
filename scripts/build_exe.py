"""
build_exe.py — Developer build script for Gevis AI Studio Windows exe

Usage:
    python scripts/build_exe.py

Steps:
    1. Builds React frontend (npm run build)
    2. Runs electron-builder to package into Windows installer

Output:
    dist/Gevis-AI-Studio-Setup-1.0.0.exe
"""

import subprocess
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parent.parent
FRONTEND_DIR = ROOT / "frontend"
DIST_DIR = ROOT / "dist"


def run(cmd, cwd=None, shell=False):
    print(f"\n>> {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    result = subprocess.run(cmd, cwd=cwd, shell=shell)
    if result.returncode != 0:
        print(f"\nERROR: Command failed with exit code {result.returncode}")
        sys.exit(result.returncode)


def main():
    print("=" * 50)
    print("Gevis AI Studio — Exe Build")
    print("=" * 50)

    # Step 1: Build React frontend
    print("\n[1/2] Building React frontend...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    run([npm_cmd, "run", "build"], cwd=str(FRONTEND_DIR))
    print("React build complete.")

    # Step 2: Run electron-builder
    print("\n[2/2] Packaging with electron-builder...")
    run([npm_cmd, "run", "electron:build"], cwd=str(FRONTEND_DIR))

    # Done
    exe_files = list(DIST_DIR.glob("*.exe"))
    print("\n" + "=" * 50)
    print("Build complete!")
    if exe_files:
        for f in exe_files:
            print(f"  Output: {f}")
    else:
        print(f"  Output folder: {DIST_DIR}")
    print("=" * 50)


if __name__ == "__main__":
    main()
