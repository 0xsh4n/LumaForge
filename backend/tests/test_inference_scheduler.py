import time

import numpy as np

from app.imaging.inference import tiled_infer
from app.imaging.scheduler import Scheduler
from app.imaging.masks import build_mask
from app.schemas import Mask


def test_tiled_inference_reassembles_identity():
    image = np.arange(37 * 53, dtype=np.float32).reshape(37, 53, 1)
    result = tiled_infer(None, image, tile=16, overlap=4, run_fn=lambda _s, tile: tile)
    assert result.shape == image.shape
    np.testing.assert_allclose(result, image, atol=1e-3)


def test_scheduler_records_completion():
    queue = Scheduler()
    job_id = queue.submit(lambda job: setattr(job, "progress", 0.5))
    deadline = time.time() + 2
    while time.time() < deadline:
        status = queue.status(job_id)
        if status["state"] in {"done", "error"}:
            break
        time.sleep(0.01)
    assert status["state"] == "done"
    assert status["progress"] == 1.0


def test_missing_ai_matte_is_empty_even_when_inverted():
    mask = Mask(id="m", type="ai_subject", invert=True)
    result = build_mask(mask, 12, 17)
    assert result.shape == (12, 17)
    assert not result.any()
