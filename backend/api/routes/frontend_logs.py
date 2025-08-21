"""
Frontend Logs API Endpoint
=========================
Receives frontend logs and routes them to appropriate backend log files.
Provides unified logging between frontend and backend.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime
import json

from logging_system import get_professional_logger

router = APIRouter(prefix="/api/v1/logs", tags=["frontend-logs"])

# Get professional logger
logger = get_professional_logger()

class FrontendLogData(BaseModel):
    """Frontend log data model."""
    timestamp: str
    level: str
    category: str
    operation: str
    message: str
    logger_name: str
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    source: str = "frontend"

@router.post("/frontend")
async def receive_frontend_log(request: Request, log_data: FrontendLogData):
    """
    Receive frontend log and route to appropriate backend log file.
    
    Args:
        request: FastAPI request object
        log_data: Frontend log data
        
    Returns:
        Success response
    """
    try:
        # Log the incoming frontend log request
        logger.info("app.api", "frontend_log_received", 
                   f"Received frontend log: {log_data.operation}", 
                   {"frontend_log": log_data.dict()})
        
        # Route the log to appropriate backend log file based on category
        category = log_data.category
        level = log_data.level.upper()
        operation = log_data.operation
        message = log_data.message
        details = log_data.details or {}
        
        # Add frontend context to details
        details.update({
            "frontend_session_id": log_data.session_id,
            "frontend_user_id": log_data.user_id,
            "frontend_request_id": log_data.request_id,
            "frontend_source": log_data.source,
            "frontend_timestamp": log_data.timestamp
        })
        
        # Route to appropriate log file based on category
        if level == "INFO":
            logger.info(category, operation, message, details)
        elif level == "WARNING":
            logger.warning(category, operation, message, details)
        elif level == "ERROR":
            logger.error(category, message, operation, details)
        elif level == "DEBUG":
            logger.debug(category, operation, message, details)
        else:
            # Default to info level
            logger.info(category, operation, message, details)
        
        # Log successful routing
        logger.info("app.api", "frontend_log_routed", 
                   f"Frontend log routed to {category}", 
                   {"category": category, "level": level})
        
        return {"status": "success", "message": "Frontend log received and routed"}
        
    except Exception as e:
        # Log the error
        logger.error("app.api", f"Error processing frontend log: {str(e)}", "frontend_log_error", 
                    {"exception": str(e), "exception_type": type(e).__name__})
        
        # Return error response
        raise HTTPException(status_code=500, detail=f"Error processing frontend log: {str(e)}")

@router.post("/frontend/batch/raw")
async def receive_frontend_logs_batch_raw(request: Request):
    """
    Raw endpoint to receive frontend logs without Pydantic validation.
    This helps debug validation issues.
    """
    try:
        body = await request.body()
        body_str = body.decode('utf-8') if body else "No body"
        
        # Try to parse as JSON
        try:
            import json
            data = json.loads(body_str)
            logger.info("app.api", "frontend_logs_batch_raw_received", 
                       f"Raw batch request received", 
                       {"body_length": len(body_str), "data_type": type(data), "data_preview": str(data)[:1000]})
        except json.JSONDecodeError as e:
            logger.error("app.api", f"Failed to parse JSON: {str(e)}", "frontend_logs_batch_raw_json_error",
                        {"body_preview": body_str[:500], "exception": str(e), "exception_type": type(e).__name__})
            return {"error": "Invalid JSON", "details": str(e)}
        
        # If it's a list, process each item
        if isinstance(data, list):
            processed_count = 0
            error_count = 0
            
            for i, item in enumerate(data):
                try:
                    # Try to create FrontendLogData from this item
                    log_data = FrontendLogData(**item)
                    
                    # Route each log to appropriate backend log file
                    category = log_data.category
                    level = log_data.level.upper()
                    operation = log_data.operation
                    message = log_data.message
                    details = log_data.details or {}
                    
                    # Add frontend context to details
                    details.update({
                        "frontend_session_id": log_data.session_id,
                        "frontend_user_id": log_data.user_id,
                        "frontend_request_id": log_data.request_id,
                        "frontend_source": log_data.source,
                        "frontend_timestamp": log_data.timestamp
                    })
                    
                    # Route to appropriate log file based on category
                    if level == "INFO":
                        logger.info(category, operation, message, details)
                    elif level == "WARNING":
                        logger.warning(category, operation, message, details)
                    elif level == "ERROR":
                        logger.error(category, message, operation, details)
                    elif level == "DEBUG":
                        logger.debug(category, operation, message, details)
                    else:
                        # Default to info level
                        logger.info(category, operation, message, details)
                    
                    processed_count += 1
                    logger.info("app.api", "frontend_logs_batch_raw_item_processed", 
                               f"Item {i} processed successfully", {"item": item})
                               
                except Exception as e:
                    error_count += 1
                    logger.error("app.api", f"Item {i} processing failed: {str(e)}", "frontend_logs_batch_raw_item_error",
                               {"item": item, "exception": str(e), "exception_type": type(e).__name__})
            
            # Log batch processing summary
            logger.info("app.api", "frontend_logs_batch_raw_processed", 
                       f"Raw batch processing complete: {processed_count} processed, {error_count} errors",
                       {"processed_count": processed_count, "error_count": error_count})
            
            return {
                "status": "success",
                "message": f"Raw batch processing complete: {processed_count} processed, {error_count} errors",
                "processed_count": processed_count,
                "error_count": error_count
            }
        else:
            logger.error("app.api", "frontend_logs_batch_raw_not_list", 
                        f"Data is not a list", {"data_type": type(data)})
            return {"error": "Data is not a list", "data_type": str(type(data))}
        
    except Exception as e:
        logger.error("app.api", f"Error in raw endpoint: {str(e)}", "frontend_logs_batch_raw_error", 
                    {"exception": str(e), "exception_type": type(e).__name__})
        return {"error": str(e)}

@router.post("/frontend/batch")
async def receive_frontend_logs_batch(request: Request):
    """
    Receive multiple frontend logs and route them to appropriate backend log files.
    This endpoint now uses the same logic as the raw endpoint to avoid validation issues.
    """
    try:
        body = await request.body()
        body_str = body.decode('utf-8') if body else "No body"
        
        # Try to parse as JSON
        try:
            import json
            data = json.loads(body_str)
            logger.info("app.api", "frontend_logs_batch_received", 
                       f"Batch request received", 
                       {"body_length": len(body_str), "data_type": type(data), "data_preview": str(data)[:1000]})
        except json.JSONDecodeError as e:
            logger.error("app.api", f"Failed to parse JSON: {str(e)}", "frontend_logs_batch_json_error",
                        {"body_preview": body_str[:500], "exception": str(e), "exception_type": type(e).__name__})
            return {"error": "Invalid JSON", "details": str(e)}
        
        # If it's a list, process each item
        if isinstance(data, list):
            processed_count = 0
            error_count = 0
            
            for i, item in enumerate(data):
                try:
                    # Try to create FrontendLogData from this item
                    log_data = FrontendLogData(**item)
                    
                    # Route each log to appropriate backend log file
                    category = log_data.category
                    level = log_data.level.upper()
                    operation = log_data.operation
                    message = log_data.message
                    details = log_data.details or {}
                    
                    # Add frontend context to details
                    details.update({
                        "frontend_session_id": log_data.session_id,
                        "frontend_user_id": log_data.user_id,
                        "frontend_request_id": log_data.request_id,
                        "frontend_source": log_data.source,
                        "frontend_timestamp": log_data.timestamp
                    })
                    
                    # Route to appropriate log file based on category
                    if level == "INFO":
                        logger.info(category, operation, message, details)
                    elif level == "WARNING":
                        logger.warning(category, operation, message, details)
                    elif level == "ERROR":
                        logger.error(category, message, operation, details)
                    elif level == "DEBUG":
                        logger.debug(category, operation, message, details)
                    else:
                        # Default to info level
                        logger.info(category, operation, message, details)
                    
                    processed_count += 1
                    
                except Exception as e:
                    error_count += 1
                    logger.error("app.api", f"Item {i} processing failed: {str(e)}", "frontend_logs_batch_item_error",
                               {"item": item, "exception": str(e), "exception_type": type(e).__name__})
            
            # Log batch processing summary
            logger.info("app.api", "frontend_logs_batch_processed", 
                       f"Batch processing complete: {processed_count} processed, {error_count} errors",
                       {"processed_count": processed_count, "error_count": error_count})
            
            return {
                "status": "success",
                "message": f"Batch processing complete: {processed_count} processed, {error_count} errors",
                "processed_count": processed_count,
                "error_count": error_count
            }
        else:
            logger.error("app.api", "frontend_logs_batch_not_list", 
                        f"Data is not a list", {"data_type": type(data)})
            return {"error": "Data is not a list", "data_type": str(type(data))}
        
    except Exception as e:
        logger.error("app.api", f"Error in batch endpoint: {str(e)}", "frontend_logs_batch_error", 
                    {"exception": str(e), "exception_type": type(e).__name__})
        return {"error": str(e)}
    """
    Receive multiple frontend logs and route them to appropriate backend log files.
    
    Args:
        request: FastAPI request object
        logs_data: List of frontend log data
        
    Returns:
        Success response with processing summary
    """
    try:
        # Log the incoming batch request
        logger.info("app.api", "frontend_logs_batch_received", 
                   f"Received batch of {len(logs_data)} frontend logs")
        
        processed_count = 0
        error_count = 0
        
        for i, log_data in enumerate(logs_data):
            try:
                # Route each log to appropriate backend log file
                category = log_data.category
                level = log_data.level.upper()
                operation = log_data.operation
                message = log_data.message
                details = log_data.details or {}
                
                # Add frontend context to details
                details.update({
                    "frontend_session_id": log_data.session_id,
                    "frontend_user_id": log_data.user_id,
                    "frontend_request_id": log_data.request_id,
                    "frontend_source": log_data.source,
                    "frontend_timestamp": log_data.timestamp
                })
                
                # Route to appropriate log file based on category
                if level == "INFO":
                    logger.info(category, operation, message, details)
                elif level == "WARNING":
                    logger.warning(category, operation, message, details)
                elif level == "ERROR":
                    logger.error(category, message, operation, details)
                elif level == "DEBUG":
                    logger.debug(category, operation, message, details)
                else:
                    # Default to info level
                    logger.info(category, operation, message, details)
                
                processed_count += 1
                
            except Exception as e:
                error_count += 1
                # Log the individual log error with more details
                logger.error("app.api", f"Error processing individual frontend log at index {i}: {str(e)}", "frontend_log_batch_item_error",
                           {"log_index": i, "log_data": log_data.dict() if hasattr(log_data, 'dict') else str(log_data), "exception": str(e), "exception_type": type(e).__name__})
        
        # Log batch processing summary
        logger.info("app.api", "frontend_logs_batch_processed", 
                   f"Batch processing complete: {processed_count} processed, {error_count} errors",
                   {"processed_count": processed_count, "error_count": error_count})
        
        return {
            "status": "success", 
            "message": f"Batch processing complete: {processed_count} processed, {error_count} errors",
            "processed_count": processed_count,
            "error_count": error_count
        }
        
    except Exception as e:
        # Log the batch error with request body for debugging
        try:
            body = await request.body()
            body_str = body.decode('utf-8') if body else "No body"
        except:
            body_str = "Could not read body"
            
        logger.error("app.api", f"Error processing frontend logs batch: {str(e)}", "frontend_logs_batch_error",
                    {"request_body": body_str[:500], "exception": str(e), "exception_type": type(e).__name__})  # Log first 500 chars of body
        
        # Return error response
        raise HTTPException(status_code=500, detail=f"Error processing frontend logs batch: {str(e)}")

@router.post("/frontend/debug")
async def debug_frontend_logs(request: Request):
    """
    Debug endpoint to see what data is being sent from frontend.
    """
    try:
        body = await request.body()
        body_str = body.decode('utf-8') if body else "No body"
        
        # Log the raw request
        logger.info("app.api", "frontend_logs_debug", 
                   f"Debug request received", 
                   {"body_length": len(body_str), "body_preview": body_str[:1000]})
        
        return {
            "status": "debug_received",
            "body_length": len(body_str),
            "body_preview": body_str[:1000]
        }
        
    except Exception as e:
        logger.error("app.api", f"Error in debug endpoint: {str(e)}", "frontend_logs_debug_error", 
                    {"exception": str(e), "exception_type": type(e).__name__})
        raise HTTPException(status_code=500, detail=f"Debug error: {str(e)}")

@router.get("/frontend/health")
async def frontend_logs_health_check():
    """
    Health check endpoint for frontend logging system.
    
    Returns:
        Health status
    """
    try:
        # Log health check
        logger.info("app.api", "frontend_logs_health_check", "Frontend logs health check requested")
        
        return {
            "status": "healthy",
            "message": "Frontend logging system is operational",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
    except Exception as e:
        # Log health check error
        logger.error("app.api", f"Frontend logs health check failed: {str(e)}", "frontend_logs_health_check_error", 
                    {"exception": str(e), "exception_type": type(e).__name__})
        
        return {
            "status": "unhealthy",
            "message": f"Frontend logging system error: {str(e)}",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
