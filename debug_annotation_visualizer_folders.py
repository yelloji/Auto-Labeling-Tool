#!/usr/bin/env python3
"""
Annotation Visualization Debug Tool - Folder Version

This script reads images from one folder and annotations from another folder,
then visualizes the annotations overlaid on images to debug
coordinate transformation and loading issues.

Usage:
    python debug_annotation_visualizer_folders.py <image_folder> <label_folder> <output_folder>

The script will:
1. Read images from image folder
2. Read corresponding annotation files from label folder (matching by filename)
3. Draw bounding boxes and polygons on images
4. Save visualized images to output folder
"""

import json
import os
import sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import argparse


class FolderAnnotationVisualizer:
    def __init__(self, image_folder, label_folder, output_folder):
        self.image_folder = Path(image_folder)
        self.label_folder = Path(label_folder)
        self.output_folder = Path(output_folder)
        self.output_folder.mkdir(parents=True, exist_ok=True)
        
        # Color palette for different classes
        self.colors = [
            (255, 0, 0),    # Red
            (0, 255, 0),    # Green
            (0, 0, 255),    # Blue
            (255, 255, 0),  # Yellow
            (255, 0, 255),  # Magenta
            (0, 255, 255),  # Cyan
            (255, 128, 0),  # Orange
            (128, 0, 255),  # Purple
            (255, 192, 203), # Pink
            (128, 128, 128)  # Gray
        ]
    
    def get_color_for_class(self, class_id):
        """Get color for a specific class ID"""
        return self.colors[class_id % len(self.colors)]
    
    def load_annotation_file(self, annotation_path):
        """Load annotation from JSON file"""
        try:
            with open(annotation_path, 'r') as f:
                data = json.load(f)
            return data
        except Exception as e:
            print(f"Error loading {annotation_path}: {e}")
            return None
    
    def find_matching_annotation_file(self, image_filename):
        """Find matching annotation file for an image"""
        # Remove extension from image filename
        base_name = Path(image_filename).stem
        
        # Try different annotation file extensions
        possible_extensions = ['.json', '.txt']
        
        for ext in possible_extensions:
            annotation_path = self.label_folder / f"{base_name}{ext}"
            if annotation_path.exists():
                return annotation_path
        
        return None
    
    def parse_yolo_format(self, txt_path, image_width, image_height):
        """Parse YOLO format annotation file (supports both bbox and segmentation)"""
        annotations = []
        try:
            with open(txt_path, 'r') as f:
                lines = f.readlines()
            
            for line in lines:
                parts = line.strip().split()
                if len(parts) >= 5:
                    class_id = int(parts[0])
                    
                    if len(parts) == 5:
                        # YOLO bounding box format: class_id x_center y_center width height
                        x_center = float(parts[1])
                        y_center = float(parts[2])
                        width = float(parts[3])
                        height = float(parts[4])
                        
                        # Convert YOLO format to bbox format
                        x = x_center - width / 2
                        y = y_center - height / 2
                        
                        annotation = {
                            'class_id': class_id,
                            'class_name': f'Class_{class_id}',
                            'bbox': [x, y, width, height]
                        }
                        annotations.append(annotation)
                        
                    elif len(parts) > 5 and len(parts) % 2 == 1:
                        # YOLO segmentation format: class_id x1 y1 x2 y2 x3 y3 ...
                        polygon_points = []
                        for i in range(1, len(parts), 2):
                            if i + 1 < len(parts):
                                x = float(parts[i])
                                y = float(parts[i + 1])
                                polygon_points.extend([x, y])
                        
                        if len(polygon_points) >= 6:  # At least 3 points
                            annotation = {
                                'class_id': class_id,
                                'class_name': f'Class_{class_id}',
                                'polygon': polygon_points
                            }
                            annotations.append(annotation)
                            print(f"    Parsed segmentation with {len(polygon_points)//2} points")
                        else:
                            print(f"    Invalid segmentation format: not enough points")
                    
        except Exception as e:
            print(f"Error parsing YOLO file {txt_path}: {e}")
        
        return annotations
    
    def draw_bbox_annotation(self, image, annotation, image_width, image_height):
        """Draw bounding box annotation on image"""
        draw = ImageDraw.Draw(image)
        
        # Get bounding box coordinates
        bbox = annotation.get('bbox', [])
        if len(bbox) != 4:
            print(f"Invalid bbox format: {bbox}")
            return
        
        x, y, width, height = bbox
        class_id = annotation.get('class_id', 0)
        class_name = annotation.get('class_name', f'Class_{class_id}')
        
        # Convert normalized coordinates to pixel coordinates
        if x <= 1.0 and y <= 1.0 and width <= 1.0 and height <= 1.0:
            # Normalized coordinates
            x1 = int(x * image_width)
            y1 = int(y * image_height)
            x2 = int((x + width) * image_width)
            y2 = int((y + height) * image_height)
        else:
            # Pixel coordinates
            x1, y1 = int(x), int(y)
            x2, y2 = int(x + width), int(y + height)
        
        color = self.get_color_for_class(class_id)
        
        # Draw bounding box
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
        
        # Draw class label
        try:
            font = ImageFont.truetype("arial.ttf", 16)
        except:
            font = ImageFont.load_default()
        
        text = f"{class_name} ({class_id})"
        bbox_text = draw.textbbox((x1, y1-25), text, font=font)
        draw.rectangle(bbox_text, fill=color)
        draw.text((x1, y1-25), text, fill=(255, 255, 255), font=font)
        
        print(f"  Drew bbox: [{x1}, {y1}, {x2}, {y2}] for class '{class_name}'")
    
    def draw_polygon_annotation(self, image, annotation, image_width, image_height):
        """Draw polygon annotation on image"""
        draw = ImageDraw.Draw(image)
        
        # Get polygon points
        polygon = annotation.get('polygon')
        segmentation = annotation.get('segmentation')
        
        points = None
        if polygon:
            points = polygon
        elif segmentation:
            points = segmentation
        
        if not points or len(points) < 6:  # At least 3 points (x,y pairs)
            print(f"Invalid polygon format: {points}")
            return
        
        class_id = annotation.get('class_id', 0)
        class_name = annotation.get('class_name', f'Class_{class_id}')
        
        # Convert flat array to coordinate pairs
        if isinstance(points[0], (int, float)):  # Flat array format
            coord_pairs = [(points[i], points[i+1]) for i in range(0, len(points), 2)]
        else:  # Already in pairs format
            coord_pairs = points
        
        # Convert normalized coordinates to pixel coordinates
        pixel_coords = []
        for x, y in coord_pairs:
            if x <= 1.0 and y <= 1.0:
                # Normalized coordinates
                px = int(x * image_width)
                py = int(y * image_height)
            else:
                # Pixel coordinates
                px, py = int(x), int(y)
            pixel_coords.append((px, py))
        
        color = self.get_color_for_class(class_id)
        
        # Draw polygon outline
        draw.polygon(pixel_coords, outline=color, width=3)
        
        # Draw class label at centroid
        if pixel_coords:
            centroid_x = sum(p[0] for p in pixel_coords) // len(pixel_coords)
            centroid_y = sum(p[1] for p in pixel_coords) // len(pixel_coords)
            
            try:
                font = ImageFont.truetype("arial.ttf", 16)
            except:
                font = ImageFont.load_default()
            
            text = f"{class_name} ({class_id})"
            bbox_text = draw.textbbox((centroid_x, centroid_y), text, font=font)
            draw.rectangle(bbox_text, fill=color)
            draw.text((centroid_x, centroid_y), text, fill=(255, 255, 255), font=font)
        
        print(f"  Drew polygon with {len(pixel_coords)} points for class '{class_name}'")
    
    def process_images(self):
        """Process all images in the image folder"""
        if not self.image_folder.exists():
            print(f"Error: Image folder not found: {self.image_folder}")
            return
        
        if not self.label_folder.exists():
            print(f"Error: Label folder not found: {self.label_folder}")
            return
        
        print(f"Processing images from: {self.image_folder}")
        print(f"Looking for labels in: {self.label_folder}")
        print(f"Output folder: {self.output_folder}")
        
        # Get all image files
        image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}
        image_files = [f for f in self.image_folder.iterdir() 
                      if f.suffix.lower() in image_extensions]
        
        if not image_files:
            print("No image files found in the image folder.")
            return
        
        processed_count = 0
        
        for image_path in image_files:
            print(f"\nProcessing {image_path.name}:")
            
            # Find matching annotation file
            annotation_path = self.find_matching_annotation_file(image_path.name)
            
            if not annotation_path:
                print(f"  No annotation file found for {image_path.name}")
                continue
            
            print(f"  Found annotation: {annotation_path.name}")
            
            try:
                # Load image
                image = Image.open(image_path)
                image_width, image_height = image.size
                print(f"  Image size: {image_width}x{image_height}")
                
                # Convert to RGB if necessary
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Load annotations
                annotations = []
                
                if annotation_path.suffix.lower() == '.json':
                    # JSON format
                    annotation_data = self.load_annotation_file(annotation_path)
                    if annotation_data:
                        if isinstance(annotation_data, list):
                            annotations = annotation_data
                        elif isinstance(annotation_data, dict):
                            # Check if it's a single annotation or contains annotations
                            if 'annotations' in annotation_data:
                                annotations = annotation_data['annotations']
                            else:
                                annotations = [annotation_data]
                
                elif annotation_path.suffix.lower() == '.txt':
                    # YOLO format
                    annotations = self.parse_yolo_format(annotation_path, image_width, image_height)
                
                if not annotations:
                    print(f"  No valid annotations found in {annotation_path.name}")
                    continue
                
                print(f"  Found {len(annotations)} annotations")
                
                # Draw annotations
                for i, annotation in enumerate(annotations):
                    print(f"  Annotation {i+1}: {annotation}")
                    
                    if 'bbox' in annotation:
                        self.draw_bbox_annotation(image, annotation, image_width, image_height)
                    elif 'polygon' in annotation or 'segmentation' in annotation:
                        self.draw_polygon_annotation(image, annotation, image_width, image_height)
                    else:
                        print(f"    Unknown annotation type: {list(annotation.keys())}")
                
                # Save visualized image
                output_filename = f"visualized_{image_path.name}"
                output_path = self.output_folder / output_filename
                image.save(output_path)
                print(f"  Saved to: {output_path}")
                processed_count += 1
                
            except Exception as e:
                print(f"Error processing {image_path.name}: {e}")
        
        print(f"\nVisualization complete!")
        print(f"Processed {processed_count} images with annotations")
        print(f"Output saved to: {self.output_folder}")
    
    def run(self):
        """Main execution method"""
        self.process_images()


def main():
    parser = argparse.ArgumentParser(description='Visualize annotations from separate image and label folders')
    parser.add_argument('image_folder', help='Path to folder containing images')
    parser.add_argument('label_folder', help='Path to folder containing annotation files')
    parser.add_argument('output_folder', help='Output folder for visualized images')
    
    args = parser.parse_args()
    
    visualizer = FolderAnnotationVisualizer(args.image_folder, args.label_folder, args.output_folder)
    visualizer.run()


if __name__ == "__main__":
    main()