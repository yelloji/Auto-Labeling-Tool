# 🏷️ AUTO-LABELING-TOOL - COMPLETE PROJECT MANUAL

## 📋 TABLE OF CONTENTS
1. [Project Overview](#project-overview)
2. [Project Structure](#project-structure)
3. [New Advanced Features](#new-advanced-features)
4. [Backend Documentation](#backend-documentation)
5. [Frontend Documentation](#frontend-documentation)
6. [Configuration Files](#configuration-files)
7. [User Manual](#user-manual)
8. [Model Import Guide](#model-import-guide)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Development Guide](#development-guide)

---

## 🎯 PROJECT OVERVIEW

**Auto-Labeling-Tool** is a comprehensive local auto-labeling application that **rivals and exceeds cloud-based solutions like Roboflow**. Built for professional dataset management with advanced features and complete local control.

### 🚀 CORE CAPABILITIES
- **Advanced Analytics**: Class distribution analysis, imbalance detection, labeling progress tracking
- **Data Augmentation**: 15+ augmentation types with smart presets and real-time preview
- **Dataset Management**: Train/Val/Test splitting with percentage controls and validation
- **Auto-labeling**: YOLOv8 integration with custom model import capabilities
- **Visual Indicators**: Clear status indicators for labeled/unlabeled images
- **Professional UI**: Enhanced tables, modal workflows, advanced filtering

### ✅ KEY FEATURES
- ✅ **Fully Local**: Complete privacy - no data leaves your machine
- ✅ **CPU/GPU Support**: Optimized for both CPU and GPU acceleration
- ✅ **Advanced Analytics**: Professional-grade dataset insights and health scoring
- ✅ **Data Augmentation**: Comprehensive augmentation pipeline with 15+ types
- ✅ **Smart Splitting**: Intelligent Train/Val/Test splitting with validation
- ✅ **Custom Models**: Easy YOLO model import with validation
- ✅ **Multiple Formats**: Export to YOLO, COCO, Pascal VOC formats
- ✅ **Professional UI**: Modern React interface with Ant Design components
- ✅ **Batch Processing**: Efficient handling of large datasets
- ✅ **Real-time Updates**: Live data updates without page refresh

---

## 📁 PROJECT STRUCTURE

```
Auto-Labeling-Tool/
├── 🚀 STARTUP FILES
│   ├── start.py          # Cross-platform Python startup script
│   ├── start.sh          # Linux/Mac startup script
│   └── start.bat         # Windows startup script
│
├── 🔧 BACKEND (FastAPI + Python)
│   ├── main.py           # FastAPI application entry point
│   ├── api/
│   │   ├── routes/       # API endpoints
│   │   │   ├── analytics.py          # 📊 Dataset analytics & insights
│   │   │   ├── augmentation.py       # 🔄 Data augmentation pipeline
│   │   │   ├── dataset_management.py # 📈 Train/Val/Test splitting
│   │   │   ├── dashboard.py          # 🏠 Dashboard statistics
│   │   │   ├── models.py             # 🤖 AI model management
│   │   │   ├── projects.py           # 📁 Project management
│   │   │   ├── datasets.py           # 📊 Dataset operations
│   │   │   └── annotations.py        # ✏️ Annotation management
│   │   └── __init__.py
│   ├── core/             # Core configuration and utilities
│   ├── database/         # Database models and operations (10 tables)
│   ├── models/           # AI model handling
│   ├── utils/            # Utility functions
│   │   └── augmentation_utils.py     # Advanced augmentation utilities
│   └── venv/             # Python virtual environment
│
├── 🎨 FRONTEND (React + Ant Design)
│   ├── src/              # React source code
│   │   ├── components/   # React components
│   │   │   ├── DatasetAnalytics.js    # 📊 Analytics dashboard
│   │   │   ├── DataAugmentation.js    # 🔄 Augmentation interface
│   │   │   └── DatasetManagement.js   # 📈 Dataset splitting UI
│   │   ├── pages/        # Page components
│   │   │   ├── Dashboard.js           # 🏠 Main dashboard
│   │   │   ├── Datasets.js            # 📊 Enhanced dataset management
│   │   │   ├── Projects.js            # 📁 Project management
│   │   │   ├── Models.js              # 🤖 Model management
│   │   │   └── Annotate.js            # ✏️ Annotation interface
│   │   └── utils/        # Frontend utilities
│   ├── public/           # Static files
│   ├── package.json      # Node.js dependencies (includes @ant-design/plots)
│   └── build/            # Production build
│
├── 📊 DATA DIRECTORIES
│   ├── datasets/         # Uploaded datasets
│   ├── models/           # AI models storage
│   ├── uploads/          # Temporary upload files
│   ├── temp/             # Temporary processing files
│   ├── static/           # Static web files
│   └── logs/             # Application logs
│
├── 📄 CONFIGURATION
│   ├── database.db       # SQLite database
│   ├── requirements.txt  # Python dependencies
│   └── README.md         # Basic documentation
│
└── 🧪 DEVELOPMENT
    ├── tests/            # Test files
    ├── scripts/          # Utility scripts
    └── docs/             # Additional documentation
```

---

## 🚀 NEW ADVANCED FEATURES

### 📊 DATASET ANALYTICS & INSIGHTS

**Location:** `/backend/api/routes/analytics.py` + `/frontend/src/components/DatasetAnalytics.js`

**Purpose:** Comprehensive dataset analysis and health monitoring

#### 🔍 Key Features:
- **Class Distribution Analysis**: Visual charts showing label distribution across classes
- **Imbalance Detection**: Automatic detection of class imbalances with actionable recommendations
- **Labeling Progress Tracking**: Real-time progress monitoring with completion percentages
- **Split Analysis**: Train/Val/Test split statistics and validation
- **Dataset Health Scoring**: Overall dataset quality assessment with scoring metrics

#### 📡 API Endpoints:
```python
GET /api/analytics/dataset/{id}/class-distribution    # Class distribution data
GET /api/analytics/dataset/{id}/imbalance-report     # Imbalance detection
GET /api/analytics/dataset/{id}/labeling-progress    # Progress tracking
GET /api/analytics/dataset/{id}/split-analysis       # Split statistics
```

#### 🎨 UI Components:
- **Interactive Charts**: Pie charts, bar charts using @ant-design/plots
- **Health Score Cards**: Visual health indicators with color coding
- **Recommendation Engine**: Smart suggestions for dataset improvement
- **Export Capabilities**: Export analytics reports in multiple formats

---

### 🔄 DATA AUGMENTATION PIPELINE

**Location:** `/backend/api/routes/augmentation.py` + `/frontend/src/components/DataAugmentation.js`

**Purpose:** Professional-grade data augmentation with 15+ augmentation types

#### 🎯 Augmentation Types:
1. **Geometric Transformations**:
   - Rotation, Horizontal/Vertical Flip, Scale, Shear, Translation
2. **Color Adjustments**:
   - Brightness, Contrast, Saturation, Hue
3. **Noise & Effects**:
   - Gaussian Noise, Motion Blur, Gaussian Blur
4. **Weather Effects**:
   - Rain, Snow, Fog, Shadow
5. **Advanced Techniques**:
   - Cutout, Elastic Transform, Grid Distortion

#### 🎛️ Smart Presets:
- **Light Augmentation**: Subtle changes for sensitive datasets
- **Medium Augmentation**: Balanced approach for general use
- **Heavy Augmentation**: Aggressive augmentation for robust training

#### 📡 API Endpoints:
```python
POST /api/augmentation/preview                        # Preview augmentations
POST /api/augmentation/apply                         # Apply to dataset
GET /api/augmentation/presets                        # Get preset configurations
POST /api/augmentation/jobs                          # Create augmentation job
GET /api/augmentation/jobs/{id}/status               # Check job status
```

#### 🎨 UI Features:
- **Real-time Preview**: See augmentation effects before applying
- **Parameter Controls**: Fine-tune each augmentation type
- **Batch Processing**: Apply to entire datasets efficiently
- **Progress Monitoring**: Track augmentation job progress

---

### 📈 DATASET MANAGEMENT & SPLITTING

**Location:** `/backend/api/routes/dataset_management.py` + `/frontend/src/components/DatasetManagement.js`

**Purpose:** Intelligent Train/Val/Test splitting with advanced controls

#### 🎯 Key Features:
- **Percentage Controls**: Precise control over split ratios
- **Stratified Splitting**: Maintain class distribution across splits
- **Validation Rules**: Ensure minimum samples per class in each split
- **Visual Feedback**: Real-time preview of split results
- **Bulk Operations**: Move, copy, or modify multiple images

#### 📊 Split Strategies:
1. **Random Split**: Simple random distribution
2. **Stratified Split**: Maintains class proportions
3. **Custom Split**: Manual assignment with validation

#### 📡 API Endpoints:
```python
POST /api/dataset-management/split                   # Create dataset split
GET /api/dataset-management/split-preview           # Preview split results
POST /api/dataset-management/apply-split            # Apply split to dataset
GET /api/dataset-management/statistics              # Get split statistics
POST /api/dataset-management/bulk-operations        # Bulk image operations
```

#### 🎨 UI Components:
- **Interactive Sliders**: Adjust split percentages with real-time feedback
- **Validation Indicators**: Visual warnings for invalid splits
- **Statistics Dashboard**: Comprehensive split statistics
- **Bulk Action Tools**: Select and modify multiple images

---

### 🎯 ENHANCED DATASET TABLE

**Location:** `/frontend/src/pages/Datasets.js`

**Purpose:** Professional dataset management interface with advanced features

#### 🔍 New Features:
- **Status Column**: Visual indicators for dataset completion status
  - ✅ **Complete**: All images labeled and split
  - 🔄 **In Progress**: Partially labeled or split
  - ⭕ **Not Started**: No labels or splits applied
- **Advanced Actions Menu**: Dropdown with comprehensive options
  - 📊 **Analytics**: Open dataset analytics modal
  - 🔄 **Augmentation**: Access data augmentation tools
  - 📈 **Train/Val/Test Split**: Configure dataset splitting
  - 📤 **Export**: Export in multiple formats
  - 🗑️ **Delete**: Remove dataset with confirmation
- **Enhanced Filtering**: Filter by status, split type, completion
- **Bulk Operations**: Select multiple datasets for batch operations

#### 🎨 Visual Enhancements:
- **Status Icons**: Clear visual indicators with tooltips
- **Progress Bars**: Show completion percentages
- **Color Coding**: Status-based color schemes
- **Responsive Design**: Works on all screen sizes

---

### 🗄️ EXTENDED DATABASE SCHEMA

**Location:** `/backend/database/models.py`

#### 📊 New Tables:
1. **DataAugmentation**: Store augmentation configurations and jobs
2. **DatasetSplit**: Track Train/Val/Test split assignments
3. **LabelAnalytics**: Cache analytics data for performance

#### 🔧 Enhanced Models:
- **Image Model**: Added `split_type` field for Train/Val/Test assignment
- **Extended Relationships**: Improved foreign key relationships
- **Performance Indexes**: Optimized database queries

#### 📝 CRUD Operations:
**Location:** `/backend/database/operations.py`
- Complete CRUD operations for all new models
- Optimized queries for analytics and reporting
- Bulk operation support for large datasets

---

## 🔧 BACKEND DOCUMENTATION

### 📍 Location: `/backend/`

The backend is built with **FastAPI** and handles all server-side operations.

### 🚪 Entry Point: `main.py`
**Location:** `/backend/main.py`
**Purpose:** FastAPI application initialization and configuration
**Key Functions:**
- Creates FastAPI app instance
- Sets up CORS for frontend communication
- Includes API routers
- Configures static file serving

**Code Structure:**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Auto-Labeling-Tool API")
# CORS setup for frontend communication
# API router inclusion
# Static file serving setup
```

**When to Edit:**
- Adding new API routers
- Changing CORS settings
- Modifying app configuration

---

### 📡 API Endpoints: `/backend/api/`

#### 🗂️ `/backend/api/__init__.py`
**Purpose:** Makes the api directory a Python package

#### 🏠 `/backend/api/dashboard.py`
**Purpose:** Dashboard statistics and overview data
**Endpoints:**
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/recent-activity` - Get recent activity

**Key Functions:**
```python
@router.get("/stats")
async def get_dashboard_stats():
    # Returns: total projects, datasets, images, annotations
    
@router.get("/recent-activity")
async def get_recent_activity():
    # Returns: recent projects and datasets
```

**When to Edit:**
- Adding new dashboard metrics
- Changing statistics calculations

#### 🤖 `/backend/api/models.py`
**Purpose:** AI model management and inference
**Endpoints:**
- `GET /api/models/` - List available models
- `POST /api/models/upload` - Upload custom model
- `POST /api/models/predict` - Run inference on images

**Key Functions:**
```python
@router.get("/")
async def list_models():
    # Returns: list of available YOLO models
    
@router.post("/upload")
async def upload_model(file: UploadFile):
    # Uploads and validates YOLO model files
    
@router.post("/predict")
async def predict_image(image_id: int, model_name: str):
    # Runs YOLO inference on specified image
```

**When to Edit:**
- Adding new model formats
- Changing inference parameters
- Adding model validation

#### 📁 `/backend/api/projects.py`
**Purpose:** Project management operations
**Endpoints:**
- `GET /api/projects/` - List all projects
- `POST /api/projects/` - Create new project
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

**Key Functions:**
```python
@router.post("/")
async def create_project(project: ProjectCreate):
    # Creates new project in database
    
@router.get("/{project_id}")
async def get_project(project_id: int):
    # Returns project details with datasets
```

**When to Edit:**
- Adding project metadata fields
- Changing project validation rules

#### 📊 `/backend/api/datasets.py`
**Purpose:** Dataset management and file uploads
**Endpoints:**
- `GET /api/datasets/` - List all datasets
- `POST /api/datasets/` - Create new dataset
- `POST /api/datasets/upload` - Upload images to dataset
- `GET /api/datasets/{id}/images` - Get dataset images

**Key Functions:**
```python
@router.post("/upload")
async def upload_dataset_images(files: List[UploadFile]):
    # Handles bulk image uploads
    # Validates file formats and sizes
    # Stores images and creates database records
    
@router.get("/{dataset_id}/images")
async def get_dataset_images(dataset_id: int):
    # Returns paginated list of images in dataset
```

**When to Edit:**
- Changing file upload limits
- Adding new image formats
- Modifying upload validation

#### ✏️ `/backend/api/annotations.py`
**Purpose:** Annotation management and export
**Endpoints:**
- `GET /api/annotations/` - List annotations
- `POST /api/annotations/` - Create annotation
- `PUT /api/annotations/{id}` - Update annotation
- `DELETE /api/annotations/{id}` - Delete annotation
- `POST /api/annotations/export` - Export annotations

**Key Functions:**
```python
@router.post("/")
async def create_annotation(annotation: AnnotationCreate):
    # Creates new annotation (bounding box, polygon, etc.)
    
@router.post("/export")
async def export_annotations(dataset_id: int, format: str):
    # Exports annotations in YOLO, COCO, Pascal VOC formats
```

**When to Edit:**
- Adding new annotation types
- Adding new export formats
- Changing annotation validation

---

### ⚙️ Core Configuration: `/backend/core/`

#### 🔧 `/backend/core/config.py`
**Purpose:** Central configuration management
**Key Settings:**
```python
class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "Auto-Labeling-Tool"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # File paths
    BASE_DIR: Path = Path(__file__).parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "datasets"
    MODELS_DIR: Path = BASE_DIR / "models"
    
    # File upload limits
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB per image
    MAX_BATCH_SIZE: int = 10000  # 10,000 images
    
    # Supported formats
    SUPPORTED_IMAGE_FORMATS: list = [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]
    
    # Model settings
    DEFAULT_CONFIDENCE_THRESHOLD: float = 0.5
    DEFAULT_IOU_THRESHOLD: float = 0.45
    
    # GPU settings
    USE_GPU: bool = True
    GPU_MEMORY_FRACTION: float = 0.8
```

**When to Edit:**
- ⚠️ **File upload limits:** Change `MAX_FILE_SIZE` or `MAX_BATCH_SIZE`
- ⚠️ **Supported formats:** Add/remove from `SUPPORTED_IMAGE_FORMATS`
- ⚠️ **Model thresholds:** Adjust `DEFAULT_CONFIDENCE_THRESHOLD` or `DEFAULT_IOU_THRESHOLD`
- ⚠️ **GPU settings:** Modify `USE_GPU` or `GPU_MEMORY_FRACTION`

#### 📁 `/backend/core/file_handler.py`
**Purpose:** File upload and processing utilities
**Key Functions:**
```python
class FileHandler:
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    def validate_file(self, file: UploadFile) -> bool:
        # Validates file extension and size
        
    def save_uploaded_file(self, file: UploadFile, destination: Path) -> Path:
        # Saves uploaded file to specified location
        
    def process_image_batch(self, files: List[UploadFile]) -> List[Dict]:
        # Processes multiple uploaded images
```

**When to Edit:**
- ⚠️ **File size limits:** Change `MAX_FILE_SIZE`
- ⚠️ **Allowed formats:** Modify `ALLOWED_EXTENSIONS`
- ⚠️ **Upload validation:** Add custom validation rules

#### 🔐 `/backend/core/security.py`
**Purpose:** Security utilities and authentication
**Key Functions:**
```python
def generate_secure_filename(filename: str) -> str:
    # Generates secure filename for uploads
    
def validate_file_content(file_path: Path) -> bool:
    # Validates actual file content matches extension
```

**When to Edit:**
- Adding authentication mechanisms
- Implementing file security checks

---

### 🗄️ Database Models: `/backend/database/`

#### 📊 `/backend/database/models.py`
**Purpose:** SQLAlchemy database models
**Key Models:**
```python
class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    
class Image(Base):
    __tablename__ = "images"
    id = Column(Integer, primary_key=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    
class Annotation(Base):
    __tablename__ = "annotations"
    id = Column(Integer, primary_key=True)
    image_id = Column(Integer, ForeignKey("images.id"))
    class_name = Column(String, nullable=False)
    bbox_x = Column(Float)  # Bounding box coordinates
    bbox_y = Column(Float)
    bbox_width = Column(Float)
    bbox_height = Column(Float)
```

**When to Edit:**
- ⚠️ **Adding new fields:** Add columns to existing models
- ⚠️ **New annotation types:** Extend Annotation model
- ⚠️ **New relationships:** Add foreign keys and relationships

#### 🔧 `/backend/database/database.py`
**Purpose:** Database connection and session management
**Key Functions:**
```python
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    # Dependency for getting database session
    
def create_tables():
    # Creates all database tables
```

**When to Edit:**
- Changing database connection settings
- Adding database initialization logic

#### 📝 `/backend/database/crud.py`
**Purpose:** Database CRUD operations
**Key Functions:**
```python
def create_project(db: Session, project: ProjectCreate) -> Project:
    # Creates new project in database
    
def get_projects(db: Session, skip: int = 0, limit: int = 100) -> List[Project]:
    # Retrieves projects with pagination
    
def create_annotation(db: Session, annotation: AnnotationCreate) -> Annotation:
    # Creates new annotation
```

**When to Edit:**
- Adding new database operations
- Modifying query logic
- Adding data validation

---

### 🤖 AI Models: `/backend/models/`

#### 🎯 `/backend/models/yolo_model.py`
**Purpose:** YOLO model loading and inference
**Key Functions:**
```python
class YOLOModel:
    def __init__(self, model_path: str):
        # Loads YOLO model from file
        
    def predict(self, image_path: str, conf_threshold: float = 0.5) -> List[Dict]:
        # Runs inference on image
        # Returns: list of detections with bboxes and confidence
        
    def predict_batch(self, image_paths: List[str]) -> List[List[Dict]]:
        # Runs inference on multiple images
```

**When to Edit:**
- ⚠️ **Model parameters:** Change default confidence thresholds
- ⚠️ **GPU settings:** Modify device selection logic
- ⚠️ **Output format:** Change detection result structure

#### 📦 `/backend/models/model_manager.py`
**Purpose:** Model loading and management
**Key Functions:**
```python
class ModelManager:
    def __init__(self):
        self.loaded_models = {}
        
    def load_model(self, model_name: str) -> YOLOModel:
        # Loads and caches model
        
    def get_available_models(self) -> List[str]:
        # Returns list of available model files
        
    def validate_model_file(self, file_path: str) -> bool:
        # Validates YOLO model file
```

**When to Edit:**
- Adding support for new model formats
- Changing model caching logic
- Adding model validation rules

---

### 🛠️ Utilities: `/backend/utils/`

#### 🖼️ `/backend/utils/image_utils.py`
**Purpose:** Image processing utilities
**Key Functions:**
```python
def resize_image(image_path: str, max_size: int = 1280) -> str:
    # Resizes image for processing
    
def validate_image_file(file_path: str) -> bool:
    # Validates image file integrity
    
def extract_image_metadata(file_path: str) -> Dict:
    # Extracts image dimensions, format, etc.
```

**When to Edit:**
- ⚠️ **Image size limits:** Change `max_size` parameter
- Adding new image processing functions
- Modifying image validation logic

#### 📤 `/backend/utils/export_utils.py`
**Purpose:** Annotation export utilities
**Key Functions:**
```python
def export_to_yolo(annotations: List[Annotation], output_dir: str):
    # Exports annotations in YOLO format
    
def export_to_coco(annotations: List[Annotation], output_dir: str):
    # Exports annotations in COCO format
    
def export_to_pascal_voc(annotations: List[Annotation], output_dir: str):
    # Exports annotations in Pascal VOC format
```

**When to Edit:**
- ⚠️ **Adding new export formats:** Create new export functions
- Modifying existing export formats
- Changing export file structure

---

## 🎨 FRONTEND DOCUMENTATION

### 📍 Location: `/frontend/`

The frontend is built with **React** and **Ant Design** for the user interface.

### 📦 Dependencies: `package.json`
**Location:** `/frontend/package.json`
**Key Dependencies:**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "antd": "^5.2.0",
    "axios": "^1.3.0",
    "@ant-design/icons": "^5.0.1"
  }
}
```

**When to Edit:**
- Adding new React libraries
- Updating dependency versions

### 🏗️ Source Code: `/frontend/src/`

#### 🚪 Entry Point: `/frontend/src/index.js`
**Purpose:** React application entry point
**Code Structure:**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

#### 🏠 Main App: `/frontend/src/App.js`
**Purpose:** Main application component with routing
**Key Features:**
- React Router setup
- Navigation layout
- Route definitions

**Code Structure:**
```javascript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
// ... other imports

function App() {
  return (
    <Router>
      <Layout>
        <Layout.Sider>
          <Menu items={menuItems} />
        </Layout.Sider>
        <Layout.Content>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            // ... other routes
          </Routes>
        </Layout.Content>
      </Layout>
    </Router>
  );
}
```

**When to Edit:**
- ⚠️ **Adding new pages:** Add new Route components
- ⚠️ **Navigation menu:** Modify menu items
- Changing layout structure

### 📄 Pages: `/frontend/src/pages/`

#### 🏠 `/frontend/src/pages/Dashboard.js`
**Purpose:** Dashboard overview page
**Features:**
- Statistics cards (projects, datasets, images, annotations)
- Recent activity list
- Quick action buttons

**Key Functions:**
```javascript
const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  
  useEffect(() => {
    fetchDashboardStats();
    fetchRecentActivity();
  }, []);
  
  const fetchDashboardStats = async () => {
    // Calls /api/dashboard/stats
  };
};
```

**When to Edit:**
- ⚠️ **Adding new statistics:** Modify stats display
- ⚠️ **Dashboard layout:** Change card arrangement
- Adding new dashboard widgets

#### 📁 `/frontend/src/pages/Projects.js`
**Purpose:** Project management page
**Features:**
- Project list with search and filter
- Create new project modal
- Project details view
- Delete project functionality

**Key Functions:**
```javascript
const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  const handleCreateProject = async (values) => {
    // Calls /api/projects/ POST
  };
  
  const handleDeleteProject = async (projectId) => {
    // Calls /api/projects/{id} DELETE
  };
};
```

**When to Edit:**
- ⚠️ **Project form fields:** Modify create/edit forms
- ⚠️ **Project display:** Change list/card layout
- Adding project filtering options

#### 📊 `/frontend/src/pages/Datasets.js`
**Purpose:** Dataset management and file upload page
**Features:**
- Dataset list with project association
- Bulk image upload with drag-and-drop
- Upload progress tracking
- File format validation

**Key Functions:**
```javascript
const Datasets = () => {
  const [datasets, setDatasets] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  const handleUpload = async (info) => {
    // Handles file upload to /api/datasets/upload
    // Shows progress and validation messages
  };
  
  const beforeUpload = (file) => {
    // Validates file size and format
    const isValidFormat = ['image/jpeg', 'image/png', 'image/bmp'].includes(file.type);
    const isValidSize = file.size / 1024 / 1024 < 100; // 100MB
    return isValidFormat && isValidSize;
  };
};
```

**When to Edit:**
- ⚠️ **File upload limits:** Change size validation in `beforeUpload`
- ⚠️ **Supported formats:** Modify format validation
- ⚠️ **Upload UI:** Change drag-and-drop area design

#### 🤖 `/frontend/src/pages/Models.js`
**Purpose:** AI model management page
**Features:**
- Available models list
- Model upload functionality
- Model details and statistics
- Run inference on datasets

**Key Functions:**
```javascript
const Models = () => {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  
  const handleModelUpload = async (file) => {
    // Uploads model to /api/models/upload
  };
  
  const handleRunInference = async (modelName, datasetId) => {
    // Runs inference via /api/models/predict
  };
};
```

**When to Edit:**
- ⚠️ **Model formats:** Add support for new model types
- ⚠️ **Inference parameters:** Add confidence/IOU threshold controls
- Adding model performance metrics

#### ✏️ `/frontend/src/pages/Annotate.js`
**Purpose:** Image annotation interface
**Features:**
- Image viewer with zoom/pan
- Bounding box drawing tools
- Annotation list and editing
- Keyboard shortcuts

**Key Functions:**
```javascript
const Annotate = () => {
  const [currentImage, setCurrentImage] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [drawingMode, setDrawingMode] = useState(false);
  
  const handleDrawBoundingBox = (coordinates) => {
    // Creates new annotation
  };
  
  const handleSaveAnnotation = async (annotation) => {
    // Saves to /api/annotations/
  };
};
```

**When to Edit:**
- ⚠️ **Annotation tools:** Add new drawing tools (polygon, circle)
- ⚠️ **Keyboard shortcuts:** Modify shortcut mappings
- Adding annotation validation

### 🎨 Components: `/frontend/src/components/`

#### 📤 `/frontend/src/components/UploadComponent.js`
**Purpose:** Reusable file upload component
**Features:**
- Drag-and-drop interface
- Progress tracking
- File validation
- Error handling

**When to Edit:**
- ⚠️ **Upload behavior:** Modify validation rules
- ⚠️ **UI styling:** Change upload area design

#### 📊 `/frontend/src/components/StatsCard.js`
**Purpose:** Reusable statistics display card
**When to Edit:**
- Changing card layout or styling
- Adding new stat types

### 🌐 API Integration: `/frontend/src/services/`

#### 🔗 `/frontend/src/services/api.js`
**Purpose:** Centralized API communication
**Key Functions:**
```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:12000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const projectsAPI = {
  getAll: () => api.get('/api/projects/'),
  create: (data) => api.post('/api/projects/', data),
  delete: (id) => api.delete(`/api/projects/${id}`),
};

export const datasetsAPI = {
  getAll: () => api.get('/api/datasets/'),
  upload: (formData) => api.post('/api/datasets/upload', formData),
};
```

**When to Edit:**
- ⚠️ **API endpoints:** Add new API calls
- ⚠️ **Base URL:** Change backend server address
- Adding request/response interceptors

---

## ⚙️ CONFIGURATION FILES

### 🐍 Python Dependencies: `requirements.txt`
**Location:** `/requirements.txt`
**Purpose:** Lists all Python packages needed for the backend
**Key Dependencies:**
```
fastapi==0.104.1
uvicorn==0.24.0
torch==2.1.0
ultralytics==8.0.196
opencv-python==4.8.1.78
Pillow==10.0.1
sqlalchemy==2.0.23
pydantic-settings==2.0.3
```

**When to Edit:**
- ⚠️ **Adding new Python packages:** Add package name and version
- ⚠️ **Updating versions:** Change version numbers
- Removing unused dependencies

### 📊 Database: `database.db`
**Location:** `/database.db`
**Purpose:** SQLite database file containing all application data
**Tables:**
- `projects` - Project information
- `datasets` - Dataset metadata
- `images` - Image file records
- `annotations` - Annotation data
- `model_usage` - Model usage tracking
- `export_jobs` - Export job history
- `auto_label_jobs` - Auto-labeling job history

**When to Edit:**
- ⚠️ **Database reset:** Delete file to reset all data
- ⚠️ **Backup:** Copy file to backup all data

### 🤖 Model Configuration: `/models/models_config.json`
**Location:** `/models/models_config.json`
**Purpose:** Configuration for available AI models
**Structure:**
```json
{
  "yolo_models": {
    "yolov8n.pt": {
      "name": "YOLOv8 Nano",
      "description": "Fastest, smallest model",
      "classes": 80,
      "input_size": 640
    },
    "yolov8s.pt": {
      "name": "YOLOv8 Small",
      "description": "Balanced speed and accuracy",
      "classes": 80,
      "input_size": 640
    }
  }
}
```

**When to Edit:**
- ⚠️ **Adding new models:** Add model configuration
- ⚠️ **Model metadata:** Update descriptions and parameters

---

## 📖 USER MANUAL

### 🚀 Getting Started

#### 1. **Installation & Setup**
```bash
# Clone the repository
git clone https://github.com/yelloji/Auto-Labeling-Tool.git
cd Auto-Labeling-Tool

# Start the application (choose one method)
python start.py          # Cross-platform
./start.sh              # Linux/Mac
start.bat               # Windows
```

#### 2. **First Time Setup**
1. Wait for both servers to start (backend on port 12000, frontend on port 12001)
2. Open your browser to `http://localhost:12001`
3. You'll see the dashboard with empty statistics

### 📊 Using the Dashboard
**Purpose:** Overview of your projects and recent activity
**Features:**
- **Statistics Cards:** Shows total projects, datasets, images, and annotations
- **Recent Activity:** Lists recently created projects and datasets
- **Quick Actions:** Buttons to create new projects or upload datasets

### 📁 Managing Projects

#### Creating a New Project
1. Go to **Projects** page
2. Click **"Create New Project"** button
3. Fill in:
   - **Project Name:** Descriptive name for your project
   - **Description:** Optional details about the project
4. Click **"Create"**

#### Managing Existing Projects
- **View:** Click on project name to see details
- **Edit:** Click edit icon to modify project information
- **Delete:** Click delete icon (⚠️ **Warning:** This deletes all associated datasets and annotations)

### 📊 Managing Datasets

#### Creating a Dataset
1. Go to **Datasets** page
2. Click **"Create New Dataset"** button
3. Fill in:
   - **Dataset Name:** Descriptive name
   - **Project:** Select which project this belongs to
   - **Description:** Optional details

#### Uploading Images
1. Select a dataset or create a new one
2. Click **"Upload Images"** button
3. **Drag and drop** images or **click to browse**
4. **Supported formats:** JPG, JPEG, PNG, BMP, TIFF, WEBP
5. **Limits:** 
   - Maximum 100MB per image
   - Up to 10,000 images per batch
6. Wait for upload to complete

**Upload Tips:**
- ✅ Use high-quality images for better auto-labeling results
- ✅ Consistent image sizes work better
- ✅ Good lighting and clear objects improve detection
- ❌ Avoid blurry or very dark images

### 🤖 Managing AI Models

#### Available Models
The tool comes with pre-installed YOLO models:
- **YOLOv8 Nano (yolov8n.pt):** Fastest, good for real-time
- **YOLOv8 Small (yolov8s.pt):** Balanced speed and accuracy
- **YOLOv8 Medium (yolov8m.pt):** Better accuracy, slower
- **YOLOv8 Large (yolov8l.pt):** Best accuracy, slowest

#### Running Auto-Labeling
1. Go to **Models** page
2. Select a model from the list
3. Choose a dataset to label
4. Set parameters:
   - **Confidence Threshold:** 0.1-1.0 (higher = fewer, more confident detections)
   - **IOU Threshold:** 0.1-1.0 (higher = less overlap allowed)
5. Click **"Run Auto-Labeling"**
6. Wait for processing to complete

**Auto-Labeling Tips:**
- ✅ Start with confidence 0.5, adjust based on results
- ✅ Use YOLOv8s for most cases (good balance)
- ✅ Use YOLOv8n for quick testing
- ✅ Use YOLOv8l for final production labeling

### ✏️ Manual Annotation

#### Annotation Interface
1. Go to **Annotate** page
2. Select a dataset and image
3. Use annotation tools:
   - **Bounding Box:** Click and drag to draw rectangles
   - **Class Selection:** Choose object class from dropdown
   - **Edit Mode:** Click existing annotations to modify
   - **Delete:** Select annotation and press Delete key

#### Keyboard Shortcuts
- **Space:** Toggle between draw and select mode
- **Delete:** Remove selected annotation
- **Ctrl+Z:** Undo last action
- **Ctrl+S:** Save current annotations
- **Arrow Keys:** Navigate between images

#### Annotation Best Practices
- ✅ Draw tight bounding boxes around objects
- ✅ Include the entire object within the box
- ✅ Use consistent class names
- ✅ Save frequently (Ctrl+S)
- ❌ Don't include background in bounding boxes
- ❌ Don't overlap boxes unnecessarily

### 📤 Exporting Annotations

#### Export Formats
1. Go to **Datasets** page
2. Select dataset to export
3. Click **"Export"** button
4. Choose format:
   - **YOLO:** Text files with normalized coordinates
   - **COCO:** JSON format for COCO dataset
   - **Pascal VOC:** XML files for each image
   - **CVAT:** XML format for CVAT tool
   - **LabelMe:** JSON format for LabelMe tool

#### Export Structure
**YOLO Format:**
```
dataset_export/
├── images/           # Original images
├── labels/           # .txt files with annotations
└── classes.txt       # List of class names
```

**COCO Format:**
```
dataset_export/
├── images/           # Original images
└── annotations.json  # COCO format annotations
```

### 🔧 Settings and Configuration

#### File Upload Settings
**Location to edit:** `/backend/core/config.py`
```python
MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB per image
MAX_BATCH_SIZE: int = 10000  # 10,000 images
```

#### Model Settings
**Location to edit:** `/backend/core/config.py`
```python
DEFAULT_CONFIDENCE_THRESHOLD: float = 0.5
DEFAULT_IOU_THRESHOLD: float = 0.45
```

#### GPU Settings
**Location to edit:** `/backend/core/config.py`
```python
USE_GPU: bool = True  # Set to False for CPU-only
GPU_MEMORY_FRACTION: float = 0.8  # Adjust GPU memory usage
```

---

## 🤖 MODEL IMPORT GUIDE

### 🚀 **YOLO11 Custom Model Import - Complete Guide**

**This is the most powerful feature of the Auto-Labeling Tool!** Import your custom YOLO11 models for superior accuracy on your specific objects.

#### ✅ **Supported Model Formats**
- 🔥 **PyTorch (.pt):** Native YOLO11/YOLOv8 format (RECOMMENDED)
- ⚡ **ONNX (.onnx):** Cross-platform optimized format
- 🚀 **TensorRT (.engine):** NVIDIA GPU ultra-fast format

#### 🎯 **Supported YOLO Versions**
- ✅ **YOLO11** (Latest - Ultralytics)
- ✅ **YOLOv8** (All variants: n, s, m, l, x)
- ✅ **YOLOv5** (All variants)
- ✅ **Custom trained models** from any YOLO version

---

### 🌟 **Method 1: Web Interface Upload (Easiest)**

**Perfect for beginners and quick imports!**

1. **Start the application:**
   ```bash
   python start.py
   ```

2. **Open your browser:** http://localhost:12001

3. **Navigate to Models page** → Click **"Import Custom Model"** button

4. **Upload your YOLO11 model:**
   - **Select File:** Choose your `.pt` file (e.g., `my_yolo11_model.pt`)
   - **Model Name:** Enter descriptive name (e.g., "Custom Product Detector")
   - **Model Type:** Select "Object Detection" or "Instance Segmentation"
   - **Class Names:** Enter comma-separated classes: `product,defect,logo,text`
   - **Description:** Brief description of what the model detects
   - **Confidence Threshold:** Default 0.5 (adjust as needed)

5. **Click "Import Model"** → Done! Your model is ready for use

6. **Verify Import:** Your model will appear in the Models list with a "Custom" badge

---

### 📁 **Method 2: Direct File Copy (Advanced)**

**Perfect for batch imports and automation!**

1. **Copy your YOLO11 model** to the custom models directory:
   ```bash
   cp your_yolo11_model.pt Auto-Labeling-Tool/models/custom/
   ```

2. **Edit the models configuration** file `models/models_config.json`:
   ```json
   {
     "your_yolo11_model": {
       "id": "your_yolo11_model",
       "name": "My Custom YOLO11 Model",
       "type": "object_detection",
       "format": "pytorch",
       "path": "/workspace/Auto-Labeling-Tool/models/custom/your_yolo11_model.pt",
       "classes": [
         "person", "car", "bicycle", "dog", "cat",
         "product", "defect", "logo", "text"
       ],
       "input_size": [640, 640],
       "confidence_threshold": 0.5,
       "iou_threshold": 0.45,
       "description": "Custom YOLO11 model for specific object detection",
       "created_at": "2024-01-01",
       "is_custom": true
     }
   }
   ```

3. **Restart the application:** `python start.py`

---

### 🔧 **Method 3: API Import (Programmatic)**

**Perfect for automation and integration!**

```python
import requests
import json

# Upload model via REST API
def import_yolo11_model(model_path, model_name, classes_list, description=""):
    url = "http://localhost:12000/api/models/import"
    
    # Prepare files and data
    with open(model_path, 'rb') as f:
        files = {'model_file': f}
        data = {
            'model_name': model_name,
            'model_type': 'object_detection',  # or 'instance_segmentation'
            'classes': ','.join(classes_list),  # comma-separated string
            'description': description,
            'confidence_threshold': 0.5,
            'iou_threshold': 0.45
        }
        
        response = requests.post(url, files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Model imported successfully!")
            print(f"Model ID: {result['model_id']}")
            print(f"Model Name: {result['model_name']}")
            return result['model_id']
        else:
            print(f"❌ Import failed: {response.text}")
            return None

# Example usage
model_id = import_yolo11_model(
    model_path="path/to/your_yolo11_model.pt",
    model_name="Custom Product Detector",
    classes_list=["product", "defect", "logo", "text"],
    description="YOLO11 model trained on custom product dataset"
)
```

---

### 🎯 **Real-World Example Class Lists**

#### 🏭 **Industrial Inspection**
```python
classes = [
    "screw", "bolt", "nut", "washer",
    "crack", "corrosion", "dent", "scratch",
    "good_part", "defective_part"
]
```

#### 🏥 **Medical Imaging**
```python
classes = [
    "tumor", "normal_tissue", "bone", "organ",
    "lesion", "fracture", "implant", "abnormality"
]
```

#### 🛒 **Retail/E-commerce**
```python
classes = [
    "shirt", "pants", "dress", "shoes",
    "bag", "hat", "jewelry", "accessories",
    "logo", "brand_text", "price_tag"
]
```

#### 🚗 **Automotive**
```python
classes = [
    "car", "truck", "motorcycle", "bicycle",
    "license_plate", "headlight", "tire", "damage",
    "person", "traffic_sign", "traffic_light"
]
```

#### 🏠 **Security/Surveillance**
```python
classes = [
    "person", "face", "vehicle", "package",
    "weapon", "suspicious_object", "fire", "smoke",
    "intruder", "authorized_person"
]
```

---

### 🔍 **Model Validation and Testing**

After importing your YOLO11 model, the system automatically:

1. **✅ Validates Model Format:** Ensures .pt file is valid YOLO format
2. **✅ Extracts Model Info:** Auto-detects classes, input size, architecture
3. **✅ Tests Inference:** Runs a test prediction to verify functionality
4. **✅ Optimizes Loading:** Caches model for faster subsequent use

#### **Manual Testing Your Imported Model:**

```python
# Test your imported model via API
import requests

test_response = requests.post(
    "http://localhost:12000/api/models/test",
    json={
        "model_id": "your_yolo11_model",
        "test_image_path": "path/to/test/image.jpg"
    }
)

if test_response.status_code == 200:
    results = test_response.json()
    print(f"✅ Model test successful!")
    print(f"Detected objects: {len(results['detections'])}")
    for detection in results['detections']:
        print(f"- {detection['class']}: {detection['confidence']:.2f}")
else:
    print(f"❌ Model test failed: {test_response.text}")
```

### 🏋️ Training Your Own YOLO Model

#### Using Ultralytics YOLOv8
```bash
# Install ultralytics
pip install ultralytics

# Train on your dataset
yolo train data=path/to/your/dataset.yaml model=yolov8n.pt epochs=100

# The trained model will be saved as runs/detect/train/weights/best.pt
```

#### Dataset Format for Training
Your dataset should be in YOLO format:
```
your_dataset/
├── images/
│   ├── train/        # Training images
│   └── val/          # Validation images
├── labels/
│   ├── train/        # Training labels (.txt files)
│   └── val/          # Validation labels (.txt files)
└── dataset.yaml      # Dataset configuration
```

**dataset.yaml example:**
```yaml
train: images/train
val: images/val
nc: 3  # number of classes
names: ['person', 'car', 'bicycle']  # class names
```

#### Label Format
Each .txt file contains annotations for one image:
```
class_id center_x center_y width height
0 0.5 0.5 0.3 0.4
1 0.2 0.3 0.1 0.2
```
All coordinates are normalized (0-1).

### 🔄 Converting Models

#### From Other Formats to YOLO
```bash
# Convert Darknet to PyTorch
yolo export model=yolov5s.pt format=pytorch

# Convert TensorFlow to ONNX
yolo export model=your_model.pb format=onnx

# Convert to TensorRT (requires NVIDIA GPU)
yolo export model=yolov8n.pt format=engine
```

#### Model Optimization
```bash
# Export to ONNX for faster inference
yolo export model=your_model.pt format=onnx

# Export to TensorRT for NVIDIA GPUs
yolo export model=your_model.pt format=engine device=0
```

### 📊 Model Performance Tips

#### Choosing the Right Model Size
- **Nano (n):** Fastest, lowest accuracy - good for real-time applications
- **Small (s):** Balanced - recommended for most use cases
- **Medium (m):** Better accuracy, slower - good for batch processing
- **Large (l):** Best accuracy, slowest - for final production use
- **Extra Large (x):** Maximum accuracy, very slow - for research/benchmarking

#### Optimizing Inference Speed
1. **Use GPU:** Set `USE_GPU: True` in config
2. **Use TensorRT:** Convert model to .engine format for NVIDIA GPUs
3. **Batch Processing:** Process multiple images at once
4. **Smaller Input Size:** Reduce image resolution for faster processing

#### Improving Accuracy
1. **More Training Data:** Use larger, more diverse datasets
2. **Data Augmentation:** Apply rotations, scaling, color changes during training
3. **Longer Training:** Increase epochs (but watch for overfitting)
4. **Larger Model:** Use YOLOv8l or YOLOv8x for better accuracy
5. **Fine-tuning:** Start with pre-trained weights and train on your specific data

---

## 🔧 TROUBLESHOOTING GUIDE

### 🚨 Common Issues and Solutions

#### 1. **Application Won't Start**

**Problem:** `python start.py` fails or shows errors
**Solutions:**
1. **Check Python version:**
   ```bash
   python --version  # Should be 3.8 or higher
   ```
2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Check ports:**
   ```bash
   # Kill processes on ports 12000 and 12001
   lsof -ti:12000 | xargs kill -9
   lsof -ti:12001 | xargs kill -9
   ```
4. **Check permissions:**
   ```bash
   chmod +x start.sh  # For Linux/Mac
   ```

#### 2. **Backend Server Issues**

**Problem:** Backend fails to start or crashes
**Check logs:** `/backend/server.log`
**Common fixes:**
1. **Database issues:**
   ```bash
   # Delete and recreate database
   rm database.db
   # Restart application to recreate tables
   ```
2. **Missing models:**
   ```bash
   # Download default YOLO models
   cd backend
   python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
   ```
3. **GPU issues:**
   - Edit `/backend/core/config.py`
   - Set `USE_GPU: bool = False` for CPU-only mode

#### 3. **Frontend Issues**

**Problem:** Frontend won't load or shows errors
**Check logs:** `/frontend/frontend.log`
**Solutions:**
1. **Node.js dependencies:**
   ```bash
   cd frontend
   npm install
   ```
2. **Build issues:**
   ```bash
   cd frontend
   npm run build
   ```
3. **API connection:**
   - Check if backend is running on port 12000
   - Verify API calls in browser developer tools

#### 4. **File Upload Issues**

**Problem:** Images won't upload or show errors
**Check:**
1. **File size:** Must be under 100MB per image
2. **File format:** Must be JPG, JPEG, PNG, BMP, TIFF, or WEBP
3. **Disk space:** Ensure enough space in `/uploads/` directory
4. **Permissions:** Check write permissions on upload directory

**Fix file size limits:**
- Edit `/backend/core/config.py`
- Change `MAX_FILE_SIZE` value
- Edit `/backend/core/file_handler.py`
- Change `MAX_FILE_SIZE` value

#### 5. **Model Loading Issues**

**Problem:** Models fail to load or inference fails
**Solutions:**
1. **Check model files:**
   ```bash
   ls -la models/yolo/  # Should contain .pt files
   ```
2. **Download missing models:**
   ```bash
   cd backend
   python -c "
   from ultralytics import YOLO
   YOLO('yolov8n.pt')
   YOLO('yolov8s.pt')
   "
   ```
3. **GPU memory issues:**
   - Edit `/backend/core/config.py`
   - Reduce `GPU_MEMORY_FRACTION` value
   - Or set `USE_GPU: False`

#### 6. **Database Issues**

**Problem:** Data not saving or database errors
**Solutions:**
1. **Reset database:**
   ```bash
   rm database.db
   # Restart application
   ```
2. **Check database permissions:**
   ```bash
   chmod 666 database.db
   ```
3. **Backup/restore:**
   ```bash
   # Backup
   cp database.db database_backup.db
   # Restore
   cp database_backup.db database.db
   ```

#### 7. **Performance Issues**

**Problem:** Application is slow or unresponsive
**Solutions:**
1. **Enable GPU acceleration:**
   - Edit `/backend/core/config.py`
   - Set `USE_GPU: True`
   - Install CUDA if using NVIDIA GPU
2. **Reduce image sizes:**
   - Edit `/backend/core/config.py`
   - Reduce `MAX_IMAGE_SIZE` value
3. **Optimize model:**
   - Use smaller models (YOLOv8n instead of YOLOv8l)
   - Convert to ONNX or TensorRT format

### 📍 Where to Find Logs

#### Backend Logs
- **Location:** `/backend/server.log`
- **Contains:** API errors, model loading issues, database errors

#### Frontend Logs
- **Location:** `/frontend/frontend.log`
- **Contains:** React build errors, startup issues

#### Browser Console
- **Access:** F12 → Console tab
- **Contains:** JavaScript errors, API call failures

#### Application Logs
- **Location:** `/logs/` directory
- **Contains:** General application logs and error traces

### 🔧 Configuration Quick Reference

#### File Upload Limits
**File:** `/backend/core/config.py`
```python
MAX_FILE_SIZE: int = 100 * 1024 * 1024  # Change this number
MAX_BATCH_SIZE: int = 10000  # Change this number
```

#### Supported File Formats
**File:** `/backend/core/config.py`
```python
SUPPORTED_IMAGE_FORMATS: list = [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]
# Add or remove formats from this list
```

#### Model Settings
**File:** `/backend/core/config.py`
```python
DEFAULT_CONFIDENCE_THRESHOLD: float = 0.5  # 0.1 to 1.0
DEFAULT_IOU_THRESHOLD: float = 0.45  # 0.1 to 1.0
USE_GPU: bool = True  # True or False
```

#### Server Ports
**File:** `/start.py`
```python
BACKEND_PORT = 12000  # Change if port conflicts
FRONTEND_PORT = 12001  # Change if port conflicts
```

---

## 🛠️ DEVELOPMENT GUIDE

### 🏗️ Architecture Overview

The application follows a **client-server architecture**:
- **Frontend (React):** User interface running on port 12001
- **Backend (FastAPI):** API server running on port 12000
- **Database (SQLite):** Local database file
- **File Storage:** Local directories for images and models

### 🔄 Development Workflow

#### 1. **Setting Up Development Environment**
```bash
# Clone repository
git clone https://github.com/yelloji/Auto-Labeling-Tool.git
cd Auto-Labeling-Tool

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows
pip install -r ../requirements.txt

# Frontend setup
cd ../frontend
npm install
```

#### 2. **Running in Development Mode**
```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 12000

# Terminal 2: Frontend
cd frontend
npm start
```

#### 3. **Making Changes**

**Backend Changes:**
- Edit files in `/backend/`
- FastAPI auto-reloads on file changes
- Check logs in terminal or `/backend/server.log`

**Frontend Changes:**
- Edit files in `/frontend/src/`
- React auto-reloads on file changes
- Check browser console for errors

**Database Changes:**
- Edit models in `/backend/database/models.py`
- Delete `database.db` to recreate with new schema
- Or use database migrations (advanced)

### 🧪 Testing

#### Backend Testing
```bash
cd backend
python -m pytest tests/
```

#### Frontend Testing
```bash
cd frontend
npm test
```

#### Manual Testing
1. **API Testing:** Visit `http://localhost:12000/docs` for interactive API documentation
2. **Frontend Testing:** Use browser developer tools to check network requests
3. **End-to-End Testing:** Upload images, run auto-labeling, export annotations

### 📦 Building for Production

#### Backend
```bash
cd backend
pip install -r requirements.txt
# Backend is ready to run with uvicorn
```

#### Frontend
```bash
cd frontend
npm run build
# Creates optimized build in /frontend/build/
```

### 🚀 Deployment Options

#### 1. **Local Deployment (Current)**
- Use provided startup scripts
- Suitable for single-user local use

#### 2. **Docker Deployment**
Create `Dockerfile`:
```dockerfile
FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 12000 12001
CMD ["python", "start.py"]
```

#### 3. **Server Deployment**
- Deploy backend with gunicorn or uvicorn
- Serve frontend with nginx
- Use PostgreSQL instead of SQLite for production

### 🔧 Adding New Features

#### Adding a New API Endpoint
1. **Create endpoint in appropriate file** (e.g., `/backend/api/projects.py`)
2. **Add database operations** in `/backend/database/crud.py`
3. **Update frontend API calls** in `/frontend/src/services/api.js`
4. **Add frontend UI** in appropriate page component

#### Adding a New Page
1. **Create page component** in `/frontend/src/pages/`
2. **Add route** in `/frontend/src/App.js`
3. **Add navigation menu item** in `/frontend/src/App.js`

#### Adding a New Model Format
1. **Update supported formats** in `/backend/core/config.py`
2. **Add validation logic** in `/backend/models/model_manager.py`
3. **Update upload UI** in `/frontend/src/pages/Models.js`

### 📊 Database Schema

#### Current Tables
```sql
-- Projects table
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    created_at DATETIME,
    updated_at DATETIME
);

-- Datasets table
CREATE TABLE datasets (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    project_id INTEGER REFERENCES projects(id),
    created_at DATETIME,
    updated_at DATETIME
);

-- Images table
CREATE TABLE images (
    id INTEGER PRIMARY KEY,
    filename VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    dataset_id INTEGER REFERENCES datasets(id),
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    created_at DATETIME
);

-- Annotations table
CREATE TABLE annotations (
    id INTEGER PRIMARY KEY,
    image_id INTEGER REFERENCES images(id),
    class_name VARCHAR NOT NULL,
    bbox_x FLOAT,
    bbox_y FLOAT,
    bbox_width FLOAT,
    bbox_height FLOAT,
    confidence FLOAT,
    created_by VARCHAR,
    created_at DATETIME
);
```

### 🔐 Security Considerations

#### Current Security Measures
- File type validation
- File size limits
- Secure filename generation
- Input sanitization

#### Recommended Additions for Production
- User authentication
- API rate limiting
- HTTPS encryption
- File content validation
- Access control

---

## 📝 CONCLUSION

This manual provides comprehensive documentation for the Auto-Labeling-Tool project. It covers:

✅ **Complete project structure** with every file explained
✅ **Detailed code documentation** with purpose and functionality
✅ **User manual** with step-by-step instructions
✅ **Model import guide** for custom YOLO models
✅ **Troubleshooting guide** for common issues
✅ **Development guide** for extending the application

**For any issues:**
1. Check the troubleshooting section first
2. Look up the specific file in this manual
3. Check the logs in the specified locations
4. Refer to the configuration quick reference

**Key files to remember:**
- **Configuration:** `/backend/core/config.py`
- **File uploads:** `/backend/core/file_handler.py`
- **API endpoints:** `/backend/api/`
- **Frontend pages:** `/frontend/src/pages/`
- **Database:** `database.db`
- **Logs:** `/backend/server.log` and `/frontend/frontend.log`

This tool is designed to be a complete local alternative to cloud-based annotation tools, providing full control over your data and models while maintaining ease of use and powerful features.