#!/usr/bin/env bash
# Start LumaForge in development.
#
#   ./scripts/dev.sh            backend + Vite dev server (opens in a browser at
#                               http://127.0.0.1:1420 — works on any OS)
#   ./scripts/dev.sh --native   backend + the native Tauri window
#                               (requires platform webview; WebView2 on Windows)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/.venv/bin/python"

echo "==> Starting backend on http://127.0.0.1:8756"
( cd "$ROOT/backend" && "$PY" -m app.main --host 127.0.0.1 --port 8756 --reload ) &
BACKEND_PID=$!

cleanup() { echo "stopping…"; kill "$BACKEND_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

cd "$ROOT/desktop"

if [[ "${1:-}" == "--native" ]]; then
  npm run tauri:dev
else
  echo "==> Starting Vite dev server on http://127.0.0.1:1420"
  npm run dev
fi
