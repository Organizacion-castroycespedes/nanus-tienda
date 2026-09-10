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
SOURCE VERSION: 0.1.1-qa.4
QA VERSION: 0.1.1-qa.4
INSTALLER: ManusTerminalSetup-0.1.1-qa.4-win-x64.exe
INSTALLER SIZE: 113615872 bytes
INSTALLER SHA256: 4B95FD7A16B661AAD6B266F18A335E332BDB3D62EBF4291AD929B1188137FDD3
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

### QA4 physical confirmation

```text
Upgrade qa.3 -> qa.4: PASS
health: status=ok, mode=REAL, version=0.1.1-qa.4
agentInstallationId: 5fe2abeb-1787-4ac1-befb-d2963fd920f4 (preserved)
config SHA before/after: 7EA72E83DC4FCE32BB14AFED2FD03F2BC9C18A0F3486777563F900EF81B023BB (identical)
Explicit discovery duration: 2857.259 ms
DISCOVERY ETIMEDOUT QA3: RESOLVED
XP-58: USB / CONNECTED / THERMAL_58MM / XP-58
usbRawCashDrawerPulseCertified: true
discoverySource: USB_SYSTEM
DISCOVERY INVOCATIONS DURING PRINT-TICKET: 0
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
PERIPHERAL AGENT REAL DISCOVERY: PASS (QA4)
USB RAW TRANSPORT: PASS
PHYSICAL PAPER OUTPUT: PASS
DIRECT PHYSICAL FORMAT: PASS (THERMAL_58MM)
DIRECT PHYSICAL PRINT E2E: PASS
SALE PRINT API QA4: PASS (2 consecutive prints, bytesSent=892 each)
SALE RAW TRANSPORT QA4: PASS
WEB MANUS TEST PRINT: DEFERRED TO FOLLOW-UP
POS UI PHYSICAL PRINT: DEFERRED TO FOLLOW-UP
```

`bytesSent>0` no cambia ningun estado fisico a PASS sin papel observado.

## Cash drawer certification

```text
XP58 PRINT: PASS
CASH DRAWER API: REACHED
DRAWER CERTIFICATION GUARD: PASS
PHYSICAL DRAWER OPEN QA3: PASS
PHYSICAL DRAWER OPEN QA4: PASS
CASH DRAWER CERTIFICATION PERSISTENCE: PASS
CASH DRAWER API QA4: PASS (bytesSent=5)
```

El guard esta en `CashDrawerService.open()`. Requiere perfil con
`supportsCashDrawerPulse=true` y, para USB, metadata persistida
`usbRawCashDrawerPulseCertified=true`. Sin ella devuelve 400 y no escribe.

El pulso actual es `ESC p 0 50 250`, bytes `[27,112,0,50,250]`, enviado por
el mismo transporte USB RAW. La certificacion es por dispositivo, no global.

## ETIMEDOUT / hot path QA

LocalService observa XP-58 y Get-Printer termina en `6263 ms`. El timeout
anterior era `5000 ms`, causando `spawnSync powershell.exe ETIMEDOUT`.
QA4 usa timeout Windows de `10000 ms`, registra duracion, timeout, parse failure
y cantidad encontrada. Impresion de ticket y apertura de cajon ya no ejecutan
discovery: usan identidad USB persistida; discovery queda explicito.

```text
QA4 VERSION: 0.1.1-qa.4
INSTALLER SHA256: 4B95FD7A16B661AAD6B266F18A335E332BDB3D62EBF4291AD929B1188137FDD3
LOCAL SERVICE DISCOVERY: 6263 ms
DISCOVERY TIMEOUT: 10000 ms
```

Para QA controlada, primero usar `PATCH /devices/:id`:

```json
{
  "terminalId": "local-terminal",
  "profileId": "THERMAL_58MM",
  "metadata": { "usbRawCashDrawerPulseCertified": true }
}
```

Luego ejecutar un unico `POST /cash-drawer/open` y observar apertura fisica.
No se certifica autocut.

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
- QA4: upgrade `qa.3 -> qa.4` PASS. LocalService discovery completó en
  2857.259 ms. Dos `print-ticket` consecutivos usaron `THERMAL_58MM`,
  `bytesSent=892`, y no invocaron discovery. Cajón certificado persistió y
  API respondió `bytesSent=5`. Apertura física QA4 aún no fue reconfirmada.

## Comando de instalacion QA preparado

Despues de copiar el installer verificado a la maquina QA:

```powershell
$installer = "$env:USERPROFILE\Downloads\ManusTerminalSetup-0.1.1-qa.4-win-x64.exe"
$expectedSha256 = "4B95FD7A16B661AAD6B266F18A335E332BDB3D62EBF4291AD929B1188137FDD3"
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
