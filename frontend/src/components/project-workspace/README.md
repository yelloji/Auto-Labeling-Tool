# Project Workspace Components

This directory contains components extracted from the ProjectWorkspace.js file. Each component represents a section of the Project Workspace interface.

## Component Structure

### UploadSection
- **Purpose**: Interface for uploading images to the project
- **Source**: Extracted from `renderUploadContent()` in ProjectWorkspace.js
- **Files**:
  - `index.js`: Main component

### ManagementSection
- **Purpose**: Interface for managing datasets
- **Source**: Extracted from `renderManagementContent()` in ProjectWorkspace.js
- **Files**:
  - `index.js`: Main component
  - `DatasetCard.js`: Card component for displaying dataset information

## Usage

These components are designed to be used in the ProjectWorkspace.js file as replacements for the render functions:

```jsx
// Before
const renderContent = () => {
  switch (selectedKey) {
    case 'upload':
      return renderUploadContent();
    case 'management':
      return renderManagementContent();
    // ...
  }
};

// After
const renderContent = () => {
  switch (selectedKey) {
    case 'upload':
      return <UploadSection 
        batchName={batchName}
        setBatchName={setBatchName}
        tags={tags}
        setTags={setTags}
        handleFileSelect={handleFileSelect}
        handleFolderSelect={handleFolderSelect}
        uploadProps={uploadProps}
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        uploading={uploading}
        uploadProgress={uploadProgress}
        availableDatasets={availableDatasets}
        recentImages={recentImages}
      />;
    case 'management':
      return <ManagementSection 
        loadingManagement={loadingManagement}
        unassignedDatasets={unassignedDatasets}
        annotatingDatasets={annotatingDatasets}
        completedDatasets={completedDatasets}
        onDatasetClick={handleDatasetClick}
        onRenameDataset={handleRenameDataset}
        onMoveToUnassigned={handleMoveToUnassigned}
        onMoveToAnnotating={handleMoveToAnnotating}
        onMoveToDataset={handleMoveToDataset}
        onDeleteDataset={handleDeleteDataset}
        onCreateDataset={handleCreateDataset}
      />;
    // ...
  }
};
```

## Component Props

### UploadSection Props
- `batchName`: Current batch name
- `setBatchName`: Function to update batch name
- `tags`: Selected tags
- `setTags`: Function to update tags
- `handleFileSelect`: Function to handle file selection
- `handleFolderSelect`: Function to handle folder selection
- `uploadProps`: Props for the Upload component
- `fileInputRef`: Ref for the file input
- `folderInputRef`: Ref for the folder input
- `uploading`: Boolean indicating if upload is in progress
- `uploadProgress`: Upload progress percentage
- `availableDatasets`: List of available datasets
- `recentImages`: List of recently uploaded images

### ManagementSection Props
- `loadingManagement`: Boolean indicating if management data is loading
- `unassignedDatasets`: List of unassigned datasets
- `annotatingDatasets`: List of datasets in annotation
- `completedDatasets`: List of completed datasets
- `onDatasetClick`: Function to handle dataset click
- `onRenameDataset`: Function to handle dataset rename
- `onMoveToUnassigned`: Function to move dataset to unassigned
- `onMoveToAnnotating`: Function to move dataset to annotating
- `onMoveToDataset`: Function to move dataset to completed
- `onDeleteDataset`: Function to delete dataset
- `onCreateDataset`: Function to create new dataset

### DatasetCard Props
- `dataset`: Dataset object
- `status`: Dataset status (unassigned, annotating, completed)
- `onClick`: Function to handle card click
- `onRename`: Function to handle dataset rename
- `onMoveToUnassigned`: Function to move dataset to unassigned
- `onMoveToAnnotating`: Function to move dataset to annotating
- `onMoveToDataset`: Function to move dataset to completed
- `onDelete`: Function to delete dataset