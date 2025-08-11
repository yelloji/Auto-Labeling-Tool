# ProjectWorkspace Refactoring Plan

This document outlines a plan for refactoring the large ProjectWorkspace.js file into smaller, more manageable components without changing the existing functionality.

## Current Structure

Currently, ProjectWorkspace.js is a large component (~2000 lines) that contains:

1. State management for multiple features
2. API calls for various data fetching operations
3. Event handlers for user interactions
4. Multiple render functions for different sections
5. UI components for all sections

## Refactoring Approach

### Phase 1: Create Component Structure

Create a directory structure for the components:

```
src/
├── components/
│   ├── project-workspace/
│   │   ├── UploadSection/
│   │   │   ├── index.js
│   │   │   ├── FileUploader.js
│   │   │   └── RecentImages.js
│   │   ├── ManagementSection/
│   │   │   ├── index.js
│   │   │   ├── DatasetCard.js
│   │   │   ├── UnassignedSection.js
│   │   │   ├── AnnotatingSection.js
│   │   │   └── DatasetSection.js
│   │   ├── DatasetSection/
│   │   │   ├── index.js
│   │   │   └── DatasetViewer.js
│   │   ├── ModelsSection/
│   │   │   ├── index.js
│   │   │   └── ModelCard.js
│   │   ├── VisualizeSection/
│   │   │   ├── index.js
│   │   │   └── Visualizer.js
│   │   ├── DeploymentsSection/
│   │   │   ├── index.js
│   │   │   └── DeploymentCard.js
│   │   └── ActiveLearningSection/
│   │       ├── index.js
│   │       └── ActiveLearningDashboard.js
```

### Phase 2: Extract Components

Extract each section into its own component:

1. **UploadSection**: Extract `renderUploadContent()` into its own component
2. **ManagementSection**: Extract `renderManagementContent()` into its own component
3. **DatasetSection**: Extract `renderDatasetContent()` into its own component
4. **ModelsSection**: Extract `renderModelsContent()` into its own component
5. **VisualizeSection**: Extract `renderVisualizeContent()` into its own component
6. **DeploymentsSection**: Extract `renderDeploymentsContent()` into its own component
7. **ActiveLearningSection**: Extract `renderActiveLearningContent()` into its own component

### Phase 3: Extract Shared Components

Extract shared components used across multiple sections:

1. **DatasetCard**: Used in ManagementSection
2. **FileUploader**: Used in UploadSection
3. **SectionHeader**: Common header component for all sections

### Phase 4: Extract API and State Logic

Create custom hooks for API calls and state management:

1. **useProjectData**: Hook for loading project data
2. **useManagementData**: Hook for loading and managing dataset data
3. **useUploadState**: Hook for managing upload state and operations

### Phase 5: Refactor Main Component

Refactor the main ProjectWorkspace component to use the extracted components:

```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { useProjectData } from '../../hooks/useProjectData';

// Import section components
import UploadSection from '../../components/project-workspace/UploadSection';
import ManagementSection from '../../components/project-workspace/ManagementSection';
import DatasetSection from '../../components/project-workspace/DatasetSection';
import ModelsSection from '../../components/project-workspace/ModelsSection';
import VisualizeSection from '../../components/project-workspace/VisualizeSection';
import DeploymentsSection from '../../components/project-workspace/DeploymentsSection';
import ActiveLearningSection from '../../components/project-workspace/ActiveLearningSection';

const { Sider, Content } = Layout;

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const location = useLocation();
  const [selectedKey, setSelectedKey] = useState(location.state?.selectedSection || 'upload');
  
  const { project, loading } = useProjectData(projectId);
  
  // Update selectedKey when location state changes
  useEffect(() => {
    if (location.state?.selectedSection) {
      setSelectedKey(location.state.selectedSection);
    } else {
      const searchParams = new URLSearchParams(location.search);
      const section = searchParams.get('section');
      if (section) {
        setSelectedKey(section);
      }
    }
  }, [location.state, location.search]);
  
  const renderContent = () => {
    switch (selectedKey) {
      case 'upload':
        return <UploadSection projectId={projectId} />;
      case 'management':
        return <ManagementSection projectId={projectId} />;
      case 'dataset':
        return <DatasetSection projectId={projectId} />;
      case 'models':
        return <ModelsSection projectId={projectId} />;
      case 'visualize':
        return <VisualizeSection projectId={projectId} />;
      case 'deployments':
        return <DeploymentsSection projectId={projectId} />;
      case 'active-learning':
        return <ActiveLearningSection projectId={projectId} />;
      default:
        return <UploadSection projectId={projectId} />;
    }
  };
  
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar navigation */}
      <Sider width={250} theme="light">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ height: '100%', borderRight: 0 }}
          onSelect={({ key }) => setSelectedKey(key)}
        >
          {/* Menu items */}
        </Menu>
      </Sider>
      
      {/* Main content area */}
      <Content>
        {renderContent()}
      </Content>
    </Layout>
  );
};

export default ProjectWorkspace;
```

### Phase 6: Testing and Validation

1. Test each extracted component individually
2. Test the integrated application
3. Verify that all functionality works as expected
4. Fix any issues that arise during testing

## Implementation Timeline

1. **Week 1**: Create component structure and extract main sections
2. **Week 2**: Extract shared components and API logic
3. **Week 3**: Refactor main component and integrate all parts
4. **Week 4**: Testing, validation, and bug fixing

## Benefits of Refactoring

1. **Improved Maintainability**: Smaller components are easier to understand and maintain
2. **Better Code Organization**: Clear separation of concerns
3. **Enhanced Reusability**: Components can be reused across the application
4. **Easier Testing**: Smaller components are easier to test
5. **Improved Performance**: Potential for better performance through optimized rendering
6. **Better Developer Experience**: Easier onboarding for new developers