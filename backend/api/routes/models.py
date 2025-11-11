"""
API routes for model management
Easy import and management of custom YOLO models
"""

import os
import tempfile
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from models.model_manager import model_manager, ModelType, ModelFormat
from sqlalchemy.orm import Session
from database.database import get_db
from database.operations import AiModelOperations
from core.config import settings
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()


router = APIRouter()


class ModelImportRequest(BaseModel):
    """Request model for importing a custom model"""
    name: str
    type: ModelType
    classes: Optional[List[str]] = None
    description: str = ""
    confidence_threshold: float = 0.5
    iou_threshold: float = 0.45


class ModelUpdateRequest(BaseModel):
    """Request model for updating model settings"""
    confidence_threshold: Optional[float] = None
    iou_threshold: Optional[float] = None
    description: Optional[str] = None
    input_size: Optional[List[int]] = None


class PredictionRequest(BaseModel):
    """Request model for running predictions"""
    model_id: str
    confidence: Optional[float] = None
    iou_threshold: Optional[float] = None
    imgsz: Optional[int] = None  # Optional inference image size override


@router.get("/", response_model=List[Dict[str, Any]])
async def get_models():
    """Get list of all available models"""
    logger.info("app.backend", f"Starting get models operation", "get_models_start", {
        "endpoint": "/models"
    })
    
    try:
        logger.debug("operations.operations", f"Fetching models list", "models_fetch", {})
        
        models = model_manager.get_models_list()
        
        logger.info("operations.operations", f"Models retrieved successfully", "get_models_success", {
            "models_count": len(models)
        })
        
        return models
        
    except Exception as e:
        logger.error("errors.system", f"Get models operation failed", "get_models_failure", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to get models: {str(e)}")


@router.get("/types/supported")
async def get_supported_model_types():
    """Get list of supported model types and formats"""
    logger.info("app.backend", f"Starting get supported model types operation", "get_supported_types_start", {
        "endpoint": "/models/types/supported"
    })
    
    try:
        logger.debug("operations.operations", f"Retrieving supported model types and formats", "supported_types_fetch", {})
        
        supported_types = {
            "model_types": [
                {
                    "value": ModelType.OBJECT_DETECTION,
                    "label": "Object Detection",
                    "description": "Detect and classify objects with bounding boxes"
                },
                {
                    "value": ModelType.INSTANCE_SEGMENTATION,
                    "label": "Instance Segmentation", 
                    "description": "Detect objects and generate pixel-level masks"
                },
                {
                    "value": ModelType.SEMANTIC_SEGMENTATION,
                    "label": "Semantic Segmentation",
                    "description": "Classify each pixel in the image"
                },
                {
                    "value": ModelType.CLASSIFICATION,
                    "label": "Image Classification",
                    "description": "Classify entire images into categories"
                },
                {
                    "value": ModelType.POSE_ESTIMATION,
                    "label": "Pose Estimation",
                    "description": "Detect human poses and keypoints"
                }
            ],
            "model_formats": [
                {
                    "value": ModelFormat.PYTORCH,
                    "label": "PyTorch (.pt)",
                    "description": "Native PyTorch model format"
                },
                {
                    "value": ModelFormat.ONNX,
                    "label": "ONNX (.onnx)",
                    "description": "Open Neural Network Exchange format"
                },
                {
                    "value": ModelFormat.TENSORRT,
                    "label": "TensorRT (.engine)",
                    "description": "NVIDIA TensorRT optimized format"
                }
            ],
            "supported_extensions": [".pt", ".onnx", ".engine"],
            "max_file_size_mb": settings.MAX_FILE_SIZE / (1024 * 1024)
        }
        
        logger.info("operations.operations", f"Supported model types retrieved successfully", "supported_types_success", {
            "model_types_count": len(supported_types["model_types"]),
            "model_formats_count": len(supported_types["model_formats"]),
            "supported_extensions": supported_types["supported_extensions"],
            "max_file_size_mb": supported_types["max_file_size_mb"]
        })
        
        return supported_types
        
    except Exception as e:
        logger.error("errors.system", f"Get supported model types operation failed", "supported_types_failure", {
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to get supported model types: {str(e)}")


@router.post("/import")
async def import_custom_model(
    file: UploadFile = File(...),
    name: str = Form(...),
    type: ModelType = Form(...),
    classes: Optional[str] = Form(None),  # JSON string of class names
    description: str = Form(""),
    confidence_threshold: float = Form(0.5),
    iou_threshold: float = Form(0.45),
    training_input_size: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Import a custom YOLO model
    
    Upload a .pt, .onnx, or .engine file to add it to the available models
    """
    logger.info("app.backend", f"Starting model import operation", "model_import_start", {
        "model_name": name,
        "model_type": type,
        "file_name": file.filename,
        "file_size": file.size,
        "confidence_threshold": confidence_threshold,
        "iou_threshold": iou_threshold,
        "endpoint": "/models/import"
    })
    
    try:
        # Validate file format
        logger.debug("operations.operations", f"Validating file format", "file_format_validation", {
            "file_name": file.filename,
            "supported_extensions": ['.pt', '.onnx', '.engine']
        })
        
        if not file.filename.endswith(('.pt', '.onnx', '.engine')):
            logger.warning("errors.validation", f"Unsupported file format", "unsupported_format", {
                "file_name": file.filename,
                "supported_extensions": ['.pt', '.onnx', '.engine']
            })
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Please upload .pt, .onnx, or .engine files"
            )
        
        # Check file size
        logger.debug("operations.operations", f"Checking file size", "file_size_check", {
            "file_size": file.size,
            "max_size": settings.MAX_FILE_SIZE
        })
        
        if file.size > settings.MAX_FILE_SIZE:
            logger.warning("errors.validation", f"File too large", "file_too_large", {
                "file_size": file.size,
                "max_size": settings.MAX_FILE_SIZE,
                "file_name": file.filename
            })
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE / (1024*1024):.1f}MB"
            )
        
        # Parse classes if provided
        logger.debug("operations.operations", f"Parsing model classes", "classes_parsing", {
            "classes_input": classes
        })
        
        class_list = None
        if classes:
            try:
                import json
                class_list = json.loads(classes)
                logger.debug("operations.operations", f"Classes parsed as JSON", "json_classes_parsed", {
                    "class_count": len(class_list) if class_list else 0
                })
            except json.JSONDecodeError:
                # Try splitting by comma if not valid JSON
                class_list = [cls.strip() for cls in classes.split(',') if cls.strip()]
                logger.debug("operations.operations", f"Classes parsed as comma-separated", "comma_classes_parsed", {
                    "class_count": len(class_list) if class_list else 0
                })
        
        # Parse training input size if provided
        logger.debug("operations.operations", f"Parsing training input size", "training_input_size_parsing", {
            "training_input_size": training_input_size
        })
        training_size_list = None
        if training_input_size:
            try:
                import json
                parsed = json.loads(training_input_size)
                if isinstance(parsed, dict):
                    w = parsed.get("width") or parsed.get("w")
                    h = parsed.get("height") or parsed.get("h")
                    if w is not None and h is not None:
                        training_size_list = [int(w), int(h)]
                elif isinstance(parsed, (list, tuple)) and len(parsed) >= 2:
                    training_size_list = [int(parsed[0]), int(parsed[1])]
                logger.debug("operations.operations", f"Training size parsed as JSON", "json_training_size_parsed", {
                    "training_size": training_size_list
                })
            except json.JSONDecodeError:
                try:
                    parts = [p.strip() for p in str(training_input_size).split(',')]
                    if len(parts) >= 2:
                        training_size_list = [int(parts[0]), int(parts[1])]
                    logger.debug("operations.operations", f"Training size parsed as comma-separated", "comma_training_size_parsed", {
                        "training_size": training_size_list
                    })
                except Exception:
                    training_size_list = None

        # Save uploaded file to temporary location
        logger.info("operations.operations", f"Saving uploaded file to temporary location", "temp_file_save", {
            "file_name": file.filename,
            "file_size": file.size
        })
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Import the model
            logger.info("operations.operations", f"Importing custom model", "model_import_execution", {
                "model_name": name,
                "model_type": type,
                "temp_file_path": tmp_file_path,
                "class_count": len(class_list) if class_list else 0
            })
            
            # Enforce unique name at backend; return 409 if duplicate
            try:
                model_id = model_manager.import_custom_model(
                model_file=tmp_file_path,
                model_name=name,
                model_type=type,
                classes=class_list,
                description=description,
                confidence_threshold=confidence_threshold,
                iou_threshold=iou_threshold
                )
            except ValueError as ve:
                msg = str(ve)
                logger.warning("errors.validation", f"Import failed due to duplicate name", "model_import_duplicate_name", {
                    "model_name": name,
                    "error": msg
                })
                raise HTTPException(status_code=409, detail="Model name already exists. Please choose another name.")
            # Immediately upsert into ai_models so the DB reflects the new model without requiring restart
            try:
                model_info = model_manager.models_info.get(model_id)
                if model_info:
                    AiModelOperations.upsert_ai_model(
                        db=db,
                        name=model_info.name,
                        model_type=model_info.type.value if hasattr(model_info.type, "value") else str(model_info.type),
                        model_format=model_info.format.value if hasattr(model_info.format, "value") else str(model_info.format),
                        file_path=model_info.path,
                        classes=model_info.classes,
                        input_size_default=list(model_info.input_size) if isinstance(model_info.input_size, tuple) else model_info.input_size,
                        training_input_size=training_size_list,
                    )
                    logger.info("operations.operations", "AiModel upserted to DB after import", "model_import_db_upsert_success", {
                        "model_id": model_id,
                        "model_name": model_info.name,
                        "format": str(model_info.format),
                        "type": str(model_info.type),
                        "training_input_size": training_size_list
                    })
                else:
                    logger.warning("operations.operations", "Model info not found right after import; skipping DB upsert", "model_import_db_upsert_skip", {
                        "model_id": model_id,
                        "model_name": name
                    })
            except Exception as db_err:
                logger.error("errors.system", f"Failed to upsert AiModel after import: {str(db_err)}", "model_import_db_upsert_error", {
                    "model_id": model_id,
                    "model_name": name,
                    "error": str(db_err),
                    "error_type": type(db_err).__name__
                })
            
            logger.info("operations.operations", f"Model imported successfully", "model_import_success", {
                "model_id": model_id,
                "model_name": name,
                "model_type": type
            })
            
            return {
                "success": True,
                "model_id": model_id,
                "message": f"Model '{name}' imported successfully"
            }
            
        finally:
            # Clean up temporary file
            logger.debug("operations.operations", f"Cleaning up temporary file", "temp_file_cleanup", {
                "temp_file_path": tmp_file_path
            })
            os.unlink(tmp_file_path)
            
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Model import operation failed", "model_import_failure", {
            "model_name": name,
            "file_name": file.filename,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to import model: {str(e)}")


@router.post("/predict")
async def predict_with_model(
    request: PredictionRequest,
    file: UploadFile = File(...)
):
    """
    Run prediction on an uploaded image using specified model
    """
    logger.info("app.backend", f"Starting model prediction operation", "model_prediction_start", {
        "model_id": request.model_id,
        "file_name": file.filename,
        "file_size": file.size,
        "confidence": request.confidence,
        "iou_threshold": request.iou_threshold,
        "endpoint": "/models/predict"
    })
    
    try:
        # Validate image format
        logger.debug("operations.operations", f"Validating image format", "image_format_validation", {
            "file_name": file.filename,
            "supported_formats": settings.SUPPORTED_IMAGE_FORMATS
        })
        
        if not any(file.filename.lower().endswith(ext) for ext in settings.SUPPORTED_IMAGE_FORMATS):
            logger.warning("errors.validation", f"Unsupported image format", "unsupported_image_format", {
                "file_name": file.filename,
                "supported_formats": settings.SUPPORTED_IMAGE_FORMATS
            })
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image format. Supported formats: {settings.SUPPORTED_IMAGE_FORMATS}"
            )
        
        # Save uploaded image to temporary location
        logger.info("operations.operations", f"Saving uploaded image to temporary location", "temp_image_save", {
            "file_name": file.filename,
            "file_size": file.size
        })
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Run prediction
            logger.info("operations.operations", f"Running model prediction", "prediction_execution", {
                "model_id": request.model_id,
                "image_path": tmp_file_path,
                "confidence": request.confidence,
                "iou_threshold": request.iou_threshold
            })
            
            results = model_manager.predict(
                model_id=request.model_id,
                image=tmp_file_path,
                confidence=request.confidence,
                iou_threshold=request.iou_threshold,
                **({"imgsz": request.imgsz if request.imgsz is not None else (
                    model_manager.models_info[request.model_id].input_size[0]
                    if (request.model_id in model_manager.models_info and 
                        getattr(model_manager.models_info[request.model_id], "input_size", None)) else None
                )} if (request.imgsz is not None or (
                    request.model_id in model_manager.models_info and 
                    getattr(model_manager.models_info[request.model_id], "input_size", None) is not None
                )) else {})
            )
            
            logger.info("operations.operations", f"Model prediction completed successfully", "prediction_success", {
                "model_id": request.model_id,
                "file_name": file.filename,
                "results_type": type(results).__name__
            })
            
            return results
            
        finally:
            # Clean up temporary file
            logger.debug("operations.operations", f"Cleaning up temporary image file", "temp_image_cleanup", {
                "temp_file_path": tmp_file_path
            })
            os.unlink(tmp_file_path)
            
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Model prediction operation failed", "prediction_failure", {
            "model_id": request.model_id,
            "file_name": file.filename,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.get("/{model_id}")
async def get_model_info(model_id: str):
    """Get detailed information about a specific model"""
    logger.info("app.backend", f"Starting get model info operation", "get_model_info_start", {
        "model_id": model_id,
        "endpoint": "/models/{model_id}"
    })
    
    try:
        logger.debug("operations.operations", f"Checking if model exists", "model_existence_check", {
            "model_id": model_id
        })
        
        if model_id not in model_manager.models_info:
            logger.warning("errors.validation", f"Model not found", "model_not_found", {
                "model_id": model_id
            })
            raise HTTPException(status_code=404, detail="Model not found")
        
        logger.debug("operations.operations", f"Retrieving model information", "model_info_fetch", {
            "model_id": model_id
        })
        
        model_info = model_manager.models_info[model_id]
        
        logger.info("operations.operations", f"Model information retrieved successfully", "get_model_info_success", {
            "model_id": model_id,
            "model_name": model_info.name,
            "model_type": model_info.type,
            "num_classes": len(model_info.classes),
            "is_custom": model_info.is_custom
        })
        
        return {
            "id": model_info.id,
            "name": model_info.name,
            "type": model_info.type,
            "format": model_info.format,
            "classes": model_info.classes,
            "num_classes": len(model_info.classes),
            "input_size": model_info.input_size,
            "confidence_threshold": model_info.confidence_threshold,
            "iou_threshold": model_info.iou_threshold,
            "description": model_info.description,
            "is_custom": model_info.is_custom,
            "created_at": model_info.created_at,
            # Enriched metadata for UI consistency
            "file_size": getattr(model_info, "file_size", 0),
            "is_ready": getattr(model_info, "is_ready", False),
            "is_training": getattr(model_info, "is_training", False)
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Get model info operation failed", "get_model_info_failure", {
            "model_id": model_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {str(e)}")


@router.put("/{model_id}")
async def update_model_settings(model_id: str, request: ModelUpdateRequest):
    """Update model settings (confidence, IoU thresholds, description)"""
    logger.info("app.backend", f"Starting update model settings operation", "update_model_settings_start", {
        "model_id": model_id,
        "update_data": {
            "confidence_threshold": request.confidence_threshold,
            "iou_threshold": request.iou_threshold,
            "description": request.description,
            "input_size": request.input_size
        },
        "endpoint": "/models/{model_id}"
    })
    
    try:
        logger.debug("operations.operations", f"Checking if model exists", "model_existence_check", {
            "model_id": model_id
        })
        
        if model_id not in model_manager.models_info:
            logger.warning("errors.validation", f"Model not found for update", "model_not_found", {
                "model_id": model_id
            })
            raise HTTPException(status_code=404, detail="Model not found")
        
        logger.info("operations.operations", f"Updating model settings", "model_settings_update", {
            "model_id": model_id,
            "confidence_threshold": request.confidence_threshold,
            "iou_threshold": request.iou_threshold,
            "description": request.description,
            "input_size": request.input_size
        })
        
        success = model_manager.update_model_settings(
            model_id=model_id,
            confidence_threshold=request.confidence_threshold,
            iou_threshold=request.iou_threshold,
            description=request.description,
            input_size=tuple(request.input_size) if request.input_size else None
        )
        
        if not success:
            logger.error("errors.system", f"Model settings update failed", "update_failure", {
                "model_id": model_id,
                "update_data": {
                    "confidence_threshold": request.confidence_threshold,
                    "iou_threshold": request.iou_threshold,
                    "description": request.description,
                    "input_size": request.input_size
                }
            })
            raise HTTPException(status_code=500, detail="Failed to update model settings")
        
        logger.info("operations.operations", f"Model settings updated successfully", "update_model_settings_success", {
            "model_id": model_id,
            "confidence_threshold": request.confidence_threshold,
            "iou_threshold": request.iou_threshold,
            "description": request.description,
            "input_size": request.input_size
        })
        
        return {"success": True, "message": "Model settings updated successfully"}
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Update model settings operation failed", "update_model_settings_failure", {
            "model_id": model_id,
            "update_data": {
                "confidence_threshold": request.confidence_threshold,
                "iou_threshold": request.iou_threshold,
                "description": request.description
            },
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to update model: {str(e)}")


@router.delete("/{model_id}")
async def delete_model(model_id: str, db: Session = Depends(get_db)):
    """Delete a custom model (pre-trained models cannot be deleted)"""
    logger.info("app.backend", f"Starting delete model operation", "delete_model_start", {
        "model_id": model_id,
        "endpoint": "/models/{model_id}"
    })
    
    try:
        logger.debug("operations.operations", f"Checking if model exists", "model_existence_check", {
            "model_id": model_id
        })
        
        if model_id not in model_manager.models_info:
            logger.warning("errors.validation", f"Model not found for deletion", "model_not_found", {
                "model_id": model_id
            })
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Capture model name before deletion so we can remove the DB row reliably
        model_info = model_manager.models_info[model_id]
        model_name = model_info.name

        logger.info("operations.operations", f"Deleting model and corresponding DB record", "model_deletion", {
            "model_id": model_id,
            "model_name": model_name
        })

        success = model_manager.delete_model(model_id)
        
        if not success:
            logger.error("errors.system", f"Model deletion failed", "deletion_failure", {
                "model_id": model_id
            })
            raise HTTPException(status_code=500, detail="Failed to delete model")
        
        # Also remove AiModel record from database if it exists
        try:
            db_deleted = AiModelOperations.delete_ai_model_by_name(db, model_name)
            logger.info("operations.operations", f"AiModel DB record deletion attempted", "delete_model_db_attempt", {
                "model_id": model_id,
                "model_name": model_name,
                "db_deleted": db_deleted
            })
        except Exception as db_err:
            # Log but don't fail the API if DB deletion encounters an error
            logger.error("errors.system", f"AiModel DB deletion error: {str(db_err)}", "delete_model_db_error", {
                "model_id": model_id,
                "model_name": model_name,
                "error": str(db_err),
                "error_type": type(db_err).__name__
            })

        logger.info("operations.operations", f"Model deleted successfully (file/config + DB)", "delete_model_success", {
            "model_id": model_id,
            "model_name": model_name
        })
        
        return {"success": True, "message": "Model deleted successfully"}
        
    except ValueError as e:
        logger.warning("errors.validation", f"Model deletion validation error", "deletion_validation_error", {
            "model_id": model_id,
            "error": str(e)
        })
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Delete model operation failed", "delete_model_failure", {
            "model_id": model_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to delete model: {str(e)}")


@router.get("/{model_id}/download")
async def download_model(model_id: str):
    """Download the model file for the given model_id"""
    logger.info("app.backend", f"Starting model download operation", "download_model_start", {
        "model_id": model_id,
        "endpoint": "/models/{model_id}/download"
    })

    try:
        # Validate model existence
        logger.debug("operations.operations", f"Checking if model exists for download", "model_existence_check", {
            "model_id": model_id
        })

        if model_id not in model_manager.models_info:
            logger.warning("errors.validation", f"Model not found for download", "model_not_found", {
                "model_id": model_id
            })
            raise HTTPException(status_code=404, detail="Model not found")

        model_info = model_manager.models_info[model_id]
        file_path = Path(model_info.path)

        # Ensure file exists
        logger.debug("operations.operations", f"Validating model file path", "model_file_path_validation", {
            "model_id": model_id,
            "file_path": str(file_path)
        })

        if not file_path.exists():
            logger.error("errors.system", f"Model file not found for download", "model_file_missing", {
                "model_id": model_id,
                "file_path": str(file_path)
            })
            raise HTTPException(status_code=404, detail="Model file not found")

        # Build a friendly filename
        safe_name = model_info.name.replace(" ", "_")
        filename = f"{safe_name}{file_path.suffix}"

        logger.info("operations.operations", f"Model file ready for download", "download_model_ready", {
            "model_id": model_id,
            "filename": filename,
            "file_size": getattr(model_info, "file_size", 0)
        })

        # Stream the file to client
        # Add CORS expose header so frontend can read Content-Disposition for filename
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="application/octet-stream",
            headers={
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error("errors.system", f"Model download operation failed", "download_model_failure", {
            "model_id": model_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise HTTPException(status_code=500, detail=f"Failed to download model: {str(e)}")