# Idempotent - safe to run even when some/all of this is already up.
# Starts the local dev dependencies that `turbo run dev` (dashboard + worker)
# assumes are already running: Postgres, Redis, and the Inngest dev server.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root ".tools\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-PortOpen($port) {
    return [bool](Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $port })
}

# --- Postgres (5432) ---
if (Test-PortOpen 5432) {
    Write-Host "[infra] Postgres already running (5432)"
} else {
    Write-Host "[infra] Starting Postgres..."
    $pgService = Get-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
    if ($pgService) {
        Start-Service -Name "postgresql-x64-17"
        Start-Sleep -Seconds 2
        Write-Host "[infra] Postgres service started"
    } else {
        Write-Warning "[infra] Could not find/start the Postgres service automatically. Start Postgres yourself, then re-run."
    }
}

# --- Redis (6379) ---
if (Test-PortOpen 6379) {
    Write-Host "[infra] Redis already running (6379)"
} else {
    $redisExe = Join-Path $root ".tools\redis\redis-server.exe"
    if (Test-Path $redisExe) {
        Write-Host "[infra] Starting Redis..."
        Start-Process -FilePath $redisExe -ArgumentList "--port", "6379" `
            -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $logDir "redis.log") `
            -RedirectStandardError (Join-Path $logDir "redis.err.log")
        Start-Sleep -Seconds 1
        Write-Host "[infra] Redis started (logs: .tools\logs\redis.log)"
    } else {
        Write-Warning "[infra] Portable Redis not found at $redisExe - see scripts/install-redis.ps1 or install Redis another way."
    }
}

# --- Inngest dev server (8288) ---
if (Test-PortOpen 8288) {
    Write-Host "[infra] Inngest dev server already running (8288)"
} else {
    Write-Host "[infra] Starting Inngest dev server..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npx inngest-cli@latest dev -u http://localhost:3001/api/inngest" `
        -WindowStyle Hidden `
        -WorkingDirectory $root `
        -RedirectStandardOutput (Join-Path $logDir "inngest.log") `
        -RedirectStandardError (Join-Path $logDir "inngest.err.log")
    Start-Sleep -Seconds 3
    Write-Host "[infra] Inngest dev server started (logs: .tools\logs\inngest.log)"
}

Write-Host "[infra] Ready."
