# Start Lumetta for local development (Windows PowerShell).
#   .\scripts\dev.ps1            backend + native Tauri window
#   .\scripts\dev.ps1 -Browser   backend + Vite at http://127.0.0.1:1420
param([switch]$Browser)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Py = Join-Path $Root ".venv\Scripts\python.exe"
$NodeModules = Join-Path $Root "desktop\node_modules"
$Backend = $null
$OutLog = Join-Path $env:TEMP "lumetta-dev-backend.out.log"
$ErrLog = Join-Path $env:TEMP "lumetta-dev-backend.err.log"

$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $Npm -and (Test-Path "C:\Program Files\nodejs\npm.cmd")) {
  $NpmPath = "C:\Program Files\nodejs\npm.cmd"
} elseif ($Npm) {
  $NpmPath = $Npm.Source
} else {
  throw "npm was not found. Install Node.js 18 or newer and run .\scripts\setup.ps1."
}
$env:PATH = "$(Split-Path -Parent $NpmPath);$env:PATH"

if (-not (Test-Path $Py) -or -not (Test-Path $NodeModules)) {
  Write-Host "==> Development dependencies are missing; running setup"
  & (Join-Path $PSScriptRoot "setup.ps1")
}
if (-not (Test-Path $Py)) { throw "Python environment is missing at $Py. Run .\scripts\setup.ps1." }
if (-not (Test-Path $NodeModules)) { throw "Frontend dependencies are missing. Run .\scripts\setup.ps1." }

Remove-Item -LiteralPath $OutLog, $ErrLog -Force -ErrorAction SilentlyContinue
$VersionText = Get-Content -LiteralPath (Join-Path $Root "backend\app\__init__.py") -Raw
if ($VersionText -notmatch '__version__\s*=\s*"([^"]+)"') { throw "Could not read Lumetta's backend version." }
$ExpectedVersion = $Matches[1]
$ExistingBackend = $null
try { $ExistingBackend = Invoke-RestMethod -Uri "http://127.0.0.1:8756/api/system/health" -TimeoutSec 2 } catch { }
if ($ExistingBackend -and $ExistingBackend.version -ne $ExpectedVersion) {
  throw "An older Lumetta backend (v$($ExistingBackend.version)) is already using port 8756; this checkout is v$ExpectedVersion. Close the old backend and rerun dev.ps1."
}
$FrontendPort = Get-NetTCPConnection -LocalPort 1420 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($FrontendPort) { throw "Port 1420 is already used by PID $($FrontendPort.OwningProcess). Close the existing Vite/Tauri dev session and rerun dev.ps1." }
if (-not $ExistingBackend) {
  $BackendPort = Get-NetTCPConnection -LocalPort 8756 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($BackendPort) { throw "Port 8756 is already used by PID $($BackendPort.OwningProcess). Stop that process and rerun dev.ps1." }
  Write-Host "==> Starting backend on http://127.0.0.1:8756"
  $Backend = Start-Process -FilePath $Py `
    -ArgumentList @("-m", "app.main", "--host", "127.0.0.1", "--port", "8756", "--reload") `
    -WorkingDirectory (Join-Path $Root "backend") `
    -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog `
    -WindowStyle Hidden -PassThru
} else {
  Write-Host "==> Reusing Lumetta backend v$ExpectedVersion on port 8756"
}


try {
  $Ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    if ($Backend -and $Backend.HasExited) { break }
    try {
      $Health = Invoke-RestMethod -Uri "http://127.0.0.1:8756/api/system/health" -TimeoutSec 2
      if ($Health.status -eq "ok" -and $Health.version -eq $ExpectedVersion) { $Ready = $true; break }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $Ready) {
    Write-Host "Backend did not become ready. Backend output follows:" -ForegroundColor Red
    if (Test-Path $OutLog) { Get-Content -LiteralPath $OutLog -Tail 60 }
    if (Test-Path $ErrLog) { Get-Content -LiteralPath $ErrLog -Tail 60 }
    throw "Backend startup failed. Fix the reported error, then rerun this script."
  }
  Write-Host "==> Backend is ready (Lumetta $($Health.version))"

  Push-Location (Join-Path $Root "desktop")
  try {
    if ($Browser) {
      & $NpmPath run dev -- --host 127.0.0.1
    } else {
      & $NpmPath run tauri:dev
    }
    if ($LASTEXITCODE -ne 0) { throw "Frontend or Tauri development server exited with code $LASTEXITCODE." }
  } finally { Pop-Location }
} finally {
  if ($Backend -and -not $Backend.HasExited) {
    # Stop the reloader and its worker together.
    & taskkill.exe /PID $Backend.Id /T /F 2>$null | Out-Null
  }
}
