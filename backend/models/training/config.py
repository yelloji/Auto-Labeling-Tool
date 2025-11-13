"""
Typed configuration objects for training.
"""
from typing import Optional
from pydantic import BaseModel, Field


class TrainingConfig(BaseModel):
    """General training configuration used by the engine/pipeline."""
    base_model_path: str = Field(default="yolov8n.pt", description="Path to base/pretrained model")
    epochs: int = Field(default=50, ge=1, le=1000)
    batch_size: int = Field(default=16, ge=1, le=1024)
    learning_rate: float = Field(default=0.001, gt=0.0)
    image_size: int = Field(default=640, ge=64, le=2048)
    max_iterations: int = Field(default=10, ge=1, le=1000)
    description: Optional[str] = Field(default="", description="Optional session description")