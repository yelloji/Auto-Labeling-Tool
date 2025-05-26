# Auto-Labeling-Tool 🏷️

A comprehensive local auto-labeling tool for computer vision datasets that **rivals and exceeds cloud-based solutions like Roboflow**. Fully local, optimized, and user-friendly with advanced features for professional dataset management.

## 🎉 Current Status: **PRODUCTION READY** 

✅ **Complete Full-Stack Implementation Achieved!**
- **Advanced Analytics**: Class distribution, imbalance detection, labeling progress tracking
- **Data Augmentation**: 15+ augmentation types with presets and real-time preview
- **Dataset Management**: Train/Val/Test splitting with percentage controls
- **Visual Indicators**: Clear status indicators for labeled/unlabeled images
- **Professional UI**: Enhanced table views with advanced filtering and actions
- **Auto-labeling Pipeline**: 4 pre-trained YOLO models with custom model import
- **Database**: Extended with 10 tables for comprehensive data management
- **Export Systems**: Multiple format support (YOLO, COCO, Pascal VOC)

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Git

### One-Command Startup 🚀

**Option 1: Python Launcher (Recommended - Cross-platform)**
```bash
git clone https://github.com/yelloji/Auto-Labeling-Tool.git
cd Auto-Labeling-Tool
python start.py
```

**Option 2: Shell Script (Linux/Mac)**
```bash
git clone https://github.com/yelloji/Auto-Labeling-Tool.git
cd Auto-Labeling-Tool
./start.sh
```

**Option 3: Batch File (Windows)**
```bash
git clone https://github.com/yelloji/Auto-Labeling-Tool.git
cd Auto-Labeling-Tool
start.bat
```

### Manual Installation & Setup (Alternative)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yelloji/Auto-Labeling-Tool.git
   cd Auto-Labeling-Tool
   ```

2. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```
   Backend will start on `http://localhost:12000`

3. **Frontend Setup** (in new terminal)
   ```bash
   cd frontend
   npm install
   npm start
   ```
   Frontend will start on `http://localhost:12001`

### Access the Application
- **Frontend UI:** http://localhost:12001
- **Backend API:** http://localhost:12000  
- **API Documentation:** http://localhost:12000/docs

### File Upload Specifications
- **Maximum file size:** 100MB per image
- **Maximum batch size:** 10,000 images per upload
- **Supported formats:** .jpg, .jpeg, .png, .bmp, .tiff, .webp

4. **Start Labeling!**
   - Visit the frontend URL
   - Upload your first dataset
   - Use pre-trained models for auto-labeling
   - Manually refine annotations as needed

## 🚀 Features

### 🎯 Core Labeling Capabilities
- **Multi-format Annotation**: Bounding boxes, polygons, keypoints, segmentation masks
- **Auto-labeling**: Integration with YOLOv8 models (Nano, Small, Segmentation)
- **Custom Model Import**: Easy YOLO model import with validation
- **Batch Processing**: Process multiple images simultaneously
- **Real-time Preview**: Instant annotation preview and validation

### 📊 Advanced Analytics & Insights
- **Class Distribution Analysis**: Visual charts showing label distribution
- **Imbalance Detection**: Automatic detection of class imbalances with recommendations
- **Labeling Progress Tracking**: Comprehensive progress monitoring with health scores
- **Split Analysis**: Train/Val/Test split statistics and validation
- **Dataset Health Scoring**: Overall dataset quality assessment

### 🔄 Professional Data Augmentation
- **15+ Augmentation Types**: Geometric, color, noise, weather effects, and more
- **Smart Presets**: Light, Medium, Heavy augmentation presets
- **Real-time Preview**: See augmentation effects before applying
- **Batch Processing**: Apply augmentations to entire datasets
- **Custom Parameters**: Fine-tune each augmentation type

### 📈 Dataset Management
- **Train/Val/Test Splitting**: Intelligent splitting with percentage controls
- **Visual Status Indicators**: Clear indicators for labeled/unlabeled images
- **Advanced Filtering**: Filter by completion status, split type, labels
- **Bulk Operations**: Move, delete, or modify multiple images at once
- **Image Management**: Organized storage with metadata tracking

### 🎨 User Experience
- **Professional UI**: Modern React interface with Ant Design components
- **Modal-based Workflows**: Streamlined access to advanced features
- **Enhanced Tables**: Sortable, filterable tables with action menus
- **Responsive Design**: Works on desktop and tablet devices
- **Real-time Updates**: Live data updates without page refresh

### ⚡ Performance & Optimization
- **CPU & GPU Support**: Optimized for both CPU and GPU acceleration
- **Local Processing**: No data leaves your machine - complete privacy
- **Memory Efficient**: Handles large datasets efficiently
- **Fast Inference**: Optimized model inference pipeline
- **Scalable Architecture**: FastAPI backend with SQLite/PostgreSQL support

## 🛠️ Tech Stack

- **Backend**: FastAPI with Python, SQLAlchemy ORM, Pydantic validation
- **Frontend**: React 18, Ant Design 5, React Router, Axios, @ant-design/plots
- **ML Framework**: PyTorch, Ultralytics YOLOv8, OpenCV, PIL, Albumentations
- **Database**: SQLite (default) with PostgreSQL support
- **Storage**: Local filesystem with organized structure and metadata tracking

## 📁 Project Structure

```
Auto-Labeling-Tool/
├── 🚀 STARTUP FILES
│   ├── start.py            # Cross-platform Python startup script
│   ├── start.sh            # Linux/Mac startup script
│   └── start.bat           # Windows startup script
│
├── 🔧 BACKEND (FastAPI + Python)
│   ├── main.py             # FastAPI application entry point
│   ├── api/
│   │   ├── routes/         # API endpoints
│   │   │   ├── analytics.py      # Dataset analytics & insights
│   │   │   ├── augmentation.py   # Data augmentation pipeline
│   │   │   ├── dataset_management.py # Train/Val/Test splitting
│   │   │   ├── dashboard.py      # Dashboard statistics
│   │   │   ├── models.py         # AI model management
│   │   │   ├── projects.py       # Project management
│   │   │   ├── datasets.py       # Dataset operations
│   │   │   └── annotations.py    # Annotation management
│   │   └── __init__.py
│   ├── core/               # Core configuration and utilities
│   ├── database/           # Database models and operations
│   ├── models/             # AI model integrations
│   └── utils/              # Utility functions
│       └── augmentation_utils.py # Advanced augmentation utilities
│
├── 🎨 FRONTEND (React + Ant Design)
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── DatasetAnalytics.js    # Analytics dashboard
│   │   │   ├── DataAugmentation.js    # Augmentation interface
│   │   │   └── DatasetManagement.js   # Dataset splitting UI
│   │   ├── pages/          # Page components
│   │   │   ├── Dashboard.js           # Main dashboard
│   │   │   ├── Datasets.js            # Enhanced dataset management
│   │   │   ├── Projects.js            # Project management
│   │   │   ├── Models.js              # Model management
│   │   │   └── Annotate.js            # Annotation interface
│   │   ├── hooks/          # Custom hooks
│   │   └── utils/          # Frontend utilities
│   ├── public/             # Static files
│   └── package.json        # Dependencies (includes @ant-design/plots)
│
├── 📊 DATA DIRECTORIES
│   ├── datasets/           # Local dataset storage
│   ├── models/             # Pre-trained and custom models
│   ├── uploads/            # Temporary upload files
│   ├── temp/               # Temporary processing files
│   └── static/             # Static web files
│
├── 🗄️ DATABASE
│   └── database.db         # SQLite database (10 tables)
│
└── 📄 DOCUMENTATION
    ├── README.md           # This file
    ├── PROJECT_MANUAL.md   # Comprehensive project manual
    └── requirements.txt    # Python dependencies
```

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yelloji/Auto-Labeling-Tool.git
cd Auto-Labeling-Tool

# Install dependencies
pip install -r requirements.txt

# Start the backend
cd backend
python main.py

# Start the frontend (in another terminal)
cd frontend
npm install
npm start
```

## 🎯 Roadmap

### ✅ COMPLETED (Production Ready)
- [x] Project setup and architecture
- [x] Complete backend API development (FastAPI)
- [x] Professional frontend interface (React + Ant Design)
- [x] Model integration (YOLOv8 Nano, Small, Segmentation)
- [x] Auto-labeling pipeline with custom model import
- [x] Advanced dataset management with Train/Val/Test splitting
- [x] Export/import functionality (YOLO, COCO, Pascal VOC)
- [x] **Advanced Analytics**: Class distribution, imbalance detection, progress tracking
- [x] **Data Augmentation**: 15+ augmentation types with presets and preview
- [x] **Visual Indicators**: Status indicators for labeled/unlabeled images
- [x] **Enhanced UI**: Modal-based workflows, advanced filtering, bulk operations

### 🚧 FUTURE ENHANCEMENTS
- [ ] Label editing capabilities in annotation interface
- [ ] Video annotation support
- [ ] Active learning with intelligent sample selection
- [ ] Model training pipeline integration
- [ ] Advanced export formats (CVAT, Labelbox)
- [ ] Multi-user collaboration features
- [ ] Cloud storage integration (optional)
- [ ] Mobile app for annotation review

### 🎯 CURRENT FOCUS
The tool is now **production-ready** with comprehensive features that rival and exceed cloud-based solutions like Roboflow. All core functionality is implemented and tested.

## 📄 License

MIT License - see LICENSE file for details.