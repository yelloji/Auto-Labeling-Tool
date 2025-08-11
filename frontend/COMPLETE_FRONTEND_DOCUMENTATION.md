# COMPLETE FRONTEND DOCUMENTATION
## AUTO-LABELING-TOOL-2 Frontend Architecture

### 📁 FOLDER STRUCTURE OVERVIEW

```
frontend/
├── public/                     # Static assets
├── src/                       # Source code
│   ├── App.js                 # Main application component
│   ├── index.js               # React entry point
│   ├── config.js              # Configuration settings
│   ├── index.css              # Global styles
│   ├── setupProxy.js          # Development proxy setup
│   ├── components/            # Reusable components
│   ├── pages/                 # Page components
│   ├── services/              # API services
│   └── utils/                 # Utility functions
├── package.json               # Dependencies and scripts
└── Documentation files
```

---

## 📋 DETAILED FILE ANALYSIS

### 🔧 ROOT LEVEL FILES

#### `App.js` - Main Application Router
**Purpose**: Central routing and layout management
**Key Functions**:
- `App()` - Main component with routing logic
- Route definitions for all pages
- Layout structure with Header and Content

**Routes Defined**:
```javascript
- "/" → Dashboard
- "/projects" → Projects list
- "/projects/:id" → ProjectDetail
- "/projects/:id/workspace" → ProjectWorkspace (NEW MODULAR)
- "/projects/:id/annotate" → AnnotateLauncher
- "/projects/:id/annotate/progress" → AnnotateProgress
- "/projects/:id/annotate/manual/:datasetId" → ManualLabeling
- "/models" → ModelsModern
```

**Dependencies**: React Router, Ant Design Layout

#### `index.js` - React Entry Point
**Purpose**: Application initialization
**Key Functions**:
- `ReactDOM.render()` - Mounts App to DOM
- Imports global CSS

#### `config.js` - Configuration Management
**Purpose**: Centralized configuration
**Key Variables**:
- API base URLs
- Environment settings
- Feature flags

#### `setupProxy.js` - Development Proxy
**Purpose**: Proxy API calls during development
**Configuration**: Routes `/api/*` to backend server

---

## 📁 COMPONENTS DIRECTORY

### 🎯 `/components/project-workspace/` - MODULAR WORKSPACE COMPONENTS

This is the **NEW MODULAR ARCHITECTURE** we created:

#### Structure:
```
project-workspace/
├── index.js                   # Main exports
├── UploadSection/
│   ├── UploadSection.js       # File upload functionality
│   └── index.js               # Export
├── ManagementSection/
│   ├── ManagementSection.jsx  # Dataset management + DatasetCard
│   └── index.js               # Export
├── DatasetSection/
│   ├── DatasetSection.jsx     # Dataset listing and operations
│   └── index.js               # Export
├── VersionsSection/
│   ├── VersionsSection.jsx    # Version control
│   └── index.js               # Export
├── ModelsSection/
│   ├── ModelsSection.jsx      # Model management
│   └── index.js               # Export
├── VisualizeSection/
│   ├── VisualizeSection.jsx   # Data visualization
│   └── index.js               # Export
├── DeploymentsSection/
│   ├── DeploymentsSection.jsx # Model deployments
│   └── index.js               # Export
└── ActiveLearningSection/
    ├── ActiveLearningSection.jsx # Active learning workflows
    └── index.js               # Export
```

#### **UploadSection.js** - File Upload Management
**Purpose**: Handle file and folder uploads
**Key Functions**:
- `loadAvailableDatasets()` - Fetch project datasets
- `loadRecentImages()` - Load recent uploaded images
- `handleFileUpload()` - Process file uploads
- `handleFolderUpload()` - Process folder uploads
- `uploadMultipleFiles()` - Batch upload functionality

**State Variables**:
- `batchName` - Upload batch name
- `tags` - File tags
- `uploadedFiles` - Uploaded file list
- `uploading` - Upload status
- `uploadProgress` - Upload progress percentage
- `availableDatasets` - Available datasets for project
- `recentImages` - Recently uploaded images
- `batchNameModalVisible` - Modal visibility state

**Props Received**:
- `projectId` - Current project ID
- `project` - Project data object
- `loadProject` - Function to reload project data

#### **ManagementSection.jsx** - Dataset Management
**Purpose**: Manage datasets with integrated DatasetCard functionality
**Key Functions**:
- `loadManagementData()` - Load dataset management data
- `handleDatasetAction()` - Handle dataset operations
- `DatasetCard` component - Individual dataset display (integrated)

**Features**:
- Dataset listing
- Dataset operations (edit, delete, export)
- Statistics display
- Action buttons

#### **DatasetSection.jsx** - Dataset Operations
**Purpose**: Dataset listing and detailed operations
**Key Functions**:
- `loadDatasets()` - Fetch datasets
- `handleDatasetSelect()` - Select dataset
- `handleDatasetOperation()` - Perform dataset operations

#### **Other Sections** - Similar Structure
Each section follows the same pattern:
- Component file (.jsx)
- Index.js for clean exports
- Specific functionality for that workspace area

### 🎨 `/components/AnnotationToolset/` - Annotation Tools

#### **AnnotationCanvas.js** - Main Canvas Component
**Purpose**: Core annotation canvas functionality
**Key Functions**:
- `resizeCanvas()` - Handle canvas resizing
- `redrawCanvas()` - Redraw all annotations
- `drawAnnotation()` - Draw individual annotations
- `handleMouseDown/Move/Up()` - Mouse interaction handlers
- `screenToImageCoords()` - Coordinate conversion
- `imageToScreenCoords()` - Reverse coordinate conversion

**State Variables**:
- `canvasSize` - Canvas dimensions
- `imagePosition` - Image position on canvas
- `annotations` - Current annotations
- `selectedAnnotation` - Currently selected annotation
- `tool` - Current annotation tool

#### **AnnotationToolbox.js** - Tool Selection
**Purpose**: Annotation tool selection and configuration
**Key Functions**:
- `handleToolSelect()` - Select annotation tool
- `handleToolConfig()` - Configure tool settings

#### **LabelSelectionPopup.js** - Label Management
**Purpose**: Label creation and selection
**Key Functions**:
- `handleLabelCreate()` - Create new label
- `handleLabelSelect()` - Select existing label
- `handleLabelEdit()` - Edit label properties

#### **SmartPolygonTool.js** - AI-Assisted Annotation
**Purpose**: Smart polygon annotation with AI assistance
**Key Functions**:
- `performSmartSegmentation()` - AI-powered segmentation
- `handlePolygonEdit()` - Edit polygon points
- `optimizePolygon()` - Optimize polygon shape

### 🔧 `/components/` - Other Components

#### **Navbar.js** - Navigation Bar
**Purpose**: Main application navigation
**Key Functions**:
- `handleNavigation()` - Navigate between pages
- `handleUserMenu()` - User menu actions

#### **DataAugmentation.js** - Data Augmentation
**Purpose**: Data augmentation functionality
**Key Functions**:
- `applyAugmentation()` - Apply augmentation techniques
- `previewAugmentation()` - Preview augmentation results

#### **DatasetAnalytics.js** - Analytics Dashboard
**Purpose**: Dataset analytics and insights
**Key Functions**:
- `loadAnalytics()` - Load analytics data
- `generateCharts()` - Generate visualization charts

---

## 📄 PAGES DIRECTORY

### 🏠 `/pages/` - Main Pages

#### **Dashboard.js** - Main Dashboard
**Purpose**: Application overview and quick access
**Key Functions**:
- `loadDashboardData()` - Load dashboard statistics
- `handleQuickAction()` - Quick action handlers

#### **Projects.js** - Projects Management
**Purpose**: Project listing and management
**Key Functions**:
- `loadProjects()` - Fetch all projects
- `handleProjectCreate()` - Create new project
- `handleProjectEdit()` - Edit project details
- `handleProjectDelete()` - Delete project
- `handleProjectSearch()` - Search projects

**State Variables**:
- `projects` - Projects list
- `loading` - Loading state
- `searchTerm` - Search query
- `selectedProjects` - Selected projects for bulk operations

#### **ProjectDetail.js** - Project Details
**Purpose**: Individual project overview
**Key Functions**:
- `loadProject()` - Load project details
- `loadDatasets()` - Load project datasets
- `handleProjectUpdate()` - Update project information

#### **ModelsModern.js** - Model Management
**Purpose**: AI model management interface
**Key Functions**:
- `loadModels()` - Fetch available models
- `handleModelTrain()` - Start model training
- `handleModelDeploy()` - Deploy model
- `handleModelEvaluate()` - Evaluate model performance

### 🎯 `/pages/project-workspace/` - NEW MODULAR WORKSPACE

#### **ProjectWorkspace.js** - Main Workspace Controller
**Purpose**: Orchestrate all workspace sections
**Key Functions**:
- `loadProject()` - Load project data
- `handleSectionChange()` - Switch between sections
- `renderContent()` - Render appropriate section component

**Props Passed to Sections**:
- `projectId` - Current project ID
- `project` - Project data object
- `loadProject` - Function to reload project
- `navigate` - Navigation function
- `setSelectedKey` - Set active menu key

**Menu Structure**:
```javascript
const menuItems = [
  { key: 'upload', icon: UploadOutlined, label: 'Upload' },
  { key: 'management', icon: DatabaseOutlined, label: 'Management' },
  { key: 'datasets', icon: PictureOutlined, label: 'Datasets' },
  { key: 'versions', icon: HistoryOutlined, label: 'Versions' },
  { key: 'models', icon: RobotOutlined, label: 'Models' },
  { key: 'visualize', icon: EyeOutlined, label: 'Visualize' },
  { key: 'deployments', icon: DeploymentUnitOutlined, label: 'Deployments' },
  { key: 'active-learning', icon: BulbOutlined, label: 'Active Learning' }
];
```

### 📝 `/pages/annotation/` - Annotation Pages

#### **AnnotateLauncher.js** - Annotation Setup
**Purpose**: Configure and launch annotation sessions
**Key Functions**:
- `loadDatasetImages()` - Load images for annotation
- `handleAnnotationStart()` - Start annotation session
- `configureAnnotationSettings()` - Set annotation parameters

#### **AnnotateProgress.jsx** - Annotation Progress
**Purpose**: Track annotation progress and statistics
**Key Functions**:
- `loadProgressData()` - Load annotation progress
- `updateProgress()` - Update progress statistics
- `handleProgressAction()` - Handle progress-related actions

#### **ManualLabeling.jsx** - Manual Annotation Interface
**Purpose**: Main manual annotation interface
**Key Functions**:
- `loadImageData()` - Load image and existing annotations
- `loadProjectLabels()` - Load project label definitions
- `handleAnnotationSave()` - Save annotations
- `handleAnnotationDelete()` - Delete annotations
- `handleImageNavigation()` - Navigate between images

**State Variables**:
- `currentImage` - Current image data
- `annotations` - Current image annotations
- `projectLabels` - Available labels
- `selectedTool` - Current annotation tool
- `labelPopupPosition` - Label popup position
- `imagePosition` - Image position on canvas

---

## 🔌 SERVICES DIRECTORY

### **api.js** - API Service Layer
**Purpose**: Centralized API communication with axios
**Base Configuration**:
- Base URL: `http://localhost:12000` (configurable via env)
- Timeout: 30 seconds
- Automatic cache busting for GET requests
- Request/Response interceptors for logging

#### **Core Setup**:
```javascript
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:12000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  }
});
```

#### **Health Check**:
- `healthCheck()` - Check backend connectivity

#### **Models API** (`modelsAPI`):
- `getModels()` - Get all available models
- `getModel(modelId)` - Get specific model details
- `importModel(formData)` - Import custom model (multipart/form-data)
- `deleteModel(modelId)` - Delete model
- `getSupportedTypes()` - Get supported model types

#### **Projects API** (`projectsAPI`):
- `getProjects(skip, limit)` - Get all projects with pagination
- `createProject(projectData)` - Create new project
- `getProject(projectId)` - Get specific project
- `updateProject(projectId, updateData)` - Update project
- `deleteProject(projectId)` - Delete project
- `getProjectDatasets(projectId)` - Get project datasets
- `getProjectStats(projectId)` - Get project statistics
- `duplicateProject(projectId)` - Duplicate project with all data
- `getProjectManagementData(projectId)` - Get datasets organized by status
- `assignDatasetToAnnotating(projectId, datasetId)` - Assign dataset for annotation
- `renameDataset(projectId, datasetId, newName)` - Rename dataset
- `deleteProjectDataset(projectId, datasetId)` - Delete dataset from project
- `moveDatasetToUnassigned(projectId, datasetId)` - Move to unassigned
- `moveDatasetToCompleted(projectId, datasetId)` - Move to completed

#### **Datasets API** (`datasetsAPI`):
- `getDatasets(projectId, skip, limit)` - Get datasets with optional project filter
- `createDataset(datasetData)` - Create new dataset
- `uploadDataset(formData)` - Create dataset and upload files
- `getDataset(datasetId)` - Get specific dataset
- `uploadImages(datasetId, files, autoLabel)` - Upload images to dataset
- `startAutoLabeling(datasetId, autoLabelData)` - Start auto-labeling process
- `getDatasetImages(datasetId, skip, limit, labeledOnly)` - Get dataset images
- `deleteDataset(datasetId)` - Delete dataset
- `exportDataset(datasetId, format)` - Export dataset in various formats
- `getDatasetStats(datasetId)` - Get dataset statistics

#### **Images API** (`imagesAPI`):
- `getImage(imageId)` - Get specific image
- `getImageAnnotations(imageId)` - Get image annotations
- `updateImageAnnotations(imageId, annotations)` - Update annotations
- `deleteImage(imageId)` - Delete image
- `getImageLabels(imageId)` - Get image labels

#### **Annotations API** (`annotationsAPI`):
- `getAnnotations(imageId)` - Get annotations for image
- `saveAnnotations(imageId, annotations)` - Save annotations
- `deleteAnnotation(annotationId)` - Delete specific annotation
- `exportAnnotations(datasetId, format)` - Export annotations
- `importAnnotations(datasetId, file)` - Import annotations

#### **Labels API** (`labelsAPI`):
- `getProjectLabels(projectId)` - Get project label definitions
- `createLabel(projectId, labelData)` - Create new label
- `updateLabel(labelId, labelData)` - Update label
- `deleteLabel(labelId)` - Delete label

#### **Auto-Labeling API** (`autoLabelingAPI`):
- `startAutoLabeling(datasetId, config)` - Start auto-labeling
- `getAutoLabelingStatus(taskId)` - Get auto-labeling progress
- `stopAutoLabeling(taskId)` - Stop auto-labeling process

#### **Training API** (`trainingAPI`):
- `startTraining(projectId, config)` - Start model training
- `getTrainingStatus(taskId)` - Get training progress
- `stopTraining(taskId)` - Stop training process
- `getTrainingResults(taskId)` - Get training results

#### **Error Handling**:
```javascript
export const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    message.error(`Error ${status}: ${data.detail || data.message || 'Unknown error'}`);
  } else if (error.request) {
    // Request made but no response
    message.error('Network error: Unable to connect to server');
  } else {
    // Something else happened
    message.error(`Error: ${error.message}`);
  }
  console.error('API Error:', error);
};
```

#### **Request/Response Interceptors**:
- **Request**: Adds timestamp for cache busting, logs requests
- **Response**: Logs responses, handles errors globally

---

## 🛠 UTILS DIRECTORY

### **errorHandler.js** - Error Management
**Purpose**: Centralized error handling utilities
**Key Functions**:
```javascript
// Main error handler - returns structured error info
handleAPIError(error) => {
  status: number,     // HTTP status or 0/-1 for network/other errors
  message: string,    // User-friendly error message
  data: object       // Raw error data
}

// Quick error message extraction
getErrorMessage(error) => string
```

**Error Types Handled**:
- **Server Errors** (error.response): HTTP status + server message
- **Network Errors** (error.request): Connection issues
- **Other Errors**: Unexpected errors

**Usage Pattern**:
```javascript
try {
  const result = await api.someCall();
} catch (error) {
  const errorInfo = handleAPIError(error);
  message.error(errorInfo.message);
}
```

---

## 🚀 HOW TO ADD NEW DATASET SECTION

### Step 1: Create New Section Component

```bash
# Create new section folder
mkdir src/components/project-workspace/NewDatasetSection

# Create component file
touch src/components/project-workspace/NewDatasetSection/NewDatasetSection.jsx
touch src/components/project-workspace/NewDatasetSection/index.js
```

### Step 2: Component Template

**NewDatasetSection.jsx**:
```javascript
import React, { useState, useEffect } from 'react';
import { Card, Button, Table, message } from 'antd';
import { projectsAPI, handleAPIError } from '../../../services/api';

const NewDatasetSection = ({ projectId, project, loadProject }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  // Load section data
  const loadSectionData = async () => {
    try {
      setLoading(true);
      // Add your API call here
      const response = await projectsAPI.getNewDatasetData(projectId);
      setData(response.data);
    } catch (error) {
      handleAPIError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadSectionData();
    }
  }, [projectId]);

  // Your component logic here
  const handleAction = async () => {
    try {
      // Add your action logic
      message.success('Action completed successfully');
      loadSectionData(); // Reload data
    } catch (error) {
      handleAPIError(error);
    }
  };

  return (
    <div>
      <Card title="New Dataset Section" loading={loading}>
        {/* Your component UI here */}
        <Button onClick={handleAction}>
          Perform Action
        </Button>
      </Card>
    </div>
  );
};

export default NewDatasetSection;
```

**index.js**:
```javascript
export { default } from './NewDatasetSection.jsx';
```

### Step 3: Add to Main Exports

**Update `src/components/project-workspace/index.js`**:
```javascript
import NewDatasetSection from './NewDatasetSection';

export {
  UploadSection,
  ManagementSection,
  DatasetSection,
  VersionsSection,
  ModelsSection,
  VisualizeSection,
  DeploymentsSection,
  ActiveLearningSection,
  NewDatasetSection  // Add your new section
};
```

### Step 4: Add to ProjectWorkspace Menu

**Update `src/pages/project-workspace/ProjectWorkspace.js`**:

1. **Import the new section**:
```javascript
import {
  UploadSection,
  ManagementSection,
  DatasetSection,
  VersionsSection,
  ModelsSection,
  VisualizeSection,
  DeploymentsSection,
  ActiveLearningSection,
  NewDatasetSection  // Add import
} from '../../components/project-workspace';
```

2. **Add menu item**:
```javascript
const menuItems = [
  { key: 'upload', icon: UploadOutlined, label: 'Upload' },
  { key: 'management', icon: DatabaseOutlined, label: 'Management' },
  { key: 'datasets', icon: PictureOutlined, label: 'Datasets' },
  { key: 'versions', icon: HistoryOutlined, label: 'Versions' },
  { key: 'models', icon: RobotOutlined, label: 'Models' },
  { key: 'visualize', icon: EyeOutlined, label: 'Visualize' },
  { key: 'deployments', icon: DeploymentUnitOutlined, label: 'Deployments' },
  { key: 'active-learning', icon: BulbOutlined, label: 'Active Learning' },
  { key: 'new-dataset', icon: YourIcon, label: 'New Dataset' }  // Add menu item
];
```

3. **Add to renderContent function**:
```javascript
const renderContent = () => {
  const commonProps = {
    projectId,
    project,
    loadProject,
    navigate,
    setSelectedKey
  };

  switch (selectedKey) {
    case 'upload':
      return <UploadSection {...commonProps} />;
    case 'management':
      return <ManagementSection {...commonProps} />;
    case 'datasets':
      return <DatasetSection {...commonProps} />;
    case 'versions':
      return <VersionsSection {...commonProps} />;
    case 'models':
      return <ModelsSection {...commonProps} />;
    case 'visualize':
      return <VisualizeSection {...commonProps} />;
    case 'deployments':
      return <DeploymentsSection {...commonProps} />;
    case 'active-learning':
      return <ActiveLearningSection {...commonProps} />;
    case 'new-dataset':  // Add case
      return <NewDatasetSection {...commonProps} />;
    default:
      return <UploadSection {...commonProps} />;
  }
};
```

### Step 5: Add API Endpoints (if needed)

**Update `src/services/api.js`**:
```javascript
// Add new API functions
const newDatasetAPI = {
  getData: (projectId) => api.get(`/projects/${projectId}/new-dataset`),
  performAction: (projectId, data) => api.post(`/projects/${projectId}/new-dataset`, data),
  // Add more endpoints as needed
};

// Export in projectsAPI or create separate export
export { newDatasetAPI };
```

---

## 🔧 DEVELOPMENT GUIDELINES

### Component Structure Best Practices:

1. **Folder Structure**:
   ```
   ComponentName/
   ├── ComponentName.jsx    # Main component
   ├── index.js            # Clean export
   └── ComponentName.css   # Styles (if needed)
   ```

2. **Component Template**:
   ```javascript
   import React, { useState, useEffect } from 'react';
   import { Card, Button, message } from 'antd';
   import { projectsAPI, handleAPIError } from '../../../services/api';

   const ComponentName = ({ projectId, project, loadProject }) => {
     // State management
     const [loading, setLoading] = useState(false);
     
     // Effects
     useEffect(() => {
       // Component initialization
     }, [projectId]);

     // Event handlers
     const handleAction = async () => {
       // Action logic
     };

     // Render
     return (
       <div>
         {/* Component JSX */}
       </div>
     );
   };

   export default ComponentName;
   ```

3. **Props Pattern**:
   All workspace sections receive:
   - `projectId` - Current project ID
   - `project` - Project data object
   - `loadProject` - Function to reload project data
   - `navigate` - Navigation function
   - `setSelectedKey` - Set active menu key

### State Management:
- Use local state for component-specific data
- Use props for shared data
- Use context for global state (if needed)

### API Integration:
- Always use the centralized API service
- Implement proper error handling
- Show loading states
- Provide user feedback

### Styling:
- Use Ant Design components
- Follow consistent spacing and layout
- Use CSS modules for custom styles

---

## 📊 CURRENT APPLICATION STATE

### ✅ COMPLETED:
- Modular component architecture
- Clean import/export system
- Proper folder structure
- All sections created with basic structure
- Main ProjectWorkspace controller
- API service integration
- Error handling utilities

### 🔄 ACTIVE:
- Application running on ports 12000 (backend) and 12001 (frontend)
- All components compile successfully
- Navigation working between sections

### 📝 NOTES:
- Original ProjectWorkspace.js preserved as .backup file
- New modular system in `/pages/project-workspace/`
- All annotation components in `/pages/annotation/`
- Clean separation of concerns
- Scalable architecture for future additions

---

## 🎯 QUICK REFERENCE

### Adding New Features:
1. Create component in appropriate folder
2. Add to exports
3. Update routing (if page-level)
4. Add API endpoints
5. Test integration

### Common Patterns:
- All components use Ant Design
- API calls use centralized service
- Error handling is consistent
- Loading states are implemented
- Props follow established patterns

### File Naming:
- Components: PascalCase.jsx
- Utilities: camelCase.js
- Exports: index.js
- Styles: ComponentName.css

---

## 📦 DEPENDENCIES & TECHNOLOGIES

### **Core Dependencies**:
```json
{
  "react": "^18.2.0",                    // Core React framework
  "react-dom": "^18.2.0",               // React DOM rendering
  "react-router-dom": "^6.3.0",         // Client-side routing
  "react-scripts": "5.0.1"              // Create React App scripts
}
```

### **UI Framework**:
```json
{
  "antd": "^5.8.0",                      // Ant Design component library
  "@ant-design/icons": "^5.2.0",        // Ant Design icons
  "@ant-design/plots": "^2.4.0",        // Data visualization charts
  "styled-components": "^6.0.0"         // CSS-in-JS styling
}
```

### **API & Data**:
```json
{
  "axios": "^1.9.0",                     // HTTP client for API calls
  "ajv": "^8.17.1"                       // JSON schema validation
}
```

### **Annotation Tools**:
```json
{
  "fabric": "^5.3.0",                    // Canvas manipulation library
  "konva": "^9.3.20",                    // 2D canvas library
  "react-konva": "^18.2.10"             // React wrapper for Konva
}
```

### **File Handling**:
```json
{
  "react-dropzone": "^14.2.3"           // Drag & drop file uploads
}
```

### **Development Tools**:
```json
{
  "cross-env": "^7.0.3",                // Cross-platform environment variables
  "@testing-library/jest-dom": "^5.16.4",
  "@testing-library/react": "^13.3.0",
  "@testing-library/user-event": "^13.5.0"
}
```

### **Scripts Available**:
- `npm start` - Start development server (port 12001, all hosts)
- `npm run start:dev` - Start development server (localhost only)
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

---

## 🏗 ARCHITECTURE PATTERNS

### **Component Architecture**:
```
Modular Component Structure:
├── ComponentName/
│   ├── ComponentName.jsx     # Main component logic
│   ├── index.js             # Clean export: export { default } from './ComponentName'
│   └── ComponentName.css    # Component-specific styles (optional)
```

### **State Management Pattern**:
- **Local State**: `useState` for component-specific data
- **Props**: Pass data down from parent components
- **API State**: Managed in components, fetched via services
- **Global State**: Context API (when needed)

### **API Integration Pattern**:
```javascript
// Standard API call pattern
const [loading, setLoading] = useState(false);
const [data, setData] = useState([]);

const loadData = async () => {
  try {
    setLoading(true);
    const response = await api.getData();
    setData(response.data);
  } catch (error) {
    handleAPIError(error);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  loadData();
}, [dependency]);
```

### **Error Handling Pattern**:
```javascript
// Consistent error handling
try {
  await api.action();
  message.success('Action completed');
} catch (error) {
  handleAPIError(error); // Shows user-friendly message
}
```

---

## 🔧 CONFIGURATION FILES

### **setupProxy.js** - Development Proxy:
```javascript
// Proxies /api/* requests to backend during development
module.exports = function(app) {
  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:12000',
    changeOrigin: true
  }));
};
```

### **config.js** - Application Configuration:
- API endpoints
- Feature flags
- Environment-specific settings

### **index.css** - Global Styles:
- Global CSS reset
- Ant Design theme customizations
- Application-wide styles

---

## 📊 CURRENT PROJECT STATUS

### ✅ **COMPLETED FEATURES**:
- ✅ Modular component architecture implemented
- ✅ Clean import/export system established
- ✅ All workspace sections created and structured
- ✅ API service layer fully functional
- ✅ Error handling utilities implemented
- ✅ Routing system configured
- ✅ File upload functionality
- ✅ Annotation tools integrated
- ✅ Project management interface
- ✅ Dataset management system

### 🔄 **CURRENTLY ACTIVE**:
- 🔄 Application running on port 12001 (frontend) and 12000 (backend)
- 🔄 All components compile successfully
- 🔄 Navigation working between all sections
- 🔄 API integration functional

### 📁 **FILE ORGANIZATION**:
```
✅ Original ProjectWorkspace.js → ProjectWorkspace.js.backup (preserved)
✅ New modular ProjectWorkspace.js → pages/project-workspace/ProjectWorkspace.js
✅ All section components → components/project-workspace/[SectionName]/
✅ Annotation components → pages/annotation/
✅ Clean export pattern implemented throughout
✅ No duplicate files remaining
```

---

## 🎯 QUICK DEVELOPMENT GUIDE

### **Adding New Workspace Section**:
1. Create folder: `components/project-workspace/NewSection/`
2. Create component: `NewSection.jsx`
3. Create export: `index.js`
4. Add to main exports: `components/project-workspace/index.js`
5. Add to menu: `pages/project-workspace/ProjectWorkspace.js`
6. Add API endpoints: `services/api.js`

### **Adding New Page**:
1. Create component: `pages/NewPage.js`
2. Add route: `App.js`
3. Add navigation: `components/Navbar.js`

### **Adding New API Endpoint**:
1. Add function to appropriate API object in `services/api.js`
2. Use consistent error handling pattern
3. Test with frontend components

### **Common Development Commands**:
```bash
# Start development
npm start

# Install new dependency
npm install package-name

# Build for production
npm run build

# Run tests
npm test
```

---

## 📚 LEARNING RESOURCES

### **Key Technologies to Understand**:
- **React 18**: Hooks, functional components, useEffect
- **React Router v6**: Modern routing patterns
- **Ant Design v5**: Component library and design system
- **Axios**: HTTP client and interceptors
- **Konva/Fabric**: Canvas manipulation for annotations

### **Architecture Concepts**:
- **Component Composition**: Building complex UIs from simple components
- **Props vs State**: When to use each for data management
- **API Integration**: Centralized service layer pattern
- **Error Boundaries**: Graceful error handling
- **Code Splitting**: Modular architecture benefits

---

## 🎉 SUMMARY

This frontend application follows **modern React best practices** with a **fully modular architecture**. The codebase is organized for:

- **Maintainability**: Clear separation of concerns
- **Scalability**: Easy to add new features and sections
- **Reusability**: Components designed for reuse
- **Developer Experience**: Consistent patterns and clear documentation

The **project workspace system** is the core feature, allowing users to manage datasets, annotations, models, and deployments through a unified interface. Each section is independently developed but shares common patterns and utilities.

**Key Strengths**:
- 🏗 **Modular Architecture**: Easy to extend and maintain
- 🔌 **Centralized API Layer**: Consistent data management
- 🎨 **Consistent UI**: Ant Design component library
- 🛡 **Error Handling**: Robust error management
- 📱 **Responsive Design**: Works across devices
- 🚀 **Performance**: Optimized React patterns

This documentation provides a complete overview of the frontend architecture and serves as a guide for future development and maintenance.