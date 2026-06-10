# Starts TubeVault for everyday use (desktop shortcut target).
# Idempotent: if the server already answers on port 3000, it only opens the
# browser. Otherwise it builds once (when no production build exists), starts
# `npm start` hidden in the background and waits for /api/health.
param([switch]$NoBrowser)

$root = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:3000"

function Test-Server {
    try {
        (Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200
    } catch {
        $false
    }
}

if (-not (Test-Server)) {
    if (-not (Test-Path (Join-Path $root ".next\BUILD_ID"))) {
        # First run on this machine: produce a production build (visible window
        # so the one-time wait is explainable).
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run build" -WorkingDirectory $root -Wait
    }
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm start" -WorkingDirectory $root -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds(90)
    while (-not (Test-Server) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
    }
}

if (-not $NoBrowser) {
    Start-Process $url
}
