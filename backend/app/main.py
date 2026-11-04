"""LumaForge backend application factory and entry point.

Run directly for development::

    python -m app.main            # or: uvicorn app.main:app --port 8756

The Tauri shell launches this same module as a bundled sidecar in production.
"""
from __future__ import annotations

import argparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import get_settings
from .routers import images, process, projects, system


def create_app() -> FastAPI:
    app = FastAPI(
        title="LumaForge Backend",
        version=__version__,
        description="Local, offline image-processing service for LumaForge.",
    )

    # The webview (Tauri or the Vite dev server) runs on a different origin.
    # Only local/Tauri origins are permitted — the service binds to loopback.
    app.add_middleware(
        CORSMiddleware,
        # Local dev servers + the Tauri webview origins (tauri://localhost on
        # macOS/Linux, http(s)://tauri.localhost on Windows).
        allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1|tauri\.localhost)(:\d+)?|tauri://localhost)$",
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(system.router)
    app.include_router(images.router)
    app.include_router(process.router)
    app.include_router(projects.router)

    @app.get("/")
    def root() -> dict:
        return {"app": "LumaForge", "version": __version__, "status": "ok"}

    return app


app = create_app()


def main() -> None:
    import uvicorn

    settings = get_settings()
    parser = argparse.ArgumentParser(description="LumaForge backend")
    parser.add_argument("--host", default=settings.host)
    parser.add_argument("--port", type=int, default=settings.port)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    uvicorn.run(
        "app.main:app" if args.reload else app,
        host=args.host, port=args.port, reload=args.reload, log_level="info",
    )


if __name__ == "__main__":
    main()
