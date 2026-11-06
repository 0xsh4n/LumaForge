from types import SimpleNamespace
import numpy as np
import cv2

from app.imaging import upscale as upscale_mod


class FakeSession:
    def get_inputs(self):
        return [SimpleNamespace(name="input")]

    def run(self, _outputs, feeds):
        x = feeds["input"][0].transpose(1, 2, 0)
        y = cv2.resize(x, (x.shape[1] * 4, x.shape[0] * 4), interpolation=cv2.INTER_NEAREST)
        return [y.transpose(2, 0, 1)[None]]


def test_tiled_upscale_stitches_to_expected_dimensions(monkeypatch):
    monkeypatch.setattr(upscale_mod.reg, "get", lambda _id: object())
    monkeypatch.setattr(upscale_mod.reg, "is_installed", lambda _spec: True)
    monkeypatch.setattr(upscale_mod.reg, "model_path", lambda _spec: "fake.onnx")
    monkeypatch.setattr(upscale_mod, "onnx_session", lambda _path: (FakeSession(), "CPUExecutionProvider"))
    img = np.random.default_rng(12).random((19, 23, 3), dtype=np.float32)
    result, provider = upscale_mod.upscale(img, 4, tile=8, margin=2)
    assert result.shape == (76, 92, 3)
    assert provider == "CPUExecutionProvider"
    assert np.isfinite(result).all()
