"""Tests for the Color Grading Studio engine (Phase 2b)."""
from __future__ import annotations

import numpy as np

from app.imaging import grading, pipeline
from app.imaging.color import luminance
from app.schemas import Adjustments, Grade
from tests.test_pipeline import make_test_image

IDENTITY_CUBE = """
LUT_3D_SIZE 2
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
"""

INVERT_CUBE = """
LUT_3D_SIZE 2
1 1 1
0 1 1
1 0 1
0 0 1
1 1 0
0 1 0
1 0 0
0 0 0
"""


def test_grade_neutral_is_identity():
    img = make_test_image()
    out = grading.apply_grade(img, Grade())
    assert np.allclose(out, img, atol=1e-5)


def test_curves_brighten():
    img = make_test_image()
    g = Grade()
    g.curves.rgb = [[0.0, 0.0], [0.5, 0.7], [1.0, 1.0]]  # lift midtones
    out = grading.apply_curves(img, g.curves)
    assert out.mean() > img.mean() + 0.02


def test_curves_identity_noop():
    img = make_test_image()
    out = grading.apply_curves(img, Grade().curves)
    assert np.allclose(out, img, atol=1e-6)


def test_hsl_desaturates_target_band():
    img = make_test_image()  # has a red patch
    g = Grade()
    g.hsl.red.saturation = -100
    out = grading.apply_hsl(img, g.hsl)
    # Red patch region (top-left) should lose saturation.
    before = img[2:60, 2:60]
    after = out[2:60, 2:60]
    sat_before = (before.max(2) - before.min(2)).mean()
    sat_after = (after.max(2) - after.min(2)).mean()
    assert sat_after < sat_before


def test_color_balance_shadows_push():
    img = make_test_image()
    g = Grade()
    g.color_balance.shadows.b = 100  # push shadows blue
    out = grading.apply_color_balance(img, g.color_balance)
    # Dark areas should gain blue relative to red.
    L = luminance(img)
    dark = L < 0.3
    assert out[..., 2][dark].mean() > img[..., 2][dark].mean()


def test_split_tone_warms_highlights():
    img = make_test_image()
    g = Grade()
    g.split_tone.highlight_hue = 40  # orange
    g.split_tone.highlight_sat = 80
    out = grading.apply_split_tone(img, g.split_tone)
    L = luminance(img)
    bright = L > 0.7
    assert out[..., 0][bright].mean() >= img[..., 0][bright].mean()


def test_lut_identity_is_noop():
    img = make_test_image()
    lut = grading.parse_cube(IDENTITY_CUBE)
    out = grading.apply_lut(img, lut, 100)
    assert np.allclose(out, img, atol=0.02)


def test_lut_invert():
    img = make_test_image()
    lut = grading.parse_cube(INVERT_CUBE)
    out = grading.apply_lut(img, lut, 100)
    assert np.allclose(out, 1.0 - img, atol=0.03)


def test_lut_intensity_blend():
    img = make_test_image()
    lut = grading.parse_cube(INVERT_CUBE)
    half = grading.apply_lut(img, lut, 50)
    expected = img * 0.5 + (1 - img) * 0.5
    assert np.allclose(half, expected, atol=0.03)


def test_lut_bake_roundtrip():
    """Baking a colour look to a .cube then applying it ≈ the direct transform."""
    img = make_test_image()
    a = Adjustments()
    a.light.contrast = 30
    a.color.temperature = 25
    a.color.vibrance = 20
    a.grade.curves.rgb = [[0.0, 0.02], [0.5, 0.58], [1.0, 1.0]]

    direct = pipeline.render_color_only(img, a)

    size = 25
    lattice = grading.identity_lattice(size).reshape(-1, 1, 3)
    graded = pipeline.render_color_only(lattice, a).reshape(-1, 3)
    cube_text = grading.write_cube(graded, size)
    lut = grading.parse_cube(cube_text)
    via_lut = grading.apply_lut(img, lut, 100)

    assert np.allclose(direct, via_lut, atol=0.03)


def test_pipeline_with_grade_in_range():
    img = make_test_image()
    a = Adjustments()
    a.grade.curves.rgb = [[0, 0], [0.3, 0.5], [1, 1]]
    a.grade.hsl.blue.saturation = 60
    a.grade.color_balance.highlights.r = 40
    a.grade.split_tone.shadow_hue = 220
    a.grade.split_tone.shadow_sat = 40
    out = pipeline.render(img, a)
    assert out.min() >= 0 and out.max() <= 1
