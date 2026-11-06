# One-time setup for Lumetta (Windows PowerShell).
# Creates the Python venv, installs backend deps, and installs frontend deps.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Creating Python virtual environment (.venv)"
python -m venv "$Root\.venv"
$Py = "$Root\.venv\Scripts\python.exe"

Write-Host "==> Installing backend dependencies"
& $Py -m pip install --upgrade pip
& $Py -m pip install -r "$Root\backend\requirements.txt"

Write-Host "==> (Optional) RAW + HEIC support: $Py -m pip install rawpy pillow-heif"

Write-Host "==> Installing frontend dependencies"
Set-Location "$Root\desktop"
npm install

Write-Host ""
Write-Host "Setup complete."
Write-Host "  Start development:   .\scripts\dev.ps1"
Write-Host "  Build the app:       .\scripts\build.ps1"
