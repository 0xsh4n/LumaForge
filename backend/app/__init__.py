"""LumaForge local processing backend.

A FastAPI service that performs all image analysis and pixel processing for the
LumaForge desktop app. It runs entirely on the user's machine; the Tauri shell
launches it as a local sidecar and talks to it over HTTP on 127.0.0.1.

Design principles
-----------------
* Non-destructive: the imported original is held in memory at full resolution
  and never mutated. Every adjustment is a parameter in an :class:`EditState`;
  rendering re-derives pixels from the original each time.
* One pipeline: interactive previews and final exports run through the exact
  same :mod:`app.imaging.pipeline`, only at different resolutions, so what you
  see is what you get.
* Classical first: Phase 1 ships real, well-understood image-processing math
  (NumPy + OpenCV). AI models are layered on in later phases behind the same
  pipeline interface.
"""

__version__ = "0.1.0"
