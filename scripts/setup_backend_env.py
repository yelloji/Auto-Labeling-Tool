"""
Automated backend environment setup:
- Creates backend\\venv (if missing)
- Bootstraps pip (ensurepip or get-pip)
- Upgrades pip/setuptools/wheel
- Installs backend requirements (with PyPI extra index and CUDA 12.1 for Torch)
- Verifies FastAPI and Torch/CUDA

Run:
    python scripts\setup_backend_env.py

Then start the app:
    python start.py
"""

import os
import sys
import subprocess
from pathlib import Path


def run(cmd: list[str], cwd: Path | None = None) -> int:
    print("> ", " ".join(f'"{c}"' if " " in str(c) else str(c) for c in cmd))
    return subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True).returncode


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    backend_dir = project_root / "backend"
    venv_dir = backend_dir / "venv"

    is_windows = os.name == "nt"
    venv_python = (
        venv_dir / "Scripts" / "python.exe" if is_windows else venv_dir / "bin" / "python"
    )

    # 1) Create venv if missing
    if not venv_dir.exists():
        print("Creating virtual environment at:", venv_dir)
        run([sys.executable, "-m", "venv", str(venv_dir)])
    else:
        print("Virtual environment already exists:", venv_dir)

    # 2) Ensure pip is available inside the venv
    try:
        print("Bootstrapping pip via ensurepip...")
        run([str(venv_python), "-m", "ensurepip", "--upgrade"])
    except subprocess.CalledProcessError:
        print("ensurepip failed. Attempting to bootstrap pip via get-pip.py...")
        import tempfile
        import urllib.request

        tmp_dir = Path(tempfile.gettempdir())
        get_pip_path = tmp_dir / "get-pip.py"
        urllib.request.urlretrieve(
            "https://bootstrap.pypa.io/get-pip.py", str(get_pip_path)
        )
        run([str(venv_python), str(get_pip_path)])

    # 3) Upgrade pip, setuptools, wheel
    print("Upgrading pip, setuptools, wheel...")
    run([str(venv_python), "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"])

    # 4) Install backend requirements
    # Prefer CUDA 12.1 requirements if present; otherwise fall back to standard requirements
    cuda_req = backend_dir / "requirements-cuda121.txt"
    std_req = backend_dir / "requirements.txt"

    if cuda_req.exists():
        req_file = cuda_req
    elif std_req.exists():
        req_file = std_req
    else:
        print("ERROR: No requirements file found (expected backend/requirements-cuda121.txt or backend/requirements.txt)")
        return 1

    print("Installing backend requirements from:", req_file)
    # requirements-cuda121.txt includes CUDA index and PyPI extra index; std_req is CPU-only
    run([str(venv_python), "-m", "pip", "install", "-r", str(req_file)])

    # 5) Verify FastAPI and Torch/CUDA inside the venv
    print("Verifying FastAPI and Torch/CUDA...")
    verify_code = (
        "import sys,fastapi,torch; "
        "print('Python:', sys.version); "
        "print('FastAPI:', fastapi.__version__); "
        "print('Torch:', torch.__version__); "
        "print('CUDA available:', torch.cuda.is_available()); "
        "print('CUDA ver:', torch.version.cuda)"
    )
    run([str(venv_python), "-c", verify_code])

    print("\nEnvironment setup complete. To start the app:")
    start_py = project_root / "start.py"
    print(f'  "{venv_python}" "{start_py}"')
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as e:
        print("\nERROR: A command failed.")
        print("Command returned with non-zero exit status:", e)
        raise