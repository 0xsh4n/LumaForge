"""Deterministic, transparent editing suggestions available without a local VLM."""
from __future__ import annotations

from ..schemas import Adjustments


def suggest(text: str, current: Adjustments | None = None) -> tuple[Adjustments, str, list[str]]:
    request = text.casefold()
    result = current.model_copy(deep=True) if current else Adjustments()
    changes: list[str] = []
    if any(word in request for word in ("brighter", "brighten", "lighter")):
        result.light.exposure = min(5, result.light.exposure + 0.45)
        changes.append("increase exposure")
    if any(word in request for word in ("darker", "darken")):
        result.light.exposure = max(-5, result.light.exposure - 0.45)
        changes.append("lower exposure")
    if any(word in request for word in ("warm", "warmer")):
        result.color.temperature = min(100, result.color.temperature + 18)
        changes.append("warm the white balance")
    if any(word in request for word in ("cooler", "cool")):
        result.color.temperature = max(-100, result.color.temperature - 18)
        changes.append("cool the white balance")
    if "contrast" in request:
        result.light.contrast = min(100, result.light.contrast + 15)
        changes.append("increase contrast")
    if any(word in request for word in ("black and white", "black-and-white", "monochrome")):
        result.color.saturation = -100
        changes.append("convert to black and white")
    if "vintage" in request:
        result.color.saturation = max(-100, result.color.saturation - 18)
        result.grade.split_tone.shadow_hue = 32
        result.grade.split_tone.shadow_sat = 13
        result.grade.split_tone.highlight_hue = 42
        result.grade.split_tone.highlight_sat = 9
        changes.append("apply a subtle warm vintage grade")
    if "teal" in request and ("shadow" in request or "color" in request or "colour" in request):
        result.grade.split_tone.shadow_hue = 190
        result.grade.split_tone.shadow_sat = 18
        changes.append("add teal to the shadows")
    if any(word in request for word in ("background blur", "blur the background", "bokeh")):
        result.depth.enabled = True
        result.depth.aperture = min(result.depth.aperture, 2.8)
        changes.append("enable depth-based background blur")
    result = Adjustments.model_validate(result.model_dump())
    summary = "Suggested: " + ", ".join(changes) + "." if changes else "No supported edit was found. Try brighter, warmer, more contrast, vintage, black and white, or background blur."
    notes = ["Suggestions are rule-based and editable. Review them before applying."]
    if result.depth.enabled and "background blur" in summary:
        notes.append("Depth Anything V2 must be installed for depth-based blur to render.")
    return result, summary, notes
