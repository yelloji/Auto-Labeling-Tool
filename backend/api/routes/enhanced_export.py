"""
Enhanced Export System - Core Formats Only
Supports 5 essential export formats: YOLO Detection, YOLO Segmentation, COCO, Pascal VOC, CSV
"""

import os
import json
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import zipfile
import tempfile
import shutil

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel

from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

router = APIRouter()

class ExportRequest(BaseModel):
    annotations: List[Dict[str, Any]]
    images: List[Dict[str, Any]]
    classes: List[Dict[str, Any]]
    format: str
    include_images: bool = True
    dataset_name: str = "dataset"
    export_settings: Optional[Dict[str, Any]] = None
    task_type: Optional[str] = "object_detection"  # object_detection, segmentation
    project_type: Optional[str] = "Object Detection"  # Object Detection, Image Classification, Instance Segmentation, etc.

class ExportFormats:
    """Core export format implementations"""
    
    @staticmethod
    def select_optimal_format(task_type: str, project_type: str, annotations: List[Dict], user_format: str = None) -> str:
        """
        Intelligently select the optimal export format based on:
        - Task type (object_detection, segmentation)
        - Project type (Object Detection, Image Classification, Instance Segmentation)
        - Available annotation types (bbox, polygon)
        - User preference
        """
        # If user explicitly chose a format, respect it
        if user_format and user_format != "auto":
            return user_format
        
        # Analyze available annotations
        has_polygons = any(ann.get('type') == 'polygon' and 'points' in ann for ann in annotations)
        has_bboxes = any(ann.get('type') == 'bbox' or 'bbox' in ann for ann in annotations)
        
        # Task type based selection
        if task_type == "segmentation":
            if has_polygons:
                return "yolo_segmentation"  # Best for polygon segmentation
            else:
                return "coco"  # COCO supports both detection and segmentation
        
        elif task_type == "object_detection":
            # Project type specific optimizations
            if project_type == "Object Detection":
                if has_bboxes and not has_polygons:
                    return "yolo_detection"  # Optimal for pure bbox detection
                else:
                    return "coco"  # Flexible format for mixed annotations
            elif project_type == "Image Classification":
                return "csv"  # Simple format for classification labels
            elif project_type == "Instance Segmentation":
                return "coco"  # Best format for instance segmentation
            else:
                # Default object detection
                return "yolo_detection"
        
        # Default fallback
        return "coco"  # Most comprehensive and widely supported
    
    @staticmethod
    def get_export_method(format_name: str):
        """Get the appropriate export method based on format name"""
        format_methods = {
            "coco": ExportFormats.export_coco,
            "yolo_detection": ExportFormats.export_yolo_detection,
            "yolo_segmentation": ExportFormats.export_yolo_segmentation,
            "pascal_voc": ExportFormats.export_pascal_voc,
            "csv": ExportFormats.export_csv
        }
        return format_methods.get(format_name.lower())
    
    @staticmethod
    def export_coco(data: ExportRequest) -> Dict[str, Any]:
        """Export to COCO JSON format"""
        coco_data = {
            "info": {
                "description": f"{data.dataset_name} - Auto-Labeling Tool Export",
                "version": "1.0",
                "year": datetime.now().year,
                "contributor": "Auto-Labeling Tool",
                "date_created": datetime.now().isoformat()
            },
            "licenses": [{
                "id": 1,
                "name": "Unknown",
                "url": ""
            }],
            "images": [],
            "annotations": [],
            "categories": []
        }
        
        # Add categories
        for idx, cls in enumerate(data.classes):
            coco_data["categories"].append({
                "id": idx + 1,
                "name": cls.get("name", f"class_{idx}"),
                "supercategory": cls.get("supercategory", "object")
            })
        
        # Add images
        for idx, img in enumerate(data.images):
            coco_data["images"].append({
                "id": idx + 1,
                "width": img.get("width", 640),
                "height": img.get("height", 480),
                "file_name": img.get("name", f"image_{idx}.jpg"),
                "license": 1,
                "flickr_url": "",
                "coco_url": "",
                "date_captured": datetime.now().isoformat()
            })
        
        # Add annotations
        annotation_id = 1
        for ann in data.annotations:
            image_id = ann.get("image_id", 1)
            category_id = ann.get("class_id", 1) + 1
            
            if ann.get("type") == "bbox":
                bbox = ann.get("bbox", {})
                x, y, w, h = bbox.get("x", 0), bbox.get("y", 0), bbox.get("width", 0), bbox.get("height", 0)
                area = w * h
                
                coco_data["annotations"].append({
                    "id": annotation_id,
                    "image_id": image_id,
                    "category_id": category_id,
                    "segmentation": [],
                    "area": area,
                    "bbox": [x, y, w, h],
                    "iscrowd": 0
                })
            elif ann.get("type") == "polygon":
                points = ann.get("points", [])
                segmentation = []
                for point in points:
                    segmentation.extend([point.get("x", 0), point.get("y", 0)])
                
                # Calculate bounding box from polygon
                x_coords = [p.get("x", 0) for p in points]
                y_coords = [p.get("y", 0) for p in points]
                x_min, x_max = min(x_coords), max(x_coords)
                y_min, y_max = min(y_coords), max(y_coords)
                
                coco_data["annotations"].append({
                    "id": annotation_id,
                    "image_id": image_id,
                    "category_id": category_id,
                    "segmentation": [segmentation],
                    "area": (x_max - x_min) * (y_max - y_min),
                    "bbox": [x_min, y_min, x_max - x_min, y_max - y_min],
                    "iscrowd": 0
                })
            
            annotation_id += 1
        
        return coco_data
    
    @staticmethod
    def export_yolo_detection(data: ExportRequest) -> Dict[str, str]:
        """Export to YOLO format for Object Detection"""
        files = {}
        
        # Create classes.txt
        class_names = [cls.get("name", f"class_{i}") for i, cls in enumerate(data.classes)]
        files["classes.txt"] = "\n".join(class_names)
        
        # Create data.yaml for YOLO training
        yaml_content = f"""# YOLO Dataset Configuration
# Generated by Auto-Labeling Tool

# Dataset paths
path: .  # dataset root dir
train: images/train  # train images (relative to 'path')
val: images/val      # val images (relative to 'path')
test: images/test    # test images (optional)

# Classes
nc: {len(data.classes)}  # number of classes
names: {class_names}  # class names
"""
        files["data.yaml"] = yaml_content
        
        # Create annotation files for each image
        for img_idx, img in enumerate(data.images):
            img_name = img.get("name", f"image_{img_idx}.jpg")
            txt_name = Path(img_name).stem + ".txt"
            
            img_width = img.get("width", 640)
            img_height = img.get("height", 480)
            
            annotations = []
            for ann in data.annotations:
                if ann.get("image_id", 0) == img_idx and ann.get("type") == "bbox":
                    bbox = ann.get("bbox", {})
                    x, y, w, h = bbox.get("x", 0), bbox.get("y", 0), bbox.get("width", 0), bbox.get("height", 0)
                    
                    # Convert to YOLO format (normalized center coordinates)
                    center_x = (x + w / 2) / img_width
                    center_y = (y + h / 2) / img_height
                    norm_width = w / img_width
                    norm_height = h / img_height
                    
                    class_id = ann.get("class_id", 0)
                    annotations.append(f"{class_id} {center_x:.6f} {center_y:.6f} {norm_width:.6f} {norm_height:.6f}")
            
            files[txt_name] = "\n".join(annotations)
        
        return files
    
    @staticmethod
    def export_yolo_segmentation(data: ExportRequest) -> Dict[str, str]:
        """Export to YOLO format for Segmentation"""
        files = {}
        
        # Create classes.txt
        class_names = [cls.get("name", f"class_{i}") for i, cls in enumerate(data.classes)]
        files["classes.txt"] = "\n".join(class_names)
        
        # Create data.yaml for YOLO segmentation training
        yaml_content = f"""# YOLO Segmentation Dataset Configuration
# Generated by Auto-Labeling Tool

# Dataset paths
path: .  # dataset root dir
train: images/train  # train images (relative to 'path')
val: images/val      # val images (relative to 'path')
test: images/test    # test images (optional)

# Classes
nc: {len(data.classes)}  # number of classes
names: {class_names}  # class names

# Task type
task: segment  # for segmentation
"""
        files["data.yaml"] = yaml_content
        
        # Create annotation files for each image
        for img_idx, img in enumerate(data.images):
            img_name = img.get("name", f"image_{img_idx}.jpg")
            txt_name = Path(img_name).stem + ".txt"
            
            img_width = img.get("width", 640)
            img_height = img.get("height", 480)
            
            annotations = []
            for ann in data.annotations:
                if ann.get("image_id", 0) == img_idx:
                    class_id = ann.get("class_id", 0)
                    
                    if ann.get("type") in ["polygon", "segmentation"] and (ann.get("points") or ann.get("segmentation")):
                        # YOLO segmentation format: class_id x1 y1 x2 y2 x3 y3 ...
                        points = ann.get("points") or ann.get("segmentation") or []
                        normalized_points = []
                        
                        for point in points:
                            # Normalize coordinates
                            norm_x = point.get("x", 0) / img_width
                            norm_y = point.get("y", 0) / img_height
                            normalized_points.extend([f"{norm_x:.6f}", f"{norm_y:.6f}"])
                        
                        if normalized_points:
                            annotation_line = f"{class_id} " + " ".join(normalized_points)
                            annotations.append(annotation_line)
                    
                    elif ann.get("type") == "bbox":
                        # Fallback to bounding box if no polygon available
                        bbox = ann.get("bbox", {})
                        x, y, w, h = bbox.get("x", 0), bbox.get("y", 0), bbox.get("width", 0), bbox.get("height", 0)
                        
                        # Convert bbox to polygon (4 corners)
                        corners = [
                            {"x": x, "y": y},
                            {"x": x + w, "y": y},
                            {"x": x + w, "y": y + h},
                            {"x": x, "y": y + h}
                        ]
                        
                        normalized_points = []
                        for corner in corners:
                            norm_x = corner["x"] / img_width
                            norm_y = corner["y"] / img_height
                            normalized_points.extend([f"{norm_x:.6f}", f"{norm_y:.6f}"])
                        
                        annotation_line = f"{class_id} " + " ".join(normalized_points)
                        annotations.append(annotation_line)
            
            files[txt_name] = "\n".join(annotations)
        
        return files
    
    @staticmethod
    def export_csv(data: ExportRequest) -> str:
        """Export to CSV format"""
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        header = [
            "image_id", "image_name", "image_width", "image_height",
            "annotation_id", "class_id", "class_name", "annotation_type",
            "bbox_x", "bbox_y", "bbox_width", "bbox_height",
            "polygon_points", "confidence"
        ]
        writer.writerow(header)
        
        # Write data rows
        annotation_id = 1
        for img_idx, img in enumerate(data.images):
            img_name = img.get("name", f"image_{img_idx}.jpg")
            img_width = img.get("width", 640)
            img_height = img.get("height", 480)
            
            # Find annotations for this image
            image_annotations = [ann for ann in data.annotations if ann.get("image_id", 0) == img_idx]
            
            if not image_annotations:
                # Write image row even if no annotations
                writer.writerow([
                    img_idx, img_name, img_width, img_height,
                    "", "", "", "", "", "", "", "", "", ""
                ])
            else:
                for ann in image_annotations:
                    class_id = ann.get("class_id", 0)
                    class_name = data.classes[class_id].get("name", f"class_{class_id}") if class_id < len(data.classes) else "unknown"
                    ann_type = ann.get("type", "unknown")
                    confidence = ann.get("confidence", 1.0)
                    
                    # Bounding box data
                    bbox_x = bbox_y = bbox_width = bbox_height = ""
                    if ann.get("type") == "bbox" and ann.get("bbox"):
                        bbox = ann.get("bbox", {})
                        bbox_x = bbox.get("x", 0)
                        bbox_y = bbox.get("y", 0)
                        bbox_width = bbox.get("width", 0)
                        bbox_height = bbox.get("height", 0)
                    
                    # Polygon data
                    polygon_points = ""
                    if ann.get("type") == "polygon" and ann.get("points"):
                        points = ann.get("points", [])
                        point_strings = [f"({p.get('x', 0)},{p.get('y', 0)})" for p in points]
                        polygon_points = ";".join(point_strings)
                    
                    writer.writerow([
                        img_idx, img_name, img_width, img_height,
                        annotation_id, class_id, class_name, ann_type,
                        bbox_x, bbox_y, bbox_width, bbox_height,
                        polygon_points, confidence
                    ])
                    
                    annotation_id += 1
        
        return output.getvalue()
    
    @staticmethod
    def export_pascal_voc(data: ExportRequest) -> Dict[str, str]:
        """Export to Pascal VOC XML format"""
        files = {}
        
        for img_idx, img in enumerate(data.images):
            img_name = img.get("name", f"image_{img_idx}.jpg")
            xml_name = Path(img_name).stem + ".xml"
            
            # Create XML structure
            annotation = ET.Element("annotation")
            
            # Add folder
            folder = ET.SubElement(annotation, "folder")
            folder.text = data.dataset_name
            
            # Add filename
            filename = ET.SubElement(annotation, "filename")
            filename.text = img_name
            
            # Add path
            path = ET.SubElement(annotation, "path")
            path.text = f"./{img_name}"
            
            # Add source
            source = ET.SubElement(annotation, "source")
            database = ET.SubElement(source, "database")
            database.text = "Auto-Labeling Tool"
            
            # Add size
            size = ET.SubElement(annotation, "size")
            width = ET.SubElement(size, "width")
            width.text = str(img.get("width", 640))
            height = ET.SubElement(size, "height")
            height.text = str(img.get("height", 480))
            depth = ET.SubElement(size, "depth")
            depth.text = "3"
            
            # Add segmented
            segmented = ET.SubElement(annotation, "segmented")
            segmented.text = "0"
            
            # Add objects
            for ann in data.annotations:
                if ann.get("image_id", 0) == img_idx and ann.get("type") == "bbox":
                    obj = ET.SubElement(annotation, "object")
                    
                    name = ET.SubElement(obj, "name")
                    class_id = ann.get("class_id", 0)
                    class_name = data.classes[class_id].get("name", f"class_{class_id}") if class_id < len(data.classes) else "unknown"
                    name.text = class_name
                    
                    pose = ET.SubElement(obj, "pose")
                    pose.text = "Unspecified"
                    
                    truncated = ET.SubElement(obj, "truncated")
                    truncated.text = "0"
                    
                    difficult = ET.SubElement(obj, "difficult")
                    difficult.text = "0"
                    
                    bbox = ann.get("bbox", {})
                    bndbox = ET.SubElement(obj, "bndbox")
                    
                    xmin = ET.SubElement(bndbox, "xmin")
                    xmin.text = str(int(bbox.get("x", 0)))
                    
                    ymin = ET.SubElement(bndbox, "ymin")
                    ymin.text = str(int(bbox.get("y", 0)))
                    
                    xmax = ET.SubElement(bndbox, "xmax")
                    xmax.text = str(int(bbox.get("x", 0) + bbox.get("width", 0)))
                    
                    ymax = ET.SubElement(bndbox, "ymax")
                    ymax.text = str(int(bbox.get("y", 0) + bbox.get("height", 0)))
            
            # Convert to string
            ET.indent(annotation, space="  ")
            xml_str = ET.tostring(annotation, encoding="unicode")
            files[xml_name] = f'<?xml version="1.0"?>\n{xml_str}'
        
        return files

@router.post("/export")
async def export_annotations(request: ExportRequest):
    """Export annotations in specified format with intelligent format selection"""
    logger.info("app.backend", f"Starting export operation", "export_operation_start", {
        "dataset_name": request.dataset_name,
        "format": request.format,
        "task_type": request.task_type,
        "project_type": request.project_type,
        "annotation_count": len(request.annotations),
        "image_count": len(request.images),
        "class_count": len(request.classes),
        "include_images": request.include_images,
        "endpoint": "/export"
    })
    
    try:
        # Intelligently select optimal format based on task type and project type
        logger.debug("operations.exports", f"Selecting optimal export format", "format_selection", {
            "task_type": request.task_type or "object_detection",
            "project_type": request.project_type or "general",
            "annotation_count": len(request.annotations),
            "user_format": request.format
        })
        
        optimal_format = ExportFormats.select_optimal_format(
            task_type=request.task_type or "object_detection",
            project_type=request.project_type or "general", 
            annotations=request.annotations,
            user_format=request.format if request.format != "auto" else None
        )
        
        # Get the appropriate export method
        logger.debug("operations.exports", f"Getting export method for format {optimal_format}", "export_method_selection", {
            "optimal_format": optimal_format,
            "supported_formats": ["coco", "yolo_detection", "yolo_segmentation", "pascal_voc", "csv"]
        })
        
        export_method = ExportFormats.get_export_method(optimal_format)
        if not export_method:
            logger.warning("errors.validation", f"Unsupported export format requested", "unsupported_format", {
                "requested_format": optimal_format,
                "supported_formats": ["coco", "yolo_detection", "yolo_segmentation", "pascal_voc", "csv"]
            })
            raise HTTPException(status_code=400, detail=f"Unsupported format: {optimal_format}")
        
        # Execute the export
        logger.info("operations.exports", f"Executing export in {optimal_format} format", "export_execution", {
            "format": optimal_format,
            "dataset_name": request.dataset_name,
            "annotation_count": len(request.annotations)
        })
        
        if optimal_format == "coco":
            data = export_method(request)
            return {
                "success": True,
                "format": optimal_format,
                "selected_reason": f"Optimal for {request.task_type} + {request.project_type}",
                "data": data,
                "filename": f"{request.dataset_name}_coco.json"
            }
        
        elif optimal_format in ["yolo_detection", "yolo_segmentation"]:
            files = export_method(request)
            return {
                "success": True,
                "format": optimal_format,
                "selected_reason": f"Optimal for {request.task_type} + {request.project_type}",
                "files": files,
                "filename": f"{request.dataset_name}_{optimal_format}.zip"
            }
        
        elif optimal_format == "csv":
            data = export_method(request)
            return {
                "success": True,
                "format": optimal_format,
                "selected_reason": f"Optimal for {request.task_type} + {request.project_type}",
                "data": data,
                "filename": f"{request.dataset_name}.csv"
            }
        
        elif optimal_format == "pascal_voc":
            files = export_method(request)
            return {
                "success": True,
                "format": optimal_format,
                "selected_reason": f"Optimal for {request.task_type} + {request.project_type}",
                "files": files,
                "filename": f"{request.dataset_name}_pascal_voc.zip"
            }
        
        else:
            logger.warning("errors.validation", f"Unsupported format encountered during execution", "unsupported_format_execution", {
                "format": optimal_format,
                "dataset_name": request.dataset_name
            })
            raise HTTPException(status_code=400, detail=f"Unsupported format: {optimal_format}")
        
        # Log successful export completion
        logger.info("operations.exports", f"Export completed successfully", "export_success", {
            "format": optimal_format,
            "dataset_name": request.dataset_name,
            "annotation_count": len(request.annotations),
            "image_count": len(request.images),
            "class_count": len(request.classes)
        })
    
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Export operation failed", "export_failure", {
            "dataset_name": request.dataset_name,
            "format": request.format,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@router.post("/export/download")
async def download_export(request: ExportRequest):
    """Export and download as ZIP file"""
    logger.info("app.backend", f"Starting export download operation", "export_download_start", {
        "dataset_name": request.dataset_name,
        "format": request.format,
        "task_type": request.task_type,
        "project_type": request.project_type,
        "annotation_count": len(request.annotations),
        "image_count": len(request.images),
        "class_count": len(request.classes),
        "include_images": request.include_images,
        "endpoint": "/export/download"
    })
    
    try:
        format_name = request.format.lower()
        logger.debug("operations.exports", f"Processing download for format {format_name}", "download_format_processing", {
            "format": format_name,
            "dataset_name": request.dataset_name
        })
        
        if format_name == "coco":
            data = ExportFormats.export_coco(request)
            
            temp_file = tempfile.NamedTemporaryFile(
                mode='w', 
                suffix='.json', 
                delete=False,
                prefix=f"{request.dataset_name}_coco_"
            )
            
            try:
                json.dump(data, temp_file, indent=2)
                temp_file.close()
                
                return FileResponse(
                    temp_file.name,
                    media_type='application/json',
                    filename=f"{request.dataset_name}_coco.json"
                )
            except Exception as e:
                if os.path.exists(temp_file.name):
                    os.unlink(temp_file.name)
                raise e
        
        elif format_name in ["yolo", "yolo_detection", "yolo_segmentation", "pascal_voc"]:
            if format_name in ["yolo", "yolo_detection"]:
                files = ExportFormats.export_yolo_detection(request)
            elif format_name == "yolo_segmentation":
                files = ExportFormats.export_yolo_segmentation(request)
            else:  # pascal_voc
                files = ExportFormats.export_pascal_voc(request)
            
            temp_file = tempfile.NamedTemporaryFile(
                suffix='.zip', 
                delete=False,
                prefix=f"{request.dataset_name}_{format_name}_"
            )
            temp_file.close()
            
            try:
                with zipfile.ZipFile(temp_file.name, 'w') as zipf:
                    for filename, content in files.items():
                        zipf.writestr(filename, content)
                
                return FileResponse(
                    temp_file.name,
                    media_type='application/zip',
                    filename=f"{request.dataset_name}_{format_name}.zip"
                )
            except Exception as e:
                if os.path.exists(temp_file.name):
                    os.unlink(temp_file.name)
                raise e
        
        elif format_name == "csv":
            data = ExportFormats.export_csv(request)
            
            temp_file = tempfile.NamedTemporaryFile(
                mode='w', 
                suffix='.csv', 
                delete=False,
                prefix=f"{request.dataset_name}_csv_"
            )
            
            try:
                temp_file.write(data)
                temp_file.close()
                
                return FileResponse(
                    temp_file.name,
                    media_type='text/csv',
                    filename=f"{request.dataset_name}.csv"
                )
            except Exception as e:
                if os.path.exists(temp_file.name):
                    os.unlink(temp_file.name)
                raise e
        
        else:
            logger.warning("errors.validation", f"Unsupported export format for download", "unsupported_download_format", {
                "requested_format": format_name,
                "supported_formats": ["coco", "yolo_detection", "yolo_segmentation", "pascal_voc", "csv"],
                "dataset_name": request.dataset_name
            })
            raise HTTPException(status_code=400, detail=f"Unsupported export format: {format_name}")
        
        # Log successful download completion
        logger.info("operations.exports", f"Export download completed successfully", "export_download_success", {
            "format": format_name,
            "dataset_name": request.dataset_name,
            "annotation_count": len(request.annotations)
        })
    
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Export download operation failed", "export_download_failure", {
            "dataset_name": request.dataset_name,
            "format": request.format,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@router.get("/formats")
async def get_export_formats():
    """Get all supported export formats"""
    logger.info("app.backend", f"Retrieving supported export formats", "formats_retrieval", {
        "endpoint": "/formats",
        "total_formats": 5
    })
    
    try:
        formats_data = {
        "formats": [
            {
                "name": "COCO",
                "value": "coco",
                "description": "COCO JSON format - Industry standard for object detection",
                "file_type": "json",
                "supports": ["bounding_boxes", "polygons", "segmentation"],
                "use_cases": ["Object Detection", "Instance Segmentation"],
                "status": "✅ Complete"
            },
            {
                "name": "YOLO (Detection)",
                "value": "yolo_detection",
                "description": "YOLO format optimized for object detection with data.yaml",
                "file_type": "txt + yaml",
                "supports": ["bounding_boxes"],
                "use_cases": ["YOLOv5/v8 Object Detection Training"],
                "status": "✅ Complete"
            },
            {
                "name": "YOLO (Segmentation)",
                "value": "yolo_segmentation",
                "description": "YOLO format for instance segmentation with polygon coordinates",
                "file_type": "txt + yaml",
                "supports": ["polygons", "bounding_boxes"],
                "use_cases": ["YOLOv5/v8 Segmentation Training"],
                "status": "✅ Complete"
            },
            {
                "name": "Pascal VOC",
                "value": "pascal_voc",
                "description": "Pascal VOC XML format - Classic computer vision format",
                "file_type": "xml",
                "supports": ["bounding_boxes"],
                "use_cases": ["Object Detection", "Academic Research"],
                "status": "✅ Complete"
            },
            {
                "name": "CSV Export",
                "value": "csv",
                "description": "Comma-separated values format for data analysis",
                "file_type": "csv",
                "supports": ["bounding_boxes", "polygons", "metadata"],
                "use_cases": ["Data Analysis", "Excel Import", "Custom Processing"],
                "status": "✅ Complete"
            }
        ],
        "total_formats": 5,
        "task_completion": {
            "detection": {
                "yolo": "✅ Complete",
                "coco": "✅ Complete", 
                "pascal_voc": "✅ Complete",
                "csv": "✅ Complete"
            },
            "segmentation": {
                "yolo": "✅ Complete",
                "coco": "✅ Complete"
            }
        },
        "comparison": {
            "roboflow_formats": 5,
            "our_formats": 5,
            "advantage": "Focused on essential formats with better implementation"
        }
        }
        
        logger.info("operations.exports", f"Export formats retrieved successfully", "formats_retrieval_success", {
            "total_formats": 5,
            "supported_task_types": ["detection", "segmentation"]
        })
        
        return formats_data
        
    except Exception as e:
        logger.error("errors.system", f"Failed to retrieve export formats", "formats_retrieval_failure", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to retrieve export formats: {str(e)}")
