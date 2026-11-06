import numpy as np

from app.imaging.depth import apply_bokeh
from app.schemas import DepthAdjust


def test_depth_bokeh_is_identity_when_disabled():
    img = np.random.default_rng(2).random((48, 64, 3), dtype=np.float32)
    depth = np.linspace(0, 1, 48, dtype=np.float32)[:, None] * np.ones((1, 64), np.float32)
    result = apply_bokeh(img, depth, DepthAdjust(enabled=False))
    np.testing.assert_array_equal(result, img)


def test_depth_bokeh_blurs_regions_away_from_focus():
    rng = np.random.default_rng(3)
    img = rng.random((96, 128, 3), dtype=np.float32)
    depth = np.tile(np.linspace(0, 1, 96, dtype=np.float32)[:, None], (1, 128))
    params = DepthAdjust(enabled=True, focus=0.5, aperture=1.4, transition=2, subject_protect=0)
    result = apply_bokeh(img, depth, params)
    near_focus = np.mean(np.abs(result[46:50] - img[46:50]))
    far_focus = np.mean(np.abs(result[:8] - img[:8]))
    assert result.shape == img.shape
    assert far_focus > near_focus


def test_bokeh_strength_increases_with_wider_aperture():
    rng = np.random.default_rng(4)
    img = rng.random((64, 80, 3), dtype=np.float32)
    depth = np.zeros((64, 80), np.float32)
    weak = apply_bokeh(img, depth, DepthAdjust(enabled=True, focus=1, aperture=5.6, transition=0, subject_protect=0))
    strong = apply_bokeh(img, depth, DepthAdjust(enabled=True, focus=1, aperture=1.4, transition=0, subject_protect=0))
    assert np.mean(np.abs(strong - img)) > np.mean(np.abs(weak - img))
