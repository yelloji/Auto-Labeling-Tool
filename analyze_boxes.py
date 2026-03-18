import sys
import os
from pathlib import Path
from PIL import Image

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from backend.database.database import SessionLocal
    from backend.database.models import ModelExperiment
except ImportError:
    print("Error: Could not import database modules.")
    sys.exit(1)

def analyze_last_experiment():
    db = SessionLocal()
    try:
        exp = db.query(ModelExperiment).order_by(ModelExperiment.created_at.desc()).first()
        if not exp or not exp.predictions:
            print("No experiments or predictions found.")
            return

        print(f"Analyzing Experiment: {exp.name} (ID: {exp.id})")
        
        # Get the first image and its predictions
        image_name, detections = next(iter(exp.predictions.items()))
        print(f"\nImage: {image_name}")
        
        # Try to find the actual image file to get dimensions
        # Expected path: experiments/experiment_name_TIMESTAMP/input_images/image_name
        # The output_folder in DB is relative like "projects/gevis/model/training/new_trainning/experiments/prediction/NAME_TIMESTAMP"
        abs_output_folder = Path(os.getcwd()) / exp.output_folder
        img_path = abs_output_folder / "input_images" / image_name
        
        if not img_path.exists():
            # Fallback check
            print(f"Image not found at {img_path}")
            return

        with Image.open(img_path) as img:
            w, h = img.size
            print(f"Actual Image Dimensions: {w}x{h}")

        if detections:
            bbox = detections[0]['bbox']
            print(f"First Prediction BBox (xyxy): {bbox}")
            
            # Check if coordinates are within bounds
            x1, y1, x2, y2 = bbox
            if x2 > w or y2 > h:
                print(f"WARNING: BBox [{x2}, {y2}] exceeds image dimensions [{w}, {h}]!")
            else:
                print("Coordinates are within image bounds.")
            
            # Check for common scaling patterns (e.g. 640)
            if max(x2, y2) <= 641:
                 print("NOTE: Max coordinate is near 640. Boxes might be in 640-scale instead of original pixel-scale.")

    finally:
        db.close()

if __name__ == "__main__":
    analyze_last_experiment()
