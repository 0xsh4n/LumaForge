# Package the Python backend into a single .exe and place it where Tauri expects
# the sidecar (named with the Rust target triple). Run on Windows to produce the
# Windows sidecar. (Windows PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Py = "$Root\.venv\Scripts\python.exe"

Write-Host "==> Ensuring PyInstaller is installed"
& $Py -m pip install --quiet pyinstaller

Write-Host "==> Freezing backend with PyInstaller"
Set-Location "$Root\backend"
& $Py -m PyInstaller lumetta-backend.spec --noconfirm --clean

$Triple = (& rustc -Vv | Select-String '^host: ').ToString().Replace('host: ', '').Trim()
$Dest = "$Root\desktop\src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item "dist\lumetta-backend.exe" "$Dest\lumetta-backend-$Triple.exe" -Force
Write-Host "==> Sidecar ready: desktop\src-tauri\binaries\lumetta-backend-$Triple.exe"
