"""
Active Learning API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database.database import get_db
from core.active_learning import ActiveLearningPipeline
from models.training import TrainingSession, TrainingIteration, UncertainSample
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()

router = APIRouter(prefix="/api/active-learning", tags=["active-learning"])
pipeline = ActiveLearningPipeline()


# Pydantic models
class CreateTrainingSessionRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    dataset_id: int
    base_model_path: Optional[str] = "yolov8n.pt"
    epochs: Optional[int] = 50
    batch_size: Optional[int] = 16
    learning_rate: Optional[float] = 0.001
    max_iterations: Optional[int] = 10


class StartIterationRequest(BaseModel):
    newly_labeled_images: Optional[List[int]] = []


class ReviewSampleRequest(BaseModel):
    accepted: bool
    corrected: Optional[bool] = False


class TrainingSessionResponse(BaseModel):
    id: int
    name: str
    description: str
    dataset_id: int
    status: str
    current_iteration: int
    max_iterations: int
    best_map50: float
    best_map95: float
    epochs: int
    batch_size: int
    learning_rate: float
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]

    class Config:
        from_attributes = True


class TrainingIterationResponse(BaseModel):
    id: int
    session_id: int
    iteration_number: int
    status: str
    training_images_count: int
    validation_images_count: int
    newly_labeled_count: int
    map50: Optional[float]
    map95: Optional[float]
    precision: Optional[float]
    recall: Optional[float]
    loss: Optional[float]
    training_time_seconds: Optional[int]
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]

    class Config:
        from_attributes = True


class UncertainSampleResponse(BaseModel):
    id: int
    iteration_id: int
    image_id: int
    uncertainty_score: float
    confidence_variance: float
    entropy_score: float
    max_confidence: float
    min_confidence: float
    reviewed: bool
    accepted: bool
    corrected: bool
    created_at: str
    reviewed_at: Optional[str]

    class Config:
        from_attributes = True


@router.post("/sessions", response_model=TrainingSessionResponse)
async def create_training_session(
    request: CreateTrainingSessionRequest,
    db: Session = Depends(get_db)
):
    """Create a new active learning training session"""
    logger.info("operations.operations", "Creating new active learning training session", "create_training_session_start", {
        'name': request.name,
        'dataset_id': request.dataset_id,
        'base_model_path': request.base_model_path,
        'epochs': request.epochs,
        'batch_size': request.batch_size,
        'learning_rate': request.learning_rate,
        'max_iterations': request.max_iterations,
        'description': request.description
    })
    
    try:
        session = await pipeline.create_training_session(
            db=db,
            name=request.name,
            dataset_id=request.dataset_id,
            base_model_path=request.base_model_path,
            epochs=request.epochs,
            batch_size=request.batch_size,
            learning_rate=request.learning_rate,
            max_iterations=request.max_iterations,
            description=request.description
        )
        
        logger.info("operations.operations", "Training session created successfully", "create_training_session_success", {
            'session_id': session.id,
            'name': session.name,
            'dataset_id': session.dataset_id,
            'status': session.status
        })
        
        return session
    except Exception as e:
        logger.error("errors.system", f"Failed to create training session: {str(e)}", "create_training_session_failed", {
            'error': str(e),
            'name': request.name,
            'dataset_id': request.dataset_id
        })
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions", response_model=List[TrainingSessionResponse])
async def get_training_sessions(db: Session = Depends(get_db)):
    """Get all training sessions"""
    logger.info("operations.operations", "Retrieving all training sessions", "get_training_sessions_start", {})
    
    try:
        sessions = db.query(TrainingSession).order_by(TrainingSession.created_at.desc()).all()
        
        logger.info("operations.operations", "Training sessions retrieved successfully", "get_training_sessions_success", {
            'session_count': len(sessions)
        })
        
        return sessions
    except Exception as e:
        logger.error("errors.system", f"Failed to retrieve training sessions: {str(e)}", "get_training_sessions_failed", {
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}", response_model=TrainingSessionResponse)
async def get_training_session(session_id: int, db: Session = Depends(get_db)):
    """Get specific training session"""
    logger.info("operations.operations", "Retrieving specific training session", "get_training_session_start", {
        'session_id': session_id
    })
    
    try:
        session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
        if not session:
            logger.warning("errors.validation", f"Training session not found: {session_id}", "get_training_session_not_found", {
                'session_id': session_id
            })
            raise HTTPException(status_code=404, detail="Training session not found")
        
        logger.info("operations.operations", "Training session retrieved successfully", "get_training_session_success", {
            'session_id': session.id,
            'name': session.name,
            'status': session.status,
            'current_iteration': session.current_iteration
        })
        
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to retrieve training session: {str(e)}", "get_training_session_failed", {
            'error': str(e),
            'session_id': session_id
        })
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/iterations", response_model=TrainingIterationResponse)
async def start_training_iteration(
    session_id: int,
    request: StartIterationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start a new training iteration"""
    logger.info("operations.operations", "Starting new training iteration", "start_training_iteration_start", {
        'session_id': session_id,
        'newly_labeled_images_count': len(request.newly_labeled_images) if request.newly_labeled_images else 0
    })
    
    try:
        iteration = await pipeline.start_training_iteration(
            db=db,
            session_id=session_id,
            newly_labeled_images=request.newly_labeled_images
        )
        
        logger.info("operations.operations", "Training iteration started successfully", "start_training_iteration_success", {
            'iteration_id': iteration.id,
            'session_id': iteration.session_id,
            'iteration_number': iteration.iteration_number,
            'status': iteration.status
        })
        
        return iteration
    except Exception as e:
        logger.error("errors.system", f"Failed to start training iteration: {str(e)}", "start_training_iteration_failed", {
            'error': str(e),
            'session_id': session_id
        })
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions/{session_id}/iterations", response_model=List[TrainingIterationResponse])
async def get_training_iterations(session_id: int, db: Session = Depends(get_db)):
    """Get all iterations for a training session"""
    logger.info("operations.operations", "Retrieving training iterations", "get_training_iterations_start", {
        'session_id': session_id
    })
    
    try:
        iterations = db.query(TrainingIteration).filter(
            TrainingIteration.session_id == session_id
        ).order_by(TrainingIteration.iteration_number).all()
        
        logger.info("operations.operations", "Training iterations retrieved successfully", "get_training_iterations_success", {
            'session_id': session_id,
            'iteration_count': len(iterations)
        })
        
        return iterations
    except Exception as e:
        logger.error("errors.system", f"Failed to retrieve training iterations: {str(e)}", "get_training_iterations_failed", {
            'error': str(e),
            'session_id': session_id
        })
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/progress")
async def get_training_progress(session_id: int, db: Session = Depends(get_db)):
    """Get detailed training progress and metrics"""
    logger.info("operations.operations", "Retrieving training progress", "get_training_progress_start", {
        'session_id': session_id
    })
    
    try:
        progress = await pipeline.get_training_progress(db, session_id)
        
        logger.info("operations.operations", "Training progress retrieved successfully", "get_training_progress_success", {
            'session_id': session_id,
            'has_progress_data': bool(progress)
        })
        
        return progress
    except Exception as e:
        logger.error("errors.system", f"Failed to retrieve training progress: {str(e)}", "get_training_progress_failed", {
            'error': str(e),
            'session_id': session_id
        })
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions/{session_id}/uncertain-samples", response_model=List[UncertainSampleResponse])
async def get_uncertain_samples(
    session_id: int,
    iteration_number: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get uncertain samples for review"""
    logger.info("operations.annotations", "Retrieving uncertain samples", "get_uncertain_samples_start", {
        'session_id': session_id,
        'iteration_number': iteration_number
    })
    
    try:
        samples = await pipeline.get_uncertain_samples(
            db=db,
            session_id=session_id,
            iteration_number=iteration_number
        )
        
        logger.info("operations.annotations", "Uncertain samples retrieved successfully", "get_uncertain_samples_success", {
            'session_id': session_id,
            'iteration_number': iteration_number,
            'sample_count': len(samples)
        })
        
        return samples
    except Exception as e:
        logger.error("errors.system", f"Failed to retrieve uncertain samples: {str(e)}", "get_uncertain_samples_failed", {
            'error': str(e),
            'session_id': session_id,
            'iteration_number': iteration_number
        })
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/uncertain-samples/{sample_id}/review")
async def review_uncertain_sample(
    sample_id: int,
    request: ReviewSampleRequest,
    db: Session = Depends(get_db)
):
    """Review and update uncertain sample"""
    logger.info("operations.annotations", "Reviewing uncertain sample", "review_uncertain_sample_start", {
        'sample_id': sample_id,
        'accepted': request.accepted,
        'corrected': request.corrected
    })
    
    try:
        await pipeline.review_uncertain_sample(
            db=db,
            sample_id=sample_id,
            accepted=request.accepted,
            corrected=request.corrected
        )
        
        logger.info("operations.annotations", "Uncertain sample reviewed successfully", "review_uncertain_sample_success", {
            'sample_id': sample_id,
            'accepted': request.accepted,
            'corrected': request.corrected
        })
        
        return {"message": "Sample reviewed successfully"}
    except Exception as e:
        logger.error("errors.system", f"Failed to review uncertain sample: {str(e)}", "review_uncertain_sample_failed", {
            'error': str(e),
            'sample_id': sample_id,
            'accepted': request.accepted,
            'corrected': request.corrected
        })
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_training_session(session_id: int, db: Session = Depends(get_db)):
    """Delete a training session and all related data"""
    logger.info("operations.operations", "Deleting training session", "delete_training_session_start", {
        'session_id': session_id
    })
    
    try:
        session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
        if not session:
            logger.warning("errors.validation", f"Training session not found for deletion: {session_id}", "delete_training_session_not_found", {
                'session_id': session_id
            })
            raise HTTPException(status_code=404, detail="Training session not found")
        
        # Delete related data
        logger.info("operations.operations", "Deleting related uncertain samples", "delete_uncertain_samples", {
            'session_id': session_id
        })
        
        db.query(UncertainSample).filter(
            UncertainSample.iteration_id.in_(
                db.query(TrainingIteration.id).filter(TrainingIteration.session_id == session_id)
            )
        ).delete(synchronize_session=False)
        
        logger.info("operations.operations", "Deleting training iterations", "delete_training_iterations", {
            'session_id': session_id
        })
        
        db.query(TrainingIteration).filter(TrainingIteration.session_id == session_id).delete()
        db.delete(session)
        db.commit()
        
        logger.info("operations.operations", "Training session deleted successfully", "delete_training_session_success", {
            'session_id': session_id,
            'session_name': session.name
        })
        
        return {"message": "Training session deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to delete training session: {str(e)}", "delete_training_session_failed", {
            'error': str(e),
            'session_id': session_id
        })
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/export-model")
async def export_trained_model(session_id: int, iteration_number: Optional[int] = None, db: Session = Depends(get_db)):
    """Export trained model for use in auto-labeling"""
    logger.info("operations.operations", "Exporting trained model", "export_trained_model_start", {
        'session_id': session_id,
        'iteration_number': iteration_number
    })
    
    try:
        session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
        if not session:
            logger.warning("errors.validation", f"Training session not found for export: {session_id}", "export_trained_model_session_not_found", {
                'session_id': session_id
            })
            raise HTTPException(status_code=404, detail="Training session not found")
        
        # Get best iteration if not specified
        if iteration_number is None:
            logger.info("operations.operations", "Finding best iteration for export", "find_best_iteration", {
                'session_id': session_id,
                'best_map50': session.best_map50
            })
            
            iteration = db.query(TrainingIteration).filter(
                TrainingIteration.session_id == session_id,
                TrainingIteration.map50 == session.best_map50
            ).first()
        else:
            logger.info("operations.operations", "Finding specific iteration for export", "find_specific_iteration", {
                'session_id': session_id,
                'iteration_number': iteration_number
            })
            
            iteration = db.query(TrainingIteration).filter(
                TrainingIteration.session_id == session_id,
                TrainingIteration.iteration_number == iteration_number
            ).first()
        
        if not iteration:
            logger.warning("errors.validation", f"Training iteration not found for export: {iteration_number}", "export_trained_model_iteration_not_found", {
                'session_id': session_id,
                'iteration_number': iteration_number
            })
            raise HTTPException(status_code=404, detail="Training iteration not found")
        
        logger.info("operations.operations", "Trained model exported successfully", "export_trained_model_success", {
            'session_id': session_id,
            'iteration_id': iteration.id,
            'iteration_number': iteration.iteration_number,
            'model_path': iteration.weights_path,
            'map50': iteration.map50,
            'map95': iteration.map95
        })
        
        return {
            "model_path": iteration.weights_path,
            "performance": {
                "map50": iteration.map50,
                "map95": iteration.map95,
                "precision": iteration.precision,
                "recall": iteration.recall
            },
            "iteration": iteration.iteration_number,
            "training_time": iteration.training_time_seconds
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("errors.system", f"Failed to export trained model: {str(e)}", "export_trained_model_failed", {
            'error': str(e),
            'session_id': session_id,
            'iteration_number': iteration_number
        })
        raise HTTPException(status_code=400, detail=str(e))