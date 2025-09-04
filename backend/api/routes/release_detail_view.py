from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import os
import zipfile
import json
from backend.database.database import get_db
from backend.database.models import Release
from backend.utils.path_utils import PathManager
from fastapi.responses import StreamingResponse
from PIL import Image
import io

router = APIRouter()

@router.get("/releases/{release_id}/package-info")
def get_release_package_info(release_id: str, db: Session = Depends(get_db)):
    """
    Extended: Get detailed info about release ZIP contents, including images by split and annotation overlays.
    """
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    abs_model_path = PathManager.get_absolute_path(release.model_path) if release.model_path else None
    if not abs_model_path or not os.path.exists(abs_model_path) or not str(abs_model_path).endswith('.zip'):
        raise HTTPException(status_code=404, detail="Release ZIP package not found")
    with zipfile.ZipFile(abs_model_path, 'r') as zipf:
        # Extract release_config.json for header and transformation
        release_config = {}
        if 'metadata/release_config.json' in zipf.namelist():
            with zipf.open('metadata/release_config.json') as f:
                release_config = json.load(f)
        # Extract images by split
        splits = ['train', 'val', 'test']
        images_by_split = {split: [] for split in splits}
        for filename in zipf.namelist():
            for split in splits:
                img_prefix = f'images/{split}/'
                if filename.startswith(img_prefix) and not filename.endswith('/'):
                    images_by_split[split].append(filename)
        # Prefer annotation overlays from metadata/annotation.json if present
        annotation_json = {}
        if 'metadata/annotation.json' in zipf.namelist():
            with zipf.open('metadata/annotation.json') as f:
                annotation_json = json.load(f)
            annotations_by_split = annotation_json.get('annotations_by_split', {})
        else:
            annotations_by_split = {split: {} for split in splits}
            for filename in zipf.namelist():
                for split in splits:
                    label_prefix = f'labels/{split}/'
                    if filename.startswith(label_prefix) and filename.endswith('.txt'):
                        with zipf.open(filename) as f:
                            annotations_by_split[split][filename.replace(label_prefix, '')] = f.read().decode('utf-8')
        return {
            "release_id": release_id,
            "release_config": release_config,
            "images": images_by_split,
            "annotations": annotations_by_split,
            "annotation_json": annotation_json
        }

@router.get("/releases/{release_id}/file/{filename:path}")
def serve_release_file(release_id: str, filename: str, thumbnail: bool = False, size: int = 256, db: Session = Depends(get_db)):
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    abs_model_path = PathManager.get_absolute_path(release.model_path) if release.model_path else None
    if not abs_model_path or not os.path.exists(abs_model_path) or not str(abs_model_path).endswith('.zip'):
        raise HTTPException(status_code=404, detail="Release ZIP not found")
    if '..' in filename or filename.startswith('/') or filename.startswith('\\'):
        raise HTTPException(status_code=400, detail="Invalid filename")
    with zipfile.ZipFile(abs_model_path, 'r') as zipf:
        if filename not in zipf.namelist():
            raise HTTPException(status_code=404, detail="File not found in ZIP")
        if not thumbnail:
            mime_types = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.bmp': 'image/bmp',
                '.tif': 'image/tiff',
                '.tiff': 'image/tiff',
                '.webp': 'image/webp',
                '.tga': 'image/x-tga',
                '.avif': 'image/avif',
                '.heic': 'image/heic',
                '.ico': 'image/x-icon'
            }
            ext = os.path.splitext(filename.lower())[1]
            content_type = mime_types.get(ext, 'application/octet-stream')
            def iterfile():
                with zipf.open(filename, 'r') as file_in_zip:
                    while True:
                        chunk = file_in_zip.read(8192)
                        if not chunk:
                            break
                        yield chunk
            return StreamingResponse(iterfile(), media_type=content_type)
        else:
            with zipf.open(filename, 'r') as file_in_zip:
                img = Image.open(file_in_zip)
                img.thumbnail((size, size))
                buf = io.BytesIO()
                save_format = img.format or 'JPEG'
                img.save(buf, format=save_format)
                buf.seek(0)
            content_type = f'image/{save_format.lower()}'
            return StreamingResponse(buf, media_type=content_type)