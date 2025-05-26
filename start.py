#!/usr/bin/env python3
"""
Auto-Labeling-Tool Launcher
Cross-platform startup script for both backend and frontend
"""

import os
import sys
import time
import signal
import subprocess
import platform
from pathlib import Path

class AutoLabelingToolLauncher:
    def __init__(self):
        self.backend_process = None
        self.frontend_process = None
        self.is_windows = platform.system() == "Windows"
        self.project_root = Path(__file__).parent
        
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
        
        time.sleep(2)
    
    def start_backend(self):
        """Start the backend server"""
        self.print_colored("1. Starting Backend Server...", "blue")
        
        backend_dir = self.project_root / "backend"
        os.chdir(backend_dir)
        
        # Check for virtual environment
        venv_path = backend_dir / "venv"
        if not venv_path.exists():
            self.print_colored("Creating virtual environment...", "yellow")
            subprocess.run([sys.executable, "-m", "venv", "venv"])
        
        # Determine python executable
        if self.is_windows:
            python_exe = venv_path / "Scripts" / "python.exe"
            pip_exe = venv_path / "Scripts" / "pip.exe"
        else:
            python_exe = venv_path / "bin" / "python"
            pip_exe = venv_path / "bin" / "pip"
        
        # Use system python if venv doesn't work
        if not python_exe.exists():
            python_exe = sys.executable
            pip_exe = "pip"
        
        # Install dependencies
        self.print_colored("Installing/updating backend dependencies...", "yellow")
        subprocess.run([str(pip_exe), "install", "-r", "requirements.txt"], 
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Start backend
        self.print_colored("Starting FastAPI backend on port 12000...", "green")
        self.backend_process = subprocess.Popen(
            [str(python_exe), "main.py"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        # Wait for backend to start
        self.print_colored("Waiting for backend to start...", "yellow")
        for i in range(10):
            time.sleep(1)
            if self.check_port(12000):
                self.print_colored("✅ Backend started successfully on port 12000", "green")
                return True
        
        self.print_colored("❌ Backend failed to start", "red")
        return False
    
    def start_frontend(self):
        """Start the frontend server"""
        self.print_colored("2. Starting Frontend Server...", "blue")
        
        frontend_dir = self.project_root / "frontend"
        os.chdir(frontend_dir)
        
        # Install dependencies if needed
        if not (frontend_dir / "node_modules").exists():
            self.print_colored("Installing frontend dependencies...", "yellow")
            subprocess.run(["npm", "install"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Start frontend
        self.print_colored("Starting React frontend on port 12001...", "green")
        
        # Set environment variable for port
        env = os.environ.copy()
        env["PORT"] = "12001"
        
        self.frontend_process = subprocess.Popen(
            ["npm", "start"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env
        )
        
        # Wait for frontend to start
        self.print_colored("Waiting for frontend to start...", "yellow")
        for i in range(30):  # Frontend takes longer
            time.sleep(1)
            if self.check_port(12001):
                self.print_colored("✅ Frontend started successfully on port 12001", "green")
                return True
        
        self.print_colored("❌ Frontend failed to start", "red")
        return False
    
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