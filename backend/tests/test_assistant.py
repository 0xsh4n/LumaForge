from app.imaging.assistant import suggest
from app.schemas import Adjustments


def test_rules_suggest_common_adjustments():
    result, summary, notes = suggest("brighter and warmer with teal shadows")
    assert result.light.exposure > 0
    assert result.color.temperature > 0
    assert result.grade.split_tone.shadow_hue == 190
    assert "teal" in summary
    assert notes


def test_rules_clamp_adjustments_to_schema_limits():
    current = Adjustments()
    current.light.exposure = 4.9
    result, _, _ = suggest("brighter", current)
    assert result.light.exposure == 5


def test_rules_preserve_unmentioned_edits():
    current = Adjustments()
    current.color.tint = 24
    result, _, _ = suggest("make it brighter", current)
    assert result.color.tint == 24
    assert result.light.exposure > 0
