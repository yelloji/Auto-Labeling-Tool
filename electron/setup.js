'use strict';

/**
 * setup.js
 * First-run setup: downloads embedded Python, installs pip dependencies.
 * Runs ONCE — skipped on all subsequent launches via .setup_complete flag.
 *
 * Progress is reported via onProgress(percent, message) callback
 * so main.js can update the splash screen.
 *
 * All steps are logged to AppData\Local\Gevis AI Studio\logs\setup.log
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Python 3.11 embeddable package for Windows x64
const PYTHON_VERSION = '3.11.9';
const PYTHON_ZIP_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;

// pip bootstrap
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

const { APP_DATA_DIR, PYTHON_DIR } = require('./backend_runner');

const SETUP_FLAG = path.join(APP_DATA_DIR, '.setup_complete');
const VERSION_FLAG = path.join(APP_DATA_DIR, '.version');
const LOG_FILE = path.join(APP_DATA_DIR, 'logs', 'setup.log');
const APP_VERSION = '1.0.0';

/**
 * Write a timestamped line to setup.log
 */
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line, 'utf8'); } catch (_) {}
}

/**
 * Check if first-run setup has already been completed.
 */
function isSetupComplete() {
  return fs.existsSync(SETUP_FLAG);
}

/**
 * Download a file from a URL to a local path.
 * Follows redirects automatically.
 */
function downloadFile(url, destPath, onProgress, label) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (res) => {
      // Follow redirect
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath, onProgress, label)
          .then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode} for ${url}`));
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const out = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0 && onProgress) {
          const pct = Math.round((downloaded / total) * 100);
          onProgress(pct, `${label} (${Math.round(downloaded / 1024 / 1024)}MB)`);
        }
      });

      res.pipe(out);
      out.on('finish', () => { out.close(); resolve(); });
      out.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Run a command asynchronously, log all output, hide the window.
 * Returns a Promise that resolves on exit code 0, rejects otherwise.
 */
function runCommand(exe, args) {
  return new Promise((resolve, reject) => {
    log(`Running: ${exe} ${args.join(' ')}`);

    const proc = spawn(exe, args, {
      windowsHide: true,
      env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
    });

    proc.stdout.on('data', (data) => {
      log(`[stdout] ${data.toString().trimEnd()}`);
    });

    proc.stderr.on('data', (data) => {
      log(`[stderr] ${data.toString().trimEnd()}`);
    });

    proc.on('close', (code) => {
      log(`Exit code: ${code}`);
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}: ${exe} ${args.join(' ')}`));
    });

    proc.on('error', (err) => {
      log(`Spawn error: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Unzip using PowerShell — async, hidden window, logged.
 */
function unzipWithPowershell(zipPath, destDir) {
  return runCommand('powershell', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${destDir}'`
  ]);
}

/**
 * Run the full first-run setup.
 * @param {string} appResourcesDir - Path to app resources (where backend/ lives inside exe)
 * @param {function} onProgress - (percent, message) callback for splash screen updates
 */
async function runSetup(appResourcesDir, onProgress) {
  const report = (pct, msg) => {
    log(`[PROGRESS ${pct}%] ${msg}`);
    if (onProgress) onProgress(pct, msg);
  };

  // 1. Create AppData directories
  report(2, 'Preparing your workspace...');
  fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  fs.mkdirSync(PYTHON_DIR, { recursive: true });
  fs.mkdirSync(path.join(APP_DATA_DIR, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(APP_DATA_DIR, 'logs'), { recursive: true });

  log('=== Gevis AI Studio First-Run Setup ===');
  log(`APP_DATA_DIR: ${APP_DATA_DIR}`);
  log(`PYTHON_DIR: ${PYTHON_DIR}`);
  log(`appResourcesDir: ${appResourcesDir}`);
  log(`Platform: ${os.platform()} ${os.arch()}`);

  // 2. Download Python embeddable zip
  const zipPath = path.join(APP_DATA_DIR, 'python.zip');
  report(5, 'Downloading required components...');
  log(`Downloading Python from: ${PYTHON_ZIP_URL}`);
  await downloadFile(
    PYTHON_ZIP_URL,
    zipPath,
    (pct, msg) => report(5 + Math.round(pct * 0.25), `Downloading required components... (${Math.round(pct)}%)`),
    'Python runtime'
  );
  log('Python download complete.');
  report(30, 'Extracting components...');

  // 3. Extract Python zip
  log(`Extracting Python zip to: ${PYTHON_DIR}`);
  await unzipWithPowershell(zipPath, PYTHON_DIR);
  fs.unlinkSync(zipPath);
  log('Python extracted.');

  // 4. Enable pip in embedded Python
  report(35, 'Configuring...');
  const pthFiles = fs.readdirSync(PYTHON_DIR).filter(f => f.endsWith('._pth'));
  log(`Found ._pth files: ${pthFiles.join(', ')}`);
  for (const pthFile of pthFiles) {
    const pthPath = path.join(PYTHON_DIR, pthFile);
    let content = fs.readFileSync(pthPath, 'utf8');
    content = content.replace('#import site', 'import site');
    fs.writeFileSync(pthPath, content, 'utf8');
    log(`Patched: ${pthFile}`);
  }

  // 5. Download get-pip.py
  report(38, 'Setting up installer...');
  const getPipPath = path.join(PYTHON_DIR, 'get-pip.py');
  log(`Downloading get-pip.py from: ${GET_PIP_URL}`);
  await downloadFile(GET_PIP_URL, getPipPath, null, 'pip');
  log('get-pip.py downloaded.');

  // 6. Bootstrap pip
  const pythonExe = path.join(PYTHON_DIR, 'python.exe');
  log('Bootstrapping pip...');
  await runCommand(pythonExe, [getPipPath]);
  fs.unlinkSync(getPipPath);
  log('pip installed.');

  // 7. Auto-detect CUDA and choose requirements file
  report(45, 'Detecting your hardware...');
  let reqFile = path.join(appResourcesDir, 'backend', 'requirements.txt');
  const cudaReqFile = path.join(appResourcesDir, 'backend', 'requirements-cuda121.txt');
  log(`CPU requirements: ${reqFile}`);
  log(`CUDA requirements: ${cudaReqFile}`);
  log(`requirements.txt exists: ${fs.existsSync(reqFile)}`);
  log(`requirements-cuda121.txt exists: ${fs.existsSync(cudaReqFile)}`);

  let useCuda = false;
  try {
    await runCommand('nvidia-smi', []);
    useCuda = true;
    log('CUDA detected via nvidia-smi.');
  } catch (_) {
    useCuda = false;
    log('No CUDA detected — using CPU requirements.');
  }

  if (useCuda && fs.existsSync(cudaReqFile)) {
    reqFile = cudaReqFile;
    report(48, 'GPU detected — using GPU acceleration...');
  } else {
    report(48, 'Preparing AI libraries...');
  }

  // 8. pip install requirements
  const pipExe = path.join(PYTHON_DIR, 'Scripts', 'pip.exe');
  log(`pip executable: ${pipExe}`);
  log(`pip exists: ${fs.existsSync(pipExe)}`);
  log(`Installing from: ${reqFile}`);
  report(50, 'Installing AI libraries — this may take 20–30 minutes, please wait...');
  await runCommand(pipExe, ['install', '-r', reqFile, '--no-warn-script-location']);

  // 9. Write setup complete flags
  report(98, 'Almost ready...');
  fs.writeFileSync(SETUP_FLAG, new Date().toISOString(), 'utf8');
  fs.writeFileSync(VERSION_FLAG, APP_VERSION, 'utf8');
  log('Setup complete flag written.');

  report(100, 'Setup complete!');
  log('=== Setup Finished Successfully ===');
}

module.exports = { isSetupComplete, runSetup };
