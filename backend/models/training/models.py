"""
SQLAlchemy ORM models for training (minimal version)

This module now only contains the TrainingSession table.
Iteration, uncertain sample, and model version tables have been removed
per request to simplify the training system.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.sql import func

from database.database import Base


class TrainingSession(Base):
    """Training session for active learning cycles."""
    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    base_model_id = Column(String)  # e.g., "yolov8n", "yolov11n"

    # Training configuration
    epochs = Column(Integer, default=50)
    batch_size = Column(Integer, default=16)
    learning_rate = Column(Float, default=0.001)
    image_size = Column(Integer, default=640)

    # Status tracking
    status = Column(String(50), default="pending")  # pending, training, completed, failed
    current_iteration = Column(Integer, default=0)
    max_iterations = Column(Integer, default=10)

    # Performance metrics
    best_map50 = Column(Float, default=0.0)
    best_map95 = Column(Float, default=0.0)
    current_loss = Column(Float)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Note: Iterations, uncertain_samples, and model_versions were removed.
    # No relationships remain in the minimal schema.