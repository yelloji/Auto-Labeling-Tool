// Initialize professional frontend logging
import { logInfo } from './utils/professional_logger';

// API Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://work-1-digwbshcauwokcgm.prod-runtime.all-hands.dev'  // Backend on port 12000
  : 'http://localhost:12000';  // Backend on port 12000 (correct port)

// Log configuration loading
logInfo('app.frontend.ui', 'config_loaded', 'Frontend configuration loaded', {
  timestamp: new Date().toISOString(),
  component: 'config.js',
  nodeEnv: process.env.NODE_ENV,
  apiBaseUrl: API_BASE_URL,
  function: 'config_loading'
});

export { API_BASE_URL };