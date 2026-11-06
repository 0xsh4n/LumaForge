#!/usr/bin/env bash
# Build the full Lumetta desktop app (Linux / macOS):
#   1. freeze the Python backend into the sidecar
#   2. build the frontend + native Tauri bundle (installer / package)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT/scripts/build_sidecar.sh"

echo "==> Building native app bundle with Tauri"
cd "$ROOT/desktop"
npm run tauri:build

echo ""
echo "Done. Installers/bundles are in desktop/src-tauri/target/release/bundle/"
