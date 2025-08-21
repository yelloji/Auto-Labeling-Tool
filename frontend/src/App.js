import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import 'antd/dist/reset.css';

// Initialize professional frontend logging
import './utils/professional_logger';
import { logInfo, logError, logUserClick } from './utils/professional_logger';

import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ModelsModern from './pages/ModelsModern';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ProjectWorkspace from './pages/project-workspace/ProjectWorkspace';
import AnnotateLauncher from './pages/annotation/AnnotateLauncher';
import AnnotateProgress from './pages/annotation/AnnotateProgress';
import ManualLabeling from './pages/annotation/ManualLabeling';
// Removed: Datasets, DatasetDetailModern, ActiveLearningDashboard, Annotate (old)
// These will be integrated into Projects

const { Header, Content } = Layout;

function App() {
  // Log app initialization
  logInfo('app.frontend.ui', 'app_initialized', 'React App initialized', {
    timestamp: new Date().toISOString(),
    component: 'App',
    userAgent: navigator.userAgent,
    windowSize: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    function: 'app_initialization'
  });

  // Add error boundary logging
  React.useEffect(() => {
    const handleError = (error, errorInfo) => {
      logError('app.frontend.ui', 'app_error_boundary', 'Unhandled error caught by app error boundary', {
        timestamp: new Date().toISOString(),
        error: error.message,
        errorStack: error.stack,
        errorInfo: errorInfo,
        component: 'App',
        function: 'error_boundary'
      });
    };

    const handleUnhandledRejection = (event) => {
      logError('app.frontend.ui', 'app_unhandled_rejection', 'Unhandled promise rejection', {
        timestamp: new Date().toISOString(),
        reason: event.reason,
        component: 'App',
        function: 'unhandled_rejection_handler'
      });
    };

    // Add global error handlers
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Log successful app mount
    logInfo('app.frontend.ui', 'app_mounted', 'React App successfully mounted', {
      timestamp: new Date().toISOString(),
      component: 'App',
      function: 'app_mount'
    });

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <Router>
      {(() => {
        logInfo('app.frontend.ui', 'app_rendered', 'React App rendered', {
          timestamp: new Date().toISOString(),
          component: 'App',
          currentPath: window.location.pathname,
          function: 'app_render'
        });
        return null;
      })()}
      <Routes>
        {/* Project Workspace - Full screen layout without navbar */}
        <Route path="/projects/:projectId/workspace" element={<ProjectWorkspace />} />
        
        {/* Main app layout with navbar */}
        <Route path="/*" element={
          <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ padding: 0, background: '#001529' }}>
              <Navbar />
            </Header>
            <Content style={{ padding: 0, background: '#001529' }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/models" element={<ModelsModern />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:projectId" element={<ProjectDetail />} />
                <Route path="/annotate-launcher/:datasetId" element={<AnnotateLauncher />} />
                <Route path="/annotate-progress/:datasetId" element={<AnnotateProgress />} />
                <Route path="/annotate/:datasetId" element={<ManualLabeling />} />
                <Route path="/annotate/:datasetId/manual" element={<ManualLabeling />} />
                {/* Removed standalone routes: /datasets, /active-learning, /projects/:projectId/annotate */}
                {/* These features will be integrated within project workflows */}
              </Routes>
            </Content>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;