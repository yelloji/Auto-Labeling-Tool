import uuid
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database.database import get_db
from database.models import ImageTransformation
from pydantic import BaseModel, validator
from core.transformation_config import (
    is_dual_value_transformation, 
    generate_auto_value, 
    get_dual_value_range,
    calculate_max_images_per_original
)

router = APIRouter(prefix="/image-transformations", tags=["transformations"])
logger = logging.getLogger(__name__)

def generate_transformation_version():
    """Generate a unique version identifier for transformations"""
    now = datetime.now()
    return f"version_auto_{now.strftime('%Y_%m_%d_%H_%M')}"


def update_transformation_combination_count(db: Session, release_version: str):
    """Calculate and update transformation_combination_count for all transformations in a release version"""
    try:
        # Get all transformations for this release version
        transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == release_version,
            ImageTransformation.is_enabled == True
        ).all()

        # Convert to list format for calculation
        transformation_list = []
        for t in transformations:
            transformation_list.append({
                "transformation_type": t.transformation_type,
                "enabled": t.is_enabled,
                "is_dual_value": getattr(t, 'is_dual_value', False),
                "parameters": t.parameters
            })

        # Calculate max images using our existing function
        result = calculate_max_images_per_original(transformation_list)
        max_images = result.get('max', 100)

        # Update all transformations in this release version with the calculated count
        db.query(ImageTransformation).filter(
            ImageTransformation.release_version == release_version
        ).update({
            "transformation_combination_count": max_images
        })
        
        db.commit()
        logger.info(f"Updated combination count for release {release_version}: {max_images}")
        
    except Exception as e:
        logger.error(f"Error updating combination count for {release_version}: {str(e)}")
        db.rollback()


class TransformationCreate(BaseModel):
    transformation_type: str
    parameters: Dict[str, Any]
    is_enabled: bool = True
    order_index: int = 0
    release_version: Optional[str] = None
    category: str = "basic"  # basic or advanced
    status: str = "PENDING"  # PENDING or COMPLETED
    release_id: Optional[str] = None
    parameter_ranges: Optional[Dict[str, List[float]]] = None  # {"angle": [10, 45], "brightness": [-20, 20]}
    range_enabled_params: Optional[List[str]] = None  # ["angle", "brightness"]
    
    # NEW: Dual-value system support
    is_dual_value: bool = False
    dual_value_parameters: Optional[Dict[str, Dict[str, float]]] = None  # {"angle": {"user_value": 45, "auto_value": -45}}
    dual_value_enabled: bool = False


class TransformationUpdate(BaseModel):
    transformation_type: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    is_enabled: Optional[bool] = None
    order_index: Optional[int] = None
    category: Optional[str] = None
    status: Optional[str] = None
    release_id: Optional[str] = None
    release_version: Optional[str] = None
    parameter_ranges: Optional[Dict[str, List[float]]] = None
    range_enabled_params: Optional[List[str]] = None
    
    # NEW: Dual-value system support
    is_dual_value: Optional[bool] = None
    dual_value_parameters: Optional[Dict[str, Dict[str, float]]] = None
    dual_value_enabled: Optional[bool] = None


class ReleaseVersionUpdate(BaseModel):
    old_release_version: str
    new_release_version: str


class TransformationResponse(BaseModel):
    id: str
    transformation_type: str
    parameters: Dict[str, Any]
    is_enabled: bool
    order_index: int
    release_version: str
    created_at: datetime
    category: str
    status: str
    release_id: Optional[str] = None
    parameter_ranges: Optional[Dict[str, List[float]]] = None
    range_enabled_params: Optional[List[str]] = None
    
    # NEW: Dual-value system fields
    is_dual_value: bool = False
    dual_value_parameters: Optional[Dict[str, Dict[str, float]]] = None
    dual_value_enabled: bool = False

    @validator('parameters', pre=True)
    def parse_parameters(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {}
        return v


def process_dual_value_parameters(transformation: TransformationCreate) -> Dict[str, Any]:
    """Process dual-value parameters for transformation"""
    dual_value_params = {}
    
    # Check if this transformation supports dual-value system
    if is_dual_value_transformation(transformation.transformation_type):
        transformation.is_dual_value = True
        
        # Process each parameter for dual-value generation
        for param_name, user_value in transformation.parameters.items():
            if isinstance(user_value, (int, float)):
                auto_value = generate_auto_value(transformation.transformation_type, user_value)
                dual_value_params[param_name] = {
                    "user_value": user_value,
                    "auto_value": auto_value
                }
                logger.info(f"Generated dual-value for {param_name}: user={user_value}, auto={auto_value}")
    
    return dual_value_params


@router.post("/", response_model=TransformationResponse)
def create_transformation(
    transformation: TransformationCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new image transformation

    If release_version is not provided, a new temporary version will be generated
    """
    try:
        # Determine release version: use existing PENDING version or create new one
        if not transformation.release_version:
            # Check if there are existing PENDING transformations
            existing_pending = db.query(ImageTransformation).filter(
                ImageTransformation.status == "PENDING"
            ).first()
            
            if existing_pending:
                # Use the same release version as existing PENDING transformations
                transformation.release_version = existing_pending.release_version
                logger.info(f"Using existing PENDING release version: {transformation.release_version}")
            else:
                # No PENDING transformations exist, create new version
                transformation.release_version = generate_transformation_version()
                logger.info(f"Created new release version: {transformation.release_version}")

        # Process dual-value parameters
        dual_value_params = process_dual_value_parameters(transformation)
        
        # Create new transformation
        db_transformation = ImageTransformation(
            id=str(uuid.uuid4()),
            transformation_type=transformation.transformation_type,
            parameters=transformation.parameters,
            is_enabled=transformation.is_enabled,
            order_index=transformation.order_index,
            release_version=transformation.release_version,
            category=transformation.category,
            status=transformation.status,
            release_id=transformation.release_id,
            parameter_ranges=transformation.parameter_ranges,
            range_enabled_params=transformation.range_enabled_params,
            # NEW: Dual-value system fields
            is_dual_value=transformation.is_dual_value,
            dual_value_parameters=dual_value_params if dual_value_params else None,
            dual_value_enabled=bool(dual_value_params)
        )

        db.add(db_transformation)
        db.commit()
        db.refresh(db_transformation)

        # Calculate and update combination count for this release version
        update_transformation_combination_count(db, transformation.release_version)

        logger.info(f"Created transformation: {db_transformation.id} of type {db_transformation.transformation_type}")
        return db_transformation

    except Exception as e:
        db.rollback()
        logger.error(f"Error creating transformation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create transformation: {str(e)}")


@router.get("/", response_model=List[TransformationResponse])
def get_transformations(
    release_version: Optional[str] = Query(None, description="Filter by release version"),
    transformation_type: Optional[str] = Query(None, description="Filter by transformation type"),
    db: Session = Depends(get_db)
):
    """
    Get all transformations, optionally filtered by release version or type
    """
    try:
        query = db.query(ImageTransformation)

        if release_version:
            query = query.filter(ImageTransformation.release_version == release_version)

        if transformation_type:
            query = query.filter(ImageTransformation.transformation_type == transformation_type)

        # Order by order_index
        query = query.order_by(ImageTransformation.order_index)

        transformations = query.all()
        return transformations

    except Exception as e:
        logger.error(f"Error fetching transformations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch transformations: {str(e)}")


@router.get("/pending", response_model=List[TransformationResponse])
def get_pending_transformations(db: Session = Depends(get_db)):
    """
    Get all pending transformations
    """
    try:
        transformations = db.query(ImageTransformation).filter(
            ImageTransformation.status == "PENDING"
        ).all()
        return transformations
    except Exception as e:
        logger.error(f"Error getting pending transformations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get pending transformations: {str(e)}")


@router.get("/release-versions", response_model=List[str])
def get_release_versions(
    status: Optional[str] = Query(None, description="Filter by status (PENDING, COMPLETED)"),
    db: Session = Depends(get_db)
):
    """
    Get all unique release versions, optionally filtered by status
    """
    try:
        query = db.query(ImageTransformation.release_version).distinct()
        
        if status:
            query = query.filter(ImageTransformation.status == status)
        
        versions = [row[0] for row in query.all() if row[0]]
        
        return sorted(versions, reverse=True)  # Most recent first
        
    except Exception as e:
        logger.error(f"Error fetching release versions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch release versions: {str(e)}")


@router.put("/release-version", response_model=Dict[str, Any])
def update_release_version(
    update_data: ReleaseVersionUpdate,
    db: Session = Depends(get_db)
):
    """
    Update release version name for all transformations with the old version
    """
    try:
        # Find all transformations with the old release version
        transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == update_data.old_release_version
        ).all()
        
        if not transformations:
            raise HTTPException(
                status_code=404, 
                detail=f"No transformations found with release version: {update_data.old_release_version}"
            )
        
        # Update all transformations to use the new release version
        updated_count = 0
        for transformation in transformations:
            transformation.release_version = update_data.new_release_version
            updated_count += 1
        
        db.commit()
        
        logger.info(f"Updated {updated_count} transformations from version {update_data.old_release_version} to {update_data.new_release_version}")
        
        return {
            "message": f"Successfully updated release version",
            "old_version": update_data.old_release_version,
            "new_version": update_data.new_release_version,
            "updated_count": updated_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating release version: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update release version: {str(e)}")


@router.get("/{transformation_id}", response_model=TransformationResponse)
def get_transformation(
    transformation_id: str,
    db: Session = Depends(get_db)
):
    """
    Get a specific transformation by ID
    """
    try:
        transformation = db.query(ImageTransformation).filter(ImageTransformation.id == transformation_id).first()

        if not transformation:
            raise HTTPException(status_code=404, detail=f"Transformation with ID {transformation_id} not found")

        return transformation

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching transformation {transformation_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch transformation: {str(e)}")


@router.put("/{transformation_id}", response_model=TransformationResponse)
def update_transformation(
    transformation_id: str,
    transformation: TransformationUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing transformation
    """
    try:
        db_transformation = db.query(ImageTransformation).filter(ImageTransformation.id == transformation_id).first()

        if not db_transformation:
            raise HTTPException(status_code=404, detail=f"Transformation with ID {transformation_id} not found")

        # Update fields if provided
        if transformation.transformation_type is not None:
            db_transformation.transformation_type = transformation.transformation_type

        if transformation.parameters is not None:
            db_transformation.parameters = transformation.parameters

        if transformation.is_enabled is not None:
            db_transformation.is_enabled = transformation.is_enabled

        if transformation.order_index is not None:
            db_transformation.order_index = transformation.order_index

        if transformation.category is not None:
            db_transformation.category = transformation.category
            
        if transformation.status is not None:
            db_transformation.status = transformation.status
            
        if transformation.release_id is not None:
            db_transformation.release_id = transformation.release_id
            
        if transformation.release_version is not None:
            db_transformation.release_version = transformation.release_version
            
        if transformation.parameter_ranges is not None:
            db_transformation.parameter_ranges = transformation.parameter_ranges
            
        if transformation.range_enabled_params is not None:
            db_transformation.range_enabled_params = transformation.range_enabled_params

        db.commit()
        db.refresh(db_transformation)

        logger.info(f"Updated transformation: {db_transformation.id}")
        return db_transformation

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating transformation {transformation_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update transformation: {str(e)}")


@router.delete("/{transformation_id}")
def delete_transformation(
    transformation_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a transformation
    """
    try:
        transformation = db.query(ImageTransformation).filter(ImageTransformation.id == transformation_id).first()

        if not transformation:
            raise HTTPException(status_code=404, detail=f"Transformation with ID {transformation_id} not found")

        db.delete(transformation)
        db.commit()

        logger.info(f"Deleted transformation: {transformation_id}")
        return {"message": f"Transformation {transformation_id} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting transformation {transformation_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete transformation: {str(e)}")


@router.get("/version/{release_version}", response_model=List[TransformationResponse])
def get_transformations_by_version(
    release_version: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get all transformations for a specific release version, optionally filtered by status
    """
    try:
        query = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == release_version
        )

        if status:
            query = query.filter(ImageTransformation.status == status)

        transformations = query.order_by(ImageTransformation.order_index).all()

        return transformations

    except Exception as e:
        logger.error(f"Error fetching transformations for version {release_version}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch transformations: {str(e)}")


@router.post("/batch", response_model=List[TransformationResponse])
def create_transformations_batch(
    transformations: List[TransformationCreate],
    db: Session = Depends(get_db)
):
    """
    Create multiple transformations in a single batch

    All transformations will use the same release_version if not individually specified
    """
    try:
        # Generate a common version ID if not provided in the first item
        common_version = None
        if transformations and not transformations[0].release_version:
            common_version = generate_transformation_version()

        db_transformations = []
        for i, transformation in enumerate(transformations):
            # Use common version if individual version not specified
            if not transformation.release_version and common_version:
                transformation.release_version = common_version

            # Create transformation with order based on position in list
            db_transformation = ImageTransformation(
                id=str(uuid.uuid4()),
                transformation_type=transformation.transformation_type,
                parameters=transformation.parameters,
                is_enabled=transformation.is_enabled,
                order_index=i,  # Use position in list as order
                release_version=transformation.release_version,
                category=transformation.category,
                parameter_ranges=transformation.parameter_ranges,
                range_enabled_params=transformation.range_enabled_params
            )

            db.add(db_transformation)
            db_transformations.append(db_transformation)

        db.commit()

        # Refresh all objects
        for transformation in db_transformations:
            db.refresh(transformation)

        # Calculate and update combination count for the release version
        if db_transformations and db_transformations[0].release_version:
            update_transformation_combination_count(db, db_transformations[0].release_version)

        logger.info(f"Created {len(db_transformations)} transformations in batch")
        return db_transformations

    except Exception as e:
        db.rollback()
        logger.error(f"Error creating transformations batch: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create transformations: {str(e)}")


@router.post("/reorder", response_model=List[TransformationResponse])
def reorder_transformations(
    transformation_ids: List[str] = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Reorder transformations based on the provided list of IDs
    The order in the list determines the new order_index values
    """
    try:
        # Verify all transformations exist
        transformations = []
        for i, transformation_id in enumerate(transformation_ids):
            transformation = db.query(ImageTransformation).filter(ImageTransformation.id == transformation_id).first()
            if not transformation:
                raise HTTPException(status_code=404, detail=f"Transformation with ID {transformation_id} not found")

            # Update order index
            transformation.order_index = i
            transformations.append(transformation)

        db.commit()

        # Return updated transformations
        return transformations

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error reordering transformations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reorder transformations: {str(e)}")


@router.post("/generate-version")
def generate_version():
    """
    Generate a new unique version identifier for transformations
    """
    try:
        version = generate_transformation_version()
        logger.info(f"Generated new transformation version: {version}")
        
        return {
            "success": True,
            "version": version,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error generating version: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate version: {str(e)}")


@router.post("/calculate-max-images")
def calculate_max_images_endpoint(
    release_version: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Calculate maximum images per original for UI display
    Shows the calculated limit before user clicks Release button
    """
    try:
        # Get transformations for the release version
        transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == release_version,
            ImageTransformation.is_enabled == True
        ).all()

        # Convert to list format for calculation
        transformation_list = []
        for t in transformations:
            transformation_list.append({
                "transformation_type": t.transformation_type,
                "enabled": t.is_enabled,
                "is_dual_value": t.is_dual_value,
                "parameters": t.parameters
            })

        # Calculate max images
        result = calculate_max_images_per_original(transformation_list)
        
        # Add additional info for UI
        result.update({
            "release_version": release_version,
            "total_transformations": len(transformation_list),
            "calculation_timestamp": datetime.now().isoformat()
        })

        logger.info(f"Calculated max images for version {release_version}: {result}")
        return result

    except Exception as e:
        logger.error(f"Error calculating max images for version {release_version}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate max images: {str(e)}")


@router.get("/priority-preview/{release_version}")
def get_priority_preview(
    release_version: str,
    db: Session = Depends(get_db)
):
    """
    Get a preview of the priority order for dual-value transformations
    Shows what images will be generated in what order
    """
    try:
        # Get transformations for the release version
        transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == release_version,
            ImageTransformation.is_enabled == True
        ).all()

        preview = {
            "release_version": release_version,
            "has_dual_value": False,
            "priority_order": [],
            "total_guaranteed_images": 0
        }

        dual_value_transformations = []
        for t in transformations:
            if is_dual_value_transformation(t.transformation_type):
                dual_value_transformations.append(t)
                preview["has_dual_value"] = True

        if dual_value_transformations:
            # Generate priority order preview
            priority_order = []
            
            # Priority 1: User values
            for i, t in enumerate(dual_value_transformations, 1):
                priority_order.append({
                    "priority": 1,
                    "order": i,
                    "type": "user_value",
                    "transformation": t.transformation_type,
                    "parameters": t.parameters,
                    "description": f"User selected {t.transformation_type}"
                })
            
            # Priority 2: Auto values
            for i, t in enumerate(dual_value_transformations, len(dual_value_transformations) + 1):
                auto_params = {}
                for param_name, param_value in t.parameters.items():
                    if isinstance(param_value, dict) and 'user_value' in param_value:
                        auto_params[param_name] = param_value.get('auto_value', 
                                                               generate_auto_value(t.transformation_type, param_value['user_value']))
                    else:
                        auto_params[param_name] = generate_auto_value(t.transformation_type, param_value)
                
                priority_order.append({
                    "priority": 2,
                    "order": i,
                    "type": "auto_value",
                    "transformation": t.transformation_type,
                    "parameters": auto_params,
                    "description": f"Auto-generated {t.transformation_type} (opposite value)"
                })
            
            preview["priority_order"] = priority_order
            preview["total_guaranteed_images"] = len(priority_order)

        logger.info(f"Generated priority preview for version {release_version}")
        return preview

    except Exception as e:
        logger.error(f"Error generating priority preview for version {release_version}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate priority preview: {str(e)}")


@router.post("/update-combination-count")
def update_combination_count_endpoint(
    request: dict,
    db: Session = Depends(get_db)
):
    """
    Manually trigger combination count update for testing
    """
    try:
        release_version = request.get("release_version")
        if not release_version:
            raise HTTPException(status_code=400, detail="release_version is required")
        
        result = update_transformation_combination_count(db, release_version)
        return {"success": True, "updated_count": result, "release_version": release_version}
        
    except Exception as e:
        logger.error(f"Error updating combination count: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update combination count: {str(e)}")


@router.post("/update-user-selected-images")
def update_user_selected_images(
    request: dict,
    db: Session = Depends(get_db)
):
    """
    Update user selected images per original for Release Configuration UI
    Validates that user selection doesn't exceed maximum calculated value
    """
    try:
        release_version = request.get("release_version")
        user_selected_count = request.get("user_selected_count")
        
        if not release_version:
            raise HTTPException(status_code=400, detail="release_version is required")
        
        if user_selected_count is None:
            raise HTTPException(status_code=400, detail="user_selected_count is required")
        
        if not isinstance(user_selected_count, int) or user_selected_count < 1:
            raise HTTPException(status_code=400, detail="user_selected_count must be a positive integer")
        
        # Get transformations for this release version
        transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == release_version,
            ImageTransformation.is_enabled == True
        ).all()
        
        if not transformations:
            raise HTTPException(status_code=404, detail=f"No transformations found for release version {release_version}")
        
        # Get the maximum allowed count from the first transformation
        max_allowed = transformations[0].transformation_combination_count
        
        if max_allowed is None:
            # Calculate max if not set
            transformation_list = []
            for t in transformations:
                transformation_list.append({
                    "transformation_type": t.transformation_type,
                    "enabled": t.is_enabled,
                    "is_dual_value": t.is_dual_value,
                    "parameters": t.parameters
                })
            
            result = calculate_max_images_per_original(transformation_list)
            max_allowed = result.get('max', 100)
            
            # Update the max count in database
            update_transformation_combination_count(db, release_version)
        
        # Validate user selection doesn't exceed maximum
        if user_selected_count > max_allowed:
            raise HTTPException(
                status_code=400, 
                detail=f"User selected count ({user_selected_count}) cannot exceed maximum allowed ({max_allowed})"
            )
        
        # Update all transformations in this release version with user selection
        updated_count = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == release_version
        ).update({
            "user_selected_images_per_original": user_selected_count
        })
        
        db.commit()
        
        logger.info(f"Updated user selected images for release {release_version}: {user_selected_count} (max: {max_allowed})")
        
        return {
            "success": True,
            "release_version": release_version,
            "user_selected_count": user_selected_count,
            "max_allowed_count": max_allowed,
            "updated_transformations": updated_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating user selected images: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update user selected images: {str(e)}")


@router.get("/release-config/{release_version}")
def get_release_config(
    release_version: str,
    db: Session = Depends(get_db)
):
    """
    Get release configuration data for UI display
    Returns max allowed images and current user selection
    """
    try:
        # Get transformations for this release version
        transformations = db.query(ImageTransformation).filter(
            ImageTransformation.release_version == release_version,
            ImageTransformation.is_enabled == True
        ).all()
        
        if not transformations:
            raise HTTPException(status_code=404, detail=f"No transformations found for release version {release_version}")
        
        # Get configuration from first transformation (all should have same values)
        first_transformation = transformations[0]
        max_allowed = first_transformation.transformation_combination_count
        user_selected = first_transformation.user_selected_images_per_original
        
        # Calculate max if not set
        if max_allowed is None:
            transformation_list = []
            for t in transformations:
                transformation_list.append({
                    "transformation_type": t.transformation_type,
                    "enabled": t.is_enabled,
                    "is_dual_value": t.is_dual_value,
                    "parameters": t.parameters
                })
            
            result = calculate_max_images_per_original(transformation_list)
            max_allowed = result.get('max', 100)
            
            # Update the max count in database
            update_transformation_combination_count(db, release_version)
        
        return {
            "release_version": release_version,
            "max_images_per_original": max_allowed,
            "user_selected_images_per_original": user_selected,
            "total_transformations": len(transformations),
            "transformation_types": [t.transformation_type for t in transformations]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting release config for version {release_version}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get release config: {str(e)}")