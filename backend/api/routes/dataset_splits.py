"""
API routes for dataset split management
Handle assigning images to train/val/test splits
"""

import os
import shutil
import random
import math
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from database.database import get_db
from database.models import Image
from database.operations import (
    DatasetOperations, ProjectOperations, ImageOperations
)
from core.file_handler import file_handler
from core.config import settings

router = APIRouter()


class AssignImagesRequest(BaseModel):
    """Request model for assigning images to train/val/test splits"""
    method: str  # "use_existing", "assign_random", "all_train", "all_val", "all_test"
    train_percent: Optional[int] = 70
    val_percent: Optional[int] = 20
    test_percent: Optional[int] = 10
"""
    This endpoint will:
    1. Get all labeled images for the dataset
    2. Assign splits based on method:
       - use_existing: Keep existing split assignments
       - split_ratio: Split images between train/val/test based on percentages
       - all_train: Assign all images to training set
       - all_val: Assign all images to validation set
       - all_test: Assign all images to test set
    3. Update the database records
    4. Return a summary of the operation
    """
@router.post("/datasets/{dataset_id}/splits")
async def assign_images_to_splits(
    dataset_id: str,
    request: AssignImagesRequest,
    db: Session = Depends(get_db)
):
    # Debug: Log received request
    print(f"\n\n================ SPLIT REQUEST ================")
    print(f"Dataset ID: {dataset_id}")
    print(f"Method: {request.method}")
    print(f"Train percent: {request.train_percent}")
    print(f"Val percent: {request.val_percent}")
    print(f"Test percent: {request.test_percent}")
    print(f"===============================================\n\n")
    try:
        import random, math  # for shuffling and ceil

        # Verify dataset & project
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        project = ProjectOperations.get_project(db, dataset.project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Fetch all labeled images
        labeled_images = ImageOperations.get_images_by_dataset(db, dataset_id, labeled_only=True)
        if not labeled_images:
            raise HTTPException(status_code=400, detail="No labeled images found in dataset")

        # Validate method
        valid_methods = ["use_existing", "assign_random", "all_train", "all_val", "all_test"]
        if request.method not in valid_methods:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid method: {request.method}. Must be one of: {', '.join(valid_methods)}"
            )

        # Adjust percentages if necessary
        if request.method == "assign_random":
            total_pct = (request.train_percent or 0) + (request.val_percent or 0) + (request.test_percent or 0)
            if total_pct != 100:
                request.test_percent = 100 - ((request.train_percent or 0) + (request.val_percent or 0))

        # Counters
        train_count = 0
        val_count = 0
        test_count = 0

        # 1) KEEP EXISTING
        if request.method == "use_existing":
            for image in labeled_images:
                sec = getattr(image, "split_section", "train")
                if sec == "train":
                    train_count += 1
                elif sec == "val":
                    val_count += 1
                else:
                    test_count += 1

        # 2) RANDOM SPLIT
                # 2) RANDOM SPLIT
        elif request.method == "assign_random":
            import math  # ensure math is in scope
            random.shuffle(labeled_images)
            total_images = len(labeled_images)

            # 1. Exact (float) quotas
            quotas = {
                "train": total_images * (request.train_percent or 0) / 100,
                "val":   total_images * (request.val_percent   or 0) / 100,
                "test":  total_images * (request.test_percent  or 0) / 100,
            }
            # 2. Floor each quota
            sizes = {k: math.floor(q) for k, q in quotas.items()}
            assigned = sum(sizes.values())
            remaining = total_images - assigned

            # 3. Largest‐Remainder among only splits with percent > 0
            remainders = []
            if request.train_percent and request.train_percent > 0:
                remainders.append(("train", quotas["train"] - sizes["train"]))
            if request.val_percent and request.val_percent > 0:
                remainders.append(("val",   quotas["val"]   - sizes["val"]))
            if request.test_percent and request.test_percent > 0:
                remainders.append(("test",  quotas["test"]  - sizes["test"]))

            # Sort by fractional part descending
            remainders.sort(key=lambda kv: kv[1], reverse=True)

            # Allocate the leftover slots
            for split_name, _ in remainders[:remaining]:
                sizes[split_name] += 1

            # Final counts
            train_size, val_size, test_size = sizes["train"], sizes["val"], sizes["test"]
            print(f"[DEBUG] assign_random computed → train={train_size}, val={val_size}, test={test_size}")

            # Assign & persist
            for i, image in enumerate(labeled_images):
                if i < train_size:
                    split_section = "train"
                    train_count += 1
                elif i < train_size + val_size:
                    split_section = "val"
                    val_count += 1
                else:
                    split_section = "test"
                    test_count += 1

                ImageOperations.update_image_split_section(db, image.id, split_section)



        # 3) ALL_TRAIN / ALL_VAL / ALL_TEST
        elif request.method in ["all_train", "all_val", "all_test"]:
            if request.method == "all_train":
                split_section = "train"
            elif request.method == "all_val":
                split_section = "val"
            else:
                split_section = "test"

            for image in labeled_images:
                ImageOperations.update_image_split_section(db, image.id, split_section)
                if split_section == "train":
                    train_count += 1
                elif split_section == "val":
                    val_count += 1
                else:
                    test_count += 1
        else:
            # This should never happen because you validated `request.method` earlier.
            raise HTTPException(status_code=400, detail="Unsupported split method")

        # Commit once after handling whichever branch
        db.commit()
          

        # Recalculate stats and refresh
        DatasetOperations.update_dataset_stats(db, dataset_id)
        db.refresh(dataset)

        return {
            "message": f"{len(labeled_images)} images {request.method.replace('_',' ')} successfully",
            "method": request.method,
            "train": train_count,
            "val":   val_count,
            "test":  test_count
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to assign images: {str(e)}")



@router.get("/datasets/{dataset_id}/split-stats")
async def get_dataset_split_stats(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """
    Get statistics about the current train/val/test split for a dataset
    
    Returns counts of images in each split section
    """
    try:
        # Verify dataset exists
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
            
        # Get all labeled images for this dataset
        labeled_images = ImageOperations.get_images_by_dataset(
            db, dataset_id, labeled_only=True
        )
        
        # Count images in each split section
        train_count = 0
        val_count = 0
        test_count = 0
        
        for image in labeled_images:
            try:
                # Use getattr to safely access the attribute
                split_section = getattr(image, "split_section", "train")
                if split_section == "train":
                    train_count += 1
                elif split_section == "val":
                    val_count += 1
                elif split_section == "test":
                    test_count += 1
            except Exception as e:
                # If there's an error, default to train
                print(f"Error accessing split_section: {str(e)}")
                train_count += 1
        
        # Calculate percentages
        total_images = len(labeled_images)
        train_percent = round(train_count / total_images * 100) if total_images > 0 else 0
        val_percent = round(val_count / total_images * 100) if total_images > 0 else 0
        test_percent = round(test_count / total_images * 100) if total_images > 0 else 0
        
        # Return statistics
        return {
            "total_images": total_images,
            "train": train_count,
            "val": val_count,
            "test": test_count,
            "train_percent": train_percent,
            "val_percent": val_percent,
            "test_percent": test_percent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get split statistics: {str(e)}")


@router.get("/datasets/{dataset_id}/images-by-split")
async def get_images_by_split(
    dataset_id: str,
    split_section: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get a list of images for a dataset, optionally filtered by split section
    
    Parameters:
    - dataset_id: The dataset ID
    - split_section: Optional filter for split section (train, val, test)
    
    Returns a list of images with their split section information
    """
    try:
        # Verify dataset exists
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
            
        # Get all labeled images for this dataset
        labeled_images = ImageOperations.get_images_by_dataset(
            db, dataset_id, labeled_only=True
        )
        
        # Filter by split section if provided
        if split_section:
            if split_section not in ["train", "val", "test"]:
                raise HTTPException(status_code=400, detail="Invalid split section. Must be train, val, or test")
            
            # Filter images safely, handling the case where split_section column doesn't exist
            filtered_images = []
            for img in labeled_images:
                try:
                    img_split = getattr(img, "split_section", "train")
                    if img_split == split_section:
                        filtered_images.append(img)
                except Exception as e:
                    print(f"Error accessing split_section: {str(e)}")
                    # Default behavior: include in train split if no split_section
                    if split_section == "train":
                        filtered_images.append(img)
            
            labeled_images = filtered_images
        
        # Format response
        result = []
        for image in labeled_images:
            result.append({
                "id": image.id,
                "filename": image.filename,
                "file_path": image.normalized_file_path,
                "split_section": getattr(image, "split_section", "train"),
                "is_labeled": image.is_labeled,
                "is_verified": image.is_verified
            })
        
        return {
            "total": len(result),
            "images": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get images by split: {str(e)}")
