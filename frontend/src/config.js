// Initialize professional frontend logging
import { logInfo } from './utils/professional_logger';

// API Configuration
// Always use localhost:12000 — works for dev, Electron window, and exe
const API_BASE_URL = 'http://localhost:12000';

// Log configuration loading
logInfo('app.frontend.ui', 'config_loaded', 'Frontend configuration loaded', {
  timestamp: new Date().toISOString(),
  component: 'config.js',
  nodeEnv: process.env.NODE_ENV,
  apiBaseUrl: API_BASE_URL,
  function: 'config_loading'
});

export { API_BASE_URL };