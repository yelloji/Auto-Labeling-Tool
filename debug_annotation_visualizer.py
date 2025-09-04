#!/usr/bin/env python3
"""
Annotation Visualization Debug Tool

This script extracts ZIP files containing images and annotations,
then visualizes the annotations overlaid on images to debug
coordinate transformation and loading issues.

Usage:
    python debug_annotation_visualizer.py <zip_file_path> <output_folder>

The script will:
1. Extract the ZIP file
2. Read annotations.json from metadata folder
3. Draw bounding boxes and polygons on images
4. Save visualized images to output folder
"""

import json
import zipfile
import os
import sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import argparse


class AnnotationVisualizer:
    def __init__(self, zip_path, output_folder):
        self.zip_path = Path(zip_path)
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
    
    def extract_zip(self):
        """Extract ZIP file to temporary directory"""
        extract_path = self.output_folder / "extracted"
        extract_path.mkdir(exist_ok=True)
        
        print(f"Extracting {self.zip_path} to {extract_path}")
        with zipfile.ZipFile(self.zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_path)
        
        return extract_path
    
    def load_annotations(self, extract_path):
        """Load annotations from metadata/annotations.json"""
        annotations_path = extract_path / "metadata" / "annotations.json"
        
        if not annotations_path.exists():
            print(f"Warning: annotations.json not found at {annotations_path}")
            return {}
        
        print(f"Loading annotations from {annotations_path}")
        with open(annotations_path, 'r') as f:
            annotations = json.load(f)
        
        print(f"Loaded annotations for {len(annotations)} images")
        return annotations
    
    def get_color_for_class(self, class_id):
        """Get color for a specific class ID"""
        return self.colors[class_id % len(self.colors)]
    
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
    
    def visualize_annotations(self, extract_path, annotations):
        """Visualize annotations on images"""
        images_folder = extract_path / "images"
        
        if not images_folder.exists():
            print(f"Warning: Images folder not found at {images_folder}")
            return
        
        print(f"\nProcessing images from {images_folder}")
        
        for image_filename, image_annotations in annotations.items():
            image_path = images_folder / image_filename
            
            if not image_path.exists():
                print(f"Warning: Image {image_filename} not found")
                continue
            
            print(f"\nProcessing {image_filename}:")
            
            # Load image
            try:
                image = Image.open(image_path)
                image_width, image_height = image.size
                print(f"  Image size: {image_width}x{image_height}")
                
                # Convert to RGB if necessary
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Draw annotations
                for i, annotation in enumerate(image_annotations):
                    print(f"  Annotation {i+1}: {annotation}")
                    
                    if 'bbox' in annotation:
                        self.draw_bbox_annotation(image, annotation, image_width, image_height)
                    elif 'polygon' in annotation or 'segmentation' in annotation:
                        self.draw_polygon_annotation(image, annotation, image_width, image_height)
                    else:
                        print(f"    Unknown annotation type: {list(annotation.keys())}")
                
                # Save visualized image
                output_path = self.output_folder / f"visualized_{image_filename}"
                image.save(output_path)
                print(f"  Saved to: {output_path}")
                
            except Exception as e:
                print(f"Error processing {image_filename}: {e}")
    
    def run(self):
        """Main execution method"""
        print(f"Starting annotation visualization for {self.zip_path}")
        print(f"Output folder: {self.output_folder}")
        
        # Extract ZIP file
        extract_path = self.extract_zip()
        
        # Load annotations
        annotations = self.load_annotations(extract_path)
        
        if not annotations:
            print("No annotations found. Exiting.")
            return
        
        # Visualize annotations
        self.visualize_annotations(extract_path, annotations)
        
        print(f"\nVisualization complete! Check output folder: {self.output_folder}")
        print("\nSummary:")
        print(f"- Processed {len(annotations)} annotated images")
        print(f"- Output saved to: {self.output_folder}")


def main():
    parser = argparse.ArgumentParser(description='Visualize annotations from ZIP release files')
    parser.add_argument('zip_file', help='Path to the ZIP file containing images and annotations')
    parser.add_argument('output_folder', help='Output folder for visualized images')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.zip_file):
        print(f"Error: ZIP file not found: {args.zip_file}")
        sys.exit(1)
    
    visualizer = AnnotationVisualizer(args.zip_file, args.output_folder)
    visualizer.run()


if __name__ == "__main__":
    main()