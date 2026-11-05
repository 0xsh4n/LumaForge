"""In-memory registry of imported .cube LUTs, referenced by id from a grade."""
from __future__ import annotations

import threading
import uuid


class LutStore:
    def __init__(self) -> None:
        self._luts: dict[str, dict] = {}
        self._lock = threading.Lock()

    def add(self, name: str, parsed: dict) -> dict:
        lid = uuid.uuid4().hex[:10]
        entry = {"id": lid, "name": name, **parsed}
        with self._lock:
            self._luts[lid] = entry
        return {"id": lid, "name": name, "dim": parsed["dim"], "size": parsed["size"]}

    def get(self, lid: str) -> dict | None:
        with self._lock:
            return self._luts.get(lid)

    def remove(self, lid: str) -> bool:
        with self._lock:
            return self._luts.pop(lid, None) is not None

    def list(self) -> list[dict]:
        with self._lock:
            return [
                {"id": e["id"], "name": e["name"], "dim": e["dim"], "size": e["size"]}
                for e in self._luts.values()
            ]


lut_store = LutStore()
