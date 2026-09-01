param(
  [string]$TaskName = "Manus Peripheral Agent"
)

$ErrorActionPreference = "Stop"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host "registered: missing"
  Write-Host "running: false"
  Write-Host "lastResult: n/a"
  exit 1
}

$taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
$running = [bool]($taskInfo.State -eq "Running")
$lastResult = if ($null -ne $taskInfo.LastTaskResult) { "0x{0:X8}" -f ($taskInfo.LastTaskResult -band 0xFFFFFFFF) } else { "n/a" }

Write-Host "registered: present"
Write-Host ("running: " + $running)
Write-Host ("lastResult: " + $lastResult)
