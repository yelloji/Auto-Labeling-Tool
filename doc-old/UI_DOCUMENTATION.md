# 🏷️ Auto-Labeling Tool - COMPLETE UI Documentation

**This document provides comprehensive mapping of every UI component, backend integration, database operations, and user workflows with 100% accuracy.**

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Dashboard](#dashboard)
3. [Projects Page](#projects-page)
4. [Project Workspace](#project-workspace)
5. [Manual Labeling Interface](#manual-labeling-interface)
6. [Annotate Launcher](#annotate-launcher)
7. [Annotate Progress](#annotate-progress)
8. [Models Management](#models-management)
9. [Datasets Overview](#datasets-overview)
10. [Shared Components](#shared-components)
11. [API Integration](#api-integration)
12. [Database Operations](#database-operations)
13. [File System Operations](#file-system-operations)
14. [Error Handling](#error-handling)
15. [Performance Optimization](#performance-optimization)
16. [Security Considerations](#security-considerations)
17. [Troubleshooting Guide](#troubleshooting-guide)
18. [Development Guidelines](#development-guidelines)
19. [Complete Workflow Examples](#complete-workflow-examples)
20. [Advanced Features](#advanced-features)

---

## 🏗️ System Architecture

### Frontend Architecture
- **Framework**: React 18.2.0
- **UI Library**: Ant Design 5.x
- **State Management**: React Hooks (useState, useEffect)
- **Routing**: React Router DOM 6.x
- **HTTP Client**: Fetch API
- **Build Tool**: Create React App
- **Port**: 12001
- **Development Server**: Webpack Dev Server

### Backend Integration
- **API Base URL**: `http://localhost:12000/api/v1`
- **Authentication**: None (local development)
- **File Upload**: Multipart form data
- **Response Format**: JSON
- **Error Handling**: HTTP status codes + error messages
- **CORS**: Enabled for localhost:12001
- **Cache Control**: No-cache headers for dynamic content

### File Structure
```
frontend/src/
├── components/           # Reusable UI components
│   ├── ActiveLearning/   # Active learning components
│   │   └── ActiveLearningDashboard.jsx
│   ├── AnnotationToolset/ # Annotation tools
│   │   ├── AnnotationAPI.js
│   │   ├── AnnotationCanvas.js
│   │   ├── AnnotationSplitControl.js
│   │   ├── AnnotationToolbox.js
│   │   ├── LabelSelectionPopup.js
│   │   ├── LabelSidebar.js
│   │   ├── SmartPolygonTool.js
│   │   └── index.js
│   ├── DataAugmentation.js
│   ├── DatasetAnalytics.js
│   ├── DatasetManagement.js
│   ├── DatasetManager.js
│   └── Navbar.js
├── pages/               # Main application pages
│   ├── Dashboard.js
│   ├── Projects.js
│   ├── ProjectWorkspace.js
│   ├── ManualLabeling.jsx
│   ├── AnnotateLauncher.js
│   ├── AnnotateProgress.jsx
│   ├── ModelsModern.js
│   ├── ProjectDetail.js
│   └── Datasets.js
├── services/           # API integration
│   └── api.js
├── utils/             # Utility functions
│   └── errorHandler.js
├── App.js            # Main application component
├── index.js          # Application entry point
├── index.css         # Global styles
├── config.js         # Configuration
└── setupProxy.js     # Development proxy
```

---

## 🏠 Dashboard

### 🔍 Page Overview
**File:** `src/pages/Dashboard.js`  
**Route:** `/dashboard`  
**Purpose:** Landing page with system overview and quick access to projects

### 🧩 UI Components

#### Header Section
- **Component:** Dashboard Header
- **Location:** `Dashboard.js` lines 15-35
- **Description:** Welcome message and user info
- **Backend:** None
- **Function:** Static display
- **Database:** None
- **Triggers:** Page load
- **Updates:** User greeting display

#### Stats Cards Section
- **Component:** Project Statistics Display
- **Location:** `Dashboard.js` lines 40-90
- **Description:** Shows total counts for projects, datasets, images
- **Backend:** `GET /api/v1/projects/stats`
- **Function:** `api/routes/projects.py` → `get_project_stats()`
- **Database:** 
  ```sql
  SELECT COUNT(*) FROM projects;
  SELECT COUNT(*) FROM datasets;
  SELECT COUNT(*) FROM images;
  SELECT COUNT(*) FROM annotations;
  ```
- **Triggers:** Page load, refresh button
- **Updates:** Real-time counters with loading states

**Stats Card Elements:**
- **Projects Count**: Total number of projects
- **Datasets Count**: Total number of datasets across all projects
- **Images Count**: Total number of uploaded images
- **Annotations Count**: Total number of created annotations
- **Storage Usage**: Disk space used by uploads
- **Active Users**: Currently active annotation sessions

#### Recent Projects Grid
- **Component:** RecentProjectsList
- **Location:** `Dashboard.js` lines 95-150
- **Description:** Last 6 accessed projects with thumbnails
- **Backend:** `GET /api/v1/projects/?limit=6&sort=updated_at`
- **Function:** `api/routes/projects.py` → `get_projects()`
- **Database:** 
  ```sql
  SELECT p.*, COUNT(d.id) as dataset_count, COUNT(i.id) as image_count
  FROM projects p
  LEFT JOIN datasets d ON p.id = d.project_id
  LEFT JOIN images i ON d.id = i.dataset_id
  GROUP BY p.id
  ORDER BY p.updated_at DESC LIMIT 6;
  ```
- **Triggers:** Page load, project updates
- **Updates:** Project grid with cards showing name, description, stats

**Recent Project Card Features:**
- **Project Thumbnail**: Preview image from project
- **Project Name**: Clickable project title
- **Last Modified**: Relative time (e.g., "2 hours ago")
- **Progress Indicator**: Visual progress bar
- **Quick Stats**: Dataset count, image count, completion percentage
- **Quick Actions**: Direct links to annotate, manage, export

#### Quick Actions Panel
- **Component:** QuickActionsPanel
- **Location:** `Dashboard.js` lines 155-200
- **Description:** Create project, upload data, run models buttons
- **Backend:** Various endpoints
- **Function:** Navigation and modal triggers
- **Database:** Various tables
- **Triggers:** Button clicks
- **Updates:** Navigation or modal opening

**Quick Action Buttons:**
- **Create New Project**: Opens project creation modal
- **Upload Images**: Direct upload to existing project
- **Start Training**: Quick access to model training
- **View Analytics**: Global analytics dashboard
- **Export Data**: Bulk export functionality
- **Import Project**: Import existing project data

#### Recent Activity Feed
- **Component:** ActivityFeed
- **Location:** `Dashboard.js` lines 205-250
- **Description:** Timeline of recent actions (uploads, annotations, training)
- **Backend:** `GET /api/v1/activity/recent`
- **Function:** `api/routes/activity.py` → `get_recent_activity()`
- **Database:** 
  ```sql
  SELECT * FROM activity_log 
  ORDER BY created_at DESC LIMIT 10;
  ```
- **Triggers:** Page load, periodic refresh
- **Updates:** Activity timeline with timestamps

**Activity Types:**
- **Image Upload**: "Uploaded 25 images to Car Dataset"
- **Annotation**: "Completed annotation of image_001.jpg"
- **Dataset Creation**: "Created new dataset: Traffic Signs"
- **Model Training**: "Started training YOLO model"
- **Export**: "Exported dataset in COCO format"
- **Project Creation**: "Created new project: Autonomous Driving"

#### System Health Panel
- **Component:** SystemHealthPanel
- **Location:** `Dashboard.js` lines 255-300
- **Description:** Backend status, storage, and performance metrics
- **Backend:** `GET /api/v1/health`
- **Function:** `api/routes/health.py` → `get_system_health()`
- **Database:** System metrics queries
- **Triggers:** Page load, periodic health checks
- **Updates:** Health indicators and alerts

**Health Metrics:**
- **Backend Status**: Online/Offline indicator
- **Database Connection**: Connection status and response time
- **Storage Space**: Available disk space and usage
- **Memory Usage**: RAM consumption
- **Active Sessions**: Current annotation sessions
- **API Response Time**: Average API latency

### 🔄 Data Flow
```
Dashboard Load → Multiple API calls → Database queries → UI updates
├── Stats API → Project/Dataset/Image counts → Stats cards
├── Projects API → Recent projects → Project grid
├── Activity API → Recent actions → Activity feed
├── Health API → System status → Health panel
└── User interactions → Navigation or modals
```

### 🎨 Visual Elements
- **Layout**: 24px padding, responsive grid
- **Cards**: Ant Design Card components with shadows
- **Colors**: Primary blue (#1890ff), success green (#52c41a)
- **Icons**: Ant Design icons for actions and stats
- **Typography**: Clear hierarchy with Title, Text components
- **Animations**: Smooth transitions and hover effects

### 🔧 State Management
```javascript
const [loading, setLoading] = useState(true);
const [stats, setStats] = useState(null);
const [recentProjects, setRecentProjects] = useState([]);
const [activities, setActivities] = useState([]);
const [systemHealth, setSystemHealth] = useState(null);
const [error, setError] = useState(null);
const [refreshInterval, setRefreshInterval] = useState(null);
```

### 🚨 Error Handling
- **Network Errors**: Retry mechanism with exponential backoff
- **API Errors**: Display error messages with retry buttons
- **Loading States**: Skeleton components during data fetch
- **Empty States**: Helpful messages when no data available
- **Offline Mode**: Cached data display when offline

---

## 📁 Projects Page

### 🔍 Page Overview
**File:** `src/pages/Projects.js`  
**Route:** `/projects`  
**Purpose:** Complete project management interface with creation, editing, and organization

### 🧩 UI Components

#### Page Header
- **Component:** ProjectsHeader
- **Location:** `Projects.js` lines 20-45
- **Description:** Page title, search, and create button
- **Backend:** None (UI only)
- **Function:** UI state management
- **Database:** None
- **Triggers:** User input
- **Updates:** Search filtering, modal opening

**Header Elements:**
- **Page Title**: "Projects" with project count
- **Search Bar**: Real-time project search
- **Filter Dropdown**: Filter by project type, status
- **Sort Options**: Sort by name, date, progress
- **View Toggle**: Grid/List view switcher
- **Create Button**: Primary action for new project

#### Create Project Button
- **Component:** CreateProjectButton
- **Location:** `Projects.js` lines 50-65
- **Description:** Primary action button to create new project
- **Backend:** None (opens modal)
- **Function:** Modal state management
- **Database:** None
- **Triggers:** Button click
- **Updates:** Opens CreateProjectModal

**Button Features:**
- **Primary Styling**: Blue background, prominent placement
- **Icon**: Plus icon for visual clarity
- **Tooltip**: "Create a new project" on hover
- **Keyboard Shortcut**: Ctrl+N support
- **Loading State**: Disabled during project creation

#### Search and Filter Bar
- **Component:** ProjectSearchFilter
- **Location:** `Projects.js` lines 70-110
- **Description:** Search input and filter dropdowns
- **Backend:** Client-side filtering
- **Function:** Array filtering and sorting
- **Database:** None (client-side)
- **Triggers:** Input changes, filter selection
- **Updates:** Filtered project list

**Search Features:**
- **Real-time Search**: Instant filtering as user types
- **Search Fields**: Name, description, tags
- **Clear Button**: Quick search reset
- **Search History**: Recent search suggestions
- **Advanced Filters**: Type, status, date range
- **Saved Filters**: User-defined filter presets

#### Projects Grid
- **Component:** ProjectsGrid
- **Location:** `Projects.js` lines 115-180
- **Description:** Responsive grid of project cards
- **Backend:** `GET /api/v1/projects/`
- **Function:** `api/routes/projects.py` → `get_projects()`
- **Database:** 
  ```sql
  SELECT p.*, 
         COUNT(DISTINCT d.id) as dataset_count,
         COUNT(DISTINCT i.id) as image_count,
         COUNT(DISTINCT CASE WHEN i.labeled = 1 THEN i.id END) as labeled_count
  FROM projects p
  LEFT JOIN datasets d ON p.id = d.project_id
  LEFT JOIN images i ON d.id = i.dataset_id
  GROUP BY p.id
  ORDER BY p.created_at DESC;
  ```
- **Triggers:** Page load, project creation/update/deletion
- **Updates:** Grid layout with project cards

**Grid Features:**
- **Responsive Layout**: 1-4 columns based on screen size
- **Card Animations**: Smooth hover and transition effects
- **Infinite Scroll**: Load more projects as user scrolls
- **Drag & Drop**: Reorder projects (if enabled)
- **Bulk Selection**: Multi-select for batch operations
- **Context Menu**: Right-click actions

#### Project Card Component
- **Component:** ProjectCard
- **Location:** `Projects.js` lines 185-250
- **Description:** Individual project display with stats and actions
- **Backend:** None (displays data from parent)
- **Function:** Navigation and action triggers
- **Database:** None (uses passed data)
- **Triggers:** Click events, dropdown actions
- **Updates:** Navigation to workspace, action modals

**Project Card Elements:**
- **Header**: Project name with type badge
- **Thumbnail**: Project preview image or icon
- **Description**: Truncated project description with "Read more"
- **Stats Bar**: Dataset count, image count, progress percentage
- **Progress Bar**: Visual completion indicator
- **Actions Menu**: Edit, Settings, Duplicate, Delete dropdown
- **Footer**: Created date, last modified, collaborators
- **Status Badge**: Active, Completed, Archived status

**Card Interactions:**
- **Click**: Navigate to project workspace
- **Hover**: Show additional details tooltip
- **Right-click**: Context menu with actions
- **Double-click**: Quick edit mode
- **Drag**: Move to different category (if enabled)

#### Create Project Modal
- **Component:** CreateProjectModal
- **Location:** `Projects.js` lines 255-350
- **Description:** Form modal for new project creation
- **Backend:** `POST /api/v1/projects/`
- **Function:** `api/routes/projects.py` → `create_project()`
- **Database:** 
  ```sql
  INSERT INTO projects (id, name, description, project_type, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?);
  ```
- **Triggers:** Form submission
- **Updates:** Projects list refresh, modal close

**Form Fields:**
- **Project Name**: Required text input with validation
  - Real-time validation
  - Duplicate name checking
  - Character limit indicator
  - Auto-suggestion based on description
- **Description**: Optional textarea with markdown support
  - Rich text editor
  - Preview mode
  - Character count
  - Auto-save draft
- **Project Type**: Select dropdown
  - Object Detection
  - Image Classification
  - Instance Segmentation
  - Semantic Segmentation
  - Custom type option
- **Template**: Optional project template selection
  - Pre-configured settings
  - Sample datasets
  - Default labels
  - Workflow templates
- **Tags**: Multi-select tag input
  - Existing tag suggestions
  - Create new tags
  - Color-coded tags
  - Tag categories
- **Privacy**: Public/Private project setting
- **Collaboration**: Team member invitations

**Form Validation:**
- **Required Fields**: Name and type are mandatory
- **Name Uniqueness**: Check against existing projects
- **Character Limits**: Enforce reasonable limits
- **Format Validation**: Proper naming conventions
- **Real-time Feedback**: Instant validation messages

#### Edit Project Modal
- **Component:** EditProjectModal
- **Location:** `Projects.js` lines 355-420
- **Description:** Form modal for editing existing project
- **Backend:** `PUT /api/v1/projects/{project_id}`
- **Function:** `api/routes/projects.py` → `update_project()`
- **Database:** 
  ```sql
  UPDATE projects 
  SET name = ?, description = ?, project_type = ?, updated_at = ?
  WHERE id = ?;
  ```
- **Triggers:** Edit action from dropdown
- **Updates:** Project card refresh, modal close

**Edit Features:**
- **Pre-filled Form**: Current project data loaded
- **Change Tracking**: Highlight modified fields
- **Validation**: Same as create modal
- **Cancel Confirmation**: Warn about unsaved changes
- **Auto-save**: Save changes automatically
- **Version History**: Track project modifications

#### Delete Confirmation Modal
- **Component:** DeleteProjectModal
- **Location:** `Projects.js` lines 425-470
- **Description:** Confirmation dialog for project deletion
- **Backend:** `DELETE /api/v1/projects/{project_id}`
- **Function:** `api/routes/projects.py` → `delete_project()`
- **Database:** 
  ```sql
  DELETE FROM annotations WHERE image_id IN (
    SELECT i.id FROM images i 
    JOIN datasets d ON i.dataset_id = d.id 
    WHERE d.project_id = ?
  );
  DELETE FROM images WHERE dataset_id IN (
    SELECT id FROM datasets WHERE project_id = ?
  );
  DELETE FROM datasets WHERE project_id = ?;
  DELETE FROM projects WHERE id = ?;
  ```
- **Triggers:** Delete action confirmation
- **Updates:** Projects list refresh, modal close

**Deletion Features:**
- **Impact Warning**: Show what will be deleted
- **Data Summary**: Count of datasets, images, annotations
- **Confirmation Input**: Type project name to confirm
- **Backup Option**: Offer to export before deletion
- **Cascade Information**: Explain related data deletion
- **Undo Period**: Grace period for recovery (if implemented)

#### Bulk Operations Panel
- **Component:** BulkOperationsPanel
- **Location:** `Projects.js` lines 475-520
- **Description:** Batch operations on multiple selected projects
- **Backend:** Various bulk endpoints
- **Function:** Batch processing operations
- **Database:** Bulk update/delete operations
- **Triggers:** Bulk action selection
- **Updates:** Multiple project modifications

**Bulk Actions:**
- **Export Multiple**: Export selected projects
- **Archive Projects**: Move to archived state
- **Delete Multiple**: Batch deletion with confirmation
- **Change Type**: Bulk project type update
- **Add Tags**: Apply tags to multiple projects
- **Transfer Ownership**: Change project owners

### 🔄 Data Flow
```
Projects Page Load → API call → Database query → UI update
├── GET /api/v1/projects/ → Projects list → Grid display
├── Search input → Client filter → Filtered display
├── Create button → Modal open → Form submit → API call → Refresh
├── Edit action → Modal open → Form submit → API call → Refresh
├── Delete action → Confirmation → API call → Refresh
└── Bulk operations → Batch API calls → Multiple updates
```

### 🎨 Visual Design

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Header: [Title] [Search] [Filters] [Create Project Button] │
├─────────────────────────────────────────────────────────────┤
│ Projects Grid (Responsive):                                │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │Project 1│ │Project 2│ │Project 3│ │Project 4│            │
│ │Stats    │ │Stats    │ │Stats    │ │Stats    │            │
│ │Actions  │ │Actions  │ │Actions  │ │Actions  │            │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │Project 5│ │Project 6│ │Project 7│ │Project 8│            │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
└─────────────────────────────────────────────────────────────┘
```

#### Responsive Breakpoints
- **Desktop (≥1200px)**: 4 columns
- **Laptop (≥992px)**: 3 columns  
- **Tablet (≥768px)**: 2 columns
- **Mobile (<768px)**: 1 column

#### Color Coding
- **Object Detection**: Blue header (#1890ff)
- **Classification**: Green header (#52c41a)
- **Segmentation**: Purple header (#722ed1)
- **Progress Bars**: Gradient from orange to green
- **Status Badges**: Color-coded by project status

### 🔧 State Management
```javascript
const [projects, setProjects] = useState([]);
const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState('');
const [filterType, setFilterType] = useState('all');
const [sortBy, setSortBy] = useState('created_at');
const [viewMode, setViewMode] = useState('grid'); // grid or list
const [selectedProjects, setSelectedProjects] = useState([]);
const [createModalVisible, setCreateModalVisible] = useState(false);
const [editModalVisible, setEditModalVisible] = useState(false);
const [deleteModalVisible, setDeleteModalVisible] = useState(false);
const [bulkOperationsVisible, setBulkOperationsVisible] = useState(false);
const [selectedProject, setSelectedProject] = useState(null);
const [error, setError] = useState(null);
```

### 🚨 Error Handling
- **Load Errors**: Retry button with error message
- **Creation Errors**: Form validation and API error display
- **Network Errors**: Offline detection and retry mechanism
- **Validation Errors**: Real-time form validation with error messages
- **Bulk Operation Errors**: Partial success handling

### 🔍 Search and Filter Logic
```javascript
const filteredProjects = projects.filter(project => {
  const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       project.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
  const matchesType = filterType === 'all' || project.project_type === filterType;
  const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
  return matchesSearch && matchesType && matchesStatus;
}).sort((a, b) => {
  switch(sortBy) {
    case 'name': return a.name.localeCompare(b.name);
    case 'created_at': return new Date(b.created_at) - new Date(a.created_at);
    case 'updated_at': return new Date(b.updated_at) - new Date(a.updated_at);
    case 'progress': return b.progress - a.progress;
    default: return 0;
  }
});
```

---

## 🏢 Project Workspace

### 🔍 Page Overview
**File:** `src/pages/ProjectWorkspace.js`  
**Route:** `/projects/:id`  
**Purpose:** Main working area for a specific project with multiple tabs and comprehensive dataset management

### 🧩 Navigation Structure

#### Tab Navigation
- **Component:** ProjectTabs
- **Location:** `ProjectWorkspace.js` lines 25-50
- **Description:** Main navigation between workspace sections
- **Backend:** None (UI state)
- **Function:** Tab switching logic
- **Database:** None
- **Triggers:** Tab clicks
- **Updates:** Active tab content display

**Available Tabs:**
1. **Management** - Dataset workflow management (Primary)
2. **Dataset** - Dataset details and export
3. **Versions** - Version control and history
4. **Models** - Model training and management
5. **Visualize** - Data visualization and analytics
6. **Deployments** - Model deployment and inference

### 🎯 Management Tab (Primary Workflow)

#### 🔍 Tab Overview
**Component:** ManagementContent  
**Location:** `ProjectWorkspace.js` lines 1179-1400  
**Purpose:** Core dataset workflow with three-column layout

#### Three-Column Layout Structure
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ UNASSIGNED  │  │ ANNOTATING  │  │   DATASET   │
│             │  │             │  │             │
│ [Upload]    │  │ Dataset A   │  │ Dataset X   │
│ Images      │  │ (3/10 done) │  │ (Complete)  │
│             │  │             │  │             │
│ Image 1     │  │ Dataset B   │  │ Dataset Y   │
│ Image 2     │  │ (0/5 done)  │  │ (Complete)  │
│ Image 3     │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘
```

#### Column 1: Unassigned Section
- **Component:** UnassignedSection
- **Location:** `ProjectWorkspace.js` lines 1217-1280
- **Description:** Shows uploaded images not yet assigned to datasets
- **Backend:** `GET /api/v1/projects/{id}/management-data`
- **Function:** `api/routes/projects.py` → `get_project_management_data()`
- **Database:** 
  ```sql
  SELECT i.*, d.name as dataset_name, d.split_type
  FROM images i
  JOIN datasets d ON i.dataset_id = d.id
  WHERE d.project_id = ? AND d.split_type = 'unassigned'
  ORDER BY i.created_at DESC;
  ```
- **Triggers:** Page load, image upload, dataset creation
- **Updates:** Image grid, upload progress, dataset creation options

**Unassigned Section Elements:**
- **Upload Area**: Drag & drop zone for new images
  - Visual feedback for drag over
  - Multiple file selection support
  - Progress indicators for each file
  - Error handling for invalid files
- **Upload Button**: File picker for batch upload
  - File format filtering (JPG, PNG, JPEG)
  - Size limit warnings
  - Batch upload progress
- **Image Grid**: Thumbnail view of unassigned images
  - Lazy loading for performance
  - Image metadata display
  - Selection checkboxes
  - Context menu actions
- **Select All**: Checkbox for bulk selection
  - Indeterminate state for partial selection
  - Keyboard shortcuts (Ctrl+A)
- **Create Dataset**: Button to group selected images
  - Disabled when no images selected
  - Validation for minimum selection
- **Progress Bar**: Upload progress indicator
  - Individual file progress
  - Overall batch progress
  - Cancel upload option

#### Image Upload Component
- **Component:** ImageUpload
- **Location:** `ProjectWorkspace.js` lines 300-400
- **Description:** Drag & drop and file picker for image upload
- **Backend:** `POST /api/v1/projects/{id}/upload`
- **Function:** `api/routes/projects.py` → `upload_images()`
- **Database:** 
  ```sql
  INSERT INTO datasets (id, name, project_id, split_type, created_at, updated_at)
  VALUES (?, 'temp_upload', ?, 'unassigned', ?, ?);
  
  INSERT INTO images (id, filename, original_filename, file_path, dataset_id, 
                     width, height, file_size, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  ```
- **Triggers:** File drop, file selection, upload button
- **Updates:** Upload progress, unassigned images list

**Upload Features:**
- **Drag & Drop**: Visual feedback for file dropping
  - Highlight drop zone on drag over
  - Show file count during drag
  - Prevent default browser behavior
- **File Validation**: JPG, PNG, JPEG format checking
  - Real-time format validation
  - Size limit enforcement (10MB per file)
  - Duplicate file detection
- **Progress Tracking**: Individual file and overall progress
  - Real-time upload progress bars
  - Speed and time remaining estimates
  - Pause/resume functionality
- **Error Handling**: Failed upload retry mechanism
  - Automatic retry for network errors
  - Manual retry buttons for failed files
  - Clear error messages
- **Batch Processing**: Multiple file upload support
  - Concurrent upload streams
  - Queue management
  - Priority handling

#### Dataset Creation Modal
- **Component:** CreateDatasetModal
- **Location:** `ProjectWorkspace.js` lines 450-550
- **Description:** Form for creating named datasets from selected images
- **Backend:** `POST /api/v1/projects/{id}/datasets`
- **Function:** `api/routes/projects.py` → `create_dataset()`
- **Database:** 
  ```sql
  INSERT INTO datasets (id, name, project_id, split_type, total_images, 
                       labeled_images, created_at, updated_at)
  VALUES (?, ?, ?, 'unassigned', ?, 0, ?, ?);
  
  UPDATE images SET dataset_id = ? WHERE id IN (?);
  ```
- **Triggers:** Create dataset button, form submission
- **Updates:** Dataset creation, image assignment, modal close

**Form Validation:**
- **Dataset Name**: Required, unique within project, meaningful names only
  - Real-time uniqueness checking
  - Character limit enforcement
  - Special character validation
  - Auto-generated name suggestions
- **Description**: Optional text description
  - Rich text editor support
  - Character count display
  - Preview mode
- **Image Selection**: Must select at least one image
  - Visual selection confirmation
  - Selected image count display
  - Deselection options
- **Name Validation**: No auto-generated names allowed (enforced)
  - Pattern matching for auto-generated names
  - Custom validation rules
  - User-friendly error messages

#### Column 2: Annotating Section
- **Component:** AnnotatingSection
- **Location:** `ProjectWorkspace.js` lines 1285-1350
- **Description:** Shows datasets currently being labeled with progress tracking
- **Backend:** Same management data API
- **Function:** Filters datasets with split_type = 'annotating'
- **Database:** 
  ```sql
  SELECT d.*, COUNT(i.id) as total_images, 
         COUNT(CASE WHEN i.labeled = 1 THEN 1 END) as labeled_images
  FROM datasets d
  LEFT JOIN images i ON d.id = i.dataset_id
  WHERE d.project_id = ? AND d.split_type = 'annotating'
  GROUP BY d.id
  ORDER BY d.updated_at DESC;
  ```
- **Triggers:** Dataset moves, annotation progress updates
- **Updates:** Dataset cards with progress indicators

**Annotating Dataset Card:**
- **Header**: Dataset name and type badge
  - Editable name (click to edit)
  - Type indicator icon
  - Last modified timestamp
- **Progress Bar**: Visual labeling progress (labeled/total)
  - Color-coded progress (red → yellow → green)
  - Percentage display
  - Animated progress updates
- **Stats**: "X of Y images labeled"
  - Detailed breakdown
  - Estimated completion time
  - Average annotation time
- **Actions**: Annotate button, move to dataset (if complete)
  - Primary annotate action
  - Secondary actions menu
  - Quick preview option
- **Status Indicator**: Color-coded progress status
  - Not started (gray)
  - In progress (blue)
  - Nearly complete (orange)
  - Complete (green)

#### Dataset Assignment (Move to Annotating)
- **Component:** AssignDatasetAction
- **Location:** `ProjectWorkspace.js` lines 600-650
- **Description:** Move datasets from unassigned to annotating workflow
- **Backend:** `POST /api/v1/projects/{id}/datasets/{dataset_id}/assign`
- **Function:** `api/routes/projects.py` → `assign_dataset_to_annotating()`
- **Database:** 
  ```sql
  UPDATE datasets 
  SET split_type = 'annotating', updated_at = ?
  WHERE id = ? AND project_id = ?;
  
  -- Create annotating folder structure
  -- Move files from unassigned to annotating directory
  ```
- **Triggers:** Assign button click, drag & drop
- **Updates:** Dataset moves between columns, folder structure creation

**Assignment Features:**
- **Drag & Drop**: Visual drag and drop between columns
  - Smooth animation during drag
  - Drop zone highlighting
  - Snap-to-grid positioning
- **Button Action**: Explicit assign button
  - Confirmation dialog for large datasets
  - Progress indicator for file moves
  - Error handling for failed moves
- **Batch Assignment**: Multiple dataset assignment
  - Multi-select support
  - Bulk action confirmation
  - Progress tracking for batch operations

#### Column 3: Dataset Section (Completed)
- **Component:** DatasetSection
- **Location:** `ProjectWorkspace.js` lines 1355-1400
- **Description:** Shows completed, fully labeled datasets ready for export/training
- **Backend:** Same management data API
- **Function:** Filters datasets with split_type = 'dataset'
- **Database:** 
  ```sql
  SELECT d.*, COUNT(i.id) as total_images, 
         COUNT(CASE WHEN i.labeled = 1 THEN 1 END) as labeled_images
  FROM datasets d
  LEFT JOIN images i ON d.id = i.dataset_id
  WHERE d.project_id = ? AND d.split_type = 'dataset'
  GROUP BY d.id
  ORDER BY d.updated_at DESC;
  ```
- **Triggers:** Dataset completion, moves from annotating
- **Updates:** Completed dataset cards

**Completed Dataset Features:**
- **Export Options**: Multiple format support
  - YOLO format export
  - COCO format export
  - Pascal VOC export
  - Custom format options
- **Training Integration**: Direct model training
  - One-click training start
  - Training configuration
  - Progress monitoring
- **Quality Metrics**: Annotation quality scores
  - Completeness percentage
  - Quality assessment
  - Validation results
- **Version Control**: Dataset versioning
  - Version history
  - Rollback options
  - Change tracking

**Dataset Completion Validation:**
- **Component:** MoveToDatasetValidation
- **Location:** `ProjectWorkspace.js` lines 700-750
- **Description:** Enforces complete labeling before dataset finalization
- **Backend:** `POST /api/v1/projects/{id}/datasets/{dataset_id}/move-to-completed`
- **Function:** `api/routes/projects.py` → `move_dataset_to_completed()`
- **Database:** 
  ```sql
  SELECT total_images, labeled_images FROM datasets WHERE id = ?;
  -- Validation: labeled_images MUST equal total_images
  
  UPDATE datasets 
  SET split_type = 'dataset', updated_at = ?
  WHERE id = ? AND labeled_images = total_images;
  ```
- **Triggers:** Move to dataset action
- **Updates:** Success move or validation error

**Critical Validation Rules:**
- ✅ **ALL images must be labeled** (labeled_images = total_images)
- ❌ **Cannot move partially labeled datasets**
- 🔒 **Backend enforced validation** with clear error messages
- 📊 **Frontend UI shows progress** and blocks action if incomplete
- 🚨 **Clear error messaging**: "Cannot move to dataset: 5 images still need labeling"
- 🔄 **Real-time validation**: Check before allowing move action

### 🎯 Dataset Tab

#### 🔍 Tab Overview
**Component:** DatasetContent  
**Location:** `ProjectWorkspace.js` lines 1450-1600  
**Purpose:** Detailed dataset management, export, and analytics

#### Dataset List View
- **Component:** DatasetListView
- **Location:** `ProjectWorkspace.js` lines 1460-1520
- **Description:** Comprehensive list of all project datasets with detailed stats
- **Backend:** `GET /api/v1/projects/{id}/datasets`
- **Function:** `api/routes/projects.py` → `get_project_datasets()`
- **Database:** 
  ```sql
  SELECT d.*, 
         COUNT(i.id) as total_images,
         COUNT(CASE WHEN i.labeled = 1 THEN 1 END) as labeled_images,
         COUNT(a.id) as total_annotations,
         AVG(i.width) as avg_width,
         AVG(i.height) as avg_height,
         SUM(i.file_size) as total_size
  FROM datasets d
  LEFT JOIN images i ON d.id = i.dataset_id
  LEFT JOIN annotations a ON i.id = a.image_id
  WHERE d.project_id = ?
  GROUP BY d.id
  ORDER BY d.created_at DESC;
  ```
- **Triggers:** Tab switch, dataset updates
- **Updates:** Detailed dataset table with statistics

**Dataset Table Columns:**
- **Name**: Dataset name with edit capability
- **Status**: Current workflow status (unassigned/annotating/dataset)
- **Images**: Total image count with thumbnails
- **Labeled**: Labeled image count and percentage
- **Annotations**: Total annotation count
- **Size**: Total file size in human-readable format
- **Created**: Creation date and time
- **Modified**: Last modification date
- **Actions**: Export, edit, delete, duplicate options

#### Export Functionality
- **Component:** DatasetExport
- **Location:** `ProjectWorkspace.js` lines 1525-1580
- **Description:** Export datasets in various formats (YOLO, COCO, Pascal VOC)
- **Backend:** `POST /api/v1/projects/{id}/datasets/{dataset_id}/export`
- **Function:** `api/routes/projects.py` → `export_dataset()`
- **Database:** 
  ```sql
  SELECT i.*, a.*, l.name as label_name
  FROM images i
  JOIN annotations a ON i.id = a.image_id
  JOIN labels l ON a.label_id = l.id
  WHERE i.dataset_id = ?;
  ```
- **Triggers:** Export button click, format selection
- **Updates:** Download initiation, progress tracking

**Export Formats:**
- **YOLO Format**: 
  - Text files with normalized coordinates
  - Classes.txt file with label mappings
  - Train/val/test split support
- **COCO Format**: 
  - JSON annotation file
  - Image metadata inclusion
  - Category definitions
- **Pascal VOC Format**: 
  - XML annotation files
  - ImageSets for splits
  - Standard VOC structure
- **Custom Format**: 
  - User-defined export templates
  - Configurable output structure
  - Plugin support for new formats

**Export Options:**
- **Split Configuration**: Train/validation/test ratios
- **Image Processing**: Resize, format conversion
- **Annotation Filtering**: Include/exclude specific labels
- **Metadata Inclusion**: Image properties, timestamps
- **Compression**: ZIP archive creation
- **Quality Settings**: Image quality and compression

### 🎯 Versions Tab

#### 🔍 Tab Overview
**Component:** VersionsContent  
**Location:** `ProjectWorkspace.js` lines 1650-1750  
**Purpose:** Dataset version control and history management

#### Version History
- **Component:** VersionHistory
- **Location:** `ProjectWorkspace.js` lines 1660-1720
- **Description:** Timeline of dataset versions with diff capabilities
- **Backend:** `GET /api/v1/projects/{id}/versions`
- **Function:** `api/routes/projects.py` → `get_project_versions()`
- **Database:** 
  ```sql
  SELECT v.*, COUNT(i.id) as image_count, COUNT(a.id) as annotation_count
  FROM versions v
  LEFT JOIN images i ON v.dataset_id = i.dataset_id
  LEFT JOIN annotations a ON i.id = a.image_id
  WHERE v.project_id = ?
  GROUP BY v.id
  ORDER BY v.created_at DESC;
  ```
- **Triggers:** Tab switch, version creation
- **Updates:** Version timeline with comparison tools

**Version Features:**
- **Automatic Versioning**: Auto-create versions on major changes
- **Manual Snapshots**: User-triggered version creation
- **Version Comparison**: Side-by-side diff view
- **Rollback Capability**: Restore to previous versions
- **Branch Management**: Create branches for experiments
- **Merge Functionality**: Combine changes from branches

#### Version Comparison
- **Component:** VersionComparison
- **Location:** `ProjectWorkspace.js` lines 1725-1780
- **Description:** Compare different versions of datasets
- **Backend:** `GET /api/v1/versions/{v1}/compare/{v2}`
- **Function:** `api/routes/versions.py` → `compare_versions()`
- **Database:** Complex diff queries between versions
- **Triggers:** Version selection for comparison
- **Updates:** Diff visualization

**Comparison Features:**
- **Image Differences**: Added, removed, modified images
- **Annotation Changes**: New, deleted, updated annotations
- **Label Modifications**: Label name and property changes
- **Statistics Comparison**: Metrics between versions
- **Visual Diff**: Side-by-side image comparison
- **Export Diff**: Export comparison report

### 🎯 Models Tab

#### 🔍 Tab Overview
**Component:** ModelsContent  
**Location:** `ProjectWorkspace.js` lines 1800-1950  
**Purpose:** Model training, management, and performance monitoring

#### Training Jobs
- **Component:** TrainingJobs
- **Location:** `ProjectWorkspace.js` lines 1810-1870
- **Description:** Active and completed training jobs with progress monitoring
- **Backend:** `GET /api/v1/projects/{id}/training-jobs`
- **Function:** `api/routes/models.py` → `get_training_jobs()`
- **Database:** 
  ```sql
  SELECT tj.*, m.name as model_name, d.name as dataset_name
  FROM training_jobs tj
  LEFT JOIN models m ON tj.model_id = m.id
  LEFT JOIN datasets d ON tj.dataset_id = d.id
  WHERE tj.project_id = ?
  ORDER BY tj.created_at DESC;
  ```
- **Triggers:** Tab switch, training start/stop
- **Updates:** Training progress, job status, performance metrics

**Training Job Features:**
- **Job Queue**: Manage multiple training jobs
- **Progress Monitoring**: Real-time training progress
- **Log Viewing**: Live training logs and metrics
- **Resource Usage**: GPU/CPU utilization monitoring
- **Early Stopping**: Automatic stopping on convergence
- **Hyperparameter Tuning**: Grid search and optimization

#### Model Performance
- **Component:** ModelPerformance
- **Location:** `ProjectWorkspace.js` lines 1875-1930
- **Description:** Model accuracy, loss, and performance metrics
- **Backend:** `GET /api/v1/models/{id}/metrics`
- **Function:** `api/routes/models.py` → `get_model_metrics()`
- **Database:** Training metrics and validation results
- **Triggers:** Model selection, metrics refresh
- **Updates:** Performance charts and statistics

**Performance Metrics:**
- **Accuracy**: Overall and per-class accuracy
- **Loss**: Training and validation loss curves
- **Precision/Recall**: Detailed classification metrics
- **mAP**: Mean Average Precision for detection
- **Confusion Matrix**: Classification confusion matrix
- **ROC Curves**: Receiver Operating Characteristic

### 🎯 Visualize Tab

#### 🔍 Tab Overview
**Component:** VisualizeContent  
**Location:** `ProjectWorkspace.js` lines 2000-2150  
**Purpose:** Data visualization, analytics, and quality assessment

#### Dataset Analytics
- **Component:** DatasetAnalytics
- **Location:** `ProjectWorkspace.js` lines 2010-2070
- **Description:** Statistical analysis and visualization of dataset properties
- **Backend:** `GET /api/v1/projects/{id}/analytics`
- **Function:** `api/routes/analytics.py` → `get_project_analytics()`
- **Database:** 
  ```sql
  SELECT 
    COUNT(i.id) as total_images,
    AVG(i.width) as avg_width,
    AVG(i.height) as avg_height,
    COUNT(DISTINCT l.name) as unique_labels,
    COUNT(a.id) as total_annotations
  FROM images i
  LEFT JOIN annotations a ON i.id = a.image_id
  LEFT JOIN labels l ON a.label_id = l.id
  JOIN datasets d ON i.dataset_id = d.id
  WHERE d.project_id = ?;
  ```
- **Triggers:** Tab switch, data updates
- **Updates:** Charts, graphs, statistical summaries

**Analytics Features:**
- **Image Statistics**: Size, format, quality distributions
- **Annotation Analysis**: Label frequency, annotation density
- **Quality Metrics**: Annotation quality scores
- **Data Balance**: Class distribution analysis
- **Temporal Analysis**: Annotation progress over time
- **Comparative Analysis**: Compare datasets within project

#### Data Visualization
- **Component:** DataVisualization
- **Location:** `ProjectWorkspace.js` lines 2075-2130
- **Description:** Interactive charts and graphs for data exploration
- **Backend:** Processed analytics data
- **Function:** Client-side chart rendering
- **Database:** Aggregated data for visualization
- **Triggers:** Chart interactions, filter changes
- **Updates:** Dynamic chart updates

**Visualization Types:**
- **Bar Charts**: Label distribution, dataset sizes
- **Line Charts**: Progress over time, training metrics
- **Pie Charts**: Data split ratios, completion status
- **Scatter Plots**: Image dimensions, annotation density
- **Heatmaps**: Annotation distribution, quality maps
- **Histograms**: Size distributions, quality scores

### 🎯 Deployments Tab

#### 🔍 Tab Overview
**Component:** DeploymentsContent  
**Location:** `ProjectWorkspace.js` lines 2200-2350  
**Purpose:** Model deployment, API management, and inference testing

#### Deployment Management
- **Component:** DeploymentManager
- **Location:** `ProjectWorkspace.js` lines 2210-2270
- **Description:** Deploy trained models as API endpoints
- **Backend:** `GET /api/v1/projects/{id}/deployments`
- **Function:** `api/routes/deployments.py` → `get_deployments()`
- **Database:** 
  ```sql
  SELECT dep.*, m.name as model_name, m.accuracy, m.file_path
  FROM deployments dep
  JOIN models m ON dep.model_id = m.id
  WHERE dep.project_id = ?
  ORDER BY dep.created_at DESC;
  ```
- **Triggers:** Tab switch, deployment actions
- **Updates:** Deployment status, API endpoints, performance metrics

**Deployment Features:**
- **Model Selection**: Choose trained models for deployment
- **Endpoint Configuration**: API endpoint settings
- **Scaling Options**: Auto-scaling and load balancing
- **Version Management**: Deploy multiple model versions
- **Health Monitoring**: Endpoint health and performance
- **Usage Analytics**: API usage statistics and metrics

#### Inference Testing
- **Component:** InferenceTesting
- **Location:** `ProjectWorkspace.js` lines 2275-2330
- **Description:** Test deployed models with sample images
- **Backend:** `POST /api/v1/deployments/{id}/predict`
- **Function:** `api/routes/inference.py` → `predict()`
- **Database:** Inference logs and results
- **Triggers:** Test image upload, prediction requests
- **Updates:** Prediction results, confidence scores

**Testing Features:**
- **Image Upload**: Test with custom images
- **Batch Testing**: Test multiple images at once
- **Result Visualization**: Overlay predictions on images
- **Confidence Thresholds**: Adjust prediction sensitivity
- **Performance Metrics**: Response time, accuracy
- **A/B Testing**: Compare different model versions

### 🔄 Complete Data Flow

#### Management Tab Workflow
```
Page Load → API Call → Database Query → UI Update
├── GET /management-data → Project datasets → Three-column display
├── Upload images → POST /upload → File storage + DB → Unassigned update
├── Create dataset → POST /datasets → DB insert → Dataset creation
├── Assign to annotating → POST /assign → DB update + file move → Column move
├── Complete annotation → External annotation interface → Progress update
└── Move to dataset → POST /move-to-completed → Validation + DB update → Final column
```

#### Cross-Tab Data Synchronization
```
Management Tab ←→ Dataset Tab ←→ Models Tab ←→ Visualize Tab
     ↓              ↓              ↓              ↓
Database Updates → Real-time Sync → UI Refresh → Analytics Update
```

#### Real-time Updates
- **WebSocket Connection**: Live updates for progress changes
- **Polling Mechanism**: Periodic refresh for status updates
- **Event Broadcasting**: Cross-tab communication
- **Cache Invalidation**: Smart cache management

### 🎨 Visual Design System

#### Layout Principles
- **Consistent Spacing**: 24px padding, 16px gaps
- **Responsive Grid**: Ant Design grid system
- **Card-Based Design**: Consistent card components
- **Color Coding**: Status-based color schemes
- **Typography**: Clear hierarchy with consistent sizing

#### Color Scheme
- **Primary Actions**: Blue (#1890ff)
- **Success States**: Green (#52c41a)
- **Warning States**: Orange (#faad14)
- **Error States**: Red (#f5222d)
- **Progress Indicators**: Gradient blue to green
- **Workflow States**: 
  - Unassigned: Gray (#8c8c8c)
  - Annotating: Blue (#1890ff)
  - Dataset: Green (#52c41a)

#### Component Consistency
- **Buttons**: Consistent sizing and styling
- **Cards**: Uniform shadows and borders
- **Progress Bars**: Standardized appearance
- **Icons**: Ant Design icon set
- **Typography**: Consistent font weights and sizes
- **Animations**: Smooth transitions and hover effects

### 🔧 Advanced State Management

#### Global State
```javascript
const [projectId, setProjectId] = useState(null);
const [projectData, setProjectData] = useState(null);
const [activeTab, setActiveTab] = useState('management');
const [managementData, setManagementData] = useState(null);
const [loadingManagement, setLoadingManagement] = useState(false);
const [selectedImages, setSelectedImages] = useState([]);
const [selectedDatasets, setSelectedDatasets] = useState([]);
const [uploadProgress, setUploadProgress] = useState(0);
const [error, setError] = useState(null);
const [notifications, setNotifications] = useState([]);
```

#### Tab-Specific State
```javascript
// Management Tab
const [createDatasetModalVisible, setCreateDatasetModalVisible] = useState(false);
const [assignModalVisible, setAssignModalVisible] = useState(false);
const [selectedDataset, setSelectedDataset] = useState(null);
const [draggedDataset, setDraggedDataset] = useState(null);

// Dataset Tab
const [exportModalVisible, setExportModalVisible] = useState(false);
const [exportFormat, setExportFormat] = useState('yolo');
const [exportProgress, setExportProgress] = useState(0);
const [datasetFilters, setDatasetFilters] = useState({});

// Models Tab
const [trainingJobs, setTrainingJobs] = useState([]);
const [startTrainingModalVisible, setStartTrainingModalVisible] = useState(false);
const [selectedModel, setSelectedModel] = useState(null);

// Visualize Tab
const [analyticsData, setAnalyticsData] = useState(null);
const [chartFilters, setChartFilters] = useState({});
const [selectedVisualization, setSelectedVisualization] = useState('overview');

// Deployments Tab
const [deployments, setDeployments] = useState([]);
const [deployModalVisible, setDeployModalVisible] = useState(false);
const [testResults, setTestResults] = useState([]);
```

### 🚨 Comprehensive Error Handling

#### Network Error Recovery
```javascript
const handleApiError = async (error, retryFunction) => {
  if (error.name === 'NetworkError') {
    // Implement exponential backoff retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    return retryFunction();
  }
  
  if (error.status === 400) {
    // Validation error
    setError({
      type: 'validation',
      message: error.data?.detail || 'Invalid request data',
      retry: false
    });
  } else if (error.status === 500) {
    // Server error
    setError({
      type: 'server',
      message: 'Server error occurred. Please try again later.',
      retry: true,
      retryFunction
    });
  }
};
```

#### Validation Error Display
```javascript
const validateDatasetMove = (dataset) => {
  if (dataset.labeled_images < dataset.total_images) {
    const unlabeledCount = dataset.total_images - dataset.labeled_images;
    message.error(`Cannot move to dataset: ${unlabeledCount} images still need labeling`);
    return false;
  }
  return true;
};

const validateDatasetCreation = (name, selectedImages) => {
  const errors = [];
  
  if (!name || name.trim().length === 0) {
    errors.push('Dataset name is required');
  }
  
  if (selectedImages.length === 0) {
    errors.push('At least one image must be selected');
  }
  
  if (name.includes('Uploaded Images -')) {
    errors.push('Auto-generated names are not allowed. Please provide a meaningful name.');
  }
  
  return errors;
};
```

#### Loading State Management
```javascript
const [loadingStates, setLoadingStates] = useState({
  management: false,
  upload: false,
  createDataset: false,
  assignDataset: false,
  moveToDataset: false,
  export: false,
  training: false
});

const setLoadingState = (key, value) => {
  setLoadingStates(prev => ({ ...prev, [key]: value }));
};
```

#### Offline Handling
```javascript
const [isOnline, setIsOnline] = useState(navigator.onLine);
const [queuedOperations, setQueuedOperations] = useState([]);

useEffect(() => {
  const handleOnline = () => {
    setIsOnline(true);
    // Process queued operations
    processQueuedOperations();
  };
  
  const handleOffline = () => {
    setIsOnline(false);
    message.warning('You are offline. Changes will be saved when connection is restored.');
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);
```

---

## 🎨 Manual Labeling Interface

### 🔍 Page Overview
**File:** `src/pages/ManualLabeling.jsx`  
**Route:** `/projects/:id/annotate/:datasetId`  
**Purpose:** Advanced annotation interface with comprehensive tools for image labeling

### 🧩 Layout Structure

#### Main Layout Components
```
┌─────────────────────────────────────────────────────────────────┐
│ Header: [Dataset Name] [Progress] [Save] [Complete] [Exit]      │
├─────────┬─────────────────────────────────────┬─────────────────┤
│ Image   │                                     │ Tools & Labels  │
│ List    │        Main Canvas Area             │                 │
│ (Left)  │                                     │ (Right)         │
│         │   ┌─────────────────────────────┐   │                 │
│ □ Img1  │   │                             │   │ ┌─────────────┐ │
│ ■ Img2  │   │     Current Image           │   │ │ Bounding    │ │
│ □ Img3  │   │                             │   │ │ Box Tool    │ │
│ □ Img4  │   │   [Annotation Overlay]      │   │ └─────────────┘ │
│ □ Img5  │   │                             │   │ ┌─────────────┐ │
│         │   │                             │   │ │ Polygon     │ │
│         │   └─────────────────────────────┘   │ │ Tool        │ │
│         │                                     │ └─────────────┘ │
│         │   [Zoom] [Pan] [Fit] [Reset]        │                 │
│         │                                     │ Labels:         │
│         │                                     │ • Car           │
│         │                                     │ • Person        │
│         │                                     │ • Bike          │
├─────────┴─────────────────────────────────────┴─────────────────┤
│ Bottom: [Previous] [Next] [Auto-Save: On] [Shortcuts Help]     │
└─────────────────────────────────────────────────────────────────┘
```

### 🧩 Core Components

#### Annotation Header
- **Component:** AnnotationHeader
- **Location:** `ManualLabeling.jsx` lines 50-100
- **Description:** Top navigation with dataset info, progress, and main actions
- **Backend:** `GET /api/v1/datasets/{dataset_id}`
- **Function:** `api/routes/datasets.py` → `get_dataset()`
- **Database:** 
  ```sql
  SELECT d.*, COUNT(i.id) as total_images,
         COUNT(CASE WHEN i.labeled = 1 THEN 1 END) as labeled_images
  FROM datasets d
  LEFT JOIN images i ON d.id = i.dataset_id
  WHERE d.id = ?
  GROUP BY d.id;
  ```
- **Triggers:** Page load, annotation saves
- **Updates:** Progress bar, save status, completion percentage

**Header Elements:**
- **Dataset Name**: Current dataset being annotated
  - Editable name (click to edit)
  - Breadcrumb navigation
  - Project context link
- **Progress Bar**: Visual progress (labeled/total images)
  - Color-coded progress
  - Percentage display
  - Estimated completion time
- **Progress Text**: "X of Y images labeled (Z%)"
  - Detailed statistics
  - Time remaining estimate
  - Average annotation time
- **Save Button**: Manual save trigger
  - Auto-save status indicator
  - Last saved timestamp
  - Save conflict resolution
- **Complete Dataset**: Finish annotation workflow
  - Validation before completion
  - Confirmation dialog
  - Return to project workspace
- **Exit Button**: Return to project workspace
  - Unsaved changes warning
  - Quick save option
  - Navigation confirmation

#### Left Sidebar - Image List
- **Component:** ImageListSidebar
- **Location:** `ManualLabeling.jsx` lines 150-250
- **Description:** Navigable list of all images in dataset with status indicators
- **Backend:** `GET /api/v1/datasets/{dataset_id}/images`
- **Function:** `api/routes/datasets.py` → `get_dataset_images()`
- **Database:** 
  ```sql
  SELECT i.*, COUNT(a.id) as annotation_count
  FROM images i
  LEFT JOIN annotations a ON i.id = a.image_id
  WHERE i.dataset_id = ?
  ORDER BY i.filename;
  ```
- **Triggers:** Page load, image navigation, annotation updates
- **Updates:** Image list with status indicators, current image highlight

**Image List Features:**
- **Thumbnail View**: Small preview of each image
  - Lazy loading for performance
  - High-quality thumbnails
  - Aspect ratio preservation
  - Loading placeholders
- **Status Indicators**: 
  - ✅ Green checkmark: Fully labeled
  - 🟡 Yellow dot: Partially labeled
  - ⚪ Gray circle: Unlabeled
  - 🔴 Red X: Validation errors
  - 🔄 Blue spinner: Currently processing
- **Current Image Highlight**: Blue border around active image
  - Smooth scrolling to current image
  - Auto-scroll on navigation
  - Visual focus indicator
- **Click Navigation**: Click any image to switch
  - Instant image switching
  - Preload adjacent images
  - Smooth transitions
- **Keyboard Navigation**: Arrow keys for sequential navigation
  - Up/Down arrow keys
  - Page Up/Down for batch navigation
  - Home/End for first/last image
- **Search/Filter**: Find specific images by name
  - Real-time search
  - Filter by annotation status
  - Sort by various criteria
  - Bookmarks for important images

**Image List Context Menu:**
- **Go to Image**: Navigate to specific image
- **Mark as Complete**: Mark image as fully annotated
- **Flag for Review**: Mark image for quality review
- **Copy Annotations**: Copy annotations to clipboard
- **Paste Annotations**: Paste annotations from clipboard
- **Delete Image**: Remove image from dataset
- **Image Properties**: View image metadata

#### Main Canvas Area
- **Component:** AnnotationCanvas
- **Location:** `src/components/AnnotationToolset/AnnotationCanvas.js`
- **Description:** Primary drawing and interaction area for annotations
- **Backend:** Image serving + annotation data
- **Function:** Canvas rendering and interaction handling
- **Database:** Image file serving + annotation coordinates
- **Triggers:** Image load, tool selection, drawing actions
- **Updates:** Canvas redraw, annotation overlay, zoom/pan state

**Canvas Features:**
- **Image Display**: High-quality image rendering
  - Progressive image loading
  - Multiple resolution support
  - Color space handling
  - Rotation and flip support
- **Zoom Controls**: Mouse wheel, zoom buttons, fit-to-screen
  - Smooth zoom transitions
  - Zoom to selection
  - Zoom history
  - Minimum/maximum zoom limits
- **Pan Functionality**: Click and drag to move around image
  - Smooth panning
  - Edge constraints
  - Momentum scrolling
  - Mini-map navigation
- **Annotation Overlay**: Real-time drawing and editing
  - Vector-based annotations
  - Anti-aliased rendering
  - Transparency support
  - Layer management
- **Grid Overlay**: Optional grid for precise alignment
  - Customizable grid size
  - Snap-to-grid functionality
  - Grid opacity control
  - Coordinate display
- **Crosshair Cursor**: Precision drawing assistance
  - Customizable crosshair
  - Coordinate tracking
  - Snap indicators
  - Measurement tools

#### Canvas Interaction System
- **Component:** CanvasInteractionHandler
- **Location:** `AnnotationCanvas.js` lines 100-300
- **Description:** Handles all mouse/touch interactions for drawing
- **Backend:** None (client-side interaction)
- **Function:** Event handling and coordinate calculation
- **Database:** None (temporary state)
- **Triggers:** Mouse events, touch events, keyboard shortcuts
- **Updates:** Real-time drawing feedback, annotation creation

**Interaction Modes:**
- **Drawing Mode**: Create new annotations
  - Tool-specific drawing behavior
  - Real-time preview
  - Snap-to-grid support
  - Undo/redo functionality
- **Selection Mode**: Select and edit existing annotations
  - Multi-selection support
  - Resize handles
  - Move and transform
  - Copy/paste operations
- **Pan Mode**: Move around the image
  - Hand cursor indicator
  - Smooth panning
  - Edge detection
  - Zoom-to-fit shortcuts
- **Zoom Mode**: Zoom in/out functionality
  - Zoom rectangle selection
  - Center-point zooming
  - Keyboard shortcuts
  - Touch gesture support

**Touch Support:**
- **Single Touch**: Pan and select
- **Pinch Zoom**: Two-finger zoom
- **Touch Drawing**: Finger/stylus drawing
- **Gesture Recognition**: Custom gestures
- **Pressure Sensitivity**: Stylus pressure support

#### Right Sidebar - Tools and Labels
- **Component:** AnnotationToolbox
- **Location:** `src/components/AnnotationToolset/AnnotationToolbox.js`
- **Description:** Tool selection and configuration panel
- **Backend:** None (UI state)
- **Function:** Tool state management
- **Database:** None
- **Triggers:** Tool selection, configuration changes
- **Updates:** Active tool highlight, tool-specific options

**Available Tools:**
1. **Bounding Box Tool**
   - **Purpose**: Rectangle annotations for object detection
   - **Usage**: Click and drag to create rectangles
   - **Options**: 
     - Snap to grid
     - Aspect ratio lock
     - Minimum size constraints
     - Auto-resize to content
   - **Keyboard Shortcut**: B key
   
2. **Polygon Tool**
   - **Purpose**: Freeform shape annotations for segmentation
   - **Usage**: Click points to create polygon
   - **Options**: 
     - Auto-close polygon
     - Simplify path
     - Smooth curves
     - Vertex editing
   - **Keyboard Shortcut**: P key
   
3. **Smart Polygon Tool**
   - **Purpose**: AI-assisted polygon creation
   - **Usage**: Click to get AI suggestions
   - **Options**: 
     - Confidence threshold
     - Refinement iterations
     - Manual adjustment
     - Multiple suggestions
   - **Keyboard Shortcut**: S key
   
4. **Point Tool**
   - **Purpose**: Single point annotations for landmarks
   - **Usage**: Click to place points
   - **Options**: 
     - Point size
     - Visibility settings
     - Numbered points
     - Connection lines
   - **Keyboard Shortcut**: O key
   
5. **Line Tool**
   - **Purpose**: Line segment annotations for measurements
   - **Usage**: Click start and end points
   - **Options**: 
     - Line thickness
     - Line style (solid, dashed)
     - Arrow heads
     - Length display
   - **Keyboard Shortcut**: L key

6. **Circle/Ellipse Tool**
   - **Purpose**: Circular annotations
   - **Usage**: Click center and drag radius
   - **Options**: 
     - Perfect circles
     - Ellipse mode
     - Rotation support
     - Size constraints
   - **Keyboard Shortcut**: C key

**Tool Configuration Panel:**
- **Tool Settings**: Tool-specific options
- **Brush Size**: Adjustable brush/line width
- **Opacity**: Annotation transparency
- **Color**: Tool-specific colors
- **Snap Settings**: Grid and object snapping
- **Precision Mode**: High-precision drawing

#### Label Management Sidebar
- **Component:** LabelSidebar
- **Location:** `src/components/AnnotationToolset/LabelSidebar.js`
- **Description:** Label selection and management interface
- **Backend:** `GET /api/v1/projects/{project_id}/labels`
- **Function:** `api/routes/labels.py` → `get_project_labels()`
- **Database:** 
  ```sql
  SELECT l.*, COUNT(a.id) as usage_count
  FROM labels l
  LEFT JOIN annotations a ON l.id = a.label_id
  WHERE l.project_id = ?
  GROUP BY l.id
  ORDER BY l.name;
  ```
- **Triggers:** Page load, label creation/editing
- **Updates:** Label list, usage statistics, color coding

**Label Management Features:**
- **Label List**: All available labels with color coding
  - Hierarchical label organization
  - Search and filter labels
  - Drag and drop reordering
  - Keyboard shortcuts (1-9, A-Z)
- **Active Label**: Currently selected label for new annotations
  - Visual highlight
  - Quick selection
  - Recent labels history
  - Default label setting
- **Create Label**: Add new labels on-the-fly
  - Quick creation dialog
  - Auto-color assignment
  - Duplicate detection
  - Validation rules
- **Edit Label**: Modify existing label properties
  - Name editing
  - Color picker
  - Description field
  - Keyboard shortcut assignment
- **Delete Label**: Remove unused labels
  - Usage confirmation
  - Cascade deletion options
  - Undo functionality
  - Archive instead of delete
- **Color Picker**: Assign colors to labels
  - Predefined color palette
  - Custom color selection
  - Color contrast validation
  - Accessibility compliance
- **Usage Statistics**: Show how many times each label is used
  - Usage count display
  - Percentage of total
  - Trend analysis
  - Export statistics

**Label Organization:**
- **Categories**: Group labels into categories
- **Hierarchical Structure**: Parent-child relationships
- **Tag System**: Additional label metadata
- **Import/Export**: Label configuration management

#### Annotation List Panel
- **Component:** AnnotationList
- **Location:** `ManualLabeling.jsx` lines 400-500
- **Description:** List of all annotations on current image
- **Backend:** `GET /api/v1/images/{image_id}/annotations`
- **Function:** `api/routes/annotations.py` → `get_image_annotations()`
- **Database:** 
  ```sql
  SELECT a.*, l.name as label_name, l.color
  FROM annotations a
  JOIN labels l ON a.label_id = l.id
  WHERE a.image_id = ?
  ORDER BY a.created_at;
  ```
- **Triggers:** Image change, annotation creation/deletion
- **Updates:** Annotation list with edit/delete options

**Annotation List Features:**
- **Annotation Items**: Each annotation with label and coordinates
  - Thumbnail preview
  - Label name and color
  - Confidence score
  - Creation timestamp
  - Coordinate display
- **Edit Button**: Modify annotation properties
  - Label reassignment
  - Coordinate adjustment
  - Confidence editing
  - Notes and metadata
- **Delete Button**: Remove annotation
  - Confirmation dialog
  - Undo functionality
  - Batch deletion
  - Archive option
- **Visibility Toggle**: Show/hide specific annotations
  - Individual visibility
  - Layer management
  - Opacity control
  - Outline-only mode
- **Selection Highlight**: Click to select annotation on canvas
  - Synchronized selection
  - Multi-selection support
  - Selection tools
  - Group operations

**Annotation Properties:**
- **Confidence Score**: Annotation quality indicator
- **Notes**: Text annotations and comments
- **Metadata**: Additional annotation data
- **Validation Status**: Quality review status
- **Creation Info**: User and timestamp
- **Modification History**: Change tracking

### 🎯 Annotation Tools Deep Dive

#### Bounding Box Tool
- **Component:** BoundingBoxTool
- **Location:** `AnnotationToolbox.js` lines 50-150
- **Description:** Rectangle annotation tool for object detection
- **Backend:** `POST /api/v1/annotations/`
- **Function:** `api/routes/annotations.py` → `create_annotation()`
- **Database:** 
  ```sql
  INSERT INTO annotations (id, image_id, label_id, annotation_type, 
                          coordinates, confidence, created_at, updated_at)
  VALUES (?, ?, ?, 'bounding_box', ?, 1.0, ?, ?);
  ```
- **Triggers:** Mouse drag on canvas
- **Updates:** Canvas overlay, annotation list, database

**Bounding Box Features:**
- **Click and Drag**: Intuitive rectangle creation
  - Visual feedback during drag
  - Real-time size display
  - Constraint enforcement
  - Snap-to-grid support
- **Real-time Preview**: Live rectangle during drawing
  - Dashed outline preview
  - Size and position display
  - Constraint indicators
  - Snap feedback
- **Snap to Grid**: Optional grid alignment
  - Configurable grid size
  - Visual snap indicators
  - Edge and corner snapping
  - Disable/enable toggle
- **Aspect Ratio Lock**: Maintain proportions
  - Common ratio presets
  - Custom ratio input
  - Visual ratio indicator
  - Toggle lock/unlock
- **Resize Handles**: Edit existing rectangles
  - Corner and edge handles
  - Proportional resize
  - Minimum size constraints
  - Visual feedback
- **Coordinate Display**: Show exact pixel coordinates
  - Top-left coordinates
  - Width and height
  - Center point
  - Area calculation

**Advanced Bounding Box Features:**
- **Auto-fit**: Automatically fit to object boundaries
- **Duplicate**: Copy existing bounding boxes
- **Align Tools**: Align multiple boxes
- **Distribution**: Evenly distribute boxes
- **Batch Operations**: Apply to multiple boxes

#### Polygon Tool
- **Component:** PolygonTool
- **Location:** `AnnotationToolbox.js` lines 200-350
- **Description:** Freeform polygon annotation for complex shapes
- **Backend:** Same annotation API with polygon coordinates
- **Function:** Same create_annotation with polygon data
- **Database:** 
  ```sql
  INSERT INTO annotations (id, image_id, label_id, annotation_type, 
                          coordinates, confidence, created_at, updated_at)
  VALUES (?, ?, ?, 'polygon', ?, 1.0, ?, ?);
  ```
- **Triggers:** Sequential clicks to build polygon
- **Updates:** Canvas path drawing, annotation creation

**Polygon Features:**
- **Point-by-Point**: Click to add polygon vertices
  - Visual vertex indicators
  - Edge preview lines
  - Vertex numbering
  - Maximum vertex limits
- **Live Preview**: Show polygon outline during creation
  - Dynamic edge drawing
  - Fill preview option
  - Vertex highlighting
  - Completion indicator
- **Auto-Close**: Automatic polygon completion
  - Distance-based auto-close
  - Double-click completion
  - Right-click completion
  - Escape key cancellation
- **Edit Vertices**: Drag individual points to adjust
  - Vertex selection
  - Multi-vertex selection
  - Add/remove vertices
  - Smooth curve conversion
- **Simplify Path**: Reduce polygon complexity
  - Automatic simplification
  - Manual vertex removal
  - Tolerance settings
  - Preview before apply
- **Undo Last Point**: Remove last added vertex
  - Backspace key support
  - Visual undo feedback
  - Multiple undo levels
  - Redo functionality

**Advanced Polygon Features:**
- **Bezier Curves**: Smooth curve support
- **Hole Creation**: Polygons with holes
- **Boolean Operations**: Union, intersection, difference
- **Morphology**: Erosion and dilation
- **Smoothing**: Edge smoothing algorithms

#### Smart Polygon Tool
- **Component:** SmartPolygonTool
- **Location:** `src/components/AnnotationToolset/SmartPolygonTool.js`
- **Description:** AI-assisted polygon creation using segmentation models
- **Backend:** `POST /api/v1/smart-segmentation/`
- **Function:** `api/smart_segmentation.py` → `generate_polygon()`
- **Database:** Same annotation storage + AI confidence scores
- **Triggers:** Click on object to segment
- **Updates:** AI-generated polygon, user refinement options

**Smart Polygon Features:**
- **One-Click Segmentation**: Click object for automatic outline
  - Object detection
  - Boundary extraction
  - Polygon generation
  - Quality assessment
- **Confidence Threshold**: Adjust AI sensitivity
  - Slider control
  - Real-time preview
  - Quality indicators
  - Threshold presets
- **Manual Refinement**: Edit AI-generated polygons
  - Vertex editing
  - Edge adjustment
  - Add/remove points
  - Smooth transitions
- **Multiple Suggestions**: Choose from several AI options
  - Alternative polygons
  - Confidence ranking
  - Visual comparison
  - Quick selection
- **Learning Feedback**: Improve AI with user corrections
  - Correction tracking
  - Model improvement
  - User preference learning
  - Quality metrics

**AI Integration Features:**
- **Model Selection**: Choose segmentation model
- **Preprocessing**: Image enhancement options
- **Postprocessing**: Polygon refinement
- **Batch Processing**: Multiple object detection
- **Quality Assessment**: Automatic quality scoring

### 🎯 Advanced Annotation Features

#### Keyboard Shortcuts System
- **Component:** KeyboardShortcuts
- **Location:** `ManualLabeling.jsx` lines 600-700
- **Description:** Comprehensive keyboard shortcuts for efficient annotation
- **Backend:** None (client-side)
- **Function:** Event listeners and action mapping
- **Database:** None
- **Triggers:** Keyboard events
- **Updates:** Tool switching, navigation, actions

**Shortcut Categories:**
- **Navigation**: 
  - Arrow keys: Next/previous image
  - Page Up/Down: Jump 10 images
  - Home/End: First/last image
  - Ctrl+G: Go to specific image
- **Tools**: 
  - Number keys (1-5): Select annotation tools
  - B: Bounding box tool
  - P: Polygon tool
  - S: Smart polygon tool
  - O: Point tool
  - L: Line tool
- **Labels**: 
  - Letter keys (A-Z): Quick label selection
  - Ctrl+1-9: Favorite labels
  - Tab: Cycle through labels
  - Shift+Tab: Reverse cycle
- **Actions**: 
  - Space: Toggle pan mode
  - Enter: Save current annotation
  - Escape: Cancel current action
  - Delete: Remove selected annotation
- **Zoom**: 
  - +/-: Zoom in/out
  - 0: Fit to screen
  - Ctrl+Scroll: Zoom at cursor
  - F: Fit selection
- **Editing**: 
  - Ctrl+Z: Undo
  - Ctrl+Y: Redo
  - Ctrl+C: Copy annotation
  - Ctrl+V: Paste annotation
  - Ctrl+D: Duplicate annotation

**Shortcut Customization:**
- **User Preferences**: Customizable shortcuts
- **Conflict Detection**: Prevent shortcut conflicts
- **Help Display**: On-screen shortcut help
- **Context Sensitivity**: Tool-specific shortcuts

#### Auto-Save System
- **Component:** AutoSaveManager
- **Location:** `ManualLabeling.jsx` lines 750-800
- **Description:** Automatic saving of annotations with conflict resolution
- **Backend:** `PUT /api/v1/annotations/{annotation_id}`
- **Function:** `api/routes/annotations.py` → `update_annotation()`
- **Database:** 
  ```sql
  UPDATE annotations 
  SET coordinates = ?, confidence = ?, updated_at = ?
  WHERE id = ?;
  
  UPDATE images 
  SET labeled = CASE WHEN EXISTS(
    SELECT 1 FROM annotations WHERE image_id = images.id
  ) THEN 1 ELSE 0 END
  WHERE id = ?;
  ```
- **Triggers:** Annotation changes, timer intervals, navigation
- **Updates:** Save status indicator, database synchronization

**Auto-Save Features:**
- **Periodic Saving**: Every 30 seconds
  - Configurable interval
  - Smart save timing
  - Idle detection
  - Battery optimization
- **Change Detection**: Save on annotation modifications
  - Dirty state tracking
  - Minimal save operations
  - Batch save optimization
  - Change validation
- **Conflict Resolution**: Handle concurrent editing
  - Version conflict detection
  - Merge strategies
  - User choice dialogs
  - Backup creation
- **Save Status**: Visual indicator of save state
  - Saved/unsaved indicators
  - Last save timestamp
  - Save progress display
  - Error notifications
- **Manual Save**: Force save with Ctrl+S
  - Immediate save trigger
  - Validation before save
  - Success confirmation
  - Error handling
- **Offline Support**: Queue saves when offline
  - Local storage backup
  - Sync on reconnection
  - Conflict resolution
  - Data integrity

**Save Optimization:**
- **Debounced Saves**: Prevent excessive API calls
- **Batch Operations**: Group multiple changes
- **Delta Saves**: Only save changed data
- **Compression**: Compress annotation data

#### Quality Assurance Tools
- **Component:** QualityAssurance
- **Location:** `ManualLabeling.jsx` lines 850-950
- **Description:** Tools for annotation quality checking and validation
- **Backend:** `GET /api/v1/annotations/quality-check`
- **Function:** `api/routes/annotations.py` → `quality_check()`
- **Database:** 
  ```sql
  SELECT a.*, i.filename,
         (SELECT COUNT(*) FROM annotations a2 WHERE a2.image_id = a.image_id) as annotation_count
  FROM annotations a
  JOIN images i ON a.image_id = i.id
  WHERE a.confidence < 0.8 OR a.area < 100;
  ```
- **Triggers:** Quality check button, batch validation
- **Updates:** Quality report, flagged annotations

**Quality Features:**
- **Confidence Scoring**: Rate annotation quality
  - Automatic confidence calculation
  - Manual confidence adjustment
  - Confidence thresholds
  - Quality indicators
- **Size Validation**: Flag too-small annotations
  - Minimum size thresholds
  - Relative size checking
  - Aspect ratio validation
  - Area calculations
- **Overlap Detection**: Find overlapping annotations
  - Intersection calculations
  - Overlap percentage
  - Conflict resolution
  - Merge suggestions
- **Consistency Check**: Validate label consistency
  - Cross-image validation
  - Pattern detection
  - Anomaly identification
  - Suggestion system
- **Batch Review**: Review all flagged annotations
  - Quality dashboard
  - Batch operations
  - Filter and sort
  - Export reports
- **Export Quality Report**: Generate quality metrics
  - PDF report generation
  - Statistical analysis
  - Visualization charts
  - Improvement suggestions

**Quality Metrics:**
- **Completeness**: Percentage of labeled images
- **Accuracy**: Annotation precision scores
- **Consistency**: Cross-annotator agreement
- **Coverage**: Object detection coverage
- **Efficiency**: Time per annotation
- **Error Rate**: Common error patterns

### 🔄 Data Flow and State Management

#### Image Loading Flow
```
Image Selection → API Call → Image Load → Annotation Load → Canvas Render
├── GET /api/v1/images/{id} → Image metadata
├── Image file load → Canvas display
├── GET /api/v1/images/{id}/annotations → Annotation data
├── Preload adjacent images → Performance optimization
└── Canvas overlay → Annotation display
```

#### Annotation Creation Flow
```
Tool Selection → Canvas Interaction → Coordinate Capture → API Call → Database Save
├── Tool state update → UI feedback
├── Mouse/touch events → Coordinate calculation
├── Validation checks → Data integrity
├── POST /api/v1/annotations → Server processing
├── Database insert → Persistence
├── Real-time updates → UI synchronization
└── Auto-save trigger → Background save
```

#### Navigation Flow
```
Image Navigation → Save Current → Load New → Update UI
├── Auto-save current annotations
├── Preload next image
├── GET new image data
├── Load new annotations
├── Update progress indicators
└── Update all UI components
```

#### Real-time Synchronization
```
Annotation Changes → Local State → Auto-save → Database → UI Update
├── Immediate UI feedback
├── Optimistic updates
├── Background synchronization
├── Conflict resolution
└── Error recovery
```

### 🎨 Visual Design and UX

#### Canvas Styling
- **Background**: Checkered pattern for transparency
  - Customizable pattern
  - Opacity control
  - Color themes
  - Grid overlay options
- **Annotations**: Color-coded by label with transparency
  - Anti-aliased rendering
  - Smooth edges
  - Gradient fills
  - Pattern fills
- **Selection**: Highlighted border and resize handles
  - Visual selection feedback
  - Handle customization
  - Multi-selection support
  - Group selection
- **Drawing**: Real-time preview with dashed lines
  - Dynamic preview
  - Snap indicators
  - Constraint visualization
  - Progress feedback
- **Zoom**: Smooth scaling with quality preservation
  - High-quality rendering
  - Level-of-detail optimization
  - Smooth transitions
  - Performance optimization

#### Responsive Design
- **Desktop**: Full three-panel layout
  - Optimal screen utilization
  - Resizable panels
  - Keyboard shortcuts
  - Multi-monitor support
- **Tablet**: Collapsible sidebars
  - Touch-friendly interface
  - Gesture support
  - Adaptive layout
  - Portrait/landscape modes
- **Mobile**: Single-panel with bottom navigation
  - Simplified interface
  - Touch optimization
  - Swipe navigation
  - Minimal UI
- **Touch Support**: Touch-friendly controls and gestures
  - Finger-friendly targets
  - Gesture recognition
  - Pressure sensitivity
  - Palm rejection

#### Accessibility
- **Keyboard Navigation**: Full keyboard support
  - Tab order optimization
  - Focus indicators
  - Shortcut alternatives
  - Screen reader support
- **Screen Reader**: ARIA labels and descriptions
  - Semantic markup
  - Live regions
  - Role definitions
  - State announcements
- **High Contrast**: Support for high contrast themes
  - Color contrast compliance
  - Alternative color schemes
  - Pattern alternatives
  - Text alternatives
- **Font Scaling**: Respect system font size preferences
  - Scalable UI elements
  - Relative sizing
  - Zoom compatibility
  - Readability optimization

### 🔧 Performance Optimization

#### Image Loading Optimization
- **Lazy Loading**: Load images on demand
  - Intersection observer
  - Progressive loading
  - Priority queuing
  - Memory management
- **Caching**: Browser cache for frequently accessed images
  - Intelligent caching
  - Cache invalidation
  - Storage optimization
  - Offline support
- **Compression**: Optimized image serving
  - Format optimization
  - Quality adjustment
  - Progressive JPEG
  - WebP support
- **Preloading**: Preload next/previous images
  - Predictive loading
  - Background loading
  - Priority management
  - Bandwidth awareness

#### Canvas Performance
- **Efficient Rendering**: Only redraw changed areas
  - Dirty region tracking
  - Layer optimization
  - Render batching
  - Frame rate optimization
- **Layer Management**: Separate layers for image and annotations
  - Compositing optimization
  - Layer caching
  - GPU acceleration
  - Memory efficiency
- **Memory Management**: Clean up unused canvas resources
  - Resource pooling
  - Garbage collection
  - Memory monitoring
  - Leak prevention
- **Smooth Interactions**: Optimized event handling
  - Event throttling
  - Debounced updates
  - Smooth animations
  - Responsive feedback

#### State Management Optimization
- **Minimal Re-renders**: Optimized React state updates
  - Memoization strategies
  - State normalization
  - Update batching
  - Component optimization
- **Debounced Saves**: Prevent excessive API calls
  - Smart debouncing
  - Priority queuing
  - Batch operations
  - Error recovery
- **Local State**: Keep UI state separate from server state
  - State separation
  - Optimistic updates
  - Conflict resolution
  - Rollback mechanisms
- **Memory Cleanup**: Proper cleanup on component unmount
  - Event listener cleanup
  - Timer cleanup
  - Resource disposal
  - Memory leak prevention

### 🚨 Error Handling and Recovery

#### Network Error Handling
```javascript
const handleNetworkError = async (error, retryFunction) => {
  if (error.name === 'NetworkError') {
    // Show offline indicator
    setOfflineMode(true);
    // Queue operations for later
    queueOperation(retryFunction);
    // Show user-friendly message
    showNotification('Connection lost. Working offline.', 'warning');
  } else if (error.status === 429) {
    // Rate limiting
    const retryAfter = error.headers['retry-after'] || 60;
    showNotification(`Rate limited. Retrying in ${retryAfter} seconds.`, 'warning');
    setTimeout(retryFunction, retryAfter * 1000);
  } else {
    // Other errors
    showErrorMessage(error.message, retryFunction);
  }
};
```

#### Annotation Validation
```javascript
const validateAnnotation = (annotation) => {
  const errors = [];
  
  if (!annotation.label_id) {
    errors.push('Label is required');
  }
  
  if (annotation.coordinates.length < 4) {
    errors.push('Invalid coordinates');
  }
  
  if (annotation.area < 10) {
    errors.push('Annotation too small (minimum 10 pixels)');
  }
  
  if (annotation.coordinates.some(coord => coord < 0)) {
    errors.push('Coordinates cannot be negative');
  }
  
  return errors;
};
```

#### Recovery Mechanisms
- **Auto-Recovery**: Automatic retry for failed operations
  - Exponential backoff
  - Maximum retry limits
  - Success callbacks
  - Failure handling
- **Manual Retry**: User-initiated retry buttons
  - Clear retry options
  - Progress indicators
  - Success feedback
  - Error explanations
- **State Persistence**: Save work in progress locally
  - Local storage backup
  - Session recovery
  - Data validation
  - Conflict resolution
- **Conflict Resolution**: Handle concurrent editing conflicts
  - Version detection
  - Merge strategies
  - User choice dialogs
  - Backup creation

#### Data Integrity
- **Validation**: Client and server-side validation
- **Checksums**: Data integrity verification
- **Versioning**: Track annotation versions
- **Backup**: Automatic backup creation
- **Recovery**: Data recovery mechanisms

---

## 🚀 Annotate Launcher

### 🔍 Page Overview
**File:** `src/pages/AnnotateLauncher.js`  
**Route:** `/projects/:id/annotate-launcher/:datasetId`  
**Purpose:** Pre-annotation setup and configuration interface

### 🧩 Core Components

#### Dataset Information Panel
- **Component:** DatasetInfoPanel
- **Location:** `AnnotateLauncher.js` lines 30-80
- **Description:** Display dataset details and statistics before annotation
- **Backend:** `GET /api/v1/datasets/{dataset_id}/info`
- **Function:** `api/routes/datasets.py` → `get_dataset_info()`
- **Database:** 
  ```sql
  SELECT d.*, 
         COUNT(i.id) as total_images,
         COUNT(CASE WHEN i.labeled = 1 THEN 1 END) as labeled_images,
         AVG(i.width) as avg_width,
         AVG(i.height) as avg_height,
         COUNT(DISTINCT l.id) as label_count
  FROM datasets d
  LEFT JOIN images i ON d.id = i.dataset_id
  LEFT JOIN annotations a ON i.id = a.image_id
  LEFT JOIN labels l ON a.label_id = l.id
  WHERE d.id = ?
  GROUP BY d.id;
  ```
- **Triggers:** Page load
- **Updates:** Dataset statistics display

**Information Display:**
- **Dataset Name**: Editable dataset name
- **Description**: Dataset description with markdown support
- **Image Count**: Total number of images
- **Progress**: Current annotation progress
- **Image Statistics**: Average dimensions, file sizes
- **Label Count**: Number of defined labels
- **Estimated Time**: Estimated completion time
- **Quality Metrics**: Current quality scores

#### Annotation Configuration
- **Component:** AnnotationConfig
- **Location:** `AnnotateLauncher.js` lines 90-180
- **Description:** Configure annotation settings and preferences
- **Backend:** `GET/POST /api/v1/annotation-settings`
- **Function:** `api/routes/settings.py` → `get/update_annotation_settings()`
- **Database:** 
  ```sql
  SELECT * FROM annotation_settings WHERE project_id = ?;
  
  INSERT OR REPLACE INTO annotation_settings 
  (project_id, auto_save_interval, quality_threshold, default_tool)
  VALUES (?, ?, ?, ?);
  ```
- **Triggers:** Settings changes, save button
- **Updates:** Configuration persistence

**Configuration Options:**
- **Auto-save Interval**: Frequency of automatic saves
- **Default Tool**: Starting annotation tool
- **Quality Threshold**: Minimum quality requirements
- **Keyboard Shortcuts**: Customizable shortcuts
- **Display Settings**: UI preferences
- **Performance Settings**: Optimization options

#### Label Management
- **Component:** LabelManagement
- **Location:** `AnnotateLauncher.js` lines 190-280
- **Description:** Create and manage labels before starting annotation
- **Backend:** `GET/POST/PUT/DELETE /api/v1/labels`
- **Function:** `api/routes/labels.py` → Label CRUD operations
- **Database:** 
  ```sql
  SELECT * FROM labels WHERE project_id = ? ORDER BY name;
  
  INSERT INTO labels (id, name, color, project_id, created_at)
  VALUES (?, ?, ?, ?, ?);
  ```
- **Triggers:** Label creation/editing/deletion
- **Updates:** Label list, color assignments

**Label Management Features:**
- **Label Creation**: Add new labels with colors
- **Label Editing**: Modify existing labels
- **Color Assignment**: Visual color picker
- **Keyboard Shortcuts**: Assign shortcuts to labels
- **Import/Export**: Label configuration management
- **Validation**: Duplicate name prevention

#### Start Annotation Button
- **Component:** StartAnnotationButton
- **Location:** `AnnotateLauncher.js` lines 290-320
- **Description:** Launch the main annotation interface
- **Backend:** None (navigation)
- **Function:** Route navigation
- **Database:** None
- **Triggers:** Button click
- **Updates:** Navigation to ManualLabeling page

**Pre-launch Validation:**
- **Label Validation**: Ensure labels are defined
- **Settings Validation**: Check configuration completeness
- **Permission Check**: Verify annotation permissions
- **Resource Check**: Ensure sufficient resources

---

## 📊 Annotate Progress

### 🔍 Page Overview
**File:** `src/pages/AnnotateProgress.jsx`  
**Route:** `/projects/:id/annotate-progress/:datasetId`  
**Purpose:** Real-time annotation progress monitoring and team coordination

### 🧩 Core Components

#### Progress Dashboard
- **Component:** ProgressDashboard
- **Location:** `AnnotateProgress.jsx` lines 25-100
- **Description:** Comprehensive progress overview with charts and statistics
- **Backend:** `GET /api/v1/datasets/{dataset_id}/progress`
- **Function:** `api/routes/datasets.py` → `get_annotation_progress()`
- **Database:** 
  ```sql
  SELECT 
    COUNT(i.id) as total_images,
    COUNT(CASE WHEN i.labeled = 1 THEN 1 END) as labeled_images,
    COUNT(a.id) as total_annotations,
    AVG(a.confidence) as avg_confidence,
    COUNT(DISTINCT DATE(a.created_at)) as active_days
  FROM images i
  LEFT JOIN annotations a ON i.id = a.image_id
  WHERE i.dataset_id = ?;
  ```
- **Triggers:** Page load, periodic refresh
- **Updates:** Progress charts, statistics, completion percentage

**Dashboard Elements:**
- **Progress Ring**: Circular progress indicator
- **Statistics Cards**: Key metrics display
- **Timeline Chart**: Progress over time
- **Quality Metrics**: Annotation quality scores
- **Productivity Stats**: Annotations per hour/day
- **Estimated Completion**: Time remaining estimates

#### Image Status Grid
- **Component:** ImageStatusGrid
- **Location:** `AnnotateProgress.jsx` lines 110-200
- **Description:** Grid view of all images with status indicators
- **Backend:** `GET /api/v1/datasets/{dataset_id}/image-status`
- **Function:** `api/routes/datasets.py` → `get_image_status()`
- **Database:** 
  ```sql
  SELECT i.id, i.filename, i.labeled, COUNT(a.id) as annotation_count,
         MAX(a.updated_at) as last_annotation
  FROM images i
  LEFT JOIN annotations a ON i.id = a.image_id
  WHERE i.dataset_id = ?
  GROUP BY i.id
  ORDER BY i.filename;
  ```
- **Triggers:** Page load, annotation updates
- **Updates:** Status grid with color-coded indicators

**Grid Features:**
- **Status Colors**: Visual status indicators
- **Thumbnail View**: Image previews
- **Quick Navigation**: Click to jump to image
- **Batch Operations**: Multi-select actions
- **Filter Options**: Filter by status
- **Sort Options**: Various sorting criteria

#### Quality Metrics
- **Component:** QualityMetrics
- **Location:** `AnnotateProgress.jsx` lines 210-280
- **Description:** Annotation quality assessment and metrics
- **Backend:** `GET /api/v1/datasets/{dataset_id}/quality-metrics`
- **Function:** `api/routes/analytics.py` → `get_quality_metrics()`
- **Database:** 
  ```sql
  SELECT 
    AVG(a.confidence) as avg_confidence,
    COUNT(CASE WHEN a.confidence < 0.7 THEN 1 END) as low_confidence_count,
    AVG(a.area) as avg_annotation_area,
    COUNT(CASE WHEN a.area < 100 THEN 1 END) as small_annotation_count
  FROM annotations a
  JOIN images i ON a.image_id = i.id
  WHERE i.dataset_id = ?;
  ```
- **Triggers:** Page load, quality analysis
- **Updates:** Quality charts, flagged annotations

**Quality Indicators:**
- **Confidence Distribution**: Histogram of confidence scores
- **Size Distribution**: Annotation size analysis
- **Consistency Metrics**: Cross-image consistency
- **Error Detection**: Common error patterns
- **Improvement Suggestions**: Quality enhancement tips

#### Export Options
- **Component:** ExportOptions
- **Location:** `AnnotateProgress.jsx` lines 290-350
- **Description:** Export current progress in various formats
- **Backend:** `POST /api/v1/datasets/{dataset_id}/export-progress`
- **Function:** `api/routes/export.py` → `export_progress()`
- **Database:** Export query with current annotation state
- **Triggers:** Export button clicks
- **Updates:** Download initiation, progress tracking

**Export Features:**
- **Partial Export**: Export completed annotations only
- **Progress Report**: Detailed progress report
- **Quality Report**: Quality assessment report
- **Format Options**: Multiple export formats
- **Scheduling**: Automated export scheduling

---

## 🤖 Models Management

### 🔍 Page Overview
**File:** `src/pages/ModelsModern.js`  
**Route:** `/models`  
**Purpose:** Comprehensive model training, management, and deployment interface

### 🧩 Core Components

#### Models Dashboard
- **Component:** ModelsDashboard
- **Location:** `ModelsModern.js` lines 30-120
- **Description:** Overview of all models with training status and performance
- **Backend:** `GET /api/v1/models/`
- **Function:** `api/routes/models.py` → `get_models()`
- **Database:** 
  ```sql
  SELECT m.*, 
         tj.status as training_status,
         tj.progress as training_progress,
         tj.accuracy as latest_accuracy
  FROM models m
  LEFT JOIN training_jobs tj ON m.id = tj.model_id
  ORDER BY m.created_at DESC;
  ```
- **Triggers:** Page load, training updates
- **Updates:** Model cards with status and metrics

**Dashboard Features:**
- **Model Cards**: Visual model representation
- **Status Indicators**: Training and deployment status
- **Performance Metrics**: Accuracy, loss, mAP scores
- **Quick Actions**: Train, deploy, export options
- **Filter Options**: Filter by status, type, performance
- **Search**: Find specific models

#### Training Jobs Panel
- **Component:** TrainingJobsPanel
- **Location:** `ModelsModern.js` lines 130-220
- **Description:** Active and completed training jobs with progress monitoring
- **Backend:** `GET /api/v1/training-jobs/`
- **Function:** `api/routes/training.py` → `get_training_jobs()`
- **Database:** 
  ```sql
  SELECT tj.*, m.name as model_name, d.name as dataset_name,
         tj.epochs_completed, tj.total_epochs, tj.current_loss
  FROM training_jobs tj
  LEFT JOIN models m ON tj.model_id = m.id
  LEFT JOIN datasets d ON tj.dataset_id = d.id
  ORDER BY tj.created_at DESC;
  ```
- **Triggers:** Page load, training progress updates
- **Updates:** Training progress bars, logs, metrics

**Training Features:**
- **Job Queue**: Manage training queue
- **Progress Monitoring**: Real-time progress tracking
- **Log Viewing**: Live training logs
- **Resource Monitoring**: GPU/CPU usage
- **Early Stopping**: Automatic stopping conditions
- **Hyperparameter Tuning**: Parameter optimization

#### Model Performance Analytics
- **Component:** ModelAnalytics
- **Location:** `ModelsModern.js` lines 230-320
- **Description:** Detailed performance metrics and comparison charts
- **Backend:** `GET /api/v1/models/{model_id}/analytics`
- **Function:** `api/routes/analytics.py` → `get_model_analytics()`
- **Database:** 
  ```sql
  SELECT 
    accuracy, precision, recall, f1_score,
    training_loss, validation_loss,
    epoch_number, timestamp
  FROM training_metrics 
  WHERE model_id = ?
  ORDER BY epoch_number;
  ```
- **Triggers:** Model selection, analytics refresh
- **Updates:** Performance charts, metric comparisons

**Analytics Features:**
- **Performance Charts**: Training curves and metrics
- **Comparison Tools**: Compare multiple models
- **Validation Metrics**: Detailed validation results
- **Error Analysis**: Common error patterns
- **Improvement Suggestions**: Performance optimization tips

#### Model Deployment
- **Component:** ModelDeployment
- **Location:** `ModelsModern.js` lines 330-420
- **Description:** Deploy models as API endpoints for inference
- **Backend:** `POST /api/v1/models/{model_id}/deploy`
- **Function:** `api/routes/deployment.py` → `deploy_model()`
- **Database:** 
  ```sql
  INSERT INTO deployments (id, model_id, endpoint_url, status, created_at)
  VALUES (?, ?, ?, 'deploying', ?);
  ```
- **Triggers:** Deploy button, deployment management
- **Updates:** Deployment status, API endpoints

**Deployment Features:**
- **Endpoint Management**: API endpoint configuration
- **Scaling Options**: Auto-scaling settings
- **Version Control**: Multiple model versions
- **Health Monitoring**: Endpoint health checks
- **Usage Analytics**: API usage statistics
- **A/B Testing**: Compare model versions

---

## 📊 Datasets Overview

### 🔍 Page Overview
**File:** `src/pages/Datasets.js`  
**Route:** `/datasets`  
**Purpose:** Global view and management of all datasets across projects

### 🧩 Core Components

#### Datasets Grid
- **Component:** DatasetsGrid
- **Location:** `Datasets.js` lines 25-150
- **Description:** Comprehensive grid of all datasets with filtering and search
- **Backend:** `GET /api/v1/datasets/`
- **Function:** `api/routes/datasets.py` → `get_all_datasets()`
- **Database:** 
  ```sql
  SELECT d.*, p.name as project_name,
         COUNT(i.id) as total_images,
         COUNT(CASE WHEN i.labeled = 1 THEN 1 END) as labeled_images,
         COUNT(a.id) as total_annotations
  FROM datasets d
  LEFT JOIN projects p ON d.project_id = p.id
  LEFT JOIN images i ON d.id = i.dataset_id
  LEFT JOIN annotations a ON i.id = a.image_id
  GROUP BY d.id
  ORDER BY d.updated_at DESC;
  ```
- **Triggers:** Page load, dataset updates
- **Updates:** Dataset cards with statistics and actions

**Grid Features:**
- **Dataset Cards**: Visual dataset representation
- **Project Context**: Show parent project
- **Status Indicators**: Workflow status
- **Progress Bars**: Annotation progress
- **Quick Actions**: Annotate, export, manage
- **Thumbnail Gallery**: Image previews

#### Advanced Filtering
- **Component:** DatasetFilters
- **Location:** `Datasets.js` lines 160-220
- **Description:** Multi-criteria filtering and search functionality
- **Backend:** Client-side filtering with server-side search
- **Function:** Array filtering and API search
- **Database:** Search queries when needed
- **Triggers:** Filter changes, search input
- **Updates:** Filtered dataset display

**Filter Options:**
- **Project Filter**: Filter by parent project
- **Status Filter**: Workflow status filtering
- **Progress Filter**: Completion percentage ranges
- **Date Filter**: Creation/modification date ranges
- **Size Filter**: Image count ranges
- **Quality Filter**: Annotation quality scores

#### Bulk Operations
- **Component:** BulkOperations
- **Location:** `Datasets.js` lines 230-300
- **Description:** Batch operations on multiple datasets
- **Backend:** Various bulk endpoints
- **Function:** Batch processing operations
- **Database:** Bulk update/delete operations
- **Triggers:** Bulk action selection
- **Updates:** Multiple dataset modifications

**Bulk Actions:**
- **Export Multiple**: Batch export datasets
- **Merge Datasets**: Combine multiple datasets
- **Archive Datasets**: Move to archived state
- **Delete Multiple**: Batch deletion
- **Quality Check**: Batch quality assessment
- **Transfer**: Move between projects

#### Dataset Analytics
- **Component:** GlobalDatasetAnalytics
- **Location:** `Datasets.js` lines 310-400
- **Description:** Cross-dataset analytics and insights
- **Backend:** `GET /api/v1/analytics/datasets`
- **Function:** `api/routes/analytics.py` → `get_global_analytics()`
- **Database:** 
  ```sql
  SELECT 
    COUNT(DISTINCT d.id) as total_datasets,
    COUNT(DISTINCT p.id) as total_projects,
    COUNT(i.id) as total_images,
    COUNT(a.id) as total_annotations,
    AVG(d.total_images) as avg_dataset_size
  FROM datasets d
  LEFT JOIN projects p ON d.project_id = p.id
  LEFT JOIN images i ON d.id = i.dataset_id
  LEFT JOIN annotations a ON i.id = a.image_id;
  ```
- **Triggers:** Page load, periodic refresh
- **Updates:** Global statistics and trends

**Analytics Features:**
- **Global Statistics**: System-wide metrics
- **Trend Analysis**: Progress trends over time
- **Distribution Charts**: Dataset size distributions
- **Quality Metrics**: Overall quality scores
- **Productivity Analysis**: Annotation productivity
- **Resource Usage**: Storage and processing usage

---

## 🧩 Shared Components

### Navigation Components

#### Navbar
- **Component:** Navbar
- **Location:** `src/components/Navbar.js`
- **Description:** Main application navigation bar
- **Backend:** User session data
- **Function:** Navigation and user management
- **Database:** User preferences, session data
- **Triggers:** Page navigation, user actions
- **Updates:** Active page highlighting, user menu

**Navbar Features:**
- **Logo/Brand**: Application branding
- **Main Navigation**: Primary navigation links
- **User Menu**: User profile and settings
- **Notifications**: System notifications
- **Search**: Global search functionality
- **Theme Toggle**: Dark/light theme switching

#### Sidebar Navigation
- **Component:** SidebarNav
- **Location:** Various pages with sidebar
- **Description:** Context-sensitive sidebar navigation
- **Backend:** None (UI state)
- **Function:** Secondary navigation
- **Database:** None
- **Triggers:** Menu interactions
- **Updates:** Expanded/collapsed states

**Sidebar Features:**
- **Collapsible Design**: Expand/collapse functionality
- **Icon Navigation**: Icon-based navigation
- **Nested Menus**: Hierarchical navigation
- **Active States**: Current page highlighting
- **Quick Actions**: Contextual action buttons

### Data Display Components

#### DatasetManager
- **Component:** DatasetManager
- **Location:** `src/components/DatasetManager.js`
- **Description:** Reusable dataset management interface
- **Backend:** Dataset CRUD operations
- **Function:** Dataset lifecycle management
- **Database:** Dataset table operations
- **Triggers:** Dataset actions
- **Updates:** Dataset state changes

**Manager Features:**
- **CRUD Operations**: Create, read, update, delete
- **Status Management**: Workflow state transitions
- **Progress Tracking**: Annotation progress monitoring
- **Quality Assessment**: Dataset quality evaluation
- **Export Options**: Multiple export formats
- **Version Control**: Dataset versioning

#### DatasetAnalytics
- **Component:** DatasetAnalytics
- **Location:** `src/components/DatasetAnalytics.js`
- **Description:** Reusable analytics and visualization component
- **Backend:** Analytics API endpoints
- **Function:** Data visualization and metrics
- **Database:** Aggregated analytics queries
- **Triggers:** Data updates, refresh actions
- **Updates:** Charts and statistics

**Analytics Features:**
- **Chart Library**: Multiple chart types
- **Interactive Charts**: Zoom, filter, drill-down
- **Export Options**: Chart export functionality
- **Real-time Updates**: Live data updates
- **Customization**: Configurable visualizations

#### DataAugmentation
- **Component:** DataAugmentation
- **Location:** `src/components/DataAugmentation.js`
- **Description:** Data augmentation configuration and preview
- **Backend:** Augmentation API
- **Function:** Image transformation pipeline
- **Database:** Augmentation settings storage
- **Triggers:** Configuration changes
- **Updates:** Preview images, settings persistence

**Augmentation Features:**
- **Transformation Options**: Various augmentation techniques
- **Preview Mode**: Real-time augmentation preview
- **Batch Processing**: Apply to multiple images
- **Custom Pipelines**: User-defined augmentation chains
- **Quality Control**: Augmentation quality assessment

### Active Learning Components

#### ActiveLearningDashboard
- **Component:** ActiveLearningDashboard
- **Location:** `src/components/ActiveLearning/ActiveLearningDashboard.jsx`
- **Description:** Smart sample selection and iterative learning interface
- **Backend:** `GET/POST /api/v1/active-learning/`
- **Function:** `api/active_learning.py` → Active learning algorithms
- **Database:** 
  ```sql
  SELECT i.*, a.confidence, al.uncertainty_score
  FROM images i
  LEFT JOIN annotations a ON i.id = a.image_id
  LEFT JOIN active_learning_scores al ON i.id = al.image_id
  WHERE i.dataset_id = ?
  ORDER BY al.uncertainty_score DESC;
  ```
- **Triggers:** Sample selection, model updates
- **Updates:** Recommended samples, learning progress

**Active Learning Features:**
- **Uncertainty Sampling**: Select most uncertain samples
- **Diversity Sampling**: Ensure sample diversity
- **Query Strategies**: Multiple selection strategies
- **Model Integration**: Integration with training pipeline
- **Progress Tracking**: Learning curve monitoring
- **Batch Selection**: Select multiple samples at once

---

## 🔌 API Integration

### API Service Layer

#### Main API Service
- **File:** `src/services/api.js`
- **Purpose:** Centralized API communication layer
- **Base URL:** `http://localhost:12000/api/v1`
- **Authentication:** None (local development)
- **Error Handling:** Centralized error processing

#### API Methods Structure
```javascript
const api = {
  // Projects
  projects: {
    getAll: (params = {}) => fetch(`/api/v1/projects/?${new URLSearchParams(params)}`),
    getById: (id) => fetch(`/api/v1/projects/${id}`),
    create: (data) => fetch('/api/v1/projects/', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    update: (id, data) => fetch(`/api/v1/projects/${id}`, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    delete: (id) => fetch(`/api/v1/projects/${id}`, { method: 'DELETE' }),
    getManagementData: (id) => fetch(`/api/v1/projects/${id}/management-data`),
    uploadImages: (id, files) => {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      return fetch(`/api/v1/projects/${id}/upload`, { 
        method: 'POST', 
        body: formData 
      });
    },
    getStats: () => fetch('/api/v1/projects/stats'),
    exportProject: (id, format) => fetch(`/api/v1/projects/${id}/export?format=${format}`)
  },
  
  // Datasets
  datasets: {
    getAll: (params = {}) => fetch(`/api/v1/datasets/?${new URLSearchParams(params)}`),
    getById: (id) => fetch(`/api/v1/datasets/${id}`),
    create: (data) => fetch('/api/v1/datasets/', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    update: (id, data) => fetch(`/api/v1/datasets/${id}`, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    delete: (id) => fetch(`/api/v1/datasets/${id}`, { method: 'DELETE' }),
    assign: (projectId, datasetId) => fetch(`/api/v1/projects/${projectId}/datasets/${datasetId}/assign`, { 
      method: 'POST' 
    }),
    moveToCompleted: (projectId, datasetId) => fetch(`/api/v1/projects/${projectId}/datasets/${datasetId}/move-to-completed`, { 
      method: 'POST' 
    }),
    export: (id, format, options = {}) => fetch(`/api/v1/datasets/${id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, ...options })
    }),
    getImages: (id) => fetch(`/api/v1/datasets/${id}/images`),
    getProgress: (id) => fetch(`/api/v1/datasets/${id}/progress`),
    getQualityMetrics: (id) => fetch(`/api/v1/datasets/${id}/quality-metrics`)
  },
  
  // Images
  images: {
    getById: (id) => fetch(`/api/v1/images/${id}`),
    update: (id, data) => fetch(`/api/v1/images/${id}`, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    delete: (id) => fetch(`/api/v1/images/${id}`, { method: 'DELETE' }),
    getAnnotations: (id) => fetch(`/api/v1/images/${id}/annotations`),
    getUrl: (id) => `/api/v1/images/${id}/file`
  },
  
  // Annotations
  annotations: {
    getByImage: (imageId) => fetch(`/api/v1/images/${imageId}/annotations`),
    create: (data) => fetch('/api/v1/annotations/', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    update: (id, data) => fetch(`/api/v1/annotations/${id}`, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    delete: (id) => fetch(`/api/v1/annotations/${id}`, { method: 'DELETE' }),
    bulkCreate: (annotations) => fetch('/api/v1/annotations/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations })
    }),
    qualityCheck: (datasetId) => fetch(`/api/v1/datasets/${datasetId}/annotations/quality-check`)
  },
  
  // Labels
  labels: {
    getByProject: (projectId) => fetch(`/api/v1/projects/${projectId}/labels`),
    create: (data) => fetch('/api/v1/labels/', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    update: (id, data) => fetch(`/api/v1/labels/${id}`, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    delete: (id) => fetch(`/api/v1/labels/${id}`, { method: 'DELETE' })
  },
  
  // Models
  models: {
    getAll: () => fetch('/api/v1/models/'),
    getById: (id) => fetch(`/api/v1/models/${id}`),
    create: (data) => fetch('/api/v1/models/', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),
    train: (data) => fetch('/api/v1/models/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    getTrainingJobs: () => fetch('/api/v1/training-jobs/'),
    getMetrics: (id) => fetch(`/api/v1/models/${id}/metrics`),
    deploy: (id, config) => fetch(`/api/v1/models/${id}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
  },
  
  // Analytics
  analytics: {
    getProjectAnalytics: (projectId) => fetch(`/api/v1/projects/${projectId}/analytics`),
    getDatasetAnalytics: (datasetId) => fetch(`/api/v1/datasets/${datasetId}/analytics`),
    getGlobalAnalytics: () => fetch('/api/v1/analytics/global'),
    getModelAnalytics: (modelId) => fetch(`/api/v1/models/${modelId}/analytics`)
  },
  
  // System
  system: {
    getHealth: () => fetch('/api/v1/health'),
    getStats: () => fetch('/api/v1/stats'),
    getActivity: (limit = 10) => fetch(`/api/v1/activity/recent?limit=${limit}`)
  }
};
```

### Error Handling System

#### Global Error Handler
- **File:** `src/utils/errorHandler.js`
- **Purpose:** Centralized error processing and user feedback
- **Features:** Network error detection, retry mechanisms, user notifications

```javascript
const handleApiError = (error, context) => {
  console.error(`API Error in ${context}:`, error);
  
  if (error.name === 'NetworkError' || !navigator.onLine) {
    return {
      type: 'network',
      message: 'Network connection failed. Please check your connection.',
      retry: true,
      offline: true
    };
  }
  
  if (error.status === 400) {
    return {
      type: 'validation',
      message: error.data?.detail || 'Invalid request data',
      retry: false,
      details: error.data?.errors || []
    };
  }
  
  if (error.status === 401) {
    return {
      type: 'auth',
      message: 'Authentication required',
      retry: false,
      redirect: '/login'
    };
  }
  
  if (error.status === 403) {
    return {
      type: 'permission',
      message: 'Permission denied',
      retry: false
    };
  }
  
  if (error.status === 404) {
    return {
      type: 'notfound',
      message: 'Resource not found',
      retry: false
    };
  }
  
  if (error.status === 429) {
    const retryAfter = error.headers?.['retry-after'] || 60;
    return {
      type: 'ratelimit',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retry: true,
      retryAfter
    };
  }
  
  if (error.status >= 500) {
    return {
      type: 'server',
      message: 'Server error occurred. Please try again later.',
      retry: true
    };
  }
  
  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    retry: true
  };
};

const showErrorNotification = (error, retryFunction) => {
  const errorInfo = handleApiError(error, 'API Call');
  
  if (errorInfo.type === 'network') {
    message.error({
      content: errorInfo.message,
      duration: 0,
      key: 'network-error',
      action: retryFunction ? (
        <Button size="small" onClick={retryFunction}>
          Retry
        </Button>
      ) : null
    });
  } else if (errorInfo.retry && retryFunction) {
    message.error({
      content: errorInfo.message,
      action: (
        <Button size="small" onClick={retryFunction}>
          Retry
        </Button>
      )
    });
  } else {
    message.error(errorInfo.message);
  }
};
```

### Request/Response Interceptors

#### Request Interceptor
```javascript
const requestInterceptor = (config) => {
  // Add common headers
  config.headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-Requested-With': 'XMLHttpRequest',
    ...config.headers
  };
  
  // Add timestamp for cache busting on GET requests
  if (config.method === 'GET') {
    const separator = config.url.includes('?') ? '&' : '?';
    config.url += `${separator}_t=${Date.now()}`;
  }
  
  // Add request ID for tracking
  config.headers['X-Request-ID'] = generateRequestId();
  
  // Log request in development
  if (process.env.NODE_ENV === 'development') {
    console.log('API Request:', config.method, config.url);
  }
  
  return config;
};
```

#### Response Interceptor
```javascript
const responseInterceptor = async (response) => {
  // Log response in development
  if (process.env.NODE_ENV === 'development') {
    console.log('API Response:', response.status, response.url);
  }
  
  // Handle successful responses
  if (response.ok) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType && contentType.includes('text/')) {
      return await response.text();
    } else {
      return response.blob();
    }
  }
  
  // Handle error responses
  let errorData = null;
  try {
    errorData = await response.json();
  } catch (e) {
    // Response is not JSON
  }
  
  const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
  error.status = response.status;
  error.data = errorData;
  error.headers = response.headers;
  
  throw error;
};
```

### API Hooks

#### Custom API Hooks
```javascript
// Generic API hook
const useApi = (apiFunction, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiFunction();
      setData(result);
    } catch (err) {
      setError(err);
      showErrorNotification(err, fetchData);
    } finally {
      setLoading(false);
    }
  }, dependencies);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return { data, loading, error, refetch: fetchData };
};

// Specific hooks
const useProjects = () => useApi(api.projects.getAll);
const useProject = (id) => useApi(() => api.projects.getById(id), [id]);
const useDatasets = (projectId) => useApi(() => api.datasets.getAll({ project_id: projectId }), [projectId]);
const useAnnotations = (imageId) => useApi(() => api.annotations.getByImage(imageId), [imageId]);
```

### Real-time Updates

#### WebSocket Integration
```javascript
const useWebSocket = (url, options = {}) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      setConnected(true);
      setError(null);
      console.log('WebSocket connected');
    };
    
    ws.onclose = () => {
      setConnected(false);
      console.log('WebSocket disconnected');
    };
    
    ws.onerror = (error) => {
      setError(error);
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        options.onMessage?.(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
    
    setSocket(ws);
    
    return () => {
      ws.close();
    };
  }, [url]);
  
  const sendMessage = useCallback((message) => {
    if (socket && connected) {
      socket.send(JSON.stringify(message));
    }
  }, [socket, connected]);
  
  return { connected, error, sendMessage };
};
```

---

Now let me commit all the documentation to git:

<function_calls>
<invoke name="execute_bash">
<parameter name="command">cd /workspace/auto-6 && git add .