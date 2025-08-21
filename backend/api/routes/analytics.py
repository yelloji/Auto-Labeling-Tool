"""
Analytics API endpoints for label analysis and dataset insights
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from database.database import get_db
from database import operations as crud
from database.operations import DatasetOperations, ImageOperations
from database.models import Dataset, Image, Annotation, LabelAnalytics, DatasetSplit
from utils.augmentation_utils import LabelAnalyzer
from core.config import settings
from logging_system.professional_logger import get_professional_logger

# Initialize professional logger
logger = get_professional_logger()

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dataset/{dataset_id}/class-distribution")
async def get_class_distribution(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Get class distribution analysis for a dataset"""
    logger.info("app.backend", f"Starting class distribution analysis for dataset {dataset_id}", "analytics_class_distribution", {
        "dataset_id": dataset_id,
        "endpoint": "/api/analytics/dataset/{dataset_id}/class-distribution"
    })
    
    try:
        # Get dataset
        logger.debug("app.database", f"Fetching dataset {dataset_id} from database", "database_query")
        dataset = crud.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        logger.info("app.database", f"Dataset {dataset_id} found, fetching annotations", "database_query")
        
        # Get all annotations for this dataset
        annotations = crud.get_annotations_by_dataset(db, dataset_id)
        logger.info("app.backend", f"Retrieved {len(annotations)} annotations for dataset {dataset_id}", "data_retrieval", {
            "dataset_id": dataset_id,
            "annotation_count": len(annotations)
        })
        
        # Convert to format expected by analyzer
        annotation_dicts = [
            {
                'id': ann.id,
                'image_id': ann.image_id,
                'class_name': ann.class_name,
                'confidence': ann.confidence
            }
            for ann in annotations
        ]
        
        # Analyze distribution
        logger.info("operations.operations", f"Starting class distribution analysis for dataset {dataset_id}", "analysis_start", {
            "dataset_id": dataset_id,
            "annotation_count": len(annotation_dicts)
        })
        analysis = LabelAnalyzer.analyze_class_distribution(annotation_dicts)
        logger.info("operations.operations", f"Class distribution analysis completed for dataset {dataset_id}", "analysis_complete", {
            "dataset_id": dataset_id,
            "analysis_result": analysis
        })
        
        # Store/update analytics in database
        existing_analytics = crud.get_label_analytics_by_dataset(db, dataset_id)
        if existing_analytics:
            logger.info("app.database", f"Updating existing analytics for dataset {dataset_id}", "database_update", {
                "dataset_id": dataset_id,
                "analytics_id": existing_analytics.id
            })
            crud.update_label_analytics(db, existing_analytics.id, analysis)
        else:
            logger.info("app.database", f"Creating new analytics for dataset {dataset_id}", "database_create", {
                "dataset_id": dataset_id
            })
            crud.create_label_analytics(db, dataset_id, analysis)
        
        logger.info("app.backend", f"Class distribution analysis completed successfully for dataset {dataset_id}", "api_success", {
            "dataset_id": dataset_id
        })
        return analysis
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error analyzing class distribution for dataset {dataset_id}", "analysis_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error analyzing class distribution: {str(e)}")


@router.get("/dataset/{dataset_id}/split-analysis")
async def get_split_analysis(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Get analysis of train/val/test split distribution"""
    logger.info("app.backend", f"Starting split analysis for dataset {dataset_id}", "analytics_split_analysis", {
        "dataset_id": dataset_id,
        "endpoint": "/api/analytics/dataset/{dataset_id}/split-analysis"
    })
    
    try:
        # Get dataset
        logger.debug("app.backend", f"Fetching dataset {dataset_id} from database", "database_query")
        dataset = crud.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        logger.info("app.backend", f"Dataset {dataset_id} found, fetching images and annotations", "database_query")
        
        # Get images with their split assignments
        images = crud.get_images_by_dataset(db, dataset_id)
        annotations = crud.get_annotations_by_dataset(db, dataset_id)
        
        logger.info("app.backend", f"Retrieved {len(images)} images and {len(annotations)} annotations for dataset {dataset_id}", "data_retrieval", {
            "dataset_id": dataset_id,
            "image_count": len(images),
            "annotation_count": len(annotations)
        })
        
        # Group images by split
        split_assignments = {
            'train': [img.id for img in images if img.split_type == 'train'],
            'val': [img.id for img in images if img.split_type == 'val'],
            'test': [img.id for img in images if img.split_type == 'test'],
            'unassigned': [img.id for img in images if img.split_type == 'unassigned']
        }
        
        logger.info("operations.operations", f"Split assignments calculated for dataset {dataset_id}", "split_calculation", {
            "dataset_id": dataset_id,
            "train_count": len(split_assignments['train']),
            "val_count": len(split_assignments['val']),
            "test_count": len(split_assignments['test']),
            "unassigned_count": len(split_assignments['unassigned'])
        })
        
        # Convert annotations to format expected by analyzer
        annotation_dicts = [
            {
                'id': ann.id,
                'image_id': ann.image_id,
                'class_name': ann.class_name,
                'confidence': ann.confidence
            }
            for ann in annotations
        ]
        
        # Analyze split distribution
        logger.info("operations.operations", f"Starting split distribution analysis for dataset {dataset_id}", "analysis_start", {
            "dataset_id": dataset_id,
            "annotation_count": len(annotation_dicts)
        })
        analysis = LabelAnalyzer.analyze_split_distribution(annotation_dicts, split_assignments)
        logger.info("operations.operations", f"Split distribution analysis completed for dataset {dataset_id}", "analysis_complete", {
            "dataset_id": dataset_id,
            "analysis_result": analysis
        })
        
        # Add split counts
        analysis['split_counts'] = {
            split: len(img_ids) for split, img_ids in split_assignments.items()
        }
        
        logger.info("app.backend", f"Split analysis completed successfully for dataset {dataset_id}", "api_success", {
            "dataset_id": dataset_id,
            "split_counts": analysis['split_counts']
        })
        return analysis
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error analyzing split distribution for dataset {dataset_id}", "analysis_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error analyzing split distribution: {str(e)}")


@router.get("/dataset/{dataset_id}/imbalance-report")
async def get_imbalance_report(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Get comprehensive imbalance report with recommendations"""
    logger.info("app.backend", f"Starting imbalance report generation for dataset {dataset_id}", "analytics_imbalance_report", {
        "dataset_id": dataset_id,
        "endpoint": "/api/analytics/dataset/{dataset_id}/imbalance-report"
    })
    
    try:
        # Get class distribution
        logger.info("operations.operations", f"Fetching class distribution for dataset {dataset_id}", "analysis_request")
        class_analysis = await get_class_distribution(dataset_id, db)
        
        # Get split analysis
        logger.info("operations.operations", f"Fetching split analysis for dataset {dataset_id}", "analysis_request")
        split_analysis = await get_split_analysis(dataset_id, db)
        
        # Generate comprehensive recommendations
        logger.info("operations.operations", f"Generating recommendations for dataset {dataset_id}", "recommendations_start", {
            "dataset_id": dataset_id,
            "imbalance_ratio": class_analysis.get('imbalance_ratio', 0)
        })
        recommendations = []
        
        # Class imbalance recommendations
        if class_analysis['imbalance_ratio'] > 5.0:
            recommendations.extend([
                {
                    "type": "critical",
                    "title": "Severe Class Imbalance Detected",
                    "description": f"Imbalance ratio: {class_analysis['imbalance_ratio']:.1f}:1",
                    "actions": [
                        "Apply data augmentation to minority classes",
                        "Collect more data for underrepresented classes",
                        "Use class weighting during training"
                    ]
                }
            ])
        elif class_analysis['imbalance_ratio'] > 3.0:
            recommendations.extend([
                {
                    "type": "warning",
                    "title": "Moderate Class Imbalance",
                    "description": f"Imbalance ratio: {class_analysis['imbalance_ratio']:.1f}:1",
                    "actions": [
                        "Consider data augmentation for minority classes",
                        "Monitor training performance carefully"
                    ]
                }
            ])
        
        # Split consistency recommendations
        if not split_analysis['consistent_splits']:
            recommendations.append({
                "type": "warning",
                "title": "Inconsistent Class Distribution Across Splits",
                "description": "Some classes are missing from certain splits",
                "actions": [
                    "Use stratified splitting to ensure all classes in each split",
                    "Manually reassign images to balance splits"
                ]
            })
        
        # Dataset size recommendations
        total_images = sum(split_analysis['split_counts'].values())
        if total_images < 100:
            recommendations.append({
                "type": "info",
                "title": "Small Dataset Size",
                "description": f"Only {total_images} images in dataset",
                "actions": [
                    "Consider collecting more data",
                    "Use aggressive data augmentation",
                    "Consider transfer learning"
                ]
            })
        
        # Calculate health score
        health_score = calculate_dataset_health_score(class_analysis, split_analysis)
        logger.info("operations.operations", f"Dataset health score calculated for dataset {dataset_id}", "health_score", {
            "dataset_id": dataset_id,
            "health_score": health_score,
            "recommendation_count": len(recommendations)
        })
        
        result = {
            "dataset_id": dataset_id,
            "class_analysis": class_analysis,
            "split_analysis": split_analysis,
            "recommendations": recommendations,
            "overall_health_score": health_score,
            "generated_at": datetime.utcnow().isoformat()
        }
        
        logger.info("app.backend", f"Imbalance report completed successfully for dataset {dataset_id}", "api_success", {
            "dataset_id": dataset_id,
            "health_score": health_score,
            "recommendation_count": len(recommendations)
        })
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error generating imbalance report for dataset {dataset_id}", "report_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error generating imbalance report: {str(e)}")


@router.get("/dataset/{dataset_id}/labeling-progress")
async def get_labeling_progress(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Get detailed labeling progress statistics"""
    logger.info("app.backend", f"Starting labeling progress analysis for dataset {dataset_id}", "analytics_labeling_progress", {
        "dataset_id": dataset_id,
        "endpoint": "/api/analytics/dataset/{dataset_id}/labeling-progress"
    })
    
    try:
        # Get dataset
        logger.debug("app.backend", f"Fetching dataset {dataset_id} from database", "database_query")
        dataset = crud.get_dataset(db, dataset_id)
        if not dataset:
            logger.warning("errors.validation", f"Dataset {dataset_id} not found", "dataset_not_found", {
                "dataset_id": dataset_id
            })
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get all images
        logger.info("app.backend", f"Fetching images for dataset {dataset_id}", "database_query")
        images = crud.get_images_by_dataset(db, dataset_id)
        logger.info("app.backend", f"Retrieved {len(images)} images for dataset {dataset_id}", "data_retrieval", {
            "dataset_id": dataset_id,
            "image_count": len(images)
        })
        
        # Calculate statistics
        logger.info("operations.operations", f"Calculating labeling statistics for dataset {dataset_id}", "statistics_calculation")
        total_images = len(images)
        labeled_images = len([img for img in images if img.is_labeled])
        auto_labeled_images = len([img for img in images if img.is_auto_labeled])
        verified_images = len([img for img in images if img.is_verified])
        unlabeled_images = total_images - labeled_images
        
        # Split-wise progress
        logger.info("operations.operations", f"Calculating split-wise progress for dataset {dataset_id}", "split_progress_calculation")
        split_progress = {}
        for split_type in ['train', 'val', 'test', 'unassigned']:
            split_images = [img for img in images if img.split_type == split_type]
            split_labeled = len([img for img in split_images if img.is_labeled])
            split_progress[split_type] = {
                'total': len(split_images),
                'labeled': split_labeled,
                'unlabeled': len(split_images) - split_labeled,
                'progress_percentage': (split_labeled / len(split_images) * 100) if split_images else 0
            }
        
        # Recent activity
        logger.info("operations.operations", f"Calculating recent activity for dataset {dataset_id}", "recent_activity_calculation")
        recent_images = sorted(images, key=lambda x: x.updated_at, reverse=True)[:10]
        recent_activity = [
            {
                'image_id': img.id,
                'filename': img.filename,
                'is_labeled': img.is_labeled,
                'is_verified': img.is_verified,
                'updated_at': img.updated_at.isoformat()
            }
            for img in recent_images
        ]
        
        progress_percentage = (labeled_images / total_images * 100) if total_images > 0 else 0
        
        logger.info("operations.operations", f"Labeling progress calculated for dataset {dataset_id}", "progress_summary", {
            "dataset_id": dataset_id,
            "total_images": total_images,
            "labeled_images": labeled_images,
            "unlabeled_images": unlabeled_images,
            "progress_percentage": progress_percentage
        })
        
        result = {
            "dataset_id": dataset_id,
            "total_images": total_images,
            "labeled_images": labeled_images,
            "unlabeled_images": unlabeled_images,
            "auto_labeled_images": auto_labeled_images,
            "verified_images": verified_images,
            "progress_percentage": progress_percentage,
            "split_progress": split_progress,
            "recent_activity": recent_activity
        }
        
        logger.info("app.backend", f"Labeling progress analysis completed successfully for dataset {dataset_id}", "api_success", {
            "dataset_id": dataset_id,
            "progress_percentage": progress_percentage
        })
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions as they are already handled
        raise
    except Exception as e:
        logger.error("errors.system", f"Error getting labeling progress for dataset {dataset_id}", "progress_error", {
            "dataset_id": dataset_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=f"Error getting labeling progress: {str(e)}")


@router.get("/project/{project_id}/label-distribution")
async def get_project_label_distribution(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Get label distribution across all datasets in a project"""
    try:
        # Get all datasets for this project
        datasets = DatasetOperations.get_datasets_by_project(db, project_id)
        if not datasets:
            return {"label_distribution": {}, "total_annotations": 0}
        
        # Aggregate label counts across all datasets
        label_counts = {}
        total_annotations = 0
        
        for dataset in datasets:
            # Get class distribution for each dataset
            annotations = ImageOperations.get_annotations_by_dataset(db, dataset.id)
            
            for annotation in annotations:
                label_name = annotation.class_name
                if label_name in label_counts:
                    label_counts[label_name] += 1
                else:
                    label_counts[label_name] = 1
                total_annotations += 1
        
        # Calculate percentages
        label_distribution = {}
        for label, count in label_counts.items():
            percentage = (count / total_annotations * 100) if total_annotations > 0 else 0
            label_distribution[label] = {
                "count": count,
                "percentage": round(percentage, 2)
            }
        
        return {
            "project_id": project_id,
            "label_distribution": label_distribution,
            "total_annotations": total_annotations,
            "unique_labels": len(label_counts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting project label distribution: {str(e)}")


def calculate_dataset_health_score(class_analysis: Dict, split_analysis: Dict) -> Dict[str, Any]:
    """Calculate overall dataset health score"""
    score = 100
    issues = []
    
    # Class balance (30% of score)
    if class_analysis['imbalance_ratio'] > 10:
        score -= 30
        issues.append("Severe class imbalance")
    elif class_analysis['imbalance_ratio'] > 5:
        score -= 20
        issues.append("High class imbalance")
    elif class_analysis['imbalance_ratio'] > 3:
        score -= 10
        issues.append("Moderate class imbalance")
    
    # Split consistency (25% of score)
    if not split_analysis['consistent_splits']:
        score -= 25
        issues.append("Inconsistent splits")
    
    # Dataset size (20% of score)
    total_annotations = class_analysis['total_annotations']
    if total_annotations < 100:
        score -= 20
        issues.append("Very small dataset")
    elif total_annotations < 500:
        score -= 10
        issues.append("Small dataset")
    
    # Class diversity (15% of score)
    if class_analysis['num_classes'] < 2:
        score -= 15
        issues.append("Single class dataset")
    elif class_analysis['normalized_entropy'] < 0.5:
        score -= 10
        issues.append("Low class diversity")
    
    # Entropy/distribution (10% of score)
    if class_analysis['gini_coefficient'] > 0.6:
        score -= 10
        issues.append("Highly uneven distribution")
    
    # Determine grade
    if score >= 90:
        grade = "A"
        status = "Excellent"
    elif score >= 80:
        grade = "B"
        status = "Good"
    elif score >= 70:
        grade = "C"
        status = "Fair"
    elif score >= 60:
        grade = "D"
        status = "Poor"
    else:
        grade = "F"
        status = "Critical"
    
    return {
        "score": max(0, score),
        "grade": grade,
        "status": status,
        "issues": issues
    }