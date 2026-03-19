'use strict';

/**
 * preload.js — Secure bridge between Electron and React
 *
 * contextBridge exposes a safe, limited API to the renderer (React).
 * Node.js APIs are NOT directly accessible in the renderer.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('gevisApp', {
  version: '1.0.0',
  platform: process.platform,
  isElectron: true
});
