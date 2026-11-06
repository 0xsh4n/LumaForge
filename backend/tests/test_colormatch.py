"""Tests for AI Color Match (Phase 7 §23) — classical grading recommendations."""
from __future__ import annotations

import numpy as np

from app.imaging import colormatch as cm
from app.imaging import pipeline
from app.schemas import Adjustments, ColorMatchResult
from tests.test_pipeline import make_test_image


def test_returns_cards_and_scene():
    img = make_test_image()
    out = cm.color_match(img)
    # Validates against the response schema (adjustments are real Adjustments).
    parsed = ColorMatchResult(**out)
    assert len(parsed.cards) == 6
    ids = [c.id for c in parsed.cards]
    assert ids[0] == "natural" and "mono" in ids
    assert set(out["scene"]) == {"brightness", "cast", "saturation", "skin", "mood"}


def test_every_card_renders_in_range():
    img = make_test_image()
    for card in cm.color_match(img)["cards"]:
        out = pipeline.render(img, card["adjustments"])
        assert out.shape == img.shape
        assert out.min() >= 0.0 and out.max() <= 1.0


def test_cards_are_distinct_looks():
    img = make_test_image()
    cards = {c["id"]: c for c in cm.color_match(img)["cards"]}
    base = pipeline.render(img, Adjustments())
    warm = pipeline.render(img, cards["warm_cinematic"]["adjustments"])
    cool = pipeline.render(img, cards["cool_editorial"]["adjustments"])
    # Warm look pushes red over blue vs. the cool look.
    warm_rb = warm[..., 0].mean() - warm[..., 2].mean()
    cool_rb = cool[..., 0].mean() - cool[..., 2].mean()
    assert warm_rb > cool_rb
    # Both differ from the untouched render.
    assert not np.allclose(warm, base, atol=1e-3)
    assert not np.allclose(cool, base, atol=1e-3)


def test_mono_is_desaturated():
    img = make_test_image()
    mono = next(c for c in cm.color_match(img)["cards"] if c["id"] == "mono")
    out = pipeline.render(img, mono["adjustments"])
    # Channels should be nearly equal (grayscale) across the frame.
    spread = np.abs(out[..., 0] - out[..., 1]).mean() + np.abs(out[..., 1] - out[..., 2]).mean()
    assert spread < 0.02


def test_skin_protection_tempers_saturation():
    # A mostly-skin-toned frame should get gentler saturation than a neutral one.
    skin = np.full((120, 160, 3), [0.80, 0.60, 0.52], np.float32)
    neutralimg = np.full((120, 160, 3), [0.5, 0.5, 0.5], np.float32)
    s_skin = next(c for c in cm.color_match(skin)["cards"] if c["id"] == "vibrant_pop")
    s_neutral = next(c for c in cm.color_match(neutralimg)["cards"] if c["id"] == "vibrant_pop")
    assert s_skin["adjustments"].color.vibrance < s_neutral["adjustments"].color.vibrance
    assert cm.color_match(skin)["scene"]["skin"] is True
