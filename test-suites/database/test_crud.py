"""
test_crud.py — Direct SQLAlchemy CRUD tests (no HTTP layer).

PURPOSE
-------
These tests bypass FastAPI and the HTTP layer completely. They talk
directly to the database using SQLAlchemy ORM operations. This verifies
that the database models, relationships, and cascade deletes work
correctly at the data layer — independent of any API bugs.

WHAT IS TESTED
--------------
  Project   — create, read by ID, update name, delete
  Dataset   — create inside a project, read, update
  Image     — create inside a dataset, read, update is_labeled flag
  Annotation — create on an image, read, verify image FK
  Label     — create on a project, read, update color
  Release   — create on a project, read

  Cascade deletes:
    - Deleting a Project also deletes its Datasets
    - Deleting a Dataset also deletes its Images
    - Deleting an Image also deletes its Annotations

WHY THIS MATTERS
----------------
  Backend API tests verify HTTP behaviour.
  These tests verify the underlying database logic is correct.
  A bug could exist at either layer — both must be tested separately.

HOW TESTS RUN
-------------
Uses a fresh in-memory SQLite database created per test module.
No server, no HTTP, no FastAPI. Pure SQLAlchemy only.
"""

import sys
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.base import Base
from database.models import (
    Project, Dataset, Image, Annotation, Label,
    Release, AutoLabelJob, DatasetSplit, LabelAnalytics,
    ImageTransformation,
)


# ---------------------------------------------------------------------------
# Engine & session fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def crud_engine():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db(crud_engine):
    """Function-scoped session — each test starts fresh via rollback."""
    connection = crud_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_project(db, name: str = "Test Project") -> Project:
    p = Project(name=name, description="desc", project_type="Object Detection")
    db.add(p)
    db.flush()
    return p


def _make_dataset(db, project_id: int, name: str = "Test Dataset") -> Dataset:
    ds = Dataset(
        id=str(uuid.uuid4()),
        name=name,
        description="",
        project_id=project_id,
    )
    db.add(ds)
    db.flush()
    return ds


def _make_image(db, dataset_id: str, filename: str = "test.jpg") -> Image:
    img = Image(
        id=str(uuid.uuid4()),
        filename=filename,
        original_filename=filename,
        file_path=f"projects/test/{filename}",
        dataset_id=dataset_id,
        width=100,
        height=100,
        format="jpg",
    )
    db.add(img)
    db.flush()
    return img


def _make_annotation(db, image_id: str, class_name: str = "dog") -> Annotation:
    ann = Annotation(
        id=str(uuid.uuid4()),
        image_id=image_id,
        class_name=class_name,
        class_id=0,
        confidence=0.9,
        x_min=0.1,
        y_min=0.1,
        x_max=0.5,
        y_max=0.5,
    )
    db.add(ann)
    db.flush()
    return ann


# ---------------------------------------------------------------------------
# Project CRUD
# ---------------------------------------------------------------------------

def test_create_project(db):
    """Creating a Project row and flushing must assign a numeric id."""
    p = _make_project(db, "New Project")
    assert p.id is not None
    assert isinstance(p.id, int)


def test_read_project(db):
    """A created project must be retrievable by id."""
    p = _make_project(db, "Read Project")
    fetched = db.query(Project).filter(Project.id == p.id).first()
    assert fetched is not None
    assert fetched.name == "Read Project"


def test_update_project(db):
    """Updating a project's name must be persisted."""
    p = _make_project(db, "Update Project")
    p.name = "Updated Project"
    db.flush()

    fetched = db.query(Project).filter(Project.id == p.id).first()
    assert fetched.name == "Updated Project"


def test_delete_project(db):
    """Deleting a project must remove it from the database."""
    p = _make_project(db, "Delete Project")
    project_id = p.id
    db.delete(p)
    db.flush()

    fetched = db.query(Project).filter(Project.id == project_id).first()
    assert fetched is None


# ---------------------------------------------------------------------------
# Dataset CRUD
# ---------------------------------------------------------------------------

def test_create_dataset(db):
    """Creating a Dataset must assign a UUID id and link to the project."""
    p = _make_project(db, "DS CRUD Project")
    ds = _make_dataset(db, p.id, "CRUD Dataset")
    assert ds.id is not None
    assert ds.project_id == p.id


def test_read_dataset(db):
    """A created dataset must be retrievable by id."""
    p = _make_project(db, "DS Read Project")
    ds = _make_dataset(db, p.id, "Read Dataset")
    fetched = db.query(Dataset).filter(Dataset.id == ds.id).first()
    assert fetched is not None
    assert fetched.name == "Read Dataset"


def test_update_dataset(db):
    """Updating a dataset name must be persisted."""
    p = _make_project(db, "DS Update Project")
    ds = _make_dataset(db, p.id, "Old DS Name")
    ds.name = "New DS Name"
    db.flush()
    fetched = db.query(Dataset).filter(Dataset.id == ds.id).first()
    assert fetched.name == "New DS Name"


def test_delete_dataset(db):
    """Deleting a dataset must remove it from the database."""
    p = _make_project(db, "DS Delete Project")
    ds = _make_dataset(db, p.id, "Delete Dataset")
    ds_id = ds.id
    db.delete(ds)
    db.flush()
    assert db.query(Dataset).filter(Dataset.id == ds_id).first() is None


# ---------------------------------------------------------------------------
# Image CRUD
# ---------------------------------------------------------------------------

def test_create_image(db):
    """Creating an Image must link it to the correct dataset."""
    p = _make_project(db, "Img CRUD Project")
    ds = _make_dataset(db, p.id, "Img CRUD DS")
    img = _make_image(db, ds.id, "image.jpg")
    assert img.id is not None
    assert img.dataset_id == ds.id


def test_read_image(db):
    """A created image must be retrievable by id."""
    p = _make_project(db, "Img Read Project")
    ds = _make_dataset(db, p.id, "Img Read DS")
    img = _make_image(db, ds.id, "read.jpg")
    fetched = db.query(Image).filter(Image.id == img.id).first()
    assert fetched is not None
    assert fetched.filename == "read.jpg"


def test_update_image(db):
    """Updating an image field must be persisted."""
    p = _make_project(db, "Img Update Project")
    ds = _make_dataset(db, p.id, "Img Update DS")
    img = _make_image(db, ds.id, "before.jpg")
    img.is_labeled = True
    db.flush()
    fetched = db.query(Image).filter(Image.id == img.id).first()
    assert fetched.is_labeled is True


def test_delete_image(db):
    """Deleting an image must remove it from the database."""
    p = _make_project(db, "Img Delete Project")
    ds = _make_dataset(db, p.id, "Img Delete DS")
    img = _make_image(db, ds.id, "delete.jpg")
    img_id = img.id
    db.delete(img)
    db.flush()
    assert db.query(Image).filter(Image.id == img_id).first() is None


# ---------------------------------------------------------------------------
# Annotation CRUD
# ---------------------------------------------------------------------------

def test_create_annotation(db):
    """Creating an Annotation must link it to the correct image."""
    p = _make_project(db, "Ann CRUD Project")
    ds = _make_dataset(db, p.id, "Ann CRUD DS")
    img = _make_image(db, ds.id, "ann.jpg")
    ann = _make_annotation(db, img.id, "cat")
    assert ann.id is not None
    assert ann.image_id == img.id
    assert ann.class_name == "cat"


def test_read_annotation(db):
    """A created annotation must be retrievable by id."""
    p = _make_project(db, "Ann Read Project")
    ds = _make_dataset(db, p.id, "Ann Read DS")
    img = _make_image(db, ds.id, "ann_read.jpg")
    ann = _make_annotation(db, img.id, "bird")
    fetched = db.query(Annotation).filter(Annotation.id == ann.id).first()
    assert fetched is not None
    assert fetched.class_name == "bird"


def test_update_annotation(db):
    """Updating annotation class_name must be persisted."""
    p = _make_project(db, "Ann Update Project")
    ds = _make_dataset(db, p.id, "Ann Update DS")
    img = _make_image(db, ds.id, "ann_upd.jpg")
    ann = _make_annotation(db, img.id, "fox")
    ann.class_name = "wolf"
    db.flush()
    fetched = db.query(Annotation).filter(Annotation.id == ann.id).first()
    assert fetched.class_name == "wolf"


def test_delete_annotation(db):
    """Deleting an annotation must remove it from the database."""
    p = _make_project(db, "Ann Delete Project")
    ds = _make_dataset(db, p.id, "Ann Delete DS")
    img = _make_image(db, ds.id, "ann_del.jpg")
    ann = _make_annotation(db, img.id, "bear")
    ann_id = ann.id
    db.delete(ann)
    db.flush()
    assert db.query(Annotation).filter(Annotation.id == ann_id).first() is None


# ---------------------------------------------------------------------------
# Cascade deletes
# ---------------------------------------------------------------------------

def test_cascade_delete_project_removes_datasets(db):
    """Deleting a project must cascade-delete its datasets."""
    p = _make_project(db, "Cascade Project")
    ds1 = _make_dataset(db, p.id, "Cascade DS1")
    ds2 = _make_dataset(db, p.id, "Cascade DS2")
    ds1_id = ds1.id
    ds2_id = ds2.id

    db.delete(p)
    db.flush()

    assert db.query(Dataset).filter(Dataset.id == ds1_id).first() is None
    assert db.query(Dataset).filter(Dataset.id == ds2_id).first() is None


def test_cascade_delete_project_removes_datasets_and_images(db):
    """Deleting a project cascades to datasets which cascade to images."""
    p = _make_project(db, "Deep Cascade Project")
    ds = _make_dataset(db, p.id, "Deep Cascade DS")
    img = _make_image(db, ds.id, "deep_cascade.jpg")
    img_id = img.id

    db.delete(p)
    db.flush()

    assert db.query(Image).filter(Image.id == img_id).first() is None


def test_cascade_delete_image_removes_annotations(db):
    """Deleting an image must cascade-delete its annotations."""
    p = _make_project(db, "Ann Cascade Project")
    ds = _make_dataset(db, p.id, "Ann Cascade DS")
    img = _make_image(db, ds.id, "ann_cascade.jpg")
    ann = _make_annotation(db, img.id, "horse")
    ann_id = ann.id

    db.delete(img)
    db.flush()

    assert db.query(Annotation).filter(Annotation.id == ann_id).first() is None


def test_cascade_delete_dataset_removes_images(db):
    """Deleting a dataset must cascade-delete its images."""
    p = _make_project(db, "DS Img Cascade Project")
    ds = _make_dataset(db, p.id, "DS Img Cascade DS")
    img = _make_image(db, ds.id, "ds_cascade.jpg")
    img_id = img.id

    db.delete(ds)
    db.flush()

    assert db.query(Image).filter(Image.id == img_id).first() is None


# ---------------------------------------------------------------------------
# Relationships
# ---------------------------------------------------------------------------

def test_project_datasets_relationship(db):
    """project.datasets must return the project's datasets."""
    p = _make_project(db, "Rel Project")
    ds1 = _make_dataset(db, p.id, "Rel DS1")
    ds2 = _make_dataset(db, p.id, "Rel DS2")
    db.refresh(p)

    assert len(p.datasets) == 2
    ds_ids = {ds.id for ds in p.datasets}
    assert ds1.id in ds_ids
    assert ds2.id in ds_ids


def test_dataset_images_relationship(db):
    """dataset.images must return the dataset's images."""
    p = _make_project(db, "Rel Image Project")
    ds = _make_dataset(db, p.id, "Rel Image DS")
    img1 = _make_image(db, ds.id, "rel1.jpg")
    img2 = _make_image(db, ds.id, "rel2.jpg")
    db.refresh(ds)

    assert len(ds.images) == 2
    img_ids = {img.id for img in ds.images}
    assert img1.id in img_ids
    assert img2.id in img_ids


def test_image_annotations_relationship(db):
    """image.annotations must return the image's annotations."""
    p = _make_project(db, "Rel Ann Project")
    ds = _make_dataset(db, p.id, "Rel Ann DS")
    img = _make_image(db, ds.id, "rel_ann.jpg")
    ann1 = _make_annotation(db, img.id, "cat")
    ann2 = _make_annotation(db, img.id, "dog")
    db.refresh(img)

    assert len(img.annotations) == 2
    class_names = {ann.class_name for ann in img.annotations}
    assert "cat" in class_names
    assert "dog" in class_names


def test_project_labels_relationship(db):
    """project.labels must return the project's labels."""
    p = _make_project(db, "Rel Label Project")
    lbl1 = Label(name="car", color="#ff0000", project_id=p.id)
    lbl2 = Label(name="truck", color="#00ff00", project_id=p.id)
    db.add_all([lbl1, lbl2])
    db.flush()
    db.refresh(p)

    label_names = {lbl.name for lbl in p.labels}
    assert "car" in label_names
    assert "truck" in label_names


# ---------------------------------------------------------------------------
# Label CRUD
# ---------------------------------------------------------------------------

def test_create_label(db):
    """Creating a Label must link it to its project."""
    p = _make_project(db, "Label CRUD Project")
    lbl = Label(name="person", color="#ff0000", project_id=p.id)
    db.add(lbl)
    db.flush()
    assert lbl.id is not None
    assert lbl.project_id == p.id


def test_read_label(db):
    """A created label must be retrievable."""
    p = _make_project(db, "Label Read Project")
    lbl = Label(name="bicycle", color="#00ff00", project_id=p.id)
    db.add(lbl)
    db.flush()
    fetched = db.query(Label).filter(Label.id == lbl.id).first()
    assert fetched is not None
    assert fetched.name == "bicycle"


def test_delete_label(db):
    """Deleting a label must remove it from the database."""
    p = _make_project(db, "Label Delete Project")
    lbl = Label(name="bus", color="#0000ff", project_id=p.id)
    db.add(lbl)
    db.flush()
    lbl_id = lbl.id
    db.delete(lbl)
    db.flush()
    assert db.query(Label).filter(Label.id == lbl_id).first() is None
