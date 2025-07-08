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

router = APIRouter(prefix="/image-transformations", tags=["transformations"])
logger = logging.getLogger(__name__)

def generate_transformation_version():
    """Generate a unique version identifier for transformations"""
    now = datetime.now()
    return f"version_auto_{now.strftime('%Y_%m_%d_%H_%M')}"


class TransformationCreate(BaseModel):
    transformation_type: str
    parameters: Dict[str, Any]
    is_enabled: bool = True
    order_index: int = 0
    release_version: Optional[str] = None
    category: str = "basic"  # basic or advanced
    status: str = "PENDING"  # PENDING or COMPLETED
    release_id: Optional[str] = None


class TransformationUpdate(BaseModel):
    transformation_type: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    is_enabled: Optional[bool] = None
    order_index: Optional[int] = None
    category: Optional[str] = None
    status: Optional[str] = None
    release_id: Optional[str] = None
    release_version: Optional[str] = None


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

    @validator('parameters', pre=True)
    def parse_parameters(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {}
        return v


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
            release_id=transformation.release_id
        )

        db.add(db_transformation)
        db.commit()
        db.refresh(db_transformation)

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
                category=transformation.category
            )

            db.add(db_transformation)
            db_transformations.append(db_transformation)

        db.commit()

        # Refresh all objects
        for transformation in db_transformations:
            db.refresh(transformation)

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