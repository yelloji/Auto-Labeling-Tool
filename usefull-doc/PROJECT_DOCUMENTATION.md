# Auto-Labeling-Tool - Complete Project Documentation

## 🎯 Project Overview

**Auto-Labeling-Tool** is a comprehensive local computer vision annotation platform that combines automatic AI labeling with manual annotation capabilities. Think of it as a self-hosted alternative to Roboflow or LabelImg, but with advanced AI assistance.

### Core Purpose
- **Automatic Labeling**: Use YOLO11 and other AI models to automatically detect and label objects
- **Manual Annotation**: Provide tools for manual polygon, bounding box, and point annotations
- **Active Learning**: Intelligently suggest which images need human review
- **Dataset Management**: Organize, export, and analyze computer vision datasets

---

## 🏗️ Architecture Overview

```
┌─────────────────┐    HTTP/REST API    ┌─────────────────┐
│   Frontend      │ ◄─────────────────► │    Backend      │
│   (React)       │                     │   (FastAPI)     │
│   Port 12001    │                     │   Port 12000    │
└─────────────────┘                     └─────────────────┘
                                                │
                                                ▼
                                        ┌─────────────────┐
                                        │   SQLite DB     │
                                        │   (database.db) │
                                        └─────────────────┘
```

### Technology Stack

**Backend (Python)**
- **FastAPI**: Modern async web framework
- **SQLAlchemy**: Database ORM
- **SQLite**: Local database
- **Ultralytics**: YOLO11 AI models
- **OpenCV**: Image processing
- **PyTorch**: Deep learning framework

**Frontend (JavaScript)**
- **React 18**: UI framework
- **Ant Design**: UI component library
- **Konva/React-Konva**: Canvas-based annotation tools
- **Axios**: HTTP client
- **React Router**: Navigation

---

## 📁 Project Structure Deep Dive

```
auto-2/
├── 🚀 start.py                    # Main launcher (USE THIS!)
├── 🪟 start.bat                   # Windows batch launcher
├── 📖 README.md                   # Basic project info
├── 📋 PROJECT_DOCUMENTATION.md    # This file
│
├── 🔧 backend/                    # Python FastAPI backend
│   ├── 🌐 main.py                # FastAPI app entry point
│   ├── 📦 requirements.txt       # Python dependencies
│   ├── 🗄️ database.db           # SQLite database file
│   │
│   ├── 🛣️ api/                   # API endpoints
│   │   ├── 📁 routes/            # Route modules
│   │   │   ├── projects.py       # Project CRUD operations
│   │   │   ├── datasets.py       # Dataset management
│   │   │   ├── annotations.py    # Annotation operations
│   │   │   ├── models.py         # AI model management
│   │   │   └── export.py         # Data export functionality
│   │   ├── active_learning.py    # Active learning algorithms
│   │   └── smart_segmentation.py # AI segmentation tools
│   │
│   ├── 🧠 core/                  # Business logic
│   │   ├── config.py             # App configuration
│   │   ├── auto_labeler.py       # AI labeling engine
│   │   ├── dataset_manager.py    # Dataset operations
│   │   ├── file_handler.py       # File upload/processing
│   │   └── active_learning.py    # Active learning core
│   │
│   ├── 🗃️ database/              # Database layer
│   │   ├── base.py               # SQLAlchemy base
│   │   ├── database.py           # DB connection & session
│   │   ├── models.py             # Database models/tables
│   │   └── operations.py         # Database operations
│   │
│   ├── 🤖 models/                # AI model management
│   │   ├── model_manager.py      # Model loading/inference
│   │   └── training/             # Model training utilities
│   │
│   └── 🔧 utils/                 # Utility functions
│       └── augmentation_utils.py # Data augmentation
│
├── 🎨 frontend/                  # React frontend
│   ├── 📦 package.json          # Node.js dependencies
│   ├── 🌐 public/               # Static assets
│   └── 📁 src/                  # Source code
│       ├── 🏠 App.js            # Main React component
│       ├── ⚙️ config.js         # Frontend configuration
│       │
│       ├── 🧩 components/        # Reusable UI components
│       │   ├── AnnotationToolset/ # Annotation tools
│       │   ├── ActiveLearning/   # Active learning UI
│       │   ├── DatasetManagement.js
│       │   ├── DataAugmentation.js
│       │   └── Navbar.js
│       │
│       ├── 📄 pages/             # Main application pages
│       │   ├── Dashboard.js      # Main dashboard
│       │   ├── Projects.js       # Project management
│       │   ├── Datasets.js       # Dataset overview
│       │   ├── ManualLabeling.jsx # Manual annotation interface
│       │   ├── AnnotateProgress.jsx # Progress tracking
│       │   └── ProjectWorkspace.js # Project workspace
│       │
│       ├── 🔌 services/          # API communication
│       │   └── api.js            # Axios API client
│       │
│       └── 🛠️ utils/             # Frontend utilities
│           └── errorHandler.js   # Error handling
│
├── 🤖 models/                    # AI model storage
│   ├── pretrained/               # Pre-trained models
│   ├── custom/                   # Custom trained models
│   ├── yolo/                     # YOLO model files
│   └── sam/                      # Segment Anything models
│
├── 📊 datasets/                  # Dataset storage
├── 📁 uploads/                   # User uploaded files
├── 🖼️ test_images/              # Sample test datasets
├── 📜 scripts/                   # Utility scripts
└── 📋 logs/                      # Application logs
```

---

## 🗄️ Database Schema

The SQLite database (`database.db`) contains these main tables:

### Projects Table
```sql
projects:
  - id (Primary Key)
  - name (Project name)
  - description
  - project_type (detection/segmentation/classification)
  - created_at
  - updated_at
```

### Datasets Table
```sql
datasets:
  - id (Primary Key)
  - project_id (Foreign Key)
  - name
  - description
  - image_count
  - created_at
```

### Images Table
```sql
images:
  - id (Primary Key)
  - dataset_id (Foreign Key)
  - filename
  - file_path
  - width, height
  - annotation_status (unassigned/in_progress/completed)
  - created_at
```

### Annotations Table
```sql
annotations:
  - id (Primary Key)
  - image_id (Foreign Key)
  - class_name
  - annotation_type (bbox/polygon/point)
  - coordinates (JSON)
  - confidence_score
  - is_ai_generated (boolean)
  - created_at
```

---

## 🛣️ API Structure

### Main API Endpoints

**Projects**: `/api/projects/`
- `GET /` - List all projects
- `POST /` - Create new project
- `GET /{id}` - Get project details
- `PUT /{id}` - Update project
- `DELETE /{id}` - Delete project

**Datasets**: `/api/datasets/`
- `GET /project/{project_id}` - Get project datasets
- `POST /` - Create dataset
- `POST /{id}/upload` - Upload images

**Annotations**: `/api/annotations/`
- `GET /image/{image_id}` - Get image annotations
- `POST /` - Create annotation
- `PUT /{id}` - Update annotation
- `DELETE /{id}` - Delete annotation

**AI Models**: `/api/models/`
- `GET /available` - List available models
- `POST /auto-label` - Run auto-labeling
- `POST /train` - Train custom model

**Export**: `/api/export/`
- `POST /yolo` - Export in YOLO format
- `POST /coco` - Export in COCO format
- `POST /pascal` - Export in Pascal VOC format

---

## 🎨 Frontend Component Structure

### Main Pages
1. **Dashboard** (`pages/Dashboard.js`)
   - Project overview
   - Recent activity
   - Quick stats

2. **Projects** (`pages/Projects.js`)
   - Project management
   - Create/edit/delete projects

3. **Manual Labeling** (`pages/ManualLabeling.jsx`)
   - Canvas-based annotation interface
   - Polygon, bbox, point tools
   - Zoom, pan, undo/redo

4. **Annotate Progress** (`pages/AnnotateProgress.jsx`)
   - Shows annotation progress
   - Active learning suggestions
   - Image status management

### Key Components
- **AnnotationToolset**: Canvas annotation tools
- **ActiveLearning**: AI-assisted labeling interface
- **DatasetManagement**: Dataset CRUD operations
- **Navbar**: Main navigation

---

## 🚀 Installation & Setup

### Quick Start (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd auto-2

# Run the launcher (installs everything automatically)
python start.py
```

### Manual Setup
```bash
# Backend setup
cd backend
pip install -r requirements.txt

# Frontend setup  
cd ../frontend
npm install

# Start backend
cd ../backend
uvicorn main:app --host 0.0.0.0 --port 12000

# Start frontend (new terminal)
cd frontend
npm start
```

### Access Points
- **Frontend UI**: http://localhost:12001
- **Backend API**: http://localhost:12000
- **API Docs**: http://localhost:12000/api/docs

---

## 🔧 Development Workflow

### Adding New Features

1. **Backend Changes**:
   ```bash
   cd backend
   # Add new route in api/routes/
   # Add business logic in core/
   # Update database models if needed
   # Test with FastAPI docs
   ```

2. **Frontend Changes**:
   ```bash
   cd frontend
   # Add new components in components/
   # Add new pages in pages/
   # Update API calls in services/api.js
   # Test in browser
   ```

3. **Database Changes**:
   ```bash
   cd backend
   # Update models in database/models.py
   # Create migration script if needed
   # Test database operations
   ```

### Key Development Files

**Backend Entry Points**:
- `main.py` - FastAPI app configuration
- `api/routes/` - Add new API endpoints here
- `core/` - Add business logic here
- `database/models.py` - Database schema

**Frontend Entry Points**:
- `src/App.js` - Main React app
- `src/pages/` - Add new pages here
- `src/components/` - Add reusable components
- `src/services/api.js` - API communication

---

## 🐛 Common Issues & Solutions

### Issue: "pkill command not found" (Windows)
**Solution**: Use `start.py` instead of shell scripts
```bash
python start.py  # Cross-platform launcher
```

### Issue: Port already in use
**Solution**: Kill existing processes
```bash
# Windows
taskkill /F /IM "uvicorn.exe"
taskkill /F /IM "node.exe"

# Linux/Mac
pkill -f uvicorn
pkill -f "npm start"
```

### Issue: Frontend shows old cached data
**Solution**: Clear React cache
```bash
cd frontend
rm -rf node_modules/.cache
rm -rf build
npm start
```

### Issue: Database connection errors
**Solution**: Check database file permissions
```bash
cd backend
ls -la database.db  # Should be readable/writable
```

### Issue: AI models not loading
**Solution**: Check models directory
```bash
ls -la models/
# Ensure model files exist and are accessible
```

---

## 🔍 Key Files to Know

### Critical Files (Don't Delete!)
- `start.py` - Main launcher
- `backend/main.py` - Backend entry point
- `backend/database.db` - Your data!
- `frontend/src/App.js` - Frontend entry point
- `backend/requirements.txt` - Python dependencies
- `frontend/package.json` - Node.js dependencies

### Configuration Files
- `backend/core/config.py` - Backend settings
- `frontend/src/config.js` - Frontend settings
- `models/models_config.json` - AI model configuration

### Important Directories
- `uploads/projects/` - User uploaded images
- `models/` - AI model files
- `logs/` - Application logs
- `datasets/` - Processed datasets

---

## 📈 Performance Tips

1. **Database**: SQLite is fine for local use, but consider PostgreSQL for production
2. **Images**: Large images are automatically resized for faster processing
3. **Models**: YOLO11 models are cached after first load
4. **Frontend**: React components use lazy loading for better performance

---

## 🔒 Security Notes

- This is designed for **local use only**
- No authentication system (assumes trusted local environment)
- File uploads are validated but stored locally
- API has CORS enabled for local development

---

## 🚀 Future Enhancements

- [ ] Multi-user support with authentication
- [ ] Cloud storage integration
- [ ] Real-time collaboration
- [ ] Advanced AI model training
- [ ] Mobile-responsive interface
- [ ] Docker containerization

---

## 📞 Getting Help

1. **Check logs**: `logs/backend.log` and `logs/frontend.log`
2. **API Documentation**: http://localhost:12000/api/docs
3. **Database inspection**: Use SQLite browser on `backend/database.db`
4. **Browser DevTools**: Check console for frontend errors

---

*This documentation is maintained as the project evolves. Last updated: 2025-06-04*