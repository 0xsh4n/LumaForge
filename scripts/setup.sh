#!/usr/bin/env bash
# One-time setup for Lumetta (Linux / macOS).
# Creates the Python venv, installs backend deps, and installs frontend deps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Creating Python virtual environment (.venv)"
python3 -m venv "$ROOT/.venv"
PY="$ROOT/.venv/bin/python"

echo "==> Installing backend dependencies"
"$PY" -m pip install --upgrade pip
"$PY" -m pip install -r "$ROOT/backend/requirements.txt"

echo "==> (Optional) RAW + HEIC support: $PY -m pip install rawpy pillow-heif"

echo "==> Installing frontend dependencies"
cd "$ROOT/desktop"
npm install

echo ""
echo "Setup complete."
echo "  Start development:   ./scripts/dev.sh"
echo "  Build the app:       ./scripts/build.sh"
