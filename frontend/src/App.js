import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import 'antd/dist/reset.css';

// Initialize frontend logging
import './utils/logger';

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
  return (
    <Router>
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