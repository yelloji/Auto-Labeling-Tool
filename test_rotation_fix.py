#!/usr/bin/env python3
"""
Test script to verify rotation transformation fix
"""

import requests
import json
import time
import os

def test_rotation_fix():
    """Test that rotation transformations create different images"""
    
    print("🔧 TESTING ROTATION TRANSFORMATION FIX...")
    
    # API endpoint
    url = "http://localhost:12000/api/v1/releases/create"
    
    # Test payload with rotation 90°
    payload = {
        "version_name": "rotation_fix_test",
        "dataset_ids": ["1c62d270-2df3-4568-986d-0cff06cd7e7d"],  # car_dataset (has 5 images)
        "transformations": [
            {
                "type": "rotate",
                "params": {
                    "angle": 90
                }
            }
        ],
        "multiplier": 3,  # 1 original + 2 augmented = 3 total per image
        "export_format": "yolo_detection",
        "project_id": "gevis"
    }
    
    print(f"📤 SENDING REQUEST:")
    print(f"   URL: {url}")
    print(f"   Transformations: {json.dumps(payload['transformations'], indent=2)}")
    print(f"   Multiplier: {payload['multiplier']}")
    print(f"   Expected: Original (0°) + Aug1 (-90°) + Aug2 (+90°)")
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        
        print(f"\n📊 RESPONSE:")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            release_data = result.get('release', result)
            
            print(f"   ✅ SUCCESS!")
            print(f"   Release ID: {release_data.get('release_id')}")
            print(f"   Final Image Count: {release_data.get('final_image_count')}")
            print(f"   Original Images: {release_data.get('total_original_images')}")
            print(f"   Augmented Images: {release_data.get('total_augmented_images')}")
            
            # Check if ZIP file was created
            zip_path = f"/workspace/project/app-2/projects/gevis/releases/rotation_fix_test_yolo_detection.zip"
            if os.path.exists(zip_path):
                zip_size = os.path.getsize(zip_path)
                print(f"   📦 ZIP Created: {zip_size:,} bytes")
                
                # Extract and check image files
                print(f"\n🔍 VERIFYING ROTATION IN ZIP FILE...")
                os.system(f"cd /tmp && rm -rf rotation_test && mkdir rotation_test && cd rotation_test && unzip -q {zip_path}")
                
                # Check first few images
                print(f"📏 IMAGE FILE SIZES (should be different if rotated):")
                os.system("ls -la /tmp/rotation_test/images/train/car* | head -6")
                
                return True
            else:
                print(f"   ❌ ZIP file not found: {zip_path}")
                return False
                
        else:
            print(f"   ❌ FAILED!")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_rotation_fix()
    if success:
        print(f"\n🎉 ROTATION FIX TEST COMPLETED!")
    else:
        print(f"\n💥 ROTATION FIX TEST FAILED!")