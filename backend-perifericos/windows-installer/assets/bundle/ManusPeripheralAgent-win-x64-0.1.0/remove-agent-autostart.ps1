param(
  [string]$TaskName = "Manus Peripheral Agent"
)

$ErrorActionPreference = "Stop"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Autostart removed: $TaskName"
  exit 0
}

Write-Host "Autostart not installed: $TaskName"
