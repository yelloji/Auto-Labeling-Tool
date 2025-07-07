#!/usr/bin/env python3
"""
Script to remove the grayscale transformation with the wrong release version
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from database.database import get_db
from database.models import ImageTransformation

def remove_grayscale_transformation():
    """Remove the grayscale transformation with ID: 0182467d-157f-4fea-8296-876333f8e321"""
    
    # Get database session
    db = next(get_db())
    
    try:
        # Find the specific grayscale transformation
        grayscale_id = "0182467d-157f-4fea-8296-876333f8e321"
        
        transformation = db.query(ImageTransformation).filter(
            ImageTransformation.id == grayscale_id
        ).first()
        
        if transformation:
            print(f"Found transformation:")
            print(f"  ID: {transformation.id}")
            print(f"  Type: {transformation.transformation_type}")
            print(f"  Release Version: {transformation.release_version}")
            print(f"  Status: {transformation.status}")
            
            # Delete the transformation
            db.delete(transformation)
            db.commit()
            
            print(f"\n✅ Successfully deleted grayscale transformation!")
            
        else:
            print(f"❌ Transformation with ID {grayscale_id} not found")
            
        # Show remaining transformations
        print(f"\n📋 Remaining PENDING transformations:")
        remaining = db.query(ImageTransformation).filter(
            ImageTransformation.status == "PENDING"
        ).all()
        
        for t in remaining:
            print(f"  {t.transformation_type}: {t.release_version}")
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        
    finally:
        db.close()

if __name__ == "__main__":
    remove_grayscale_transformation()