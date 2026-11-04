"""In-memory store of open images.

Holds each imported image's untouched full-resolution original (the single
source of truth for non-destructive editing) plus a cached preview-resolution
copy used for fast interactive rendering and analysis. Memory is bounded by
``settings.max_open_images`` with least-recently-used eviction so the app stays
within the 8 GB baseline target.
"""
from __future__ import annotations

import threading
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field

import numpy as np

from .config import get_settings
from .imaging import io as imgio


@dataclass
class ImageSession:
    id: str
    meta: dict
    original: np.ndarray            # float32 RGB [0,1], full resolution
    preview_base: np.ndarray        # float32 RGB [0,1], downscaled
    preview_scale: float            # preview_base long edge / original long edge
    exif_bytes: bytes | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    @property
    def original_long_edge(self) -> int:
        h, w = self.original.shape[:2]
        return max(h, w)


class ImageStore:
    def __init__(self) -> None:
        self._items: "OrderedDict[str, ImageSession]" = OrderedDict()
        self._lock = threading.Lock()
        self._settings = get_settings()

    def _evict_if_needed(self) -> None:
        while len(self._items) > self._settings.max_open_images:
            self._items.popitem(last=False)  # drop least-recently-used

    def add(self, img: np.ndarray, meta: dict, exif_bytes: bytes | None = None) -> ImageSession:
        sid = uuid.uuid4().hex[:12]
        preview_base, scale = imgio.downscale_to(img, self._settings.preview_max_dim)
        session = ImageSession(
            id=sid, meta={**meta, "id": sid}, original=img,
            preview_base=np.ascontiguousarray(preview_base),
            preview_scale=scale, exif_bytes=exif_bytes,
        )
        with self._lock:
            self._items[sid] = session
            self._items.move_to_end(sid)
            self._evict_if_needed()
        return session

    def get(self, sid: str) -> ImageSession | None:
        with self._lock:
            s = self._items.get(sid)
            if s is not None:
                self._items.move_to_end(sid)
            return s

    def remove(self, sid: str) -> bool:
        with self._lock:
            return self._items.pop(sid, None) is not None

    def list_ids(self) -> list[str]:
        with self._lock:
            return list(self._items.keys())


# Module-level singleton used by the routers.
store = ImageStore()
