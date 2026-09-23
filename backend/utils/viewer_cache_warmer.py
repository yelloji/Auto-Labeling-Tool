"""Build everything the image viewer will ask for, before anyone asks.

Opening an image for the first time costs around a second and a half: the
display preview has to be rendered from a ~17MB PNG, and both the GT overlay
and the missed-detection pass have to rasterise full-resolution masks. Every
one of those results is then cached and the same image opens in a tenth of the
time - so the only images that are ever slow are the ones nobody has opened yet.

This does that work up front, right after a prediction finishes, in the
subprocess that ran it. Nothing is blocked: the experiment is already marked
completed by then, so the results page is usable while this fills in behind it.

Everything here is best-effort. A failure costs the first open of one image,
never the prediction, so no exception is allowed to escape.
"""
import asyncio

from PIL import Image

PREVIEW_SIZE = 2560
GALLERY_THUMB_SIZE = 320


def _build_preview(src_path, dest_path, size, quality):
    """One resized JPEG, unless it is already there."""
    if dest_path.exists():
        return False
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src_path) as img:
        if img.mode == "RGBA":
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[3])
            img = bg
        elif img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.thumbnail((size, size), Image.Resampling.LANCZOS)
        img.save(dest_path, format="JPEG", quality=quality, optimize=True)
    return True


def warm_experiment_viewer_cache(db, experiment, logger=None) -> dict:
    """Pre-build previews, thumbnails and overlays for one experiment's images.

    Returns counts for logging. Safe to run twice: anything already cached is
    detected and skipped, so a second run costs almost nothing.
    """
    import json
    import os

    from utils import project_cache
    from utils.experiment_image_resolver import resolve_experiment_image
    from utils.sahi_gt_overlay import get_gt_overlay_for_image

    stats = {"images": 0, "previews": 0, "thumbs": 0, "overlays": 0, "failed": 0}

    try:
        preds = experiment.predictions
        if isinstance(preds, str):
            preds = json.loads(preds)
        names = sorted(preds or {})
        project = project_cache.resolve_project_name(experiment) or "_unknown"
        # The viewer asks for the experiment's own IoU, so warm that exact value
        # rather than a default it will never request.
        iou = getattr(experiment, "iou_threshold", None) or 0.45

        # get_missed_ground_truth is an async endpoint doing synchronous work;
        # imported lazily so this module stays cheap for anything that only
        # wants the preview helpers.
        from models.training.api_routes import get_missed_ground_truth
        loop = asyncio.new_event_loop()

        try:
            for name in names:
                stats["images"] += 1
                try:
                    row = resolve_experiment_image(db, experiment, name)
                    md5 = getattr(row, "image_hash_md5", None) if row else None
                    src = getattr(row, "file_path", None) if row else None

                    if md5 and src and os.path.exists(src):
                        # Keyed by md5, so images shared with another experiment
                        # are already done and cost nothing here.
                        if _build_preview(src, project_cache.preview_path(project, md5),
                                          PREVIEW_SIZE, 88):
                            stats["previews"] += 1
                        if _build_preview(src, project_cache.thumb_path(project, md5, GALLERY_THUMB_SIZE),
                                          GALLERY_THUMB_SIZE, 85):
                            stats["thumbs"] += 1

                    get_gt_overlay_for_image(db, experiment.id, name)
                    loop.run_until_complete(get_missed_ground_truth(experiment.id, name, iou, db))
                    stats["overlays"] += 1
                except Exception as e:
                    stats["failed"] += 1
                    if logger:
                        logger.warning(
                            "errors.system",
                            f"Could not pre-build viewer cache for {name}: {e}",
                            "viewer_cache_warm_image_failed",
                        )
        finally:
            loop.close()

    except Exception as e:
        if logger:
            logger.warning(
                "errors.system",
                f"Viewer cache pre-build did not run: {e}",
                "viewer_cache_warm_failed",
            )

    return stats
