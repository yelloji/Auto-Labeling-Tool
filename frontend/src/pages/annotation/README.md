# Annotation Workflow

This directory contains components related to the annotation workflow in the application.

## Workflow Overview

The annotation process follows these steps:

1. **Project Workspace** → **Management Section** → **Annotating Section**
   - User selects a dataset to annotate from the Management section in Project Workspace
   - Clicking on a dataset in the "Annotating" section launches the annotation process

2. **Annotate Launcher** (`AnnotateLauncher.js`)
   - Entry point for annotation tasks
   - Shows dataset information and annotation options
   - User can choose between manual annotation or assisted annotation
   - User clicks "Start Annotating" to begin

3. **Annotate Progress** (`AnnotateProgress.jsx`)
   - Shows progress of annotation tasks
   - Displays statistics about completed annotations
   - Provides management tools for the annotation process
   - User can continue annotation from here

4. **Manual Labeling** (`ManualLabeling.jsx`)
   - Main annotation interface
   - Provides tools for creating and editing annotations
   - Allows assigning images to train/val/test splits
   - User can navigate between images and save annotations

## Component Relationships

- **ProjectWorkspace.js** → Calls `handleStartAnnotating(dataset)` → Navigates to `/annotate-launcher/${dataset.id}`
- **AnnotateLauncher.js** → Navigates to `/annotate-progress/${datasetId}` or `/annotate/${datasetId}`
- **AnnotateProgress.jsx** → Navigates to `/annotate/${datasetId}?imageId=${imageId}`
- **ManualLabeling.jsx** → Main annotation interface, uses components from `/components/AnnotationToolset/`

## Key Components

### AnnotateLauncher.js
- Entry point for annotation tasks
- Shows dataset information and annotation options
- Allows selecting annotation method

### AnnotateProgress.jsx
- Shows progress of annotation tasks
- Displays statistics and management tools
- Allows continuing annotation

### ManualLabeling.jsx
- Main annotation interface
- Uses components from `/components/AnnotationToolset/`:
  - `AnnotationCanvas`: Main drawing area for annotations
  - `AnnotationToolbox`: Tools for creating and editing annotations
  - `LabelSelectionPopup`: Popup for selecting labels
  - `LabelSidebar`: Sidebar showing available labels
  - `AnnotationSplitControl`: Controls for assigning images to train/val/test splits

## API Integration

The annotation workflow interacts with several API endpoints:

- `/api/v1/datasets/{datasetId}`: Get dataset information
- `/api/v1/datasets/{datasetId}/images`: Get images for annotation
- `/api/v1/images/{imageId}/annotations`: Get/save annotations for an image
- `/api/v1/datasets/{datasetId}/stats`: Get annotation statistics

## Future Improvements

1. **Component Extraction**: Extract smaller components from the large annotation files
2. **State Management**: Implement better state management for annotation data
3. **Performance Optimization**: Optimize rendering and data loading
4. **Keyboard Shortcuts**: Add keyboard shortcuts for common annotation actions
5. **Offline Support**: Add offline support for annotation tasks