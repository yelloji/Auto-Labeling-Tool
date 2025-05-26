# Auto-Labeling-Tool 🏷️

A comprehensive local auto and semi-automatic labeling tool for computer vision datasets. Built to be better than Roboflow - fully local, optimized, and easy to use with both CPU and GPU support.

## 🚀 Features

### Core Labeling Capabilities
- **Multi-format Annotation**: Bounding boxes, polygons, keypoints, segmentation masks
- **Video Annotation**: Frame-by-frame and interpolation support
- **Auto-labeling**: Integration with state-of-the-art models (YOLOv8, SAM, CLIP, etc.)
- **Semi-automatic Labeling**: Human-in-the-loop with smart suggestions
- **Batch Processing**: Process multiple images/videos simultaneously

### Advanced AI Features
- **Pre-trained Models**: YOLOv8, Segment Anything Model (SAM), CLIP, and more
- **Custom Model Training**: Train models on your own data
- **Active Learning**: Intelligent sample selection for optimal labeling efficiency
- **Quality Assurance**: Automated validation and consistency checks

### Data Management
- **Multi-format Support**: COCO, YOLO, Pascal VOC, CVAT, and more
- **Dataset Organization**: Smart project and dataset management
- **Data Augmentation**: Built-in augmentation pipeline
- **Version Control**: Track dataset changes and annotations

### Performance & Optimization
- **CPU & GPU Support**: Optimized for both CPU and GPU acceleration
- **Local Processing**: No data leaves your machine
- **Memory Efficient**: Handles large datasets efficiently
- **Fast Inference**: Optimized model inference pipeline

## 🛠️ Tech Stack

- **Backend**: FastAPI with Python
- **Frontend**: Modern React-based web interface
- **ML Framework**: PyTorch with Ultralytics integration
- **Database**: SQLite/PostgreSQL for metadata
- **Storage**: Local filesystem with organized structure

## 📁 Project Structure

```
Auto-Labeling-Tool/
├── backend/                 # FastAPI backend
│   ├── api/                # API endpoints
│   ├── core/               # Core business logic
│   ├── models/             # ML model integrations
│   ├── database/           # Database models and operations
│   └── utils/              # Utility functions
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   └── utils/          # Frontend utilities
│   └── public/
├── models/                 # Pre-trained and custom models
├── datasets/               # Local dataset storage
├── docs/                   # Documentation
├── scripts/                # Utility scripts
└── tests/                  # Test suites
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

- [x] Project setup and architecture
- [ ] Backend API development
- [ ] Frontend interface
- [ ] Model integration (YOLOv8, SAM)
- [ ] Auto-labeling pipeline
- [ ] Dataset management
- [ ] Export/import functionality
- [ ] Advanced features (active learning, etc.)

## 📄 License

MIT License - see LICENSE file for details.