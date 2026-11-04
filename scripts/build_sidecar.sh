#!/usr/bin/env bash
# Package the Python backend into a single executable and place it where Tauri
# expects the sidecar (named with the Rust target triple). Run on each OS you
# want to build LumaForge for — PyInstaller output is platform-specific.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/.venv/bin/python"

echo "==> Ensuring PyInstaller is installed"
"$PY" -m pip install --quiet pyinstaller

echo "==> Freezing backend with PyInstaller"
cd "$ROOT/backend"
"$PY" -m PyInstaller lumaforge-backend.spec --noconfirm --clean

TRIPLE="$(rustc -Vv | sed -n 's/^host: //p')"
DEST="$ROOT/desktop/src-tauri/binaries"
mkdir -p "$DEST"
cp "dist/lumaforge-backend" "$DEST/lumaforge-backend-$TRIPLE"
chmod +x "$DEST/lumaforge-backend-$TRIPLE"
echo "==> Sidecar ready: desktop/src-tauri/binaries/lumaforge-backend-$TRIPLE"
