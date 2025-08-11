# Frontend Structure Documentation

This document outlines the organization of the frontend codebase, focusing on the main workflows and component relationships.

## Directory Structure

```
frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── AnnotationToolset/  # Components for annotation interface
│   │   ├── project-workspace/  # Components for project workspace
│   ├── pages/              # Main application pages
│   │   ├── annotation/     # Annotation workflow pages
│   │   ├── project-workspace/ # Project workspace pages
│   ├── services/           # API and service functions
│   ├── utils/              # Utility functions
│   ├── App.js              # Main application component
```

## Main Workflows

### Project Management Workflow

1. **Dashboard** (`/pages/Dashboard.js`)
   - Entry point to the application
   - Shows overview of projects and recent activity

2. **Projects** (`/pages/Projects.js`)
   - Lists all projects
   - Allows creating new projects

3. **Project Detail** (`/pages/ProjectDetail.js`)
   - Shows detailed information about a specific project
   - Links to Project Workspace

4. **Project Workspace** (`/pages/ProjectWorkspace.js`)
   - Main interface for working with a project
   - Contains multiple sections:
     - Upload: For uploading images
     - Management: For managing datasets and annotation workflow
     - Dataset: For viewing and managing completed datasets
     - Models: For training and managing ML models
     - Visualize: For visualizing project data
     - Deployments: For deploying models
     - Active Learning: For active learning workflows

### Annotation Workflow

The annotation workflow is initiated from the Project Workspace's Management section:

1. **Annotate Launcher** (`/pages/AnnotateLauncher.js`)
   - Entry point for annotation tasks
   - Allows selecting annotation method and settings

2. **Annotate Progress** (`/pages/AnnotateProgress.jsx`)
   - Shows progress of annotation tasks
   - Provides statistics and management tools

3. **Manual Labeling** (`/pages/ManualLabeling.jsx`)
   - Main annotation interface
   - Uses components from `/components/AnnotationToolset/`

## Component Relationships

### Project Workspace

The Project Workspace (`ProjectWorkspace.js`) is a large component that contains multiple sections rendered conditionally based on the selected tab. Each section could potentially be extracted into its own component:

- `renderUploadContent()`: Upload section
- `renderManagementContent()`: Management section
- `renderDatasetContent()`: Dataset section
- `renderVersionsContent()`: Versions section
- `renderModelsContent()`: Models section
- `renderVisualizeContent()`: Visualization section
- `renderDeploymentsContent()`: Deployments section
- `renderActiveLearningContent()`: Active Learning section

### Annotation Components

The annotation interface uses several specialized components:

- `AnnotationCanvas`: Main drawing area for annotations
- `AnnotationToolbox`: Tools for creating and editing annotations
- `LabelSelectionPopup`: Popup for selecting labels
- `LabelSidebar`: Sidebar showing available labels
- `AnnotationSplitControl`: Controls for assigning images to train/val/test splits

## Navigation Flow

1. User starts at Dashboard
2. Navigates to Projects list
3. Selects or creates a Project
4. Views Project Detail
5. Enters Project Workspace
6. In the Management section, selects a dataset for annotation
7. Launches annotation process via Annotate Launcher
8. Views annotation progress in Annotate Progress
9. Performs annotation in Manual Labeling interface

## Future Refactoring Opportunities

1. **Extract Project Workspace Sections**: Each section in ProjectWorkspace.js could be extracted into its own component file.

2. **Create Feature-Based Folders**: Organize components by feature (annotation, dataset management, model training, etc.).

3. **Implement Lazy Loading**: Use React.lazy and Suspense for code-splitting to improve performance.

4. **Standardize Component Props**: Ensure consistent prop naming and documentation across components.

5. **Add TypeScript**: Consider migrating to TypeScript for better type safety and developer experience.# Frontend Structure Documentation

This document outlines the organization of the frontend codebase, focusing on the main workflows and component relationships.

## Directory Structure

```
frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── AnnotationToolset/  # Components for annotation interface
│   │   ├── project-workspace/  # Components for project workspace
│   ├── pages/              # Main application pages
│   │   ├── annotation/     # Annotation workflow pages
│   │   ├── project-workspace/ # Project workspace pages
│   ├── services/           # API and service functions
│   ├── utils/              # Utility functions
│   ├── App.js              # Main application component
```

## Main Workflows

### Project Management Workflow

1. **Dashboard** (`/pages/Dashboard.js`)
   - Entry point to the application
   - Shows overview of projects and recent activity

2. **Projects** (`/pages/Projects.js`)
   - Lists all projects
   - Allows creating new projects

3. **Project Detail** (`/pages/ProjectDetail.js`)
   - Shows detailed information about a specific project
   - Links to Project Workspace

4. **Project Workspace** (`/pages/ProjectWorkspace.js`)
   - Main interface for working with a project
   - Contains multiple sections:
     - Upload: For uploading images
     - Management: For managing datasets and annotation workflow
     - Dataset: For viewing and managing completed datasets
     - Models: For training and managing ML models
     - Visualize: For visualizing project data
     - Deployments: For deploying models
     - Active Learning: For active learning workflows

### Annotation Workflow

The annotation workflow is initiated from the Project Workspace's Management section:

1. **Annotate Launcher** (`/pages/AnnotateLauncher.js`)
   - Entry point for annotation tasks
   - Allows selecting annotation method and settings

2. **Annotate Progress** (`/pages/AnnotateProgress.jsx`)
   - Shows progress of annotation tasks
   - Provides statistics and management tools

3. **Manual Labeling** (`/pages/ManualLabeling.jsx`)
   - Main annotation interface
   - Uses components from `/components/AnnotationToolset/`

## Component Relationships

### Project Workspace

The Project Workspace (`ProjectWorkspace.js`) is a large component that contains multiple sections rendered conditionally based on the selected tab. Each section could potentially be extracted into its own component:

- `renderUploadContent()`: Upload section
- `renderManagementContent()`: Management section
- `renderDatasetContent()`: Dataset section
- `renderVersionsContent()`: Versions section
- `renderModelsContent()`: Models section
- `renderVisualizeContent()`: Visualization section
- `renderDeploymentsContent()`: Deployments section
- `renderActiveLearningContent()`: Active Learning section

### Annotation Components

The annotation interface uses several specialized components:

- `AnnotationCanvas`: Main drawing area for annotations
- `AnnotationToolbox`: Tools for creating and editing annotations
- `LabelSelectionPopup`: Popup for selecting labels
- `LabelSidebar`: Sidebar showing available labels
- `AnnotationSplitControl`: Controls for assigning images to train/val/test splits

## Navigation Flow

1. User starts at Dashboard
2. Navigates to Projects list
3. Selects or creates a Project
4. Views Project Detail
5. Enters Project Workspace
6. In the Management section, selects a dataset for annotation
7. Launches annotation process via Annotate Launcher
8. Views annotation progress in Annotate Progress
9. Performs annotation in Manual Labeling interface

## Future Refactoring Opportunities

1. **Extract Project Workspace Sections**: Each section in ProjectWorkspace.js could be extracted into its own component file.

2. **Create Feature-Based Folders**: Organize components by feature (annotation, dataset management, model training, etc.).

3. **Implement Lazy Loading**: Use React.lazy and Suspense for code-splitting to improve performance.

4. **Standardize Component Props**: Ensure consistent prop naming and documentation across components.

5. **Add TypeScript**: Consider migrating to TypeScript for better type safety and developer experience.