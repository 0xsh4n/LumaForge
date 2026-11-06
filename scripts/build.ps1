# Build the full Lumetta desktop app (Windows PowerShell):
#   1. freeze the Python backend into the sidecar .exe
#   2. build the frontend + native Tauri bundle (.msi / NSIS .exe installer)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

& "$Root\scripts\build_sidecar.ps1"

Write-Host "==> Building native app bundle with Tauri"
Set-Location "$Root\desktop"
npm run tauri:build

Write-Host ""
Write-Host "Done. Installers are in desktop\src-tauri\target\release\bundle\"
