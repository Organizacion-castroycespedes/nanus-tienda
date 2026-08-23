import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const artifactName = `ManusPeripheralAgent-win-x64-${packageJson.version}`;
const artifactRoot = join(projectRoot, "dist-package", "windows-x64", artifactName);
const stagingRoot = mkdtempSync(join(tmpdir(), "manus-peripheral-agent-runtime-"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const parseAllowedOrigins = (value) =>
  (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error("Windows x64 packaging must run on a Windows x64 build host.");
}

if (!existsSync(join(projectRoot, "dist", "main.js"))) {
  throw new Error("Missing dist/main.js. Run npm run build before packaging.");
}

const writeText = (relativePath, text) => {
  const destination = join(artifactRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text, "utf8");
};

const taskName = "Manus Peripheral Agent";
const writeAutostartScripts = () => {
  const ps = (lines) => `${lines.join("\r\n")}\r\n`;
  writeText(
    "start-agent-autostart.ps1",
    ps([
      'param(',
      '  [int]$DelaySeconds = 15,',
      '  [int]$HealthTimeoutSeconds = 30,',
      '  [int]$PollIntervalSeconds = 1',
      ')',
      "",
      '$ErrorActionPreference = "Stop"',
      '$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path',
      '$nodeExe = Join-Path $scriptRoot "runtime\\node.exe"',
      '$entryPoint = Join-Path $scriptRoot "app\\main.js"',
      '$configPath = Join-Path $scriptRoot "config\\agent.config.local.json"',
      '$healthUrl = "http://127.0.0.1:4050/health"',
      'function Resolve-WritableDirectory {',
      '  param(',
      '    [string]$PrimaryDirectory,',
      '    [string]$FallbackLeaf',
      '  )',
      '  $fallbackDirectory = Join-Path ([System.IO.Path]::GetTempPath()) $FallbackLeaf',
      '  foreach ($candidateDirectory in @($PrimaryDirectory, $fallbackDirectory)) {',
      '    try {',
      '      New-Item -ItemType Directory -Path $candidateDirectory -Force | Out-Null',
      '      $probePath = Join-Path $candidateDirectory ".write-test"',
      '      $probeStream = [System.IO.File]::Open($probePath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)',
      '      $probeStream.Close()',
      '      Remove-Item -Path $probePath -Force -ErrorAction SilentlyContinue',
      '      return $candidateDirectory',
      '    } catch {',
      '    }',
      '  }',
      '  return $fallbackDirectory',
      '}',
      '$logDir = Resolve-WritableDirectory -PrimaryDirectory (Join-Path $env:LOCALAPPDATA "Manus\\PeripheralAgent\\logs") -FallbackLeaf "Manus\\PeripheralAgent\\logs"',
      '$stateDir = Resolve-WritableDirectory -PrimaryDirectory (Join-Path $env:LOCALAPPDATA "Manus\\PeripheralAgent\\state") -FallbackLeaf "Manus\\PeripheralAgent\\state"',
      '$logFile = Join-Path $logDir "autostart.log"',
      '$stdoutLog = Join-Path $logDir "agent-autostart.stdout.log"',
      '$stderrLog = Join-Path $logDir "agent-autostart.stderr.log"',
      'function Write-AutostartLog {',
      '  param([string]$Message)',
      '  $line = "{0} {1}" -f (Get-Date).ToString("o"), $Message',
      '  try {',
      '    Add-Content -Path $logFile -Value $line -ErrorAction Stop',
      '  } catch {',
      '    Write-Host $line',
      '  }',
      '}',
      "",
      'function Test-AgentHealth {',
      '  try {',
      '    $health = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop',
      '    return $health.StatusCode -eq 200',
      '  } catch {',
      '    return $false',
      '  }',
      '}',
      "",
      'function Test-PortBusy {',
      '  try {',
      '    $connection = Get-NetTCPConnection -LocalPort 4050 -ErrorAction Stop | Where-Object { $_.State -eq "Listen" } | Select-Object -First 1',
      '    return $null -ne $connection',
      '  } catch {',
      '    return $false',
      '  }',
      '}',
      "",
      'if (-not (Test-Path $nodeExe)) {',
      '  Write-AutostartLog "missing node.exe"',
      '  Write-Host "Autostart health check: FAIL"',
      '  exit 1',
      '}',
      'if (-not (Test-Path $entryPoint)) {',
      '  Write-AutostartLog "missing app/main.js"',
      '  Write-Host "Autostart health check: FAIL"',
      '  exit 1',
      '}',
      'if (-not (Test-Path $configPath)) {',
      '  Write-AutostartLog "missing config/agent.config.local.json"',
      '  Write-Host "Autostart health check: FAIL"',
      '  exit 1',
      '}',
      "",
      'function Get-LastLogLines {',
      '  param(',
      '    [string]$Path,',
      '    [int]$Count = 20',
      '  )',
      '  if (-not (Test-Path $Path)) {',
      '    return @()',
      '  }',
      '  return Get-Content -Path $Path -Tail $Count -ErrorAction SilentlyContinue',
      '}',
      "",
      'Write-AutostartLog "startup requested"',
      'Write-AutostartLog ("executable={0}" -f $nodeExe)',
      'Write-AutostartLog ("entryPoint={0}" -f $entryPoint)',
      'Write-AutostartLog ("configPath={0}" -f $configPath)',
      '# PowerShell 5.1 compatibility: set the env var before process start so the child inherits it.',
      "",
      'Start-Sleep -Seconds $DelaySeconds',
      "",
      'if (Test-AgentHealth) {',
      '  Write-AutostartLog "health PASS"',
      '  Write-Host "Autostart health check: PASS"',
      '  exit 0',
      '}',
      "",
      '$startupWaitDeadline = (Get-Date).AddSeconds(5)',
      'while ((Get-Date) -lt $startupWaitDeadline -and (Test-PortBusy)) {',
      '  if (Test-AgentHealth) {',
      '    Write-AutostartLog "health PASS"',
      '    Write-Host "Autostart health check: PASS"',
      '    exit 0',
      '  }',
      '  Start-Sleep -Seconds 1',
      '}',
      "",
      'if (Test-PortBusy -and -not (Test-AgentHealth)) {',
      '  Write-AutostartLog "health FAIL port busy"',
      '  Write-Host "Autostart health check: FAIL"',
      '  exit 1',
      '}',
      "",
      '$env:PERIPHERALS_CONFIG_PATH = $configPath',
      '$quotedEntryPoint = \'"\' + $entryPoint + \'"\'',
      '$process = $null',
      'try {',
      '  $process = Start-Process -FilePath $nodeExe -ArgumentList $quotedEntryPoint -WorkingDirectory $scriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog',
      '  Write-AutostartLog ("started pid={0}" -f $process.Id)',
      '} catch {',
      '  Write-AutostartLog ("start failed: {0}" -f $_.Exception.Message)',
      '  Write-Host "Autostart health check: FAIL"',
      '  exit 1',
      '}',
      "",
      '$deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)',
      'while ((Get-Date) -lt $deadline) {',
      '  $process.Refresh()',
      '  if ($process.HasExited) {',
      '    $stderrTail = Get-LastLogLines -Path $stderrLog -Count 20',
      '    if ($stderrTail.Count -gt 0) {',
      '      Write-AutostartLog ("stderr tail: {0}" -f ($stderrTail -join " | "))',
      '    }',
      '    Write-AutostartLog ("process exited early exitCode={0}" -f $process.ExitCode)',
      '    Write-Host "Autostart health check: FAIL"',
      '    exit 1',
      '  }',
      "",
      '  if (Test-AgentHealth) {',
      '    Write-AutostartLog "health PASS"',
      '    Write-Host "Autostart health check: PASS"',
      '    exit 0',
      '  }',
      "",
      '  Start-Sleep -Seconds $PollIntervalSeconds',
      '}',
      "",
      'if (-not $process.HasExited) {',
      '  try {',
      '    Stop-Process -Id $process.Id -Force',
      '    Write-AutostartLog ("timeout killed pid={0}" -f $process.Id)',
      '  } catch {',
      '    Write-AutostartLog ("timeout stop failed: {0}" -f $_.Exception.Message)',
      '  }',
      '}',
      "",
      'Write-AutostartLog "health TIMEOUT"',
      'Write-Host "Autostart health check: FAIL"',
      'exit 1',
    ]),
  );
  writeText(
    "install-agent-autostart.ps1",
    ps([
      'param(',
      `  [string]$TaskName = "${taskName}"`,
      ')',
      "",
      '$ErrorActionPreference = "Stop"',
      '$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path',
      '$runner = Join-Path $scriptRoot "start-agent-autostart.ps1"',
      '$taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument (\'-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "\' + $runner + \'"\') -WorkingDirectory $scriptRoot',
      '$taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)',
      '$taskSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable',
      '$taskPrincipal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited',
      "",
      'if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {',
      '  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false',
      '}',
      "",
      'Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Principal $taskPrincipal | Out-Null',
      'Write-Host "Autostart registered: $TaskName"',
    ]),
  );
  writeText(
    "remove-agent-autostart.ps1",
    ps([
      'param(',
      `  [string]$TaskName = "${taskName}"`,
      ')',
      "",
      '$ErrorActionPreference = "Stop"',
      "",
      'if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {',
      '  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false',
      '  Write-Host "Autostart removed: $TaskName"',
      '  exit 0',
      '}',
      "",
      'Write-Host "Autostart not installed: $TaskName"',
    ]),
  );
  writeText(
    "status-agent-autostart.ps1",
    ps([
      'param(',
      `  [string]$TaskName = "${taskName}"`,
      ')',
      "",
      '$ErrorActionPreference = "Stop"',
      "",
      '$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue',
      'if (-not $task) {',
      '  Write-Host "registered: missing"',
      '  Write-Host "running: false"',
      '  Write-Host "lastResult: n/a"',
      '  exit 1',
      '}',
      "",
      '$taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName',
      '$running = [bool]($taskInfo.State -eq "Running")',
      '$lastResult = if ($null -ne $taskInfo.LastTaskResult) { "0x{0:X8}" -f ($taskInfo.LastTaskResult -band 0xFFFFFFFF) } else { "n/a" }',
      "",
      'Write-Host "registered: present"',
      'Write-Host ("running: " + $running)',
      'Write-Host ("lastResult: " + $lastResult)',
    ]),
  );
};

try {
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(artifactRoot, { recursive: true });

  // Build a clean production dependency closure. No development dependencies,
  // repository files, npm, or Git are copied to the workstation artifact.
  cpSync(join(projectRoot, "package.json"), join(stagingRoot, "package.json"));
  cpSync(join(projectRoot, "package-lock.json"), join(stagingRoot, "package-lock.json"));
  execFileSync(npmCommand, ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: stagingRoot,
    stdio: "inherit",
    windowsHide: true,
    // npm.cmd is a Windows command shim; the build host shell is required
    // only while composing the artifact, never by the target workstation.
    shell: process.platform === "win32",
  });

  cpSync(join(projectRoot, "dist"), join(artifactRoot, "app"), {
    recursive: true,
    filter: (source) => !source.endsWith(".d.ts") && !source.endsWith(".js.map") && !source.endsWith(".tsbuildinfo"),
  });
  cpSync(join(stagingRoot, "node_modules"), join(artifactRoot, "node_modules"), { recursive: true });
  mkdirSync(join(artifactRoot, "runtime"), { recursive: true });
  cpSync(process.execPath, join(artifactRoot, "runtime", "node.exe"));

  writeText("config/agent.config.example.json", `${JSON.stringify({
    port: 4050,
    bind: "127.0.0.1",
    allowedOrigins: ["http://localhost:3000"],
    logLevel: "INFO",
    enableRealAdapters: false,
    usbPrintTransport: "RAW",
    usbRawPhysicalCutCertified: false,
    logLimit: 500,
    printerWidthChars: 48,
  }, null, 2)}\n`);

  // This QA local config contains no secrets. It keeps the agent loopback-only
  // and lets the approved web origin be supplied at package time.
  writeText("config/agent.config.local.json", `${JSON.stringify({
    port: 4050,
    bind: "127.0.0.1",
    allowedOrigins: Array.from(new Set([
      "http://localhost:3000",
      ...parseAllowedOrigins(process.env.PERIPHERALS_ALLOWED_ORIGINS),
    ])),
    logLevel: "INFO",
    enableRealAdapters: true,
    usbPrintTransport: "RAW",
    usbRawPhysicalCutCertified: true,
    logLimit: 500,
    printerWidthChars: 48,
  }, null, 2)}\n`);

  writeText("start-agent.cmd", `@echo off\r\nsetlocal\r\nset "AGENT_ROOT=%~dp0"\r\nset "PERIPHERALS_CONFIG_PATH=%AGENT_ROOT%config\\agent.config.local.json"\r\nif not exist "%LOCALAPPDATA%\\Manus\\PeripheralAgent\\logs" mkdir "%LOCALAPPDATA%\\Manus\\PeripheralAgent\\logs"\r\nif not exist "%LOCALAPPDATA%\\Manus\\PeripheralAgent\\state" mkdir "%LOCALAPPDATA%\\Manus\\PeripheralAgent\\state"\r\n"%AGENT_ROOT%runtime\\node.exe" "%AGENT_ROOT%app\\main.js"\r\n`);
  writeText("VERSION.json", `${JSON.stringify({
    agent: "manus-pos-peripheral-agent",
    version: packageJson.version,
    platform: "win32",
    architecture: "x64",
    runtime: process.version,
    packaging: "portable-node-runtime",
  }, null, 2)}\n`);
  writeText("VERSION", `${packageJson.version}\r\n`);
  writeAutostartScripts();
  writeText("README-WINDOWS-X64.txt", `MANUS PERIPHERAL AGENT - Windows x64 portable\r\n\r\n1. Copy this directory to C:\\Program Files\\Manus\\PeripheralAgent (administrator) or another local path.\r\n2. Edit config\\agent.config.local.json only for local workstation values. It accepts no secrets.\r\n3. Double-click start-agent.cmd.\r\n4. Check http://127.0.0.1:4050/health.\r\n5. Call POST http://127.0.0.1:4050/devices/discover.\r\n6. Install autostart with install-agent-autostart.ps1.\r\n7. Inspect autostart with status-agent-autostart.ps1.\r\n8. Remove autostart with remove-agent-autostart.ps1.\r\n\r\nThe agent is loopback-only by default. Its Node runtime is embedded; npm and Git are not required on the POS workstation.\r\nPowerShell 5.1 compatibility: the autostart launcher sets PERIPHERALS_CONFIG_PATH in the launcher environment before process start, and passes the main entry point as a quoted argument so paths with spaces like C:\\Program Files\\Manus\\PeripheralAgent work.\r\nLogs/state are under %LOCALAPPDATA%\\Manus\\PeripheralAgent.\r\nAutostart uses a Scheduled Task in the current user session and launches the portable installation from its own folder.\r\n`);
  writeText("logs/.gitkeep", "");
  writeText("state/.gitkeep", "");

  console.log(`Package created: ${artifactRoot}`);
  console.log(`Portable runtime: ${join(artifactRoot, "runtime", "node.exe")}`);
  console.log("Global Node/npm/Git are not required by the target workstation.");
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}
