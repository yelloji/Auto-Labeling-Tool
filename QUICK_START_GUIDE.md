# 🚀 Quick Start Guide - Auto-Labeling Tool

## 📋 5-Minute Setup

### 1. Access the Application
- Open browser and go to: `http://localhost:12001`
- Backend runs on: `http://localhost:12000`

### 2. Create Your First Project
1. Click **"Projects"** in navigation
2. Click **"Create Project"** button
3. Enter project name and description
4. Click **"Create"**

### 3. Upload Images
1. Enter your project workspace
2. In **Management** tab, go to **Unassigned** column
3. **Drag & drop** images or click **"Upload"**
4. Wait for upload to complete

### 4. Create Dataset
1. Select uploaded images in **Unassigned** column
2. Click **"Create Dataset"**
3. Enter meaningful dataset name (e.g., "car_images_batch1")
4. Click **"Create"**

### 5. Start Annotation
1. **Drag** dataset from **Unassigned** to **Annotating** column
2. Click **"Annotate"** button on the dataset
3. Use annotation tools to label images:
   - Select tool (Bounding Box, Polygon, etc.)
   - Choose label from right sidebar
   - Draw on image
   - Save and move to next image

### 6. Complete Dataset
1. Label **ALL** images in the dataset
2. Return to **Management** tab
3. **Drag** dataset from **Annotating** to **Dataset** column
   - ⚠️ **Important**: Only fully labeled datasets can be moved here

### 7. Export or Train
1. Go to **Dataset** tab
2. Select your completed dataset
3. Choose export format (YOLO, COCO, etc.) OR start training

---

## ⚡ Essential Shortcuts

### Navigation
- **Projects Page**: View all projects
- **Project Workspace**: Main working area
- **Management Tab**: Dataset workflow
- **Annotation Interface**: Label images

### Annotation Tools
- **Bounding Box**: Rectangle selection
- **Polygon**: Freeform shapes
- **Smart Polygon**: AI-assisted drawing
- **Zoom**: Mouse wheel or controls
- **Pan**: Click and drag

### Workflow States
- **Unassigned**: Uploaded, not organized
- **Annotating**: Being labeled
- **Dataset**: Completed, ready for use

---

## ✅ Validation Rules

### Dataset Creation
- ✅ Must provide meaningful name
- ❌ No auto-generated names allowed

### Moving to Dataset Column
- ✅ **ALL images must be labeled**
- ❌ Cannot move partially labeled datasets

### File Uploads
- ✅ Supported: JPG, PNG, JPEG
- ✅ Batch upload supported
- ⚠️ Recommended: < 100 images per batch

---

## 🔧 Common Issues & Solutions

### Images Not Loading
**Solution**: Images auto-fix when accessed (no action needed)

### Cannot Move Dataset
**Problem**: "Cannot move to dataset: X images still need labeling"
**Solution**: Complete labeling ALL images in the dataset

### Upload Stuck
**Solutions**:
- Check file formats (JPG/PNG only)
- Try smaller batches
- Refresh page and retry

### Annotation Not Saving
**Solutions**:
- Check network connection
- Refresh page
- Try again

---

## 📱 Best Practices

### Project Organization
- Use descriptive project names
- Group related images together
- Create datasets with clear purposes

### Annotation Workflow
- Label similar images in batches
- Use consistent labeling standards
- Review annotations before completing

### Performance Tips
- Upload in smaller batches (< 100 images)
- Use desktop/laptop for annotation
- Close unnecessary browser tabs

---

## 🎯 Typical Workflow

```
1. Create Project
   ↓
2. Upload Images → Unassigned
   ↓
3. Create Dataset → Group images
   ↓
4. Move to Annotating → Start labeling
   ↓
5. Annotate ALL Images → Complete labeling
   ↓
6. Move to Dataset → Finalize
   ↓
7. Export or Train → Use dataset
```

---

## 📞 Need Help?

1. **Check UI Documentation**: Complete guide available
2. **Look for Error Messages**: Usually self-explanatory
3. **Try Refresh**: Solves many temporary issues
4. **Check Browser Console**: For technical errors

---

*For complete documentation, see UI_DOCUMENTATION.md*