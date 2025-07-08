# Frontend Codebase Documentation

This document provides a comprehensive overview of the frontend codebase structure, detailing the purpose and functionality of each file and directory.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Core Files](#core-files)
3. [Pages](#pages)
4. [Components](#components)
   - [Annotation Toolset](#annotation-toolset)
   - [Active Learning](#active-learning)
   - [Other Components](#other-components)
5. [Services](#services)
6. [Utils](#utils)

## Project Structure

The frontend is a React application with the following high-level structure:

```
frontend/
├── public/            # Static files
├── src/               # Source code
│   ├── components/    # Reusable UI components
│   ├── pages/         # Page components (routes)
│   ├── services/      # API and service functions
│   ├── utils/         # Utility functions
│   ├── App.js         # Main application component
│   ├── config.js      # Application configuration
│   ├── index.js       # Application entry point
│   └── setupProxy.js  # Development proxy configuration
└── package.json       # Dependencies and scripts
```

## Core Files

### `src/index.js`
The entry point of the React application. It renders the App component into the DOM.

### `src/App.js`
The main application component that sets up routing and global state. It defines all the routes for the application and their corresponding components.

### `src/config.js`
Contains application-wide configuration settings, including API endpoints, feature flags, and environment-specific settings.

### `src/setupProxy.js`
Configures the development proxy to forward API requests to the backend server during development.

## Pages

### `src/pages/Dashboard.js`
The main dashboard page that users see after logging in. It provides an overview of projects, recent activities, and quick access to common tasks.

### `src/pages/Projects.js`
Displays a list of all projects with filtering and sorting options. Users can create new projects or access existing ones from this page.

### `src/pages/ProjectDetail.js`
Shows detailed information about a specific project, including its datasets, statistics, and settings. Users can manage project properties and access project-specific actions.

### `src/pages/ProjectWorkspace.js`
A full-screen workspace for project operations, including dataset management, annotation, and model training. It serves as a container for various project-related activities.

### `src/pages/ModelsModern.js`
Provides an interface for managing machine learning models, including importing, training, and evaluating models. Users can view model details and performance metrics.

### `src/pages/AnnotateLauncher.js`
Entry point for annotation tasks. It allows users to select datasets and configure annotation settings before starting the annotation process.

### `src/pages/AnnotateProgress.jsx`
Shows the progress of annotation tasks, including statistics on completed annotations, remaining images, and estimated completion time.

### `src/pages/ManualLabeling.jsx`
The main annotation interface where users can view images and create annotations using various tools. It includes the annotation canvas, toolbox, and label management.

## Components

### Annotation Toolset

#### `src/components/AnnotationToolset/AnnotationAPI.js`
A service class that handles communication with the backend for annotation operations. It provides methods for fetching, creating, updating, and deleting annotations.

#### `src/components/AnnotationToolset/AnnotationCanvas.js`
Renders the image being annotated and handles drawing annotations. It manages the canvas state, zoom, pan, and interaction with annotation shapes.

#### `src/components/AnnotationToolset/AnnotationToolbox.js`
Provides tools for creating different types of annotations (box, polygon, etc.). It includes buttons for selecting tools and configuring annotation properties.

#### `src/components/AnnotationToolset/AnnotationSplitControl.js`
Allows users to assign images to different dataset splits (train, validation, test) for machine learning purposes.

#### `src/components/AnnotationToolset/LabelSelectionPopup.js`
A modal dialog for selecting or creating labels for annotations. It appears after drawing a shape or when editing an existing annotation.

#### `src/components/AnnotationToolset/LabelSidebar.js`
A sidebar component that shows available labels and annotation statistics. Users can filter annotations by label and manage label properties.

#### `src/components/AnnotationToolset/SmartPolygonTool.js`
Implements AI-assisted polygon annotation using segmentation models. It helps users create accurate polygon annotations with fewer clicks.

#### `src/components/AnnotationToolset/index.js`
Exports all annotation toolset components for easier importing.

### Active Learning

#### `src/components/ActiveLearning/ActiveLearningDashboard.jsx`
A dashboard for active learning workflows, where the system suggests which images to annotate next based on model uncertainty. This component is currently not used in the active application but is preserved for future use.

### Other Components

#### `src/components/Navbar.js`
The application's navigation bar, providing access to different sections of the application and user account functions.

#### `src/components/DatasetAnalytics.js`
Provides analytics and statistics for datasets, including image counts, label distributions, and annotation progress. This component is currently not used in the active application but is preserved for future use.

#### `src/components/DataAugmentation.js`
Implements data augmentation features for creating variations of images to improve model training. This component is currently not used in the active application but is preserved for future use.

## Services

### `src/services/api.js`
Centralizes API calls to the backend with error handling and response processing. It includes methods for interacting with projects, datasets, models, and annotations.

## Utils

### `src/utils/errorHandler.js`
Provides utility functions for handling and displaying errors consistently throughout the application.

## Workflow Overview

The application follows a project-centric workflow:

1. Users create projects for their annotation tasks
2. Within projects, users manage datasets of images
3. Users can annotate images manually or use auto-labeling with ML models
4. Annotations can be exported in various formats for use in training ML models
5. The application provides analytics and management tools for tracking progress

The annotation system supports various annotation types (bounding boxes, polygons, etc.) and includes AI-assisted annotation features to improve efficiency.

## Development Notes

- The application has moved from a dataset-centric approach to a project-centric approach, where datasets are managed within projects.
- Some components (DatasetAnalytics.js, DataAugmentation.js, ActiveLearningDashboard.jsx) are preserved for future use but are not currently active in the application.
- The annotation system is designed to be extensible, allowing for new annotation types and tools to be added.