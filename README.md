# Auto-Labeling-Tool 🏷️

**The easiest way to label your images for AI training!** 

✨ **Better than Roboflow** - but runs on your computer  
🚀 **Super easy to use** - just 3 commands to start  
💻 **Works everywhere** - Windows, Mac, Linux  
🔒 **Your data stays private** - everything runs locally  

## ✅ **Ready to Use Right Now!**

This tool can:
- 🏷️ **Auto-label your images** using AI models
- 📊 **Manage your datasets** with smart organization  
- 🎨 **Augment your data** with 15+ effects
- 📈 **Show analytics** about your labels
- 💾 **Export in any format** (YOLO, COCO, etc.)
- 🎯 **Import custom models** for better accuracy

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

## 🚀 How to Install and Run

### ⚡ **SUPER SIMPLE - 3 COMMANDS ONLY!**

**Step 1:** Download the code
```bash
git clone https://github.com/yelloji/Auto-Labeling-Tool.git
```

**Step 2:** Go into the folder
```bash
cd Auto-Labeling-Tool
```

**Step 3:** Run it!
```bash
python start.py
```

**That's it! 🎉** The app will install everything automatically and start running.

---

### 🕐 **First Time Running (Takes 3-5 minutes)**

When you run `python start.py` for the **first time**, here's what happens:

```
🏷️ Starting Auto-Labeling-Tool...
==================================
🔍 Checking what you need...
📦 Installing Node.js... ✅ Done!
📦 Installing Python packages... ✅ Done!
📦 Installing website files... ✅ Done!
🚀 Starting the app...
✅ Backend started on port 12000
✅ Frontend started on port 12001

🎉 Auto-Labeling-Tool is now running!
Open your browser: http://localhost:12001
```

**What gets installed automatically:**
- ✅ Node.js (if you don't have it)
- ✅ All Python packages needed
- ✅ All website files needed
- ✅ Everything else required

---

### ⚡ **Second Time Running (Takes 10-20 seconds)**

When you run `python start.py` **again**, it's super fast:

```
🏷️ Starting Auto-Labeling-Tool...
==================================
🔍 Checking what you need...
✅ Node.js found - good!
✅ Python packages found - good!
✅ Website files found - good!
🚀 Starting the app...
✅ Backend started on port 12000
✅ Frontend started on port 12001

🎉 Auto-Labeling-Tool is now running!
Open your browser: http://localhost:12001
```

**Why it's faster:**
- ✅ Everything is already installed
- ✅ Just starts the app directly
- ✅ No downloading or installing needed

---

### 🎯 **What You Need (Only Python!)**

**Required:**
- ✅ **Python 3.8 or newer** (that's it!)

**Installed Automatically:**
- 🤖 Node.js (if missing)
- 🤖 All other software needed

**You only need Python installed on your computer!** Everything else is automatic. 🚀

---

### 🗂️ **What Files Get Created:**

After running the first time, you'll see these new folders:
```
Auto-Labeling-Tool/
├── backend/
│   └── venv/              ← Python packages stored here
├── frontend/
│   └── node_modules/      ← Website files stored here
└── database.db           ← Your data stored here
```

**Don't delete these folders!** They contain all the installed software and your data.

---

### ❓ **Common Questions:**

**Q: Do I need to install Node.js myself?**  
A: No! The app installs it automatically if you don't have it.

**Q: What if something goes wrong?**  
A: Just run `python start.py` again. It will fix itself.

**Q: How do I stop the app?**  
A: Press `Ctrl+C` in the terminal where you ran the command.

**Q: How do I start it again later?**  
A: Just run `python start.py` again. It will be much faster the second time.

**Q: Can I use this on Windows/Mac/Linux?**  
A: Yes! It works on all operating systems.

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