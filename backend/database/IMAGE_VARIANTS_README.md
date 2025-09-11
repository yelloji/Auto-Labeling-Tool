# Image Variants System

## Overview

The Image Variants system provides a way to track and manage transformed versions of original images. This system is designed to maintain a relationship between original images and their transformed variants, allowing for efficient storage and retrieval of transformation data.

## Components

### 1. Database Migration

The migration file `20250815_add_image_variants_table.py` creates the `image_variants` table with the following structure:

```sql
CREATE TABLE image_variants (
    id INTEGER PRIMARY KEY,
    parent_image_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    affine_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_image_id) REFERENCES images(id) ON DELETE CASCADE
);
```

### 2. SQLAlchemy Model

The `ImageVariant` model in `models.py` provides ORM support for the table:

```python
class ImageVariant(Base):
    __tablename__ = "image_variants"
    
    id = Column(Integer, primary_key=True)
    parent_image_id = Column(String, ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    path = Column(Text, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    affine_json = Column(Text, nullable=False)  # JSON string containing the affine transformation matrix
    created_at = Column(DateTime, default=func.now())
    
    # Relationship to parent image
    parent_image = relationship("Image", back_populates="variants")
```

### 3. Repository Module

The `image_variant_repository.py` module provides functions for interacting with the table:

```python
class ImageVariantRepository:
    @staticmethod
    def insert_image_variant(db, parent_image_id, rel_path, width, height, affine_json) -> int:
        # Inserts a new image variant and returns its ID
        
    @staticmethod
    def update_image_variant_path(db, variant_id, rel_path) -> None:
        # Updates the path of an existing image variant
```

## Usage

### Creating a New Image Variant

```python
from database.image_variant_repository import ImageVariantRepository

# Insert a new image variant
variant_id = ImageVariantRepository.insert_image_variant(
    db=db_session,
    parent_image_id="original_image_uuid",
    rel_path="projects/project_name/dataset_name/variants/transformed_image.jpg",
    width=800,
    height=600,
    affine_json=json.dumps({
        "matrix": [
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0]
        ],
        "transformations": [
            {"type": "flip", "horizontal": True, "vertical": False},
            {"type": "rotate", "angle": 45}
        ]
    })
)
```

### Updating an Image Variant Path

```python
from database.image_variant_repository import ImageVariantRepository

# Update the path of an existing image variant
ImageVariantRepository.update_image_variant_path(
    db=db_session,
    variant_id=123,
    rel_path="projects/project_name/dataset_name/variants/new_path.jpg"
)
```

## Benefits

1. **Transformation Tracking**: Maintains a record of all transformations applied to original images
2. **Efficient Storage**: Stores transformation matrices instead of redundant image metadata
3. **Relationship Preservation**: Maintains parent-child relationships between original and transformed images
4. **Cascade Deletion**: Automatically removes variants when parent images are deleted
5. **Performance Optimization**: Allows for efficient querying of variants by parent image

## Implementation Notes

- The `affine_json` field stores a JSON string containing the transformation matrix and details of applied transformations
- The `path` field stores the relative path to the variant image file
- The `parent_image_id` field creates a foreign key relationship to the parent image
- The `cascade="all, delete-orphan"` option ensures variants are deleted when the parent image is deleted

---

*Created: August 15, 2025*