#!/usr/bin/env python3
"""
Test proper data augmentation rotation - same dimensions with white background
"""

import requests
import json
import zipfile
import tempfile
import os
from PIL import Image

def test_proper_rotation():
    print("🔧 TESTING PROPER DATA AUGMENTATION ROTATION...")
    print("   Expected: Same dimensions (300×168) with white background fill")
    
    # API endpoint
    url = "http://localhost:12000/api/v1/releases/create"
    
    # Test payload with rotation 90°
    payload = {
        "version_name": "proper_rotation_test",
        "dataset_ids": ["1c62d270-2df3-4568-986d-0cff06cd7e7d"],  # car_dataset (has 5 images)
        "transformations": [
            {
                "type": "rotate",
                "params": {
                    "angle": 90
                }
            }
        ],
        "multiplier": 3,
        "export_format": "yolo_detection",
        "project_id": "gevis"
    }
    
    print(f"📤 SENDING REQUEST:")
    print(f"   URL: {url}")
    print(f"   Transformations: {json.dumps(payload['transformations'], indent=2)}")
    print(f"   Multiplier: {payload['multiplier']}")
    print(f"   Expected: Original (300×168) + Aug1 (300×168) + Aug2 (300×168)")
    print()
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"📊 RESPONSE:")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ SUCCESS!")
            print(f"   Release ID: {data.get('release', {}).get('id', 'None')}")
            print(f"   Final Image Count: {data.get('release', {}).get('final_image_count', 0)}")
            print(f"   Original Images: {data.get('release', {}).get('total_original_images', 0)}")
            print(f"   Augmented Images: {data.get('release', {}).get('total_augmented_images', 0)}")
            print(f"   📦 ZIP Created: {data.get('release', {}).get('zip_size', 0):,} bytes")
            
            # Download and verify the ZIP
            release_id = data.get('release', {}).get('id')
            if release_id:
                verify_rotation_dimensions(release_id)
            
        else:
            print(f"   ❌ FAILED!")
            print(f"   Error: {response.text}")
            
    except Exception as e:
        print(f"   💥 EXCEPTION: {str(e)}")
    
    print(f"\n🎉 PROPER ROTATION TEST COMPLETED!")

def verify_rotation_dimensions(release_id):
    """Verify that rotated images maintain same dimensions"""
    print(f"\n🔍 VERIFYING ROTATION DIMENSIONS...")
    
    # Download ZIP
    download_url = f"http://localhost:12000/api/v1/releases/{release_id}/download"
    response = requests.get(download_url)
    
    if response.status_code != 200:
        print(f"   ❌ Failed to download ZIP")
        return
    
    # Extract ZIP to temp directory
    with tempfile.TemporaryDirectory() as temp_dir:
        zip_path = os.path.join(temp_dir, "test.zip")
        with open(zip_path, "wb") as f:
            f.write(response.content)
        
        # Extract ZIP
        extract_dir = os.path.join(temp_dir, "extracted")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # Find image files
        images_dir = os.path.join(extract_dir, "images", "train")
        if not os.path.exists(images_dir):
            print(f"   ❌ Images directory not found")
            return
        
        # Check dimensions of original and augmented images
        image_files = [f for f in os.listdir(images_dir) if f.endswith('.jpg')]
        image_files.sort()
        
        print(f"📐 IMAGE DIMENSIONS (should ALL be same for proper data augmentation):")
        
        dimensions_set = set()
        for img_file in image_files[:3]:  # Check first 3 images
            img_path = os.path.join(images_dir, img_file)
            with Image.open(img_path) as img:
                dimensions = img.size
                dimensions_set.add(dimensions)
                print(f"   {img_file}: {dimensions[0]}×{dimensions[1]} pixels")
        
        # Verify all images have same dimensions
        if len(dimensions_set) == 1:
            print(f"   ✅ ALL IMAGES HAVE SAME DIMENSIONS - PROPER DATA AUGMENTATION!")
        else:
            print(f"   ❌ IMAGES HAVE DIFFERENT DIMENSIONS - INCORRECT FOR ML TRAINING!")
            print(f"   Found dimensions: {dimensions_set}")

if __name__ == "__main__":
    test_proper_rotation()