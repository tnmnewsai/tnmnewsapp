# Stops the background infra processes started by start-infra.ps1
# (Redis, Inngest dev server). Leaves Postgres running since it's a
# Windows service, not something this dev stack owns starting/stopping.
$ErrorActionPreference = "SilentlyContinue"

Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match 'redis-server\.exe' -or $_.CommandLine -match 'inngest-cli'
} | ForEach-Object {
    Write-Host "[stop-infra] Stopping PID $($_.ProcessId): $($_.CommandLine)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "[stop-infra] Done. Postgres service left running - stop it yourself if you want it down too."
