"""Tests for lens corrections and the RAW develop pipeline (Phase 2c).

The RAW decode test runs only when a sample RAW file is available (its path in
the LUMAFORGE_TEST_RAW environment variable), since RAW files are too large to
commit. The lens-correction tests always run on synthetic images.
"""
from __future__ import annotations

import os

import numpy as np
import pytest

from app.imaging import adjustments as adj
from app.schemas import Adjustments
from app.imaging import pipeline
from tests.test_pipeline import make_test_image


def test_defringe_in_range_and_touches_edges():
    img = make_test_image()
    out = adj.apply_defringe(img, 100)
    assert out.min() >= 0 and out.max() <= 1
    # Flat interior of a colour patch keeps its saturation.
    flat_in = img[2:18, 2:18]
    flat_out = out[2:18, 2:18]
    assert np.allclose(flat_in, flat_out, atol=0.02)


def test_distortion_changes_geometry_but_stays_valid():
    img = make_test_image()
    out = adj.apply_distortion(img, 60)
    assert out.shape == img.shape
    assert out.min() >= 0 and out.max() <= 1
    assert not np.allclose(out, img)


def test_distortion_zero_is_identity():
    img = make_test_image()
    assert np.allclose(adj.apply_distortion(img, 0), img)


def test_lens_corrections_in_pipeline():
    img = make_test_image()
    a = Adjustments()
    a.effects.defringe = 60
    a.effects.distortion = -40
    out = pipeline.render(img, a)
    assert out.min() >= 0 and out.max() <= 1


# ----------------------------- RAW decode --------------------------------

RAW_SAMPLE = os.environ.get("LUMAFORGE_TEST_RAW")


@pytest.mark.skipif(not RAW_SAMPLE or not os.path.exists(RAW_SAMPLE),
                    reason="no sample RAW file (set LUMAFORGE_TEST_RAW)")
def test_develop_raw_variants():
    from app.imaging import raw as rawdev
    from app.schemas import RawParams

    assert rawdev.RAW_AVAILABLE
    img, meta = rawdev.develop_raw(RAW_SAMPLE, RawParams())
    assert img.dtype == np.float32 and img.ndim == 3
    assert 0.0 <= img.min() and img.max() <= 1.0
    assert meta["is_raw"] and meta["bit_depth"] == 16

    # A positive exposure stop brightens the developed image.
    bright, _ = rawdev.develop_raw(RAW_SAMPLE, RawParams(exposure=1.0))
    assert bright.mean() > img.mean()

    # Different demosaic algorithm still decodes to the same dimensions.
    vng, _ = rawdev.develop_raw(RAW_SAMPLE, RawParams(demosaic="VNG"))
    assert vng.shape == img.shape
