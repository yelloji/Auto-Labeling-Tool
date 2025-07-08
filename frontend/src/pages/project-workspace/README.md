# Project Workspace

This directory contains components related to the project workspace in the application.

## Overview

The Project Workspace is the main interface for working with a project. It provides access to various features including:

- Uploading images
- Managing datasets
- Viewing and analyzing data
- Training and managing models
- Deploying models
- Active learning workflows

## Main Component

### ProjectWorkspace.js

The main component that renders the project workspace interface. It contains:

- A sidebar navigation menu
- Multiple content sections rendered based on the selected menu item
- State management for the entire workspace

## Sections

The ProjectWorkspace component renders different sections based on the selected menu item:

1. **Upload Section** (`renderUploadContent()`)
   - Interface for uploading images to the project
   - Supports file and folder uploads
   - Shows recently uploaded images

2. **Management Section** (`renderManagementContent()`)
   - Main interface for managing datasets
   - Divided into three subsections:
     - **Unassigned**: Newly uploaded datasets
     - **Annotating**: Datasets currently being annotated
     - **Dataset**: Completed datasets

3. **Dataset Section** (`renderDatasetContent()`)
   - Shows detailed information about datasets
   - Provides tools for dataset management

4. **Versions Section** (`renderVersionsContent()`)
   - Shows version history of the project
   - Allows managing different versions

5. **Models Section** (`renderModelsContent()`)
   - Interface for training and managing ML models
   - Shows model performance metrics

6. **Visualize Section** (`renderVisualizeContent()`)
   - Tools for visualizing project data
   - Shows statistics and charts

7. **Deployments Section** (`renderDeploymentsContent()`)
   - Interface for deploying models
   - Shows deployment status and metrics

8. **Active Learning Section** (`renderActiveLearningContent()`)
   - Tools for active learning workflows
   - Shows active learning metrics and progress

## Workflow Integration

The Project Workspace integrates with other workflows in the application:

- **Annotation Workflow**: Initiated from the Management section
  - User clicks on a dataset in the "Annotating" section
  - System navigates to the Annotation Launcher

- **Model Training Workflow**: Initiated from the Models section
  - User configures and starts model training
  - System shows training progress and results

- **Export Workflow**: Available in multiple sections
  - User can export datasets, annotations, or models
  - System generates and provides download links

## API Integration

The Project Workspace interacts with several API endpoints:

- `/api/v1/projects/{projectId}`: Get project information
- `/api/v1/projects/{projectId}/management`: Get management data
- `/api/v1/projects/{projectId}/images`: Get project images
- `/api/v1/projects/{projectId}/datasets`: Manage project datasets

## Refactoring Opportunities

The ProjectWorkspace.js file is quite large and could benefit from refactoring:

1. **Extract Sections**: Each section could be extracted into its own component
2. **Extract Shared Components**: Common components like DatasetCard could be extracted
3. **Custom Hooks**: API calls and state management could be moved to custom hooks
4. **Context API**: Consider using React Context for state management

See the `REFACTORING_PLAN.md` file for a detailed refactoring plan.