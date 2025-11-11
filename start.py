#!/usr/bin/env python3
"""
SYA App Launcher with Enhanced Logging
Cross-platform startup script with comprehensive logging
"""

import os
import sys
import time
import signal
import subprocess
import platform
import shutil
import urllib.request
import json
from pathlib import Path

class AutoLabelingToolLauncher:
    def __init__(self):
        self.backend_process = None
        self.frontend_process = None
        self.is_windows = platform.system() == "Windows"
        self.project_root = Path(__file__).parent
        
        # Create logs directory
        self.logs_dir = self.project_root / "logs"
        self.logs_dir.mkdir(exist_ok=True)
        self.print_colored(f"📁 Logs directory: {self.logs_dir}", "blue")
        
    def print_colored(self, text, color="white"):
        """Print colored text (basic cross-platform)"""
        colors = {
            "red": "\033[91m",
            "green": "\033[92m", 
            "yellow": "\033[93m",
            "blue": "\033[94m",
            "white": "\033[0m"
        }
        
        if not self.is_windows:
            print(f"{colors.get(color, '')}{text}\033[0m")
        else:
            print(text)
    
    def check_port(self, port):
        """Check if port is in use"""
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            return result == 0
        except:
            return False
    
    def kill_port(self, port):
        """Kill process on specific port"""
        self.print_colored(f"Killing existing process on port {port}...", "yellow")
        
        if self.is_windows:
            try:
                subprocess.run(f'netstat -ano | findstr :{port}', shell=True, capture_output=True)
                subprocess.run(f'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :{port}\') do taskkill /F /PID %a', shell=True)
            except:
                pass
        else:
            try:
                subprocess.run(f"lsof -ti:{port} | xargs kill -9", shell=True, stderr=subprocess.DEVNULL)
            except:
                pass
        
        # Wait for port to be fully released
        time.sleep(3)
        
        # Verify port is actually free
        for i in range(5):
            if not self.check_port(port):
                break
            time.sleep(1)
    
    def is_nodejs_installed(self):
        """Check if Node.js is installed"""
        try:
            result = subprocess.run(["node", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                version = result.stdout.strip()
                self.print_colored(f"✅ Node.js found: {version}", "green")
                return True
        except FileNotFoundError:
            pass
        return False
    
    def is_git_installed(self):
        """Check if Git is installed"""
        try:
            result = subprocess.run(["git", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                version = result.stdout.strip()
                self.print_colored(f"✅ Git found: {version}", "green")
                return True
        except FileNotFoundError:
            pass
        return False
    
    def install_nodejs_windows(self):
        """Install Node.js on Windows"""
        self.print_colored("🔍 Attempting to install Node.js on Windows...", "yellow")
        
        # Try winget first (Windows 10+)
        try:
            result = subprocess.run(["winget", "install", "OpenJS.NodeJS"], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                self.print_colored("✅ Node.js installed via winget!", "green")
                return True
        except FileNotFoundError:
            pass
        
        # Try chocolatey
        try:
            result = subprocess.run(["choco", "install", "nodejs", "-y"], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                self.print_colored("✅ Node.js installed via chocolatey!", "green")
                return True
        except FileNotFoundError:
            pass
        
        # Fallback to manual instructions
        self.print_colored("❌ Automatic installation failed.", "red")
        self.print_colored("Please install Node.js manually:", "yellow")
        self.print_colored("1. Go to https://nodejs.org/", "white")
        self.print_colored("2. Download and install the LTS version", "white")
        self.print_colored("3. Restart your terminal and run this script again", "white")
        return False
    
    def install_nodejs_macos(self):
        """Install Node.js on macOS"""
        self.print_colored("🔍 Attempting to install Node.js on macOS...", "yellow")
        
        # Try homebrew
        try:
            result = subprocess.run(["brew", "install", "node"], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                self.print_colored("✅ Node.js installed via homebrew!", "green")
                return True
        except FileNotFoundError:
            pass
        
        # Fallback to manual instructions
        self.print_colored("❌ Homebrew not found or installation failed.", "red")
        self.print_colored("Please install Node.js manually:", "yellow")
        self.print_colored("1. Install Homebrew: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"", "white")
        self.print_colored("2. Run: brew install node", "white")
        self.print_colored("3. Or download from https://nodejs.org/", "white")
        return False
    
    def install_nodejs_linux(self):
        """Install Node.js on Linux"""
        self.print_colored("🔍 Attempting to install Node.js on Linux...", "yellow")
        
        # Try different package managers
        package_managers = [
            (["sudo", "apt", "update"], ["sudo", "apt", "install", "-y", "nodejs", "npm"]),  # Ubuntu/Debian
            (["sudo", "yum", "update"], ["sudo", "yum", "install", "-y", "nodejs", "npm"]),  # CentOS/RHEL
            (["sudo", "dnf", "update"], ["sudo", "dnf", "install", "-y", "nodejs", "npm"]),  # Fedora
            (["sudo", "pacman", "-Sy"], ["sudo", "pacman", "-S", "--noconfirm", "nodejs", "npm"]),  # Arch
        ]
        
        for update_cmd, install_cmd in package_managers:
            try:
                # Try update first
                subprocess.run(update_cmd, capture_output=True, text=True, timeout=30)
                # Then install
                result = subprocess.run(install_cmd, capture_output=True, text=True, timeout=120)
                if result.returncode == 0:
                    self.print_colored(f"✅ Node.js installed via {install_cmd[1]}!", "green")
                    return True
            except (FileNotFoundError, subprocess.TimeoutExpired):
                continue
        
        # Try NodeSource repository (universal Linux)
        try:
            self.print_colored("🔍 Trying NodeSource repository...", "yellow")
            # Download and run NodeSource setup script
            subprocess.run(["curl", "-fsSL", "https://deb.nodesource.com/setup_lts.x", "|", "sudo", "-E", "bash", "-"], 
                         shell=True, capture_output=True, text=True, timeout=60)
            result = subprocess.run(["sudo", "apt-get", "install", "-y", "nodejs"], 
                                  capture_output=True, text=True, timeout=120)
            if result.returncode == 0:
                self.print_colored("✅ Node.js installed via NodeSource!", "green")
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        
        # Fallback to manual instructions
        self.print_colored("❌ Automatic installation failed.", "red")
        self.print_colored("Please install Node.js manually:", "yellow")
        self.print_colored("Ubuntu/Debian: sudo apt update && sudo apt install nodejs npm", "white")
        self.print_colored("CentOS/RHEL: sudo yum install nodejs npm", "white")
        self.print_colored("Fedora: sudo dnf install nodejs npm", "white")
        self.print_colored("Or download from https://nodejs.org/", "white")
        return False
    
    def install_git_windows(self):
        """Install Git on Windows"""
        try:
            result = subprocess.run(["winget", "install", "Git.Git"], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                self.print_colored("✅ Git installed via winget!", "green")
                return True
        except FileNotFoundError:
            pass
        
        self.print_colored("Please install Git manually from https://git-scm.com/", "yellow")
        return False
    
    def install_git_unix(self):
        """Install Git on Unix-like systems"""
        system = platform.system().lower()
        
        if system == "darwin":  # macOS
            try:
                result = subprocess.run(["brew", "install", "git"], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    self.print_colored("✅ Git installed via homebrew!", "green")
                    return True
            except FileNotFoundError:
                pass
        else:  # Linux
            package_managers = [
                ["sudo", "apt", "install", "-y", "git"],
                ["sudo", "yum", "install", "-y", "git"],
                ["sudo", "dnf", "install", "-y", "git"],
                ["sudo", "pacman", "-S", "--noconfirm", "git"],
            ]
            
            for cmd in package_managers:
                try:
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                    if result.returncode == 0:
                        self.print_colored(f"✅ Git installed via {cmd[1]}!", "green")
                        return True
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    continue
        
        self.print_colored("Please install Git manually from https://git-scm.com/", "yellow")
        return False
    
    def check_and_install_prerequisites(self):
        """Check and auto-install all prerequisites"""
        self.print_colored("🔍 Checking prerequisites...", "blue")
        
        all_good = True
        
        # Check Node.js
        if not self.is_nodejs_installed():
            self.print_colored("📦 Node.js not found. Installing automatically...", "yellow")
            
            system = platform.system().lower()
            if system == "windows":
                success = self.install_nodejs_windows()
            elif system == "darwin":
                success = self.install_nodejs_macos()
            else:
                success = self.install_nodejs_linux()
            
            if not success:
                all_good = False
            else:
                # Refresh PATH and check again
                if not self.is_nodejs_installed():
                    self.print_colored("⚠️ Node.js installed but not in PATH. Please restart terminal.", "yellow")
                    all_good = False
        
        # Git is useful for development but not required for end-users.
        # We only emit an informational warning and skip installation.
        if not self.is_git_installed():
            self.print_colored("⚠️ Git not detected. This is fine for normal usage.", "yellow")
        
        if not all_good:
            self.print_colored("❌ Some prerequisites failed to install automatically.", "red")
            self.print_colored("Please install them manually and run this script again.", "yellow")
            sys.exit(1)
        
        self.print_colored("✅ All prerequisites are ready!", "green")
    
    def start_backend(self):
        """Start the backend server"""
        self.print_colored("1. Starting Backend Server...", "blue")
        
        backend_dir = self.project_root / "backend"
        os.chdir(backend_dir)
        
        # Check for virtual environment
        venv_path = backend_dir / "venv"
        if not venv_path.exists():
            self.print_colored("Creating virtual environment...", "yellow")
            subprocess.run([sys.executable, "-m", "venv", "venv"])  # create venv
        
        # Determine python executable
        if self.is_windows:
            python_exe = venv_path / "Scripts" / "python.exe"
        else:
            python_exe = venv_path / "bin" / "python"
        
        # Ensure we have a working Python in venv; fallback to system Python only if absolutely necessary
        if not python_exe.exists():
            self.print_colored("⚠️ Venv python not found, falling back to system Python (not recommended)", "yellow")
            python_exe = Path(sys.executable)
        
        # 1) Make sure pip exists inside the venv and is up-to-date
        self.print_colored("Bootstrapping pip in backend venv...", "yellow")
        subprocess.run([str(python_exe), "-m", "ensurepip", "--upgrade"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run([str(python_exe), "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 2) Choose the correct requirements file (prefer CUDA 12.1 if present)
        req_cuda = backend_dir / "requirements-cuda121.txt"
        req_cpu = backend_dir / "requirements.txt"
        if req_cuda.exists():
            req_file = req_cuda
            self.print_colored(f"Installing backend dependencies (CUDA 12.1) from {req_file.name}...", "yellow")
            install_result = subprocess.run([str(python_exe), "-m", "pip", "install", "-r", str(req_file)], capture_output=True, text=True)
            if install_result.returncode != 0:
                # Fallback to CPU requirements if CUDA installation fails
                self.print_colored("⚠️ CUDA requirements installation failed. Falling back to CPU requirements...", "yellow")
                snippet = install_result.stderr[-300:] if install_result.stderr else install_result.stdout[-300:]
                if snippet:
                    self.print_colored(snippet, "yellow")
                req_file = req_cpu
                self.print_colored(f"Installing backend dependencies (CPU) from {req_file.name}...", "yellow")
                install_result = subprocess.run([str(python_exe), "-m", "pip", "install", "-r", str(req_file)], capture_output=True, text=True)
        else:
            req_file = req_cpu
            self.print_colored(f"Installing backend dependencies (CPU) from {req_file.name}...", "yellow")
            install_result = subprocess.run([str(python_exe), "-m", "pip", "install", "-r", str(req_file)], capture_output=True, text=True)

        # Check final install result
        if install_result.returncode != 0:
            self.print_colored("❌ Failed to install backend dependencies", "red")
            snippet = install_result.stderr[-400:] if install_result.stderr else install_result.stdout[-400:]
            if snippet:
                self.print_colored(snippet, "red")
            return False
        self.print_colored("✅ Backend dependencies installed", "green")

        # 4) Verify that FastAPI and Uvicorn are importable in the venv
        verify_code = "import fastapi, uvicorn; print('OK')"
        verify = subprocess.run([str(python_exe), "-c", verify_code], capture_output=True, text=True)
        if verify.returncode != 0:
            self.print_colored("❌ Backend verification failed (FastAPI/Uvicorn not importable)", "red")
            err = verify.stderr or verify.stdout
            if err:
                self.print_colored(err[-400:], "red")
            return False
        else:
            self.print_colored("✅ Verified FastAPI and Uvicorn in backend venv", "green")
        
        
        
        # Start backend and save logs to file for easier debugging
        self.print_colored("Starting FastAPI backend on port 12000...", "green")
        log_file = backend_dir / "backend_start.log"
        env_backend = os.environ.copy()
        if self.is_windows:
            # Ensure UTF-8 encoding so emoji prints don't crash (cp1252 issue)
            env_backend["PYTHONIOENCODING"] = "utf-8"
            env_backend["PYTHONUTF8"] = "1"
        self.backend_process = subprocess.Popen(
            [str(python_exe), "main.py"],
            cwd=str(backend_dir),
            stdout=open(log_file, "w"),
            stderr=subprocess.STDOUT,
            env=env_backend
        )
        
        # Wait for backend to start (give it a bit more time on first run)
        self.print_colored("Waiting for backend to start...", "yellow")
        for i in range(30):  # increased from 10 to 30 seconds
            time.sleep(1)
            if self.check_port(12000):
                self.print_colored("✅ Backend started successfully on port 12000", "green")
                return True
            # Every 10 seconds remind user where to look if it fails
            if (i + 1) % 10 == 0:
                self.print_colored(f"⏳ Still waiting... ({i + 1}/30 seconds)", "yellow")
                if not self.backend_process.poll() is None:
                    self.print_colored("❌ Backend process exited early. Check backend_start.log for details.", "red")
                    return False
        
        self.print_colored("❌ Backend failed to start", "red")
        return False
    
    def start_frontend(self):
        """Start the frontend server"""
        self.print_colored("2. Starting Frontend Server...", "blue")
        
        frontend_dir = self.project_root / "frontend"
        
        # Ensure frontend directory exists
        if not frontend_dir.exists():
            self.print_colored("❌ Frontend directory not found!", "red")
            return False
        
        # Change to frontend directory
        original_dir = os.getcwd()
        try:
            os.chdir(str(frontend_dir))
            
            # Install dependencies if needed
            if not (frontend_dir / "node_modules").exists():
                self.print_colored("Installing frontend dependencies...", "yellow")
                
                # Try to find npm executable
                npm_cmd = self.find_npm_executable()
                if not npm_cmd:
                    self.print_colored("❌ npm not found in PATH", "red")
                    return False
                
                try:
                    result = subprocess.run(
                        [npm_cmd, "install"], 
                        capture_output=True, 
                        text=True,
                        timeout=300,  # 5 minute timeout
                        cwd=str(frontend_dir)
                    )
                    
                    if result.returncode != 0:
                        self.print_colored(f"❌ npm install failed: {result.stderr}", "red")
                        return False
                    
                    self.print_colored("✅ Frontend dependencies installed", "green")
                    
                except subprocess.TimeoutExpired:
                    self.print_colored("❌ npm install timed out", "red")
                    return False
                except Exception as e:
                    self.print_colored(f"❌ npm install error: {str(e)}", "red")
                    return False
            else:
                # Inform user that dependencies are already present
                self.print_colored("✅ Frontend dependencies already installed", "green")
            
            # Start frontend
            self.print_colored("Starting React frontend on port 12001...", "green")
            
            # Set environment variables
            env = os.environ.copy()
            env["PORT"] = "12001"
            env["BROWSER"] = "none"  # Don't auto-open browser
            env["CI"] = "true"  # Prevent interactive prompts
            env["DANGEROUSLY_DISABLE_HOST_CHECK"] = "true"  # Allow external access
            
            # Find npm executable again for start command
            npm_cmd = self.find_npm_executable()
            if not npm_cmd:
                self.print_colored("❌ npm not found for start command", "red")
                return False
            
            # Add faster build environment variable
            env["GENERATE_SOURCEMAP"] = "false"  # Faster builds
            
            # Double-check that port 12001 is free
            if self.check_port(12001):
                self.print_colored("⚠️ Port 12001 still in use, trying to kill again...", "yellow")
                self.kill_port(12001)
                if self.check_port(12001):
                    self.print_colored("❌ Cannot free port 12001", "red")
                    return False
            
            try:
                # Create log file for debugging
                log_file = frontend_dir / "npm_start.log"
                with open(log_file, 'w') as f:
                    self.frontend_process = subprocess.Popen(
                        [npm_cmd, "start"],
                        stdout=f,
                        stderr=subprocess.STDOUT,
                        env=env,
                        cwd=str(frontend_dir)
                    )
                
                # Wait for frontend to start
                self.print_colored("Waiting for frontend to start...", "yellow")
                for i in range(60):  # Frontend takes longer
                    time.sleep(1)
                    if self.check_port(12001):
                        self.print_colored("✅ Frontend started successfully on port 12001", "green")
                        return True
                    
                    # Show progress every 15 seconds and check for errors
                    if (i + 1) % 15 == 0:
                        self.print_colored(f"⏳ Still waiting... ({i + 1}/60 seconds)", "yellow")
                        # Check if process is still running
                        if self.frontend_process.poll() is not None:
                            self.print_colored("❌ Frontend process exited unexpectedly", "red")
                            self.print_colored(f"📄 Check log file: {log_file}", "yellow")
                            return False
                
                self.print_colored("❌ Frontend failed to start within timeout", "red")
                self.print_colored(f"📄 Check log file: {log_file}", "yellow")
                return False
                
            except Exception as e:
                self.print_colored(f"❌ Failed to start frontend: {str(e)}", "red")
                return False
                
        finally:
            # Always return to original directory
            os.chdir(original_dir)
    
    def find_npm_executable(self):
        """Find npm executable with proper Windows handling"""
        if platform.system() == "Windows":
            # On Windows, try different possible locations and full paths
            possible_commands = ["npm.cmd", "npm.exe", "npm"]
            
            # Also try common installation paths
            common_paths = [
                r"C:\Program Files\nodejs\npm.cmd",
                r"C:\Program Files (x86)\nodejs\npm.cmd",
                r"C:\Users\{}\AppData\Roaming\npm\npm.cmd".format(os.environ.get('USERNAME', '')),
                r"C:\nodejs\npm.cmd"
            ]
            possible_commands.extend(common_paths)
        else:
            possible_commands = ["npm"]
        
        for cmd in possible_commands:
            try:
                result = subprocess.run(
                    [cmd, "--version"], 
                    capture_output=True, 
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    return cmd
            except (FileNotFoundError, subprocess.TimeoutExpired):
                continue
        
        # If not found, try to find using 'where' command on Windows
        if platform.system() == "Windows":
            try:
                result = subprocess.run(
                    ["where", "npm"], 
                    capture_output=True, 
                    text=True,
                    timeout=10
                )
                if result.returncode == 0 and result.stdout.strip():
                    npm_path = result.stdout.strip().split('\n')[0]
                    self.print_colored(f"✅ Found npm via 'where': {npm_path}", "green")
                    return npm_path
            except (FileNotFoundError, subprocess.TimeoutExpired):
                pass
        
        self.print_colored("❌ npm not found. Please ensure Node.js is properly installed.", "red")
        self.print_colored("Try running: node --version && npm --version", "yellow")
        self.print_npm_troubleshooting()
        return None
    
    def print_npm_troubleshooting(self):
        """Print npm troubleshooting steps"""
        self.print_colored("\n🔧 NPM Troubleshooting Steps:", "blue")
        if platform.system() == "Windows":
            self.print_colored("1. Restart your command prompt/terminal", "white")
            self.print_colored("2. Try: refreshenv (if using Chocolatey)", "white")
            self.print_colored("3. Check if Node.js is in PATH: echo %PATH%", "white")
            self.print_colored("4. Reinstall Node.js from: https://nodejs.org/", "white")
            self.print_colored("5. Use Node.js installer (not zip file)", "white")
        else:
            self.print_colored("1. Restart your terminal", "white")
            self.print_colored("2. Check if Node.js is in PATH: echo $PATH", "white")
            self.print_colored("3. Try: source ~/.bashrc or source ~/.zshrc", "white")
            self.print_colored("4. Reinstall Node.js using your package manager", "white")
    
    def cleanup(self):
        """Stop both servers"""
        self.print_colored("\nShutting down servers...", "yellow")
        
        if self.backend_process:
            self.backend_process.terminate()
            try:
                self.backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.backend_process.kill()
        
        if self.frontend_process:
            self.frontend_process.terminate()
            try:
                self.frontend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.frontend_process.kill()
        
        self.print_colored("Servers stopped.", "green")
    
    def run(self):
        """Main launcher function"""
        try:
            self.print_colored("🏷️ Starting Auto-Labeling-Tool...", "blue")
            self.print_colored("==================================", "blue")
            
            # Check and install prerequisites automatically
            self.check_and_install_prerequisites()
            
            # Check and kill existing processes
            if self.check_port(12000):
                self.print_colored("Backend port 12000 is in use", "yellow")
                self.kill_port(12000)
            
            if self.check_port(12001):
                self.print_colored("Frontend port 12001 is in use", "yellow")
                self.kill_port(12001)
            
            # Create logs directory
            logs_dir = self.project_root / "logs"
            logs_dir.mkdir(exist_ok=True)
            
            # Start backend
            if not self.start_backend():
                return 1
            
            # Start frontend
            if not self.start_frontend():
                self.cleanup()
                return 1
            
            # Success message
            print()
            self.print_colored("🎉 Auto-Labeling-Tool is now running!", "green")
            self.print_colored("==================================", "green")
            self.print_colored("Backend API:  http://localhost:12000", "blue")
            self.print_colored("Frontend UI:  http://localhost:12001", "blue")
            self.print_colored("API Docs:     http://localhost:12000/docs", "blue")
            print()
            self.print_colored("Press Ctrl+C to stop both servers", "red")
            
            # Keep running until interrupted
            try:
                while True:
                    time.sleep(1)
                    # Check if processes are still running
                    if self.backend_process and self.backend_process.poll() is not None:
                        self.print_colored("Backend process died unexpectedly", "red")
                        break
                    if self.frontend_process and self.frontend_process.poll() is not None:
                        self.print_colored("Frontend process died unexpectedly", "red")
                        break
            except KeyboardInterrupt:
                pass
            
            return 0
            
        except Exception as e:
            self.print_colored(f"Error: {e}", "red")
            return 1
        finally:
            self.cleanup()

def main():
    launcher = AutoLabelingToolLauncher()
    sys.exit(launcher.run())

if __name__ == "__main__":
    main()