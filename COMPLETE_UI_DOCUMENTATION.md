# 🏷️ Auto-Labeling Tool - COMPLETE UI Documentation

**This document provides 100% accurate mapping of every UI component to its backend implementation and database impact.**

---

## 📋 Table of Contents

1. [Dashboard](#dashboard)
2. [Projects Page](#projects-page)
3. [Project Workspace](#project-workspace)
4. [Annotate Launcher](#annotate-launcher)
5. [Annotate Progress](#annotate-progress)
6. [Manual Labeling Interface](#manual-labeling-interface)
7. [Models Management](#models-management)
8. [Datasets Overview](#datasets-overview)
9. [Shared Components](#shared-components)
10. [Critical Issues & Fixes](#critical-issues--fixes)

---

## 🏠 Dashboard

### 🔍 1. Page Overview
**File:** `src/pages/Dashboard.js`  
**Purpose:** Landing page with system overview and quick access to projects

### 🧩 2. UI Components

#### Stats Cards Section
- **Component:** Project Statistics Display
- **Location:** `Dashboard.js` lines 45-85
- **Description:** Shows total counts for projects, datasets, images
- **Backend:** `GET /api/v1/projects/stats`
- **Function:** `api/routes/projects.py` → `get_project_stats()`
- **Database:** 
  ```sql
  SELECT COUNT(*) FROM projects;
  SELECT COUNT(*) FROM datasets;
  SELECT COUNT(*) FROM images;
  ```
- **Triggers:** Page load
- **Updates:** Real-time counters

#### Recent Projects Grid
- **Component:** RecentProjectsList
- **Location:** `Dashboard.js` lines 90-140
- **Description:** Last 6 accessed projects with thumbnails
- **Backend:** `GET /api/v1/projects/?limit=6&sort=updated_at`
- **Function:** `api/routes/projects.py` → `get_projects()`
- **Database:** 
  ```sql
  SELECT * FROM projects ORDER BY updated_at DESC LIMIT 6;
  ```
- **Triggers:** Page load
- **Updates:** Project grid display

#### Quick Actions Panel
- **Component:** QuickActionsPanel
- **Location:** `Dashboard.js` lines 145-180
- **Description:** Create project, upload data, run models buttons
- **Backend:** Various endpoints
- **Function:** Multiple functions
- **Database:** Various tables
- **Triggers:** Button clicks
- **Updates:** Navigation or modal opening

### 🔄 3. Data Flow
```
Dashboard Load → API calls → Database queries → UI updates
User clicks → Navigation or modal → Action execution
```

### 🔧 4. Known Issues
- ❌ Stats not real-time
- ❌ Project thumbnails missing

---

## 📁 Projects Page

### 🔍 1. Page Overview
**File:** `src/pages/Projects.js`  
**Purpose:** Complete project management interface

### 🧩 2. UI Components

#### Create Project Button
- **Component:** CreateProjectButton
- **Location:** `Projects.js` lines 25-40
- **Description:** Opens modal for new project creation
- **Backend:** None (opens modal)
- **Function:** N/A
- **Database:** None
- **Triggers:** Button click
- **Updates:** Opens CreateProjectModal

#### Create Project Modal
- **Component:** CreateProjectModal
- **Location:** `Projects.js` lines 180-280
- **Description:** Form with name, description, type fields
- **Backend:** `POST /api/v1/projects/`
- **Function:** `api/routes/projects.py` → `create_project()`
- **Database:** 
  ```sql
  INSERT INTO projects (id, name, description, project_type, created_at, updated_at)
  VALUES (uuid, name, description, type, now(), now());
  ```
- **File System:** Creates `uploads/projects/{name}/` folders
- **Triggers:** Form submission
- **Updates:** Closes modal, refreshes project list

#### Project Search Bar
- **Component:** ProjectSearchBar
- **Location:** `Projects.js` lines 45-65
- **Description:** Real-time search through project names
- **Backend:** `GET /api/v1/projects/?search={query}`
- **Function:** `api/routes/projects.py` → `get_projects()` with search
- **Database:** 
  ```sql
  SELECT * FROM projects WHERE name ILIKE '%{query}%' OR description ILIKE '%{query}%';
  ```
- **Triggers:** Text input (debounced 300ms)
- **Updates:** Filters project grid

#### Project Type Filter
- **Component:** ProjectTypeFilter
- **Location:** `Projects.js` lines 70-90
- **Description:** Dropdown to filter by Object Detection, Classification, etc.
- **Backend:** `GET /api/v1/projects/?project_type={type}`
- **Function:** `api/routes/projects.py` → `get_projects()` with filter
- **Database:** 
  ```sql
  SELECT * FROM projects WHERE project_type = '{type}';
  ```
- **Triggers:** Dropdown selection
- **Updates:** Filters project grid

#### Projects Grid
- **Component:** ProjectsGrid
- **Location:** `Projects.js` lines 95-200
- **Description:** Card layout showing all projects
- **Backend:** `GET /api/v1/projects/?skip=0&limit=100`
- **Function:** `api/routes/projects.py` → `get_projects()`
- **Database:** 
  ```sql
  SELECT * FROM projects ORDER BY updated_at DESC LIMIT 100 OFFSET 0;
  ```
- **Triggers:** Page load, search, filter changes
- **Updates:** Project cards display

#### Project Card Actions
- **Component:** ProjectCardActions (per card)
- **Location:** `Projects.js` lines 205-280
- **Description:** Edit, Delete, Duplicate dropdown menu

##### Edit Project
- **Backend:** `PUT /api/v1/projects/{id}`
- **Function:** `api/routes/projects.py` → `update_project()`
- **Database:** 
  ```sql
  UPDATE projects SET name=?, description=?, updated_at=now() WHERE id=?;
  ```
- **Triggers:** Edit menu item click
- **Updates:** Project card data

##### Delete Project
- **Backend:** `DELETE /api/v1/projects/{id}`
- **Function:** `api/routes/projects.py` → `delete_project()`
- **Database:** 
  ```sql
  DELETE FROM annotations WHERE image_id IN (SELECT id FROM images WHERE dataset_id IN (SELECT id FROM datasets WHERE project_id=?));
  DELETE FROM images WHERE dataset_id IN (SELECT id FROM datasets WHERE project_id=?);
  DELETE FROM datasets WHERE project_id=?;
  DELETE FROM projects WHERE id=?;
  ```
- **File System:** Removes `uploads/projects/{name}/` folder
- **Triggers:** Delete confirmation
- **Updates:** Removes card from grid

##### Duplicate Project
- **Backend:** `POST /api/v1/projects/{id}/duplicate`
- **Function:** `api/routes/projects.py` → `duplicate_project()`
- **Database:** 
  ```sql
  INSERT INTO projects (name, description, project_type) VALUES ('{name}_copy', description, project_type);
  -- Copies all datasets, images, annotations
  ```
- **File System:** Copies entire project folder
- **Triggers:** Duplicate menu item click
- **Updates:** Adds new card to grid

### 🔄 3. Data Flow
```
Page Load → GET /api/v1/projects/ → Display grid
Search → GET /api/v1/projects/?search={query} → Filter results
Create → POST /api/v1/projects/ → Insert DB + Create folders → Refresh grid
Edit → PUT /api/v1/projects/{id} → Update DB → Refresh card
Delete → DELETE /api/v1/projects/{id} → Cascade delete + Remove folders → Remove card
```

### 🔧 4. Known Issues
- ❌ No bulk operations
- ❌ Limited sorting options
- ❌ No project templates

---

## 🏗️ Project Workspace

### 🔍 1. Page Overview
**File:** `src/pages/ProjectWorkspace.js`  
**Purpose:** Main project interface with dataset management in three stages

### 🧩 2. UI Components

#### Project Header
- **Component:** ProjectHeader
- **Location:** `ProjectWorkspace.js` lines 40-80
- **Description:** Project name, description, stats overview
- **Backend:** `GET /api/v1/projects/{id}`
- **Function:** `api/routes/projects.py` → `get_project()`
- **Database:** 
  ```sql
  SELECT * FROM projects WHERE id = ?;
  ```
- **Triggers:** Page load
- **Updates:** Header information display

#### Upload Images Button
- **Component:** UploadImagesButton
- **Location:** `ProjectWorkspace.js` lines 85-110
- **Description:** File picker for bulk image upload
- **Backend:** `POST /api/v1/projects/{id}/upload-bulk`
- **Function:** `api/routes/projects.py` → `upload_multiple_images_to_project()`
- **Database:** 
  ```sql
  INSERT INTO datasets (id, project_id, name, created_at, updated_at);
  INSERT INTO images (id, dataset_id, filename, file_path, split_type, width, height, file_size, created_at, updated_at);
  ```
- **File System:** Saves files to `uploads/projects/{project_name}/unassigned/{batch_name}/`
- **Triggers:** File selection and upload
- **Updates:** Refreshes workspace tabs

#### Batch Name Input
- **Component:** BatchNameInput
- **Location:** `ProjectWorkspace.js` lines 115-130
- **Description:** Text input for naming uploaded dataset
- **Backend:** Part of upload request
- **Function:** Used in `upload_multiple_images_to_project()`
- **Database:** Sets `datasets.name` field
- **Triggers:** Text input during upload
- **Updates:** Dataset name in database

#### Dataset Management Tabs
- **Component:** DatasetManagementTabs
- **Location:** `ProjectWorkspace.js` lines 135-180
- **Description:** Three-tab interface for dataset stages
- **Backend:** `GET /api/v1/projects/{id}/management`
- **Function:** `api/routes/projects.py` → `get_project_management()`
- **Database:** 
  ```sql
  SELECT d.*, COUNT(i.id) as total_images, COUNT(CASE WHEN i.is_labeled THEN 1 END) as labeled_images
  FROM datasets d LEFT JOIN images i ON d.id = i.dataset_id 
  WHERE d.project_id = ? GROUP BY d.id;
  ```
- **File System:** Checks folder existence in unassigned/, annotating/, dataset/
- **Triggers:** Page load, tab switches
- **Updates:** Categorizes datasets by physical location

##### Unassigned Tab
- **Component:** UnassignedDatasets
- **Location:** `ProjectWorkspace.js` lines 185-230
- **Description:** Datasets not yet assigned for annotation
- **Backend:** Part of management endpoint
- **Function:** Categorized in `get_project_management()`
- **Database:** Datasets where files exist in unassigned/ folder
- **Triggers:** Tab selection
- **Updates:** Shows datasets with "Start Annotating" buttons

##### Annotating Tab
- **Component:** AnnotatingDatasets
- **Location:** `ProjectWorkspace.js` lines 235-280
- **Description:** Datasets currently being annotated
- **Backend:** Part of management endpoint
- **Function:** Categorized in `get_project_management()`
- **Database:** Datasets where files exist in annotating/ folder
- **Triggers:** Tab selection
- **Updates:** Shows datasets with progress and "Continue" buttons

##### Completed Tab
- **Component:** CompletedDatasets
- **Location:** `ProjectWorkspace.js` lines 285-330
- **Description:** Fully annotated datasets ready for export
- **Backend:** Part of management endpoint
- **Function:** Categorized in `get_project_management()`
- **Database:** Datasets where files exist in dataset/ folder OR all images labeled
- **Triggers:** Tab selection
- **Updates:** Shows datasets with export options

#### Dataset Action Buttons

##### Start Annotating Button
- **Component:** StartAnnotatingButton
- **Location:** `ProjectWorkspace.js` lines 335-355
- **Description:** Moves dataset from unassigned to annotating
- **Backend:** `POST /api/v1/projects/{project_id}/datasets/{dataset_id}/move-to-annotating`
- **Function:** `api/routes/projects.py` → `move_dataset_to_annotating()`
- **Database:** 
  ```sql
  UPDATE images SET file_path = ?, split_type = 'annotating', updated_at = now() 
  WHERE dataset_id = ?;
  ```
- **File System:** `shutil.move(unassigned_folder, annotating_folder)`
- **Triggers:** Button click
- **Updates:** **🚨 ISSUE: Creates duplicate entries instead of updating**

##### Move to Completed Button
- **Component:** MoveToCompletedButton
- **Location:** `ProjectWorkspace.js` lines 360-380
- **Description:** Moves dataset from annotating to completed
- **Backend:** `POST /api/v1/projects/{project_id}/datasets/{dataset_id}/move-to-completed`
- **Function:** `api/routes/projects.py` → `move_dataset_to_completed()`
- **Database:** 
  ```sql
  UPDATE images SET file_path = ?, split_type = 'completed', updated_at = now() 
  WHERE dataset_id = ?;
  ```
- **File System:** `shutil.move(annotating_folder, dataset_folder)`
- **Triggers:** Button click
- **Updates:** **🚨 ISSUE: Same duplication problem**

##### Delete Dataset Button
- **Component:** DeleteDatasetButton
- **Location:** `ProjectWorkspace.js` lines 385-405
- **Description:** Permanently removes dataset and all data
- **Backend:** `DELETE /api/v1/projects/{project_id}/datasets/{dataset_id}`
- **Function:** `api/routes/projects.py` → `delete_dataset()`
- **Database:** 
  ```sql
  DELETE FROM annotations WHERE image_id IN (SELECT id FROM images WHERE dataset_id = ?);
  DELETE FROM images WHERE dataset_id = ?;
  DELETE FROM datasets WHERE id = ?;
  ```
- **File System:** Removes dataset folder completely
- **Triggers:** Delete confirmation
- **Updates:** Removes dataset from workspace

#### Continue Annotation Button
- **Component:** ContinueAnnotationButton
- **Location:** `ProjectWorkspace.js` lines 410-430
- **Description:** Opens annotation interface for dataset
- **Backend:** None (navigation)
- **Function:** N/A
- **Database:** None
- **Triggers:** Button click
- **Updates:** Navigates to `/annotate-launcher/{dataset_id}`

### 🔄 3. Data Flow
```
Page Load → GET /api/v1/projects/{id} → Display project info
Page Load → GET /api/v1/projects/{id}/management → Categorize datasets
Upload → POST /api/v1/projects/{id}/upload-bulk → Create dataset + images → Refresh tabs
Move Dataset → POST /api/.../move-to-{status} → Update paths + move files → Refresh categorization
Delete → DELETE /api/.../datasets/{id} → Remove from DB + files → Refresh tabs
```

### 🔧 4. Known Issues
- ❌ **CRITICAL:** Dataset movement creates duplicate database entries
- ❌ **CRITICAL:** Path updates use fragile string replacement
- ❌ No progress indicators during operations
- ❌ No undo functionality

---

## 🚀 Annotate Launcher

### 🔍 1. Page Overview
**File:** `src/pages/AnnotateLauncher.js`  
**Purpose:** Configuration page before starting annotation session

### 🧩 2. UI Components

#### Dataset Information Panel
- **Component:** DatasetInfoPanel
- **Location:** `AnnotateLauncher.js` lines 30-80
- **Description:** Shows dataset name, image count, progress
- **Backend:** `GET /api/v1/datasets/{id}`
- **Function:** `api/routes/datasets.py` → `get_dataset()`
- **Database:** 
  ```sql
  SELECT d.*, COUNT(i.id) as total_images, COUNT(CASE WHEN i.is_labeled THEN 1 END) as labeled_images
  FROM datasets d LEFT JOIN images i ON d.id = i.dataset_id WHERE d.id = ? GROUP BY d.id;
  ```
- **Triggers:** Page load
- **Updates:** Dataset overview display

#### Annotation Mode Selection
- **Component:** AnnotationModeSelector
- **Location:** `AnnotateLauncher.js` lines 85-120
- **Description:** Radio buttons for Manual vs Auto-assisted annotation
- **Backend:** None (frontend state)
- **Function:** N/A
- **Database:** None
- **Triggers:** Radio button selection
- **Updates:** Changes available options

#### Model Selection Dropdown
- **Component:** ModelSelectionDropdown
- **Location:** `AnnotateLauncher.js` lines 125-155
- **Description:** Choose AI model for smart annotation
- **Backend:** `GET /api/v1/models/`
- **Function:** `api/routes/models.py` → `get_models()`
- **Database:** 
  ```sql
  SELECT * FROM models WHERE is_active = true;
  ```
- **Triggers:** Dropdown open
- **Updates:** Populates model options

#### Confidence Threshold Slider
- **Component:** ConfidenceThresholdSlider
- **Location:** `AnnotateLauncher.js` lines 160-180
- **Description:** Set minimum confidence for auto-annotations
- **Backend:** None (passed to annotation session)
- **Function:** Used in auto-labeling
- **Database:** None (session parameter)
- **Triggers:** Slider movement
- **Updates:** Threshold value display

#### Launch Annotation Button
- **Component:** LaunchAnnotationButton
- **Location:** `AnnotateLauncher.js` lines 185-210
- **Description:** Starts annotation with selected configuration
- **Backend:** 
  - Manual: None (navigation)
  - Auto: `POST /api/v1/datasets/{id}/auto-label`
- **Function:** 
  - Manual: N/A
  - Auto: `api/routes/datasets.py` → `start_auto_labeling()`
- **Database:** 
  - Manual: None
  - Auto: Creates annotations in `annotations` table
- **Triggers:** Button click
- **Updates:** Navigation to annotation interface

### 🔄 3. Data Flow
```
Page Load → GET /api/v1/datasets/{id} → Display info
Page Load → GET /api/v1/models/ → Populate dropdown
Launch Manual → Navigate to /annotate/{dataset_id}/manual
Launch Auto → POST /api/v1/datasets/{id}/auto-label → Generate annotations → Navigate to progress
```

### 🔧 4. Known Issues
- ❌ Model loading status not shown
- ❌ No preview of auto-labeling
- ❌ Configuration not persisted

---

## 📊 Annotate Progress

### 🔍 1. Page Overview
**File:** `src/pages/AnnotateProgress.jsx`  
**Purpose:** Real-time annotation progress tracking and navigation

### 🧩 2. UI Components

#### Progress Header
- **Component:** ProgressHeader
- **Location:** `AnnotateProgress.jsx` lines 25-60
- **Description:** Dataset name and completion percentage
- **Backend:** `GET /api/v1/datasets/{id}/progress`
- **Function:** `api/routes/datasets.py` → `get_dataset_progress()`
- **Database:** 
  ```sql
  SELECT COUNT(*) as total, COUNT(CASE WHEN is_labeled THEN 1 END) as labeled
  FROM images WHERE dataset_id = ?;
  ```
- **Triggers:** Page load, periodic refresh
- **Updates:** Progress percentage display

#### Statistics Cards
- **Component:** ProgressStatistics
- **Location:** `AnnotateProgress.jsx` lines 65-120
- **Description:** Total, labeled, unlabeled, auto-labeled counts
- **Backend:** Part of progress endpoint
- **Function:** Calculated in `get_dataset_progress()`
- **Database:** 
  ```sql
  SELECT 
    COUNT(*) as total_images,
    COUNT(CASE WHEN is_labeled THEN 1 END) as labeled_images,
    COUNT(CASE WHEN NOT is_labeled THEN 1 END) as unlabeled_images,
    COUNT(CASE WHEN is_auto_labeled THEN 1 END) as auto_labeled_images
  FROM images WHERE dataset_id = ?;
  ```
- **Triggers:** Data refresh
- **Updates:** Statistics cards

#### Progress Bar
- **Component:** AnnotationProgressBar
- **Location:** `AnnotateProgress.jsx` lines 125-145
- **Description:** Visual progress bar with percentage
- **Backend:** Part of progress endpoint
- **Function:** Calculated percentage
- **Database:** Based on labeled/total ratio
- **Triggers:** Progress updates
- **Updates:** Progress bar fill

#### Image Grid
- **Component:** ImageProgressGrid
- **Location:** `AnnotateProgress.jsx` lines 150-220
- **Description:** Thumbnail grid with status indicators
- **Backend:** `GET /api/v1/projects/{project_id}/images?dataset_id={dataset_id}`
- **Function:** `api/routes/projects.py` → `get_project_images()`
- **Database:** 
  ```sql
  SELECT i.*, COUNT(a.id) as annotation_count
  FROM images i LEFT JOIN annotations a ON i.id = a.image_id
  WHERE i.dataset_id = ? GROUP BY i.id;
  ```
- **Triggers:** Page load
- **Updates:** Image grid with status badges

#### Image Status Indicators
- **Component:** ImageStatusIndicators
- **Location:** `AnnotateProgress.jsx` lines 225-250
- **Description:** Color-coded status badges (green=labeled, red=unlabeled)
- **Backend:** Part of images response
- **Function:** Status determined by annotation count
- **Database:** Based on `is_labeled` field and annotation existence
- **Triggers:** Image data load
- **Updates:** Status badge colors

#### Continue Annotation Button
- **Component:** ContinueAnnotationButton
- **Location:** `AnnotateProgress.jsx` lines 255-275
- **Description:** Resume annotation from next unlabeled image
- **Backend:** None (navigation with state)
- **Function:** N/A
- **Database:** None
- **Triggers:** Button click
- **Updates:** Navigates to manual annotation

#### Export Dataset Button
- **Component:** ExportDatasetButton
- **Location:** `AnnotateProgress.jsx` lines 280-300
- **Description:** Export annotations in various formats
- **Backend:** `POST /api/v1/datasets/{id}/export`
- **Function:** `api/routes/export.py` → `export_dataset()`
- **Database:** 
  ```sql
  SELECT i.*, a.* FROM images i 
  LEFT JOIN annotations a ON i.id = a.image_id 
  WHERE i.dataset_id = ?;
  ```
- **Triggers:** Export button click
- **Updates:** Downloads export file

### 🔄 3. Data Flow
```
Page Load → GET /api/v1/datasets/{id}/progress → Display statistics
Page Load → GET /api/v1/projects/{project_id}/images → Show grid
Continue → Navigate to /annotate/{dataset_id}/manual?imageId={next_unlabeled}
Export → POST /api/v1/datasets/{id}/export → Generate file → Download
```

### 🔧 4. Known Issues
- ❌ Real-time updates not implemented
- ❌ Limited export formats
- ❌ No image filtering options

---

## 🎨 Manual Labeling Interface

### 🔍 1. Page Overview
**File:** `src/pages/ManualLabeling.jsx`  
**Purpose:** Main annotation interface with drawing tools and label management

### 🧩 2. UI Components

#### Navigation Header
- **Component:** AnnotationNavigationHeader
- **Location:** `ManualLabeling.jsx` lines 40-90
- **Description:** Back button, image counter (X/Y), Previous/Next buttons
- **Backend:** None (navigation state)
- **Function:** N/A
- **Database:** None
- **Triggers:** Button clicks, keyboard shortcuts
- **Updates:** Image navigation, URL updates

#### Image Display Canvas
- **Component:** AnnotationCanvas
- **Location:** `src/components/AnnotationToolset/index.js` lines 50-200
- **Description:** Main canvas displaying image with annotation overlays
- **Backend:** Image served from uploads folder
- **Function:** Static file serving
- **Database:** Reads `images.file_path` for image location
- **Triggers:** Image load, annotation drawing
- **Updates:** Image display, annotation rendering

#### Tool Selection Panel
- **Component:** AnnotationToolbox
- **Location:** `src/components/AnnotationToolset/AnnotationToolbox.js` lines 20-150
- **Description:** Select, Box, Polygon, Smart tools

##### Select Tool
- **Component:** SelectTool
- **Location:** `AnnotationToolbox.js` lines 155-180
- **Description:** Default tool for selecting existing annotations
- **Backend:** None
- **Function:** N/A
- **Database:** None
- **Triggers:** Tool selection, annotation clicks
- **Updates:** Enables annotation manipulation

##### Box Tool
- **Component:** BoxTool
- **Location:** `AnnotationToolbox.js` lines 185-210
- **Description:** Rectangle drawing for bounding boxes
- **Backend:** None (until save)
- **Function:** N/A
- **Database:** None (until save)
- **Triggers:** Tool selection, mouse drag
- **Updates:** Draws rectangular annotations

##### Polygon Tool
- **Component:** PolygonTool
- **Location:** `AnnotationToolbox.js` lines 215-250
- **Description:** Multi-point polygon drawing
- **Backend:** None (until save)
- **Function:** N/A
- **Database:** None (until save)
- **Triggers:** Tool selection, mouse clicks
- **Updates:** **🚨 ISSUE: Not saving automatically**

##### Smart Tool
- **Component:** SmartTool
- **Location:** `AnnotationToolbox.js` lines 255-290
- **Description:** AI-assisted annotation using SAM
- **Backend:** `POST /api/v1/images/{id}/smart-annotate`
- **Function:** `api/routes/annotations.py` → `smart_annotate()`
- **Database:** May create auto-annotations
- **Triggers:** Tool selection, object click
- **Updates:** **🚨 ISSUE: Not fully implemented**

#### Zoom Controls
- **Component:** ZoomControls
- **Location:** `AnnotationToolbox.js` lines 295-330
- **Description:** Zoom in/out buttons and percentage display
- **Backend:** None
- **Function:** N/A
- **Database:** None
- **Triggers:** Zoom buttons, mouse wheel
- **Updates:** Canvas zoom level

#### Label Sidebar
- **Component:** LabelSidebar
- **Location:** `src/components/AnnotationToolset/LabelSidebar.js` lines 20-200
- **Description:** Shows available labels and current image annotations

##### Current Labels Display
- **Component:** CurrentLabelsDisplay
- **Location:** `LabelSidebar.js` lines 25-80
- **Description:** Lists annotations for current image
- **Backend:** `GET /api/v1/images/{id}/annotations`
- **Function:** `api/routes/annotations.py` → `get_image_annotations()`
- **Database:** 
  ```sql
  SELECT * FROM annotations WHERE image_id = ?;
  ```
- **Triggers:** Image load, annotation save
- **Updates:** **🚨 CRITICAL ISSUE: Shows "No labels" even when annotations exist**

##### Available Labels List
- **Component:** AvailableLabels
- **Location:** `LabelSidebar.js` lines 85-130
- **Description:** Project label classes for assignment
- **Backend:** `GET /api/v1/projects/{id}/labels`
- **Function:** `api/routes/projects.py` → `get_project_labels()`
- **Database:** 
  ```sql
  SELECT * FROM labels WHERE project_id = ?;
  ```
- **Triggers:** Page load
- **Updates:** Label options list

##### Create Label Input
- **Component:** CreateLabelInput
- **Location:** `LabelSidebar.js` lines 135-170
- **Description:** Input field to create new label classes
- **Backend:** `POST /api/v1/projects/{id}/labels`
- **Function:** `api/routes/projects.py` → `create_label()`
- **Database:** 
  ```sql
  INSERT INTO labels (id, project_id, name, color, created_at) VALUES (?, ?, ?, ?, now());
  ```
- **Triggers:** Enter key, create button
- **Updates:** Adds to available labels list

#### Label Selection Popup
- **Component:** LabelSelectionPopup
- **Location:** `src/components/AnnotationToolset/LabelSelectionPopup.js` lines 20-150
- **Description:** Modal for assigning labels to drawn annotations
- **Backend:** None (uses existing labels)
- **Function:** N/A
- **Database:** None (selection only)
- **Triggers:** **🚨 CRITICAL ISSUE: Appears immediately after drawing, blocks view of annotation**
- **Updates:** Assigns label to annotation

#### Split Type Dropdown
- **Component:** SplitTypeDropdown
- **Location:** `ManualLabeling.jsx` lines 95-120
- **Description:** Assign image to Training/Validation/Test split
- **Backend:** `PUT /api/v1/images/{id}/split`
- **Function:** `api/routes/images.py` → `update_image_split()`
- **Database:** 
  ```sql
  UPDATE images SET split_type = ?, updated_at = now() WHERE id = ?;
  ```
- **Triggers:** Dropdown selection
- **Updates:** **🚨 ISSUE: Not updating database properly**

#### Save Annotations Button
- **Component:** SaveAnnotationsButton
- **Location:** `AnnotationToolbox.js` lines 335-365
- **Description:** Saves all current annotations to database
- **Backend:** `POST /api/v1/images/{id}/annotations`
- **Function:** `api/routes/annotations.py` → `save_image_annotations()`
- **Database:** 
  ```sql
  DELETE FROM annotations WHERE image_id = ?;
  INSERT INTO annotations (id, image_id, class_name, class_id, x_min, y_min, x_max, y_max, confidence, created_at);
  UPDATE images SET is_labeled = true, updated_at = now() WHERE id = ?;
  ```
- **Triggers:** Save button, Ctrl+S
- **Updates:** **🚨 CRITICAL ISSUE: Shows "saved" but annotations don't appear in sidebar**

#### Clear Annotations Button
- **Component:** ClearAnnotationsButton
- **Location:** `AnnotationToolbox.js` lines 370-390
- **Description:** Removes all annotations from current image
- **Backend:** `DELETE /api/v1/images/{id}/annotations`
- **Function:** `api/routes/annotations.py` → `delete_all_image_annotations()`
- **Database:** 
  ```sql
  DELETE FROM annotations WHERE image_id = ?;
  UPDATE images SET is_labeled = false, updated_at = now() WHERE id = ?;
  ```
- **Triggers:** Clear button click
- **Updates:** Removes annotations from canvas and database

#### Undo/Redo Controls
- **Component:** UndoRedoControls
- **Location:** `AnnotationToolbox.js` lines 395-425
- **Description:** Undo/redo buttons for annotation history
- **Backend:** None (frontend state)
- **Function:** N/A
- **Database:** None (until save)
- **Triggers:** Undo/Redo buttons, Ctrl+Z/Ctrl+Y
- **Updates:** Reverts/reapplies annotation changes

### 🔄 3. Data Flow
```
Image Load → GET /api/v1/images/{id}/annotations → Display existing annotations
Draw Annotation → Label Selection Popup → Assign label → Add to canvas
Save → POST /api/v1/images/{id}/annotations → Delete old + Insert new → Update is_labeled
Split Change → PUT /api/v1/images/{id}/split → Update split_type
Navigation → Load next/previous image → Repeat cycle
```

### 🔧 4. Critical Issues
- ❌ **CRITICAL:** Label popup blocks view of drawn annotation
- ❌ **CRITICAL:** Saved annotations don't appear in label sidebar
- ❌ **CRITICAL:** Images not marked as "labeled" even with annotations
- ❌ **CRITICAL:** Polygon tool not saving automatically
- ❌ **CRITICAL:** Coordinates become 0 when switching tools
- ❌ **CRITICAL:** Split dropdown not updating database

---

## 🤖 Models Management

### 🔍 1. Page Overview
**File:** `src/pages/ModelsModern.js`  
**Purpose:** AI model management for auto-labeling features

### 🧩 2. UI Components

#### Models Grid
- **Component:** ModelsGrid
- **Location:** `ModelsModern.js` lines 40-150
- **Description:** Grid showing available models with status
- **Backend:** `GET /api/v1/models/`
- **Function:** `api/routes/models.py` → `get_models()`
- **Database:** 
  ```sql
  SELECT * FROM models ORDER BY created_at DESC;
  ```
- **Triggers:** Page load
- **Updates:** Model cards display

#### Add Model Button
- **Component:** AddModelButton
- **Location:** `ModelsModern.js` lines 25-35
- **Description:** Opens modal to add new model
- **Backend:** None (opens modal)
- **Function:** N/A
- **Database:** None
- **Triggers:** Button click
- **Updates:** Opens AddModelModal

#### Model Configuration Modal
- **Component:** ModelConfigurationModal
- **Location:** `ModelsModern.js` lines 155-250
- **Description:** Form for model name, type, file upload
- **Backend:** `POST /api/v1/models/`
- **Function:** `api/routes/models.py` → `create_model()`
- **Database:** 
  ```sql
  INSERT INTO models (id, name, model_type, file_path, is_active, created_at) VALUES (?, ?, ?, ?, true, now());
  ```
- **File System:** Saves model file to `models/` directory
- **Triggers:** Form submission
- **Updates:** Adds model to grid

#### Model Status Indicators
- **Component:** ModelStatusIndicators
- **Location:** `ModelsModern.js` lines 255-280
- **Description:** Shows loading, ready, error status
- **Backend:** `GET /api/v1/models/{id}/status`
- **Function:** `api/routes/models.py` → `get_model_status()`
- **Database:** Reads `models.status` field
- **Triggers:** Page load, periodic refresh
- **Updates:** Status badge colors

#### Test Model Button
- **Component:** TestModelButton
- **Location:** `ModelsModern.js` lines 285-310
- **Description:** Run inference on sample images
- **Backend:** `POST /api/v1/models/{id}/test`
- **Function:** `api/routes/models.py` → `test_model()`
- **Database:** May create test annotations
- **Triggers:** Test button click
- **Updates:** Shows test results

### 🔄 3. Data Flow
```
Page Load → GET /api/v1/models/ → Display model grid
Add Model → POST /api/v1/models/ → Save file + DB record → Refresh grid
Test Model → POST /api/v1/models/{id}/test → Run inference → Show results
```

### 🔧 4. Known Issues
- ❌ Model performance metrics missing
- ❌ Version management not implemented
- ❌ Model deployment status unclear

---

## 📊 Datasets Overview

### 🔍 1. Page Overview
**File:** `src/pages/Datasets.js`  
**Purpose:** Global view of all datasets across projects

### 🧩 2. UI Components

#### Dataset Table
- **Component:** DatasetTable
- **Location:** `Datasets.js` lines 40-200
- **Description:** Table with project, name, status, progress columns
- **Backend:** `GET /api/v1/datasets/`
- **Function:** `api/routes/datasets.py` → `get_all_datasets()`
- **Database:** 
  ```sql
  SELECT d.*, p.name as project_name, COUNT(i.id) as total_images, 
         COUNT(CASE WHEN i.is_labeled THEN 1 END) as labeled_images
  FROM datasets d 
  JOIN projects p ON d.project_id = p.id 
  LEFT JOIN images i ON d.id = i.dataset_id 
  GROUP BY d.id, p.name;
  ```
- **Triggers:** Page load
- **Updates:** Dataset table display

#### Dataset Filters
- **Component:** DatasetFilters
- **Location:** `Datasets.js` lines 25-35
- **Description:** Filter by project, status, progress
- **Backend:** `GET /api/v1/datasets/?filters={params}`
- **Function:** `get_all_datasets()` with filters
- **Database:** Filtered queries with WHERE clauses
- **Triggers:** Filter changes
- **Updates:** Table filtering

#### Export Actions
- **Component:** ExportActions
- **Location:** `Datasets.js` lines 205-250
- **Description:** Export individual or multiple datasets
- **Backend:** `POST /api/v1/datasets/export-multiple`
- **Function:** `api/routes/export.py` → `export_multiple_datasets()`
- **Database:** Reads data from multiple datasets
- **Triggers:** Export button clicks
- **Updates:** Downloads export files

### 🔄 3. Data Flow
```
Page Load → GET /api/v1/datasets/ → Display table
Apply Filters → GET /api/v1/datasets/?filters={params} → Update table
Export → POST /api/v1/datasets/export-multiple → Generate files → Download
```

### 🔧 4. Known Issues
- ❌ Limited export formats
- ❌ No bulk operations
- ❌ Dataset merging not available

---

## 🔧 Shared Components

### Navigation Bar
- **Component:** Navbar
- **Location:** `src/components/Navbar.js`
- **Description:** Top navigation with logo and menu items
- **Backend:** None
- **Database:** None
- **Triggers:** Menu clicks
- **Updates:** Page navigation

### API Service
- **Component:** API Service
- **Location:** `src/services/api.js`
- **Description:** Centralized HTTP client with error handling
- **Backend:** All endpoints
- **Database:** All operations
- **Triggers:** All API calls
- **Updates:** Handles requests/responses

### Error Handler
- **Component:** ErrorHandler
- **Location:** `src/utils/errorHandler.js`
- **Description:** Global error catching and user notifications
- **Backend:** Error responses
- **Database:** None
- **Triggers:** API errors, exceptions
- **Updates:** Error message display

---

## 🚨 Critical Issues & Fixes

### 🔴 **CRITICAL ANNOTATION ISSUES**

#### 1. Label Selection Popup Blocks View
**Problem:** Popup appears immediately after drawing, user can't see the annotation
**Location:** `LabelSelectionPopup.js`
**Fix Required:** Delay popup or make it non-blocking

#### 2. Annotations Don't Display After Save
**Problem:** Annotations save to database but don't appear in label sidebar
**Location:** `LabelSidebar.js` → `get_image_annotations()` call
**Fix Required:** Ensure API returns correct data format and UI refreshes

#### 3. Images Not Marked as Labeled
**Problem:** Even with annotations, `is_labeled` remains false
**Location:** `save_image_annotations()` function
**Fix Required:** Ensure database update includes `is_labeled = true`

#### 4. Coordinate Corruption
**Problem:** Box coordinates become 0 when switching to polygon tool
**Location:** Annotation state management
**Fix Required:** Proper state isolation between tools

#### 5. Polygon Tool Not Saving
**Problem:** Polygon annotations don't save automatically
**Location:** `PolygonTool` component
**Fix Required:** Implement auto-save for polygon completion

### 🔴 **CRITICAL DATABASE ISSUES**

#### 1. Duplicate Entries on Dataset Move
**Problem:** Moving datasets creates new entries instead of updating
**Location:** `move_dataset_to_annotating()` function
**Fix Required:** Update existing records instead of creating new ones

#### 2. Path Management Issues
**Problem:** Fragile string replacement for file paths
**Location:** All move functions in `projects.py`
**Fix Required:** Use proper path management utilities

#### 3. Split Dropdown Not Updating
**Problem:** UI shows change but database not updated
**Location:** `update_image_split()` function
**Fix Required:** Ensure API endpoint exists and works

### 🔧 **REQUIRED CODE FIXES**

1. **Fix annotation API contract** - Align frontend/backend data structures
2. **Implement proper path management** - Replace string operations with path utilities
3. **Fix UI state synchronization** - Ensure database changes reflect in UI
4. **Add missing API endpoints** - Complete incomplete functionality
5. **Fix database update operations** - Ensure all UI actions update database correctly

---

**This documentation provides complete traceability for every UI element. Use it to identify exact locations of issues and implement proper fixes.**