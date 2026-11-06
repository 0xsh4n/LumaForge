# Start Lumetta in development (Windows PowerShell).
#
#   .\scripts\dev.ps1            backend + native Tauri window (WebView2)
#   .\scripts\dev.ps1 -Browser   backend + Vite dev server at http://127.0.0.1:1420
param([switch]$Browser)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Py = "$Root\.venv\Scripts\python.exe"

Write-Host "==> Starting backend on http://127.0.0.1:8756"
$backend = Start-Process -FilePath $Py `
  -ArgumentList "-m", "app.main", "--host", "127.0.0.1", "--port", "8756", "--reload" `
  -WorkingDirectory "$Root\backend" -PassThru -NoNewWindow

try {
  Set-Location "$Root\desktop"
  if ($Browser) { npm run dev } else { npm run tauri:dev }
}
finally {
  if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
