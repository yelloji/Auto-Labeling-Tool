# 🎯 **TASK TYPES REFERENCE DOCUMENT**

## 📋 **SUPPORTED TASK TYPES**

This document defines all supported task types for the transformation and release system.

---

## 🏷️ **COMPUTER VISION TASK TYPES**

### **1. Object Detection** 📦
- **task_type**: `"object_detection"`
- **Description**: Detect and locate objects with bounding boxes
- **Export Formats**: YOLO, COCO, Pascal VOC, CSV
- **Use Cases**: Car detection, person detection, product recognition
- **Annotation Type**: Bounding boxes with class labels

### **2. Image Classification** 🏷️
- **task_type**: `"image_classification"`
- **Description**: Classify entire images into categories
- **Export Formats**: ImageNet, Custom folder structure, CSV
- **Use Cases**: Animal classification, medical diagnosis, quality control
- **Annotation Type**: Single label per image

### **3. Instance Segmentation** 🎭
- **task_type**: `"instance_segmentation"`
- **Description**: Detect objects and create pixel-level masks
- **Export Formats**: COCO, Mask R-CNN, Custom JSON
- **Use Cases**: Medical imaging, autonomous driving, precision agriculture
- **Annotation Type**: Polygon masks with instance IDs

### **4. Semantic Segmentation** 🎨
- **task_type**: `"semantic_segmentation"`
- **Description**: Classify every pixel in the image
- **Export Formats**: PNG masks, Cityscapes, ADE20K
- **Use Cases**: Scene understanding, medical imaging, satellite imagery
- **Annotation Type**: Pixel-level class maps

### **5. Keypoint Detection** 🔗
- **task_type**: `"keypoint_detection"`
- **Description**: Detect specific points of interest
- **Export Formats**: COCO Keypoints, Custom JSON, OpenPose
- **Use Cases**: Pose estimation, facial landmarks, hand tracking
- **Annotation Type**: X,Y coordinates with visibility flags

### **6. Multi-Label Classification** 🏷️🏷️
- **task_type**: `"multi_label_classification"`
- **Description**: Assign multiple labels to single images
- **Export Formats**: CSV, JSON, Multi-hot encoding
- **Use Cases**: Image tagging, content moderation, medical conditions
- **Annotation Type**: Multiple binary labels per image

---

## 🔧 **SPECIALIZED TASK TYPES**

### **7. Anomaly Detection** ⚠️
- **task_type**: `"anomaly_detection"`
- **Description**: Identify unusual or defective items
- **Export Formats**: Binary classification, Anomaly scores
- **Use Cases**: Quality control, fraud detection, medical screening
- **Annotation Type**: Normal/Anomaly binary labels

### **8. OCR (Text Recognition)** 📝
- **task_type**: `"ocr"`
- **Description**: Extract and recognize text from images
- **Export Formats**: JSON with bounding boxes and text, CSV
- **Use Cases**: Document processing, license plate reading, sign recognition
- **Annotation Type**: Text bounding boxes with transcriptions

### **9. Face Recognition** 👤
- **task_type**: `"face_recognition"`
- **Description**: Identify and verify faces
- **Export Formats**: Face embeddings, Identity labels, Bounding boxes
- **Use Cases**: Security systems, photo organization, access control
- **Annotation Type**: Face bounding boxes with identity labels

### **10. Custom Task** 🛠️
- **task_type**: `"custom"`
- **Description**: User-defined task type
- **Export Formats**: User-specified format
- **Use Cases**: Research projects, specialized applications
- **Annotation Type**: User-defined annotation schema

---

## 📊 **TASK TYPE CONFIGURATION**

### **Database Storage Format**:
```json
{
  "task_type": "object_detection",
  "export_format": "YOLO",
  "classes": ["car", "person", "bicycle"],
  "image_size": [640, 640],
  "train_split": 0.7,
  "val_split": 0.2,
  "test_split": 0.1
}
```

### **UI Display Format**:
```javascript
const TASK_TYPES = [
  {
    value: "object_detection",
    label: "Object Detection",
    icon: "📦",
    description: "Detect and locate objects with bounding boxes",
    formats: ["YOLO", "COCO", "Pascal VOC", "CSV"]
  },
  {
    value: "image_classification", 
    label: "Image Classification",
    icon: "🏷️",
    description: "Classify entire images into categories",
    formats: ["ImageNet", "Folder Structure", "CSV"]
  },
  // ... more task types
];
```

---

## 🎯 **EXPORT FORMAT MAPPING**

### **Object Detection**:
- **YOLO**: `.txt` files with normalized coordinates
- **COCO**: JSON with absolute coordinates and metadata
- **Pascal VOC**: XML files with image metadata
- **CSV**: Tabular format with image_path, class, bbox coordinates

### **Image Classification**:
- **ImageNet**: Folder structure with class subdirectories
- **CSV**: image_path, class_label columns
- **JSON**: Structured metadata with class mappings

### **Instance Segmentation**:
- **COCO**: JSON with polygon coordinates and masks
- **Mask R-CNN**: Binary masks with instance IDs
- **Custom JSON**: Application-specific polygon format

---

## 🔄 **TRANSFORMATION COMPATIBILITY**

### **All Task Types Support**:
- ✅ **Basic Transformations**: resize, rotate, flip, crop, brightness, contrast, blur, noise
- ✅ **Color Transformations**: color jitter, grayscale, gamma correction
- ✅ **Geometric Transformations**: affine, perspective warp, shear

### **Task-Specific Considerations**:
- **Object Detection**: Bounding boxes must be transformed with images
- **Segmentation**: Masks must be transformed identically to images  
- **Keypoints**: Point coordinates must be transformed with images
- **Classification**: Only image transformations needed (no annotation changes)

---

## 🚀 **IMPLEMENTATION NOTES**

### **Backend Validation**:
```python
VALID_TASK_TYPES = [
    "object_detection",
    "image_classification", 
    "instance_segmentation",
    "semantic_segmentation",
    "keypoint_detection",
    "multi_label_classification",
    "anomaly_detection",
    "ocr",
    "face_recognition",
    "custom"
]

def validate_task_type(task_type: str) -> bool:
    return task_type in VALID_TASK_TYPES
```

### **Frontend Selection**:
```javascript
// Task type selector component
const TaskTypeSelector = ({ value, onChange }) => {
  return (
    <Select value={value} onChange={onChange}>
      {TASK_TYPES.map(task => (
        <Option key={task.value} value={task.value}>
          {task.icon} {task.label}
        </Option>
      ))}
    </Select>
  );
};
```

---

## 📈 **FUTURE EXTENSIONS**

### **Planned Task Types**:
- **Video Object Tracking**: Multi-frame object detection
- **3D Object Detection**: Point cloud and depth-based detection
- **Audio Classification**: Sound and speech recognition
- **Time Series Analysis**: Sequential data classification

### **Advanced Features**:
- **Multi-Task Learning**: Combine multiple task types
- **Active Learning**: Intelligent sample selection per task type
- **Transfer Learning**: Pre-trained model integration per task type

---

*This reference document ensures consistent task type handling across the entire transformation and release system.* 🎯