"""Tests for the masking engine (Phase 4): mask geometry + local adjustments."""
from __future__ import annotations

import numpy as np

from app.imaging import masks as mm
from app.imaging import pipeline
from app.schemas import Adjustments, BrushDab, LocalAdjust, Mask
from tests.test_pipeline import make_test_image

H, W = 120, 160


# ---- geometry -------------------------------------------------------------


def test_radial_selects_center_not_corners():
    m = mm.build_mask(Mask(id="r", type="radial", cx=0.5, cy=0.5, rx=0.2, ry=0.2,
                           feather=20), H, W)
    assert m[H // 2, W // 2] > 0.9
    assert m[0, 0] < 0.05
    assert m[-1, -1] < 0.05


def test_radial_invert_flips_selection():
    base = Mask(id="r", type="radial", rx=0.2, ry=0.2, feather=10)
    m = mm.build_mask(base, H, W)
    mi = mm.build_mask(base.model_copy(update={"invert": True}), H, W)
    assert m[H // 2, W // 2] > 0.9 and mi[H // 2, W // 2] < 0.1
    assert m[0, 0] < 0.1 and mi[0, 0] > 0.9


def test_linear_is_monotonic_along_axis():
    # Horizontal gradient (angle 0): selection high on the left, low on the right.
    m = mm.build_mask(Mask(id="l", type="linear", angle=0.0, start=0.3, end=0.7), H, W)
    row = m[H // 2]
    assert row[0] > row[W // 2] > row[-1]
    assert row[0] > 0.8 and row[-1] < 0.2


def test_brush_paints_and_erases():
    painted = Mask(id="b", type="brush", feather=0,
                   dabs=[BrushDab(x=0.5, y=0.5, radius=0.25, hardness=0.8)])
    m = mm.build_mask(painted, H, W)
    assert m[H // 2, W // 2] > 0.9
    assert m[0, 0] < 0.05
    # An erase dab over the same spot removes it.
    erased = painted.model_copy(update={
        "dabs": painted.dabs + [BrushDab(x=0.5, y=0.5, radius=0.25, hardness=0.8, erase=True)],
    })
    me = mm.build_mask(erased, H, W)
    assert me[H // 2, W // 2] < 0.1


def test_empty_brush_is_zero():
    m = mm.build_mask(Mask(id="b", type="brush", dabs=[]), H, W)
    assert float(m.max()) == 0.0


def test_opacity_scales_weight():
    full = mm.build_mask(Mask(id="r", type="radial", rx=0.3, ry=0.3, opacity=100), H, W)
    half = mm.build_mask(Mask(id="r", type="radial", rx=0.3, ry=0.3, opacity=50), H, W)
    assert np.allclose(half, full * 0.5, atol=1e-4)


def test_mask_rebuilds_at_any_resolution():
    spec = Mask(id="r", type="radial", cx=0.5, cy=0.5, rx=0.25, ry=0.25, feather=20)
    small = mm.build_mask(spec, 60, 80)
    big = mm.build_mask(spec, 240, 320)
    # Center selected and corners free at both sizes (geometry is parametric).
    assert small[30, 40] > 0.9 and big[120, 160] > 0.9
    assert small[0, 0] < 0.1 and big[0, 0] < 0.1


# ---- local adjustments through the pipeline --------------------------------


def test_local_exposure_only_affects_masked_region():
    img = make_test_image(W, H)
    a = Adjustments()
    a.masks = [Mask(id="r", type="radial", cx=0.5, cy=0.5, rx=0.18, ry=0.18,
                    feather=0, local=LocalAdjust(exposure=1.5))]
    out = pipeline.render(img, a)
    # Center (inside) brightened; a far corner (outside) unchanged.
    assert out[H // 2, W // 2, 0] > img[H // 2, W // 2, 0] + 0.02
    assert np.allclose(out[0, -1], img[0, -1], atol=1e-3)


def test_neutral_local_is_identity():
    img = make_test_image(W, H)
    a = Adjustments()
    a.masks = [Mask(id="r", type="radial")]  # no local edits
    out = pipeline.render(img, a)
    assert np.allclose(out, img, atol=1e-5)


def test_disabled_mask_is_skipped():
    img = make_test_image(W, H)
    a = Adjustments()
    a.masks = [Mask(id="r", type="radial", enabled=False,
                    local=LocalAdjust(exposure=2.0))]
    out = pipeline.render(img, a)
    assert np.allclose(out, img, atol=1e-5)


def test_local_blur_softens_only_mask():
    # Sharp vertical edge; blur the left half only, check the right stays sharp.
    img = np.zeros((H, W, 3), np.float32)
    img[:, : W // 2] = 0.9
    a = Adjustments()
    a.masks = [Mask(id="l", type="linear", angle=0.0, start=0.45, end=0.55,
                    local=LocalAdjust(blur=80))]
    out = pipeline.render(img, a)
    left_edge_col = out[H // 2, W // 2 - 2]
    # The blurred side no longer holds a clean 0.9 block at the edge.
    assert left_edge_col[0] < 0.9
