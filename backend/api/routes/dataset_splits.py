"""
API routes for dataset split management
Handle assigning images to train/val/test splits
"""

import os
import shutil
import random
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
    # Debug: Log received request
    print(f"\n\n================ SPLIT REQUEST ================")
    print(f"Dataset ID: {dataset_id}")
    print(f"Method: {request.method}")
    print(f"Train percent: {request.train_percent}")
    print(f"Val percent: {request.val_percent}")
    print(f"Test percent: {request.test_percent}")
    print(f"===============================================\n\n")
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
            
        # Verify and adjust percentages for percentage-based methods
        if request.method in ["assign_random", "assign_sequential"]:
            total_percent = request.train_percent + request.val_percent + request.test_percent
            if total_percent != 100:
                print(f"WARNING: Percentages don't add up to 100: {request.train_percent} + {request.val_percent} + {request.test_percent} = {total_percent}")
                
                # Fix the percentages by adjusting the test percentage
                request.test_percent = 100 - request.train_percent - request.val_percent
                print(f"Adjusted percentages: {request.train_percent} + {request.val_percent} + {request.test_percent} = 100")
        
        # Counters for summary
        train_count = 0
        val_count = 0
        test_count = 0
        
        # Import math for ceiling function
        import math
        
        # Process images based on selected method
        if request.method == "assign_random":
            # Randomly assign images to splits based on percentages
            random.shuffle(labeled_images)
            total_images = len(labeled_images)
            
            # Special handling for small datasets to ensure distribution makes sense
            if total_images <= 3:
                # With 1-3 images, use a direct allocation approach
                train_size = 0
                val_size = 0
                test_size = 0
                
                # Calculate how many images to allocate to each split
                images_left = total_images
                
                # Prioritize allocation by highest percentage first
                splits = [
                    ("train", request.train_percent),
                    ("val", request.val_percent),
                    ("test", request.test_percent)
                ]
                
                # Sort by percentage (highest first)
                splits.sort(key=lambda x: x[1], reverse=True)
                
                # Allocate images by priority
                for split_name, percentage in splits:
                    # Calculate images for this split (at least 1 if percentage > 0 and we have images left)
                    split_images = min(
                        math.ceil(total_images * percentage / 100) if percentage > 0 else 0,
                        images_left
                    )
                    
                    # Update the appropriate count
                    if split_name == "train":
                        train_size = split_images
                    elif split_name == "val":
                        val_size = split_images
                    else:  # test
                        test_size = split_images
                    
                    images_left -= split_images
            else:
                # Calculate counts for each split with improved rounding
                train_size = round(total_images * request.train_percent / 100)
                val_size = round(total_images * request.val_percent / 100)
                test_size = total_images - train_size - val_size
                
                # Safety check - ensure we don't have negative values
                if test_size < 0:
                    # Adjust val_size to make test_size at least 0
                    val_size = val_size + test_size
                    test_size = 0
                
            # Debug log
            print(f"Split sizes: Train={train_size}, Val={val_size}, Test={test_size}, Total={total_images}")
            print(f"Split percentages: Train={request.train_percent}%, Val={request.val_percent}%, Test={request.test_percent}%")
            
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
            
            # Special handling for small datasets to ensure distribution makes sense
            if total_images <= 3:
                # With 1-3 images, use a direct allocation approach
                train_size = 0
                val_size = 0
                test_size = 0
                
                # Calculate how many images to allocate to each split
                images_left = total_images
                
                # Prioritize allocation by highest percentage first
                splits = [
                    ("train", request.train_percent),
                    ("val", request.val_percent),
                    ("test", request.test_percent)
                ]
                
                # Sort by percentage (highest first)
                splits.sort(key=lambda x: x[1], reverse=True)
                
                # Allocate images by priority
                for split_name, percentage in splits:
                    # Calculate images for this split (at least 1 if percentage > 0 and we have images left)
                    split_images = min(
                        math.ceil(total_images * percentage / 100) if percentage > 0 else 0,
                        images_left
                    )
                    
                    # Update the appropriate count
                    if split_name == "train":
                        train_size = split_images
                    elif split_name == "val":
                        val_size = split_images
                    else:  # test
                        test_size = split_images
                    
                    images_left -= split_images
            else:
                # Calculate counts for each split with improved rounding
                train_size = round(total_images * request.train_percent / 100)
                val_size = round(total_images * request.val_percent / 100)
                test_size = total_images - train_size - val_size
                
                # Safety check - ensure we don't have negative values
                if test_size < 0:
                    # Adjust val_size to make test_size at least 0
                    val_size = val_size + test_size
                    test_size = 0
                
            # Debug log
            print(f"Sequential split sizes: Train={train_size}, Val={val_size}, Test={test_size}, Total={total_images}")
            
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
                
                # For both assign_random and assign_sequential, update the split
                # FINAL FIX: Use direct SQL update as the most reliable method
                try:
                    # Store image ID in a separate variable
                    current_image_id = image.id
                    
                    # Use parameterized SQL to avoid SQL injection
                    sql = """
                    UPDATE images 
                    SET split_section = :split_section, 
                        updated_at = :updated_at 
                    WHERE id = :image_id
                    """
                    
                    # Execute the SQL with parameters
                    db.execute(
                        sql,
                        {
                            "split_section": split_section,
                            "updated_at": datetime.utcnow(),
                            "image_id": current_image_id
                        }
                    )
                    
                    # Commit the transaction
                    db.commit()
                    print(f"Direct SQL Update: Image {current_image_id} set to {split_section}")
                except Exception as e:
                    print(f"DATABASE ERROR: {str(e)}")
                    # Log stack trace for debugging
                    import traceback
                    print(traceback.format_exc())
        
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
                    # Store image ID in a separate variable
                    current_image_id = image.id
                    
                    # Use parameterized SQL to avoid SQL injection
                    sql = """
                    UPDATE images 
                    SET split_section = :split_section, 
                        updated_at = :updated_at 
                    WHERE id = :image_id
                    """
                    
                    # Execute the SQL with parameters
                    db.execute(
                        sql,
                        {
                            "split_section": split_section,
                            "updated_at": datetime.utcnow(),
                            "image_id": current_image_id
                        }
                    )
                    
                    # Commit the transaction
                    db.commit()
                    print(f"Direct SQL Update: Image {current_image_id} set to {split_section}")
                except Exception as e:
                    print(f"DATABASE ERROR: {str(e)}")
                    # Log stack trace for debugging
                    import traceback
                    print(traceback.format_exc())
                
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
        
        # Make absolutely sure all database changes are committed
        try:
            db.commit()
            print("Successfully committed all database changes")
        except Exception as commit_error:
            print(f"Error committing changes: {str(commit_error)}")
            db.rollback()
            
        # Move image files physically for assign_random method
        if request.method == "assign_random":
            print(f"[DEBUG] Moving files physically for assign_random method")
            print(f"[DEBUG] PROJECTS_DIR: {settings.PROJECTS_DIR}")
            
            project = DatasetOperations.get_project_by_dataset(db, dataset_id)
            dataset = DatasetOperations.get_dataset(db, dataset_id)
            
            if project:
                print(f"[DEBUG] Project name: {project.name}")
            else:
                print(f"[DEBUG] ERROR: Could not find project for dataset {dataset_id}")
                
            if dataset:
                print(f"[DEBUG] Dataset name: {dataset.name}")
            else:
                print(f"[DEBUG] ERROR: Could not find dataset with ID {dataset_id}")
            
            if project and dataset:
                for image in labeled_images:
                    try:
                        # Get source path (from annotating section)
                        src_path = os.path.join(
                            settings.PROJECTS_DIR, 
                            project.name, 
                            "annotating", 
                            dataset.name, 
                            image.filename
                        )
                        
                        # Get destination path (in the appropriate split section)
                        dest_dir = os.path.join(
                            settings.PROJECTS_DIR,
                            project.name,
                            "datasets",  # Changed from dataset to datasets
                            dataset.name,
                            image.split_section  # train, val, or test
                        )
                        
                        # Print debug information
                        print(f"[DEBUG] Source path: {src_path}")
                        print(f"[DEBUG] Destination dir: {dest_dir}")
                        print(f"[DEBUG] Image split section: {image.split_section}")
                        
                        # Ensure destination directory exists
                        os.makedirs(dest_dir, exist_ok=True)
                        
                        dest_path = os.path.join(dest_dir, image.filename)
                        
                        # Move file safely (copy then delete)
                        if os.path.exists(src_path):
                            print(f"[DEBUG] Source file exists, copying to destination")
                            shutil.copy2(src_path, dest_path)
                            if os.path.exists(dest_path):
                                print(f"[DEBUG] Destination file created successfully, removing source")
                                os.remove(src_path)
                                print(f"[DEBUG] Successfully moved file {image.filename} to {image.split_section} split")
                            else:
                                print(f"[DEBUG] ERROR: Failed to copy file to destination: {dest_path}")
                        else:
                            print(f"[DEBUG] ERROR: Source file does not exist: {src_path}")
                        # Update image file path in database
                        try:
                            # Generate relative path for database
                            rel_path = os.path.join("datasets", dataset.name, image.split_section, image.filename)
                            print(f"[DEBUG] Updating database with new path: {rel_path}")
                            
                            # Update image in database
                            ImageOperations.update_image_path(db, image.id, rel_path)
                            db.commit()
                            print(f"[DEBUG] Database updated successfully for image ID: {image.id}")
                        except Exception as db_error:
                            print(f"[DEBUG] ERROR updating database for image {image.id}: {str(db_error)}")
                            db.rollback()
                    except Exception as move_error:
                        print(f"[DEBUG] ERROR moving file {image.filename}: {str(move_error)}")
        
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