"""Runtime configuration for the Lumetta backend.

Values can be overridden with ``LUMETTA_*`` environment variables, which is
how the Tauri shell passes a chosen port / data directory to the sidecar.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> Path:
    """Per-user data directory for models, cache and projects."""
    env = os.environ.get("LUMETTA_DATA_DIR")
    if env:
        return Path(env)
    home = Path.home()
    if os.name == "nt":  # Windows
        base = Path(os.environ.get("APPDATA", home / "AppData" / "Roaming"))
        return base / "Lumetta"
    if os.sys.platform == "darwin":  # macOS
        return home / "Library" / "Application Support" / "Lumetta"
    return Path(os.environ.get("XDG_DATA_HOME", home / ".local" / "share")) / "Lumetta"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LUMETTA_", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 8756

    # Longest edge (px) of the cached preview copy and the ceiling for
    # interactive renders. 1600 px fills a typical editor viewport while keeping
    # slider feedback fast on modest hardware; exports always use full
    # resolution. The frontend may request a smaller size while a slider is
    # actively being dragged.
    preview_max_dim: int = 1600

    # Hard cap on how many originals we keep decoded in RAM at once. Targets the
    # 8 GB baseline machine from the spec. Oldest sessions are evicted first.
    max_open_images: int = 6

    data_dir: Path = Field(default_factory=_default_data_dir)

    @property
    def models_dir(self) -> Path:
        return self.data_dir / "models"

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.models_dir, self.cache_dir, self.projects_dir):
            d.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s
