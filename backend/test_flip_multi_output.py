import sys
import os
import numpy as np
from PIL import Image
import pytest

# Ensure project root is importable regardless of where pytest is executed
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
sys.path.insert(0, PROJECT_ROOT)

from backend.utils.image_transformer import ImageTransformer  # noqa: E402


def _manual_flip(image: Image.Image, horizontal: bool = False, vertical: bool = False) -> Image.Image:
    """Helper to manually flip using PIL for expected comparison"""
    result = image
    if horizontal:
        result = result.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if vertical:
        result = result.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    return result


def test_both_flips_generate_three_outputs():
    # Create a simple 3x3 RGB test image with distinct corner colors for deterministic comparison
    data = np.array([
        [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
        [[255, 255, 0], [0, 0, 0], [0, 255, 255]],
        [[255, 0, 255], [128, 128, 128], [255, 255, 255]],
    ], dtype=np.uint8)
    img = Image.fromarray(data, mode="RGB")

    transformer = ImageTransformer()
    config = {
        "flip": {
            "enabled": True,
            "horizontal": True,
            "vertical": True,
            # deliberately omit probabilities to trigger 1.0 defaults
        }
    }

    result = transformer.apply_transformations(img, config)

    # Ensure we have a list with three images
    assert isinstance(result, list), "Expected list of images when both flips enabled"
    assert len(result) == 3, f"Expected 3 images, got {len(result)}"

    h_only_expected = _manual_flip(img, horizontal=True)
    v_only_expected = _manual_flip(img, vertical=True)
    hv_expected = _manual_flip(img, horizontal=True, vertical=True)

    # Convert to numpy arrays for pixel-perfect comparison
    np_testing = pytest.importorskip("numpy.testing")
    np_testing.assert_array_equal(np.array(result[0]), np.array(h_only_expected))
    np_testing.assert_array_equal(np.array(result[1]), np.array(v_only_expected))
    np_testing.assert_array_equal(np.array(result[2]), np.array(hv_expected))