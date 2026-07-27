# One-time setup - downloads a portable Redis-for-Windows build into
# .tools/redis (gitignored) since Redis has no official Windows build and
# this machine has no Docker/WSL. Re-run safely; it just re-downloads.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$redisDir = Join-Path $root ".tools\redis"
$zipPath = Join-Path $root ".tools\redis.zip"

New-Item -ItemType Directory -Force -Path $redisDir | Out-Null

Write-Host "[install-redis] Looking up latest tporadowski/redis release..."
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/tporadowski/redis/releases/latest" -UseBasicParsing
$asset = $release.assets | Where-Object { $_.name -match 'Redis-x64.*\.zip$' } | Select-Object -First 1
if (-not $asset) {
    throw "Could not find a Redis-x64 zip asset in the latest release."
}

Write-Host "[install-redis] Downloading $($asset.name)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -UseBasicParsing

Write-Host "[install-redis] Extracting..."
Expand-Archive -Path $zipPath -DestinationPath $redisDir -Force
Remove-Item $zipPath

Write-Host "[install-redis] Done - redis-server.exe is at $redisDir\redis-server.exe"
