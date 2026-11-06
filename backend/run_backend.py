"""Frozen entry point for the bundled sidecar executable.

PyInstaller packages this file into ``lumetta-backend`` (see
``lumetta-backend.spec``). The Tauri shell launches the resulting binary with
``--host 127.0.0.1 --port 8756``.
"""
from app.main import main

if __name__ == "__main__":
    main()
