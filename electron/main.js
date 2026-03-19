'use strict';

/**
 * main.js — Electron entry point for Gevis AI Studio
 *
 * Flow:
 * 1. Open splash window immediately (no blank screen)
 * 2. First run? → run setup.js (download Python, pip install)
 * 3. Start Python backend via backend_runner.js
 * 4. Poll localhost:12000/health until backend ready
 * 5. Open main app window, close splash
 *
 * Dev mode:  run with `npm run electron:dev` — backend must already be running
 * Exe mode:  backend started automatically here
 */

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');

const { startBackend, stopBackend, isPythonReady } = require('./backend_runner');
const { isSetupComplete, runSetup } = require('./setup');

const IS_DEV = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const BACKEND_URL = 'http://localhost:12000';
const HEALTH_URL = `${BACKEND_URL}/health`;

let splashWindow = null;
let mainWindow = null;

// ── Splash window ──────────────────────────────────────────────────────────

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

function updateSplash(percent, message) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(
      `updateProgress(${percent}, ${JSON.stringify(message)})`
    ).catch(() => {});
  }
}

// ── Main app window ────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Gevis AI Studio',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL(BACKEND_URL);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Backend health polling ─────────────────────────────────────────────────

function waitForBackend(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      http.get(HEALTH_URL, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Backend did not start within 60 seconds.'));
      }
      setTimeout(check, 500);
    };

    check();
  });
}

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  createSplashWindow();

  try {
    if (IS_DEV) {
      // Dev mode: backend already running, just wait for it
      updateSplash(30, 'Waiting for backend...');
      await waitForBackend();
      updateSplash(100, 'Ready');
    } else {
      // Exe mode: first-run setup if needed, then start backend
      const appResourcesDir = IS_DEV
        ? path.join(__dirname, '..')  // dev: repo root
        : process.resourcesPath;      // exe: resources/ folder next to app.asar

      if (!isSetupComplete()) {
        await runSetup(appResourcesDir, (pct, msg) => updateSplash(pct, msg));
      } else {
        updateSplash(10, 'Starting backend...');
      }

      if (!isPythonReady()) {
        throw new Error('Python setup incomplete. Please reinstall the application.');
      }

      const backendDir = path.join(appResourcesDir, 'backend');
      startBackend(backendDir);

      updateSplash(50, 'Loading application...');
      await waitForBackend();
      updateSplash(100, 'Ready');
    }

    createMainWindow();

  } catch (err) {
    dialog.showErrorBox('Gevis AI Studio — Startup Error', err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});
