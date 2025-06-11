"""
API routes for dataset split management
Handle assigning images to train/val/test splits
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from database.database import get_db
from database.operations import (
    DatasetOperations, ProjectOperations, ImageOperations
)
from core.file_handler import file_handler

router = APIRouter()


class AssignImagesRequest(BaseModel):
    """Request model for assigning images to train/val/test splits"""
    method: str  # "use_existing", "assign_random", "assign_sequential", "all_train", "all_val", "all_test"
    train_percent: Optional[int] = 70
    val_percent: Optional[int] = 20
    test_percent: Optional[int] = 10


@router.post("/datasets/{dataset_id}/splits")
async def assign_images_to_splits(
    dataset_id: str,
    request: AssignImagesRequest,
    db: Session = Depends(get_db)
):
    """
    Assign labeled images to dataset splits (train/val/test)
    
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
    try:
        import random
        
        # Verify dataset exists
        dataset = DatasetOperations.get_dataset(db, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
            
        # Get project information (needed for file paths)
        project = ProjectOperations.get_project(db, dataset.project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        # Get all labeled images for this dataset
        labeled_images = ImageOperations.get_images_by_dataset(
            db, dataset_id, labeled_only=True
        )
        
        # If no images, return error
        if not labeled_images:
            raise HTTPException(status_code=400, detail="No labeled images found in dataset")
            
        # Validate the method parameter
        valid_methods = ["use_existing", "assign_random", "assign_sequential", "all_train", "all_val", "all_test"]
        if request.method not in valid_methods:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid method: {request.method}. Must be one of: {', '.join(valid_methods)}"
            )
            
        # Verify percentages add up to 100 if using percentage-based methods
        if request.method in ["assign_random", "assign_sequential"]:
            total_percent = request.train_percent + request.val_percent + request.test_percent
            if total_percent != 100:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Percentages must add up to 100, got {total_percent}"
                )
        
        # Counters for summary
        train_count = 0
        val_count = 0
        test_count = 0
        
        # Process images based on selected method
        if request.method == "assign_random":
            # Randomly assign images to splits based on percentages
            random.shuffle(labeled_images)
            total_images = len(labeled_images)
            
            # Calculate counts for each split
            train_size = int(total_images * request.train_percent / 100)
            val_size = int(total_images * request.val_percent / 100)
            # test_size is the remainder to ensure we use all images
            
            # Assign splits
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
        
        elif request.method == "assign_sequential":
            # Sequentially assign images to splits based on percentages
            # (no shuffling, maintain original order)
            total_images = len(labeled_images)
            
            # Calculate counts for each split
            train_size = int(total_images * request.train_percent / 100)
            val_size = int(total_images * request.val_percent / 100)
            # test_size is the remainder to ensure we use all images
            
            # Assign splits
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
                
                # For both assign_random and assign_sequential, update the split_section
                # Update the image split section in the database
                try:
                    if hasattr(image, "split_section"):
                        ImageOperations.update_image_split_section(db, image.id, split_section)
                    else:
                        # Fall back to using split_type if split_section doesn't exist
                        print(f"Warning: split_section column doesn't exist yet. Using split_type instead.")
                        ImageOperations.update_image_split(db, image.id, split_section)
                except Exception as e:
                    print(f"Error updating split section: {str(e)}")
        
        elif request.method == "all_train" or request.method == "all_val" or request.method == "all_test":
            # Determine which split to use
            if request.method == "all_train":
                split_section = "train"
            elif request.method == "all_val":
                split_section = "val"
            else:  # all_test
                split_section = "test"
                
            # Assign all images to the selected split
            for image in labeled_images:
                try:
                    if hasattr(image, "split_section"):
                        ImageOperations.update_image_split_section(db, image.id, split_section)
                    else:
                        # Fall back to using split_type if split_section doesn't exist
                        print(f"Warning: split_section column doesn't exist yet. Using split_type instead.")
                        ImageOperations.update_image_split(db, image.id, split_section)
                except Exception as e:
                    print(f"Error updating split section: {str(e)}")
                
                # Update counters
                if split_section == "train":
                    train_count += 1
                elif split_section == "val":
                    val_count += 1
                else:  # test
                    test_count += 1
                
        else:  # "use_existing"
            # Use split_section values already in the database
            for image in labeled_images:
                try:
                    # Default to "train" if split_section is not set
                    split_section = getattr(image, "split_section", "train")
                    
                    # Update counts based on existing assignment
                    if split_section == "train":
                        train_count += 1
                    elif split_section == "val":
                        val_count += 1
                    elif split_section == "test":
                        test_count += 1
                    else:
                        # If split_section has an invalid value, set it to train
                        split_section = "train"
                        train_count += 1
                        
                        # Update the database with the corrected value
                        if hasattr(image, "split_section"):
                            ImageOperations.update_image_split_section(db, image.id, "train")
                except Exception as e:
                    print(f"Error processing existing split: {str(e)}")
                    # Default to train if there's an error
                    train_count += 1
        
        # Commit all database changes
        db.commit()
        
        # Create a method description for the response message
        method_description = {
            "use_existing": "using existing assignments",
            "assign_random": "randomly assigned",
            "assign_sequential": "sequentially assigned",
            "all_train": "assigned to training set",
            "all_val": "assigned to validation set",
            "all_test": "assigned to test set"
        }.get(request.method, "assigned")
        
        # Return summary
        return {
            "message": f"{len(labeled_images)} images {method_description} successfully",
            "method": request.method,
            "train": train_count,
            "val": val_count,
            "test": test_count
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