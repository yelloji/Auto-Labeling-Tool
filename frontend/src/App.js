import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import 'antd/dist/reset.css';

import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Models from './pages/Models';
import Projects from './pages/Projects';
import Datasets from './pages/Datasets';
import Annotate from './pages/Annotate';
import ActiveLearningDashboard from './components/ActiveLearning/ActiveLearningDashboard';

const { Header, Content } = Layout;

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ padding: 0 }}>
          <Navbar />
        </Header>
        <Content style={{ padding: '24px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/models" element={<Models />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/datasets" element={<Datasets />} />
            <Route path="/annotate/:datasetId?" element={<Annotate />} />
            <Route path="/active-learning" element={<ActiveLearningDashboard />} />
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
}

export default App;