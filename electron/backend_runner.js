'use strict';

/**
 * backend_runner.js
 * Starts and stops the Python FastAPI backend process.
 *
 * Dev mode:  python is system Python / venv — started manually, not by this module
 * Exe mode:  python is embedded in AppData\Local\Gevis AI Studio\python\
 *            GEVIS_EXE_MODE=1 is set so config.py uses AppData paths
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// AppData path for Gevis AI Studio
const APP_DATA_DIR = path.join(os.homedir(), 'AppData', 'Local', 'Gevis AI Studio');
const PYTHON_DIR = path.join(APP_DATA_DIR, 'python');
const PYTHON_EXE = path.join(PYTHON_DIR, 'python.exe');
const LOG_DIR = path.join(APP_DATA_DIR, 'logs');
const BACKEND_LOG = path.join(LOG_DIR, 'backend.log');

let backendProcess = null;

/**
 * Start the Python backend.
 * @param {string} backendDir - Absolute path to the backend/ folder inside the app
 */
function startBackend(backendDir) {
  // Ensure log directory exists
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const logStream = fs.createWriteStream(BACKEND_LOG, { flags: 'a' });
  logStream.write(`\n--- Backend started at ${new Date().toISOString()} ---\n`);

  // Environment for backend process:
  // GEVIS_EXE_MODE=1 tells config.py to use AppData paths for db + projects
  const env = Object.assign({}, process.env, {
    GEVIS_EXE_MODE: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1'
  });

  backendProcess = spawn(PYTHON_EXE, ['main.py'], {
    cwd: backendDir,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  backendProcess.stdout.pipe(logStream);
  backendProcess.stderr.pipe(logStream);

  backendProcess.on('error', (err) => {
    logStream.write(`[ERROR] Failed to start backend: ${err.message}\n`);
  });

  backendProcess.on('exit', (code) => {
    logStream.write(`[INFO] Backend exited with code ${code}\n`);
    backendProcess = null;
  });

  return backendProcess;
}

/**
 * Stop the backend process cleanly.
 */
function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

/**
 * Check if embedded Python exists in AppData.
 */
function isPythonReady() {
  return fs.existsSync(PYTHON_EXE);
}

module.exports = { startBackend, stopBackend, isPythonReady, APP_DATA_DIR, PYTHON_DIR };
