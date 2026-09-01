param(
  [int]$DelaySeconds = 15,
  [int]$HealthTimeoutSeconds = 30,
  [int]$PollIntervalSeconds = 1
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeExe = Join-Path $scriptRoot "runtime\node.exe"
$entryPoint = Join-Path $scriptRoot "app\main.js"
$configPath = $env:PERIPHERALS_CONFIG_PATH
if (-not $configPath) {
  $configPath = Join-Path $scriptRoot "config\agent.config.local.json"
}
$defaultVersion = "0.1.0"
$healthUrl = "http://127.0.0.1:4050/health"
function Resolve-WritableDirectory {
  param(
    [string]$PrimaryDirectory,
    [string]$FallbackLeaf
  )
  $fallbackDirectory = Join-Path ([System.IO.Path]::GetTempPath()) $FallbackLeaf
  foreach ($candidateDirectory in @($PrimaryDirectory, $fallbackDirectory)) {
    try {
      New-Item -ItemType Directory -Path $candidateDirectory -Force | Out-Null
      $probePath = Join-Path $candidateDirectory ".write-test"
      $probeStream = [System.IO.File]::Open($probePath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
      $probeStream.Close()
      Remove-Item -Path $probePath -Force -ErrorAction SilentlyContinue
      return $candidateDirectory
    } catch {
    }
  }
  return $fallbackDirectory
}
$logDir = Resolve-WritableDirectory -PrimaryDirectory (Join-Path $env:LOCALAPPDATA "Manus\PeripheralAgent\logs") -FallbackLeaf "Manus\PeripheralAgent\logs"
$stateDir = Resolve-WritableDirectory -PrimaryDirectory (Join-Path $env:LOCALAPPDATA "Manus\PeripheralAgent\state") -FallbackLeaf "Manus\PeripheralAgent\state"
$logFile = Join-Path $logDir "autostart.log"
$stdoutLog = Join-Path $logDir "agent-autostart.stdout.log"
$stderrLog = Join-Path $logDir "agent-autostart.stderr.log"
function Write-AutostartLog {
  param([string]$Message)
  $line = "{0} {1}" -f (Get-Date).ToString("o"), $Message
  try {
    Add-Content -Path $logFile -Value $line -ErrorAction Stop
  } catch {
    Write-Host $line
  }
}

function Test-AgentHealth {
  try {
    $health = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    return $health.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-PortBusy {
  try {
    $connection = Get-NetTCPConnection -LocalPort 4050 -ErrorAction Stop | Where-Object { $_.State -eq "Listen" } | Select-Object -First 1
    return $null -ne $connection
  } catch {
    return $false
  }
}

if (-not (Test-Path $nodeExe)) {
  Write-AutostartLog "missing node.exe"
  Write-Host "Autostart health check: FAIL"
  exit 1
}
if (-not (Test-Path $entryPoint)) {
  Write-AutostartLog "missing app/main.js"
  Write-Host "Autostart health check: FAIL"
  exit 1
}
if (-not (Test-Path $configPath)) {
  Write-AutostartLog "missing config/agent.config.local.json"
  Write-Host "Autostart health check: FAIL"
  exit 1
}

function Get-LastLogLines {
  param(
    [string]$Path,
    [int]$Count = 20
  )
  if (-not (Test-Path $Path)) {
    return @()
  }
  return Get-Content -Path $Path -Tail $Count -ErrorAction SilentlyContinue
}

Write-AutostartLog "startup requested"
Write-AutostartLog ("executable={0}" -f $nodeExe)
Write-AutostartLog ("entryPoint={0}" -f $entryPoint)
Write-AutostartLog ("configPath={0}" -f $configPath)
if (-not $env:PERIPHERALS_VERSION) {
  $env:PERIPHERALS_VERSION = $defaultVersion
}
# PowerShell 5.1 compatibility: set the env var before process start so the child inherits it.

Start-Sleep -Seconds $DelaySeconds

if (Test-AgentHealth) {
  Write-AutostartLog "health PASS"
  Write-Host "Autostart health check: PASS"
  exit 0
}

$startupWaitDeadline = (Get-Date).AddSeconds(5)
while ((Get-Date) -lt $startupWaitDeadline -and (Test-PortBusy)) {
  if (Test-AgentHealth) {
    Write-AutostartLog "health PASS"
    Write-Host "Autostart health check: PASS"
    exit 0
  }
  Start-Sleep -Seconds 1
}

if (Test-PortBusy -and -not (Test-AgentHealth)) {
  Write-AutostartLog "health FAIL port busy"
  Write-Host "Autostart health check: FAIL"
  exit 1
}

if (-not $env:PERIPHERALS_CONFIG_PATH) {
  $env:PERIPHERALS_CONFIG_PATH = $configPath
}
$quotedEntryPoint = '"' + $entryPoint + '"'
$process = $null
try {
  $process = Start-Process -FilePath $nodeExe -ArgumentList $quotedEntryPoint -WorkingDirectory $scriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
  Write-AutostartLog ("started pid={0}" -f $process.Id)
} catch {
  Write-AutostartLog ("start failed: {0}" -f $_.Exception.Message)
  Write-Host "Autostart health check: FAIL"
  exit 1
}

$deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  $process.Refresh()
  if ($process.HasExited) {
    $stderrTail = Get-LastLogLines -Path $stderrLog -Count 20
    if ($stderrTail.Count -gt 0) {
      Write-AutostartLog ("stderr tail: {0}" -f ($stderrTail -join " | "))
    }
    Write-AutostartLog ("process exited early exitCode={0}" -f $process.ExitCode)
    Write-Host "Autostart health check: FAIL"
    exit 1
  }

  if (Test-AgentHealth) {
    Write-AutostartLog "health PASS"
    Write-Host "Autostart health check: PASS"
    exit 0
  }

  Start-Sleep -Seconds $PollIntervalSeconds
}

if (-not $process.HasExited) {
  try {
    Stop-Process -Id $process.Id -Force
    Write-AutostartLog ("timeout killed pid={0}" -f $process.Id)
  } catch {
    Write-AutostartLog ("timeout stop failed: {0}" -f $_.Exception.Message)
  }
}

Write-AutostartLog "health TIMEOUT"
Write-Host "Autostart health check: FAIL"
exit 1
