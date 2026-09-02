# Evidencia QA XP-58 / PeripheralAgent E2E

## Scope

Topologia objetivo:

```text
https://apptiendamanus.space
  -> http://127.0.0.1:4050
  -> Windows spooler
  -> XP-58 / USB001
```

El repair same-version de `automatizar-despliegue-manus-terminal` permanece
pausado. Esta evidencia usa exclusivamente un upgrade QA con version superior.

## Evidencia Windows confirmada

```text
Printer name: XP-58
Driver: XP-58
Type: Local
Original port: LPT1:
Corrected port: USB001
USB hardware: USB\VID_0483&PID_070B\B82D3A880106
WINDOWS TEST PAGE: PASS
```

El filtro Manus actual `Local + ^(USB|DOT4USB)` es compatible. No se amplia a
LPT/WSD/IP/COM.

## Artifact evidence

```text
SOURCE VERSION: 0.1.1-qa.3
QA VERSION: 0.1.1-qa.3
INSTALLER: ManusTerminalSetup-0.1.1-qa.3-win-x64.exe
INSTALLER SIZE: 112771584 bytes
INSTALLER SHA256: ACF726CFDADACB02D0F49C526815FD2A4F5435484277646E40E2C7CA3D49A1CF
PACKAGE VALIDATION: PASS
INSTALLER VALIDATION: PASS
```

## Pre-upgrade capture

```text
agentInstallationId: PRESERVED (QA1; value redacted)
version: 0.1.1-qa.1
mode: REAL
config backup: PASS
```

## Post-upgrade health

```text
status: PASS (QA1)
mode: REAL
version: 0.1.1-qa.1
agentInstallationId preserved: PASS
```

## Discovery

```text
QA1 0.1.1-qa.1: FAILED/EMPTY
Cause: Get-Printer JSON emitted Type=0; parser accepted strings only.
QA2 0.1.1-qa.2 REAL discovery: PASS
XP58 USB discovery: PASS
deviceId: usb-printer-45207a0cc744eb10
connectionType=USB: PASS
status=CONNECTED: PASS
usb.printerName=XP-58: PASS
no MOCK devices: PASS
```

## Terminal association

`THERMAL_58MM` existe en backend y web con `paperWidthMm=58` y
`widthChars=32`.

```text
XP-58 associated to terminal: RETEST REQUIRED
profile used: THERMAL_80MM
expected profile: THERMAL_58MM
```

## Physical results

```text
PHYSICAL WINDOWS TEST PAGE: PASS
PERIPHERAL AGENT REAL DISCOVERY: PASS
USB RAW TRANSPORT: PASS (bytesSent=744)
PHYSICAL PAPER OUTPUT: PASS
DIRECT PHYSICAL FORMAT: FAIL
DIRECT PHYSICAL PRINT E2E: PARTIAL / RETEST REQUIRED
WEB MANUS TEST PRINT: NOT TESTED
POS PHYSICAL PRINT: NOT TESTED
```

`bytesSent>0` no cambia ningun estado fisico a PASS sin papel observado.

## Chronology

- 2026-08-31: evidencia Windows recibida. Cola movida de LPT1 a USB001 y
  Windows Test Page impresa fisicamente.
- 2026-08-31: change OpenSpec creado. QA fisica de Agent/Manus aun no
  ejecutada.
- 2026-08-31: runtime self-contained e installer `0.1.1-qa.1` generados.
  Backend `84/84`, web peripherals `20/20`, package, installer y OpenSpec
  strict en PASS. Installer no ejecutado en la maquina fisica.
- QA2: `0.1.1-qa.2` descubrio XP-58 y produjo papel (`bytesSent=744`), pero
  uso `THERMAL_80MM` y el formato fisico fallo.
- QA3: runtime/installer generado para seleccionar y persistir
  `THERMAL_58MM`. Discovery no se modifica.

## Comando de instalacion QA preparado

Despues de copiar el installer verificado a la maquina QA:

```powershell
$installer = "$env:USERPROFILE\Downloads\ManusTerminalSetup-0.1.1-qa.3-win-x64.exe"
$expectedSha256 = "ACF726CFDADACB02D0F49C526815FD2A4F5435484277646E40E2C7CA3D49A1CF"
$actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $installer).Hash

if ($actualSha256 -ne $expectedSha256) {
  throw "SHA256 invalido. Esperado=$expectedSha256 Actual=$actualSha256"
}

$process = Start-Process `
  -FilePath $installer `
  -ArgumentList "install" `
  -Verb RunAs `
  -Wait `
  -PassThru

if ($process.ExitCode -ne 0) {
  throw "Installer fallo con exit code $($process.ExitCode)"
}
```

Este comando usa `install` y version superior. No usa `repair`.
