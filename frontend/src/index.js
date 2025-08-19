import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Initialize professional frontend logging
import './utils/professional_logger';
import { logInfo, logError } from './utils/professional_logger';

// Log React app startup
logInfo('app.frontend.ui', 'react_app_startup', 'React application startup initiated', {
  timestamp: new Date().toISOString(),
  component: 'index.js',
  nodeEnv: process.env.NODE_ENV,
  userAgent: navigator.userAgent,
  windowSize: {
    width: window.innerWidth,
    height: window.innerHeight
  },
  function: 'react_startup'
});

const root = ReactDOM.createRoot(document.getElementById('root'));

// Log root creation
logInfo('app.frontend.ui', 'react_root_created', 'React root element created', {
  timestamp: new Date().toISOString(),
  component: 'index.js',
  rootElement: 'root',
  function: 'root_creation'
});

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Log successful render
logInfo('app.frontend.ui', 'react_app_rendered', 'React application successfully rendered', {
  timestamp: new Date().toISOString(),
  component: 'index.js',
  function: 'app_render'
});