# One-time setup for Lumetta (Windows PowerShell).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Venv = Join-Path $Root ".venv"
$Py = Join-Path $Venv "Scripts\python.exe"

if (-not (Test-Path $Py)) {
  $Launcher = Get-Command py.exe -ErrorAction SilentlyContinue
  if ($Launcher) {
    Write-Host "==> Creating Python virtual environment (.venv)"
    & $Launcher.Source -3 -m venv $Venv
  } else {
    $Python = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $Python) { throw "Python was not found. Install Python 3.10 or newer, then rerun .\scripts\setup.ps1." }
    Write-Host "==> Creating Python virtual environment (.venv)"
    & $Python.Source -m venv $Venv
  }
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Py)) { throw "Could not create the Python environment at $Venv." }
}

Write-Host "==> Installing backend dependencies"
& $Py -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Could not upgrade pip in .venv." }
& $Py -m pip install -r (Join-Path $Root "backend\requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Backend dependencies failed to install. Review the pip output above." }

$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $Npm -and (Test-Path "C:\Program Files\nodejs\npm.cmd")) {
  $NpmPath = "C:\Program Files\nodejs\npm.cmd"
} elseif ($Npm) {
  $NpmPath = $Npm.Source
} else {
  throw "npm was not found. Install Node.js 18 or newer, then rerun .\scripts\setup.ps1."
}

Write-Host "==> Installing frontend dependencies"
Push-Location (Join-Path $Root "desktop")
try { & $NpmPath ci; if ($LASTEXITCODE -ne 0) { throw "Frontend dependencies failed to install." } }
finally { Pop-Location }

Write-Host ""
Write-Host "Setup complete. Start development with .\scripts\dev.ps1 -Browser"
