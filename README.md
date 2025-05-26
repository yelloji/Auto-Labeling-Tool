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
- 🎯 **Import YOLO11 models** - Easy custom model import for better accuracy

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

#### 🕐 **Why Node.js Installation Takes 3-5 Minutes**

**This is normal for first-time setup!** Here's what's happening:

1. **📥 Downloading Node.js:** ~30-50MB download from nodejs.org
2. **💾 Installing Node.js:** Windows installer sets up files and registry
3. **🔧 Setting up npm:** Package manager installation and configuration
4. **🌐 Network Speed:** Depends on your internet connection

#### ⚡ **Speed It Up - Alternative Options:**

**🚀 Option 1: Manual Node.js Install (Fastest)**
1. **Stop current process:** Press `Ctrl+C`
2. **Download Node.js:** Go to https://nodejs.org/en/download/
3. **Install Node.js:** Run the downloaded `.msi` file
4. **Run app again:** `python start.py` (much faster now!)

**🔧 Option 2: Let It Finish (Recommended)**
Just wait 2-3 more minutes. You'll see:
```
✅ Node.js installed successfully!
📦 Installing Python packages...
📦 Installing frontend dependencies...
🚀 Starting the app...
```

**📊 Option 3: Check Progress**
Open another terminal and check:
```cmd
node --version
npm --version
```

#### 📦 **What's Being Downloaded:**
```
📦 Node.js (~50MB) - JavaScript runtime
📦 npm packages (~100MB) - Frontend dependencies  
📦 Python packages (~200MB) - Backend dependencies
```
**Total:** ~350MB download + installation time

#### 💡 **Important:**
This 3-5 minute wait is a **one-time investment**! After the first install, starting the app takes only 10-20 seconds.

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

**Q: Node.js installation is taking too long (3+ minutes). What can I do?**  
A: You have 3 options:
- **🚀 FASTEST:** Install Node.js manually from https://nodejs.org/en/download/ then run `python start.py` again
- **⏳ WAIT:** Let it finish (3-5 minutes) - this only happens once
- **🔄 RESTART:** Press `Ctrl+C` and try `python start.py` again

**Q: What if something goes wrong?**  
A: Just run `python start.py` again. It will fix itself.

**Q: How do I stop the app?**  
A: Press `Ctrl+C` in the terminal where you ran the command.

**Q: How do I start it again later?**  
A: Just run `python start.py` again. It will be much faster the second time.

**Q: Can I use this on Windows/Mac/Linux?**  
A: Yes! It works on all operating systems.

---

## 🤖 **How to Import Your Own YOLO11 Model**

**This is one of the most important features!** You can easily import your custom YOLO11 models for better accuracy on your specific objects.

### 🚀 **Method 1: Web Interface (Easiest)**

1. **Start the app:** `python start.py`
2. **Open browser:** http://localhost:12001
3. **Go to Models page** → Click **"Import Custom Model"**
4. **Upload your YOLO11 model:**
   - Select your `.pt` file (e.g., `my_yolo11_model.pt`)
   - Enter model name (e.g., "My Custom YOLO11")
   - Add class names (comma-separated: `person,car,bike,dog,cat`)
   - Click **"Import Model"**
5. **Done!** Your model is now available for auto-labeling

### 📁 **Method 2: Direct File Copy**

1. **Copy your model** to the custom folder:
   ```bash
   cp your_yolo11_model.pt Auto-Labeling-Tool/models/custom/
   ```

2. **Add to config file** `models/models_config.json`:
   ```json
   {
     "your_yolo11_model": {
       "id": "your_yolo11_model",
       "name": "My Custom YOLO11 Model",
       "type": "object_detection",
       "format": "pytorch",
       "path": "/workspace/Auto-Labeling-Tool/models/custom/your_yolo11_model.pt",
       "classes": ["class1", "class2", "class3"],
       "input_size": [640, 640],
       "confidence_threshold": 0.5,
       "is_custom": true
     }
   }
   ```

3. **Restart the app:** `python start.py`

### 🔧 **Method 3: API Import (Programmatic)**

```python
import requests

# Upload model via API
with open('your_yolo11_model.pt', 'rb') as f:
    files = {'model_file': f}
    data = {
        'model_name': 'My YOLO11 Model',
        'model_type': 'object_detection',
        'classes': 'person,car,bike,dog,cat',  # comma-separated
        'description': 'Custom YOLO11 for my specific use case'
    }
    
    response = requests.post(
        'http://localhost:12000/api/models/import',
        files=files,
        data=data
    )
    
    print(f"Model imported with ID: {response.json()['model_id']}")
```

### ✅ **What Your YOLO11 Model Needs:**

- **File Format:** `.pt` (PyTorch format)
- **YOLO Version:** YOLO11, YOLOv8, YOLOv5 all supported
- **Model Types:** Object Detection, Instance Segmentation
- **Classes:** Will auto-detect or you can specify manually

### 🎯 **Example Class Lists:**

```python
# For custom object detection
classes = ["product", "defect", "logo", "text"]

# For medical imaging  
classes = ["tumor", "normal_tissue", "bone", "organ"]

# For industrial inspection
classes = ["screw", "bolt", "crack", "corrosion"]

# For retail/e-commerce
classes = ["shirt", "pants", "shoes", "accessories"]
```

### 🚀 **After Import:**

1. **Your model appears** in the Models page
2. **Select it** when creating new projects
3. **Auto-label images** with your custom model
4. **Fine-tune** with your own data
5. **Export** in multiple formats (YOLO, COCO, Pascal VOC)

**📖 For more details, see the complete Model Import Guide in PROJECT_MANUAL.md**

---

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

### 🚧 NEXT PRIORITY FEATURES
- [ ] **🧠 Active Learning Pipeline** - Train custom models iteratively with small datasets
- [ ] **🎯 Model Training Integration** - Fine-tune YOLO models on your labeled data
- [ ] **🔄 Human-in-the-Loop Workflow** - Review predictions, correct labels, retrain automatically
- [ ] **📊 Uncertainty Sampling** - Smart selection of most informative images to label next

### 🚧 FUTURE ENHANCEMENTS
- [ ] Label editing capabilities in annotation interface
- [ ] Video annotation support
- [ ] Advanced export formats (CVAT, Labelbox)
- [ ] Multi-user collaboration features
- [ ] Cloud storage integration (optional)
- [ ] Mobile app for annotation review

### 🧠 **ACTIVE LEARNING - Coming Soon!**

**Your exact workflow will be supported:**

1. **📝 Label 10-20 images** manually (complex defects/objects)
2. **🤖 Train custom model** on your small dataset
3. **🔍 Auto-label new images** with your trained model
4. **✅ Review & correct** predictions in the interface
5. **🔄 Retrain model** with corrected labels automatically
6. **📈 Repeat until perfect** - model gets smarter each iteration
7. **🚀 Deploy final model** for full auto-labeling

**Perfect for:**
- 🏭 Complex industrial defects
- 🔬 Medical imaging anomalies  
- 🎯 Custom object detection
- 📱 Product quality inspection
- 🚗 Specialized automotive parts

### 🔧 **Temporary Workaround (Until Active Learning is Ready)**

**For now, you can achieve similar results manually:**

1. **📝 Label 10-20 images** using the annotation interface
2. **📤 Export dataset** in YOLO format
3. **🤖 Train YOLO model** externally using Ultralytics:
   ```bash
   pip install ultralytics
   yolo train data=your_dataset.yaml model=yolov8n.pt epochs=50
   ```
4. **📥 Import trained model** back into the tool
5. **🔍 Use for auto-labeling** new images
6. **🔄 Repeat process** with corrected labels

**External Training Script Example:**
```python
from ultralytics import YOLO

# Load a model
model = YOLO('yolov8n.pt')  # or yolo11n.pt

# Train the model
results = model.train(
    data='path/to/your/dataset.yaml',
    epochs=50,
    imgsz=640,
    batch=16
)

# The trained model will be saved as runs/detect/train/weights/best.pt
# Import this back into the Auto-Labeling-Tool
```

### 🎯 CURRENT FOCUS
The tool is now **production-ready** with comprehensive features. **Active Learning is the next major feature** to make it perfect for complex, domain-specific use cases.

## 📄 License

MIT License - see LICENSE file for details.