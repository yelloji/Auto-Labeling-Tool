'use strict';

/**
 * setup.js
 * First-run setup: downloads embedded Python, installs pip dependencies.
 * Runs ONCE — skipped on all subsequent launches via .setup_complete flag.
 *
 * Progress is reported via onProgress(percent, message) callback
 * so main.js can update the splash screen.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { createGunzip } = require('zlib');

// Python 3.11 embeddable package for Windows x64
const PYTHON_VERSION = '3.11.9';
const PYTHON_ZIP_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;

// pip bootstrap
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

const { APP_DATA_DIR, PYTHON_DIR } = require('./backend_runner');

const SETUP_FLAG = path.join(APP_DATA_DIR, '.setup_complete');
const VERSION_FLAG = path.join(APP_DATA_DIR, '.version');
const APP_VERSION = '1.0.0';

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
 * Unzip a .zip file using PowerShell (available on all Windows 10+ machines).
 */
function unzipWithPowershell(zipPath, destDir) {
  execFileSync('powershell', [
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
  const report = (pct, msg) => { if (onProgress) onProgress(pct, msg); };

  // 1. Create AppData directories
  report(2, 'Creating data folders...');
  fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  fs.mkdirSync(PYTHON_DIR, { recursive: true });
  fs.mkdirSync(path.join(APP_DATA_DIR, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(APP_DATA_DIR, 'logs'), { recursive: true });

  // 2. Download Python embeddable zip
  const zipPath = path.join(APP_DATA_DIR, 'python.zip');
  report(5, 'Downloading Python runtime...');
  await downloadFile(
    PYTHON_ZIP_URL,
    zipPath,
    (pct, msg) => report(5 + Math.round(pct * 0.25), `Downloading Python: ${msg}`),
    'Python runtime'
  );
  report(30, 'Extracting Python runtime...');

  // 3. Extract Python zip
  unzipWithPowershell(zipPath, PYTHON_DIR);
  fs.unlinkSync(zipPath); // clean up zip

  // 4. Enable pip in embedded Python
  // Embedded Python has a ._pth file that blocks site-packages — we must enable it
  report(35, 'Configuring Python...');
  const pthFiles = fs.readdirSync(PYTHON_DIR).filter(f => f.endsWith('._pth'));
  for (const pthFile of pthFiles) {
    const pthPath = path.join(PYTHON_DIR, pthFile);
    let content = fs.readFileSync(pthPath, 'utf8');
    // Uncomment import site line to enable pip
    content = content.replace('#import site', 'import site');
    fs.writeFileSync(pthPath, content, 'utf8');
  }

  // 5. Download get-pip.py
  report(38, 'Installing pip...');
  const getPipPath = path.join(PYTHON_DIR, 'get-pip.py');
  await downloadFile(GET_PIP_URL, getPipPath, null, 'pip');

  // 6. Bootstrap pip
  const pythonExe = path.join(PYTHON_DIR, 'python.exe');
  execFileSync(pythonExe, [getPipPath], { stdio: 'inherit' });
  fs.unlinkSync(getPipPath); // clean up

  // 7. Auto-detect CUDA and choose requirements file
  report(45, 'Detecting hardware...');
  let reqFile = path.join(appResourcesDir, 'backend', 'requirements.txt');
  const cudaReqFile = path.join(appResourcesDir, 'backend', 'requirements-cuda121.txt');

  let useCuda = false;
  try {
    // Check if CUDA is available via nvidia-smi
    execFileSync('nvidia-smi', [], { stdio: 'ignore' });
    useCuda = true;
  } catch (_) {
    useCuda = false;
  }

  if (useCuda && fs.existsSync(cudaReqFile)) {
    reqFile = cudaReqFile;
    report(48, 'GPU detected — installing CUDA dependencies...');
  } else {
    report(48, 'Installing CPU dependencies...');
  }

  // 8. pip install requirements
  const pipExe = path.join(PYTHON_DIR, 'Scripts', 'pip.exe');
  execFileSync(pipExe, ['install', '-r', reqFile], {
    stdio: 'inherit',
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
  });

  // 9. Write setup complete flags
  report(98, 'Finalizing...');
  fs.writeFileSync(SETUP_FLAG, new Date().toISOString(), 'utf8');
  fs.writeFileSync(VERSION_FLAG, APP_VERSION, 'utf8');

  report(100, 'Setup complete!');
}

module.exports = { isSetupComplete, runSetup };
