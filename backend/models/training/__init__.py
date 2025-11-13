"""
Training package (organized tree)

Exposes ORM models and provides typed configuration and engine helpers
for managing training sessions and iterations in a clean, modular way.
"""

from .models import TrainingSession

__all__ = [
    "TrainingSession",
]
