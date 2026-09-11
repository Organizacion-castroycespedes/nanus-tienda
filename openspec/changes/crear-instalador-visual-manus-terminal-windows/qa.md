# QA plan

## Automated

- Comparar visualmente contra `backend-perifericos/installer-ui/reference/manus-terminal-installer-approved.html`.
- Tests de estados, componentes y contratos mockeados.
- Validar que XP-58 usa `THERMAL_58MM` y que el cajon se bloquea sin certificacion.
- Validar mensajes de error sin stack trace, PowerShell, JSON ni secretos.
- Validar responsive en 1024x768, 1280x720, 1366x768 y 1920x1080.

## Windows

- Probar installer en Windows limpio con XP-58 e Internet.
- Confirmar que Core conserva config e identidad y pasa health gate.
- Confirmar que UI usa los contratos Agent existentes.
- Confirmar que no se requiere PowerShell ni edicion JSON.
- Ejecutar EXE QA y confirmar ventana `MANUS TERMINAL SETUP`, offline, resize y
  ausencia de navegador externo.
- Confirmar fallback controlado cuando WebView2 no está disponible.

## Fase 2 WebView2

```text
VISUAL QA: PASS
FASE 2 WEBVIEW2 HOST: PASS (build/test/package; manual Windows pendiente)
LIBRARY: github.com/jchv/go-webview2
VERSION: v0.0.0-20260205173254-56598839c808
```

## Runtime chrome y mock navigation

```text
BROWSER MOCK: fake window chrome visible; mock navigation visible
WEBVIEW2 UI SPIKE: native Windows chrome; fake chrome hidden; mock navigation visible
PRODUCTIVE: native Windows chrome; fake chrome hidden; mock navigation hidden

## Fase 7 — estado actual

- Fase 1 visual: PASS.
- Fase 2 Go + WebView2: PASS.
- Fase 3 bridge read-only: PASS.
- Fase 4 configure device: PASS.
- Fase 5 test print físico: PASS.
- Fase 6 cash drawer físico: PASS.
- Fase 7 flujo productivo: IN PROGRESS.

Se añadió el modelo tipado del estado del Installer Core. La publicación de
eventos reales al host/UI y el QA manual del instalador integrado siguen
pendientes. No se ejecutó ningún artefacto integrado ni se produjeron efectos de
instalación en esta fase.

El reducer y sus pruebas cubren inicio, pasos sin éxito ficticio, progreso
derivado, duplicados y rollback visible. Esto es harness local; no representa
ejecución real del instalador.

El harness `--ui-core-flow-qa` añade escenarios `success`, `rollback-success` y
`rollback-fail`, con push de snapshots por `WebView2.Dispatch`. Es no destructivo:
no ejecuta instalación, servicios, rollback real, escrituras en Program Files o
ProgramData, ni llamadas al PeripheralAgent. QA visual manual sigue pendiente.

Artefacto no destructivo generado:
`backend-perifericos/dist-installer/windows-x64/ManusTerminalSetup-UI-CoreFlow-QA-win-x64.exe`
SHA256 `AF50B4B3A929FABC412C489E177DFAD16AC4B9529804EE4A7DC56C93242301C5`.
El artefacto anterior `F9FE68C6...` queda como evidencia del QA fallido; no se reutiliza.
No ejecutar el instalador integrado productivo sin aprobación.
```

El contenido WebView2 inicia debajo de la barra nativa sin espacio reservado
para la barra simulada. Se mantiene un solo HTML fuente y se inyecta un bloque
CSS de runtime durante packaging. `--ui-spike` solo abre la UI y no ejecuta
instalacion, servicio, filesystem, ProgramData ni health gate.

## Logo real

La fuente de branding es `web/public/LogoManus.png.jpeg`, inspeccionada antes
de su uso. Contiene isotipo y texto `Manus POS`; se usa como imagen completa en
header y bienvenida, sin duplicar el texto. El packaging la convierte a
`data:image/jpeg;base64,...` dentro del HTML runtime. No queda dependencia
relativa, `file://`, `http://` ni `https://`.

```text
WEBVIEW2 MANUAL QA: PASS
DPI 150%: resultado manual no registrado en esta evidencia; pendiente de captura explícita
```

## Fase 3 bridge read-only

```text
getInstallerState: implementado
GET /health real: implementado
POST /devices/discover real: implementado
configureDevice/testPrinter/testCashDrawer: no expuestos
shell/PowerShell/filesystem/registry desde UI: no expuestos
```

La prueba automatizada usa un transporte HTTP controlado y confirma que los
DTOs de health y discovery llegan al bridge sin habilitar operaciones mutantes.

## Fase 3 REAL_READONLY

```text
--ui-spike: MOCK fixtures, sin llamadas reales
--ui-bridge-qa: REAL_READONLY, health + discovery reales
fixtures como fallback en REAL_READONLY: prohibido
discovery duplicado por re-render: evitado con promesa compartida
acciones mutantes: disabled/no bridge binding
```

## Fase 4 configuración real

```text
--ui-config-qa: configureDevice habilitado; solo PATCH /devices/:id
--ui-bridge-qa: configureDevice no expuesto
perfiles permitidos: THERMAL_58MM, THERMAL_80MM
deviceId: validado contra discovery de sesión
metadata/cash drawer: preservados por no enviar metadata
test print/cash drawer: no expuestos
installer side effects: ninguno
```

## Fase 5 test print real

```text
--ui-print-qa: testPrinter habilitado; configureDevice y discovery conservados
POST /printer/test-print: loopback fijo, deviceId validado, perfil persistido
discovery durante test print: no se ejecuta
testCashDrawer: no expuesto
```

## Fase 6 cash drawer

```text
--ui-drawer-qa: testCashDrawer habilitado solo con certificación true
POST /cash-drawer/open: loopback fijo, payload real, sin discovery adicional
connector/pin/pulse: decididos por backend; no editables en UI
confirmación física: operador; no se persiste en Agent
```

## Fase 6 QA físico

```text
FASE 6 PHYSICAL DRAWER QA: PASS
ARTIFACT: ManusTerminalSetup-UI-Drawer-QA-win-x64.exe
SHA256: 7FD55F16F07EDA68CD89397CDC716B8C1E2A07B9023BE3056E1B017E20E85021
PRINTER: XP-58
PROFILE BEFORE: THERMAL_58MM
DRAWER CERTIFICATION BEFORE: true
CASH DRAWER API: PASS
PULSE SENT: PASS
PHYSICAL DRAWER OPEN: PASS
OPERATOR CONFIRMATION: YES
ACCIDENTAL PRINT: NO
PROFILE AFTER: THERMAL_58MM
DRAWER CERTIFICATION AFTER: true
INSTALLER SIDE EFFECTS: NO
BUGS: none
FASE 6: PASS
```

## Fase 5 QA físico

```text
FASE 5 PHYSICAL PRINT QA: PASS
ARTIFACT SHA256: PASS
PRINTER: XP-58
PROFILE BEFORE PRINT: THERMAL_58MM
CONFIGURE: ENABLED
PRINT: ENABLED
DRAWER: DISABLED
TEST PRINT API: PASS
PRINT JOB SENT: PASS
PHYSICAL PAPER OUTPUT: PASS
58MM FORMAT: PASS
TEXT LEGIBLE: PASS
PROFILE AFTER PRINT: THERMAL_58MM
DRAWER CERTIFICATION AFTER PRINT: true
CASH DRAWER OPENED: NO
INSTALLER SIDE EFFECTS: NO
BUGS: none
```

## Fase 7.1C - cierre nativo y Core/UI

QA HARNESS SIDE EFFECTS: FAIL en artefacto `90C70CE8...`. La evidencia mostrÃ³
que `--ui-core-flow-qa=success` alcanzÃ³ `install()` y creÃ³ Agent `0.1.1-qa.4`,
servicio y Program Files/ProgramData. Se agregÃ³ despacho QA temprano antes de
`loadManifest`, guard atÃ³mico contra `installWithObserver` durante harness y
tests de routing. Requiere re-test limpio; no ejecutar ningÃºn instalador generado.

QA fÃ­sico terminal UX: FAIL. Native X/Alt+F4 durante paso crÃ­tico: PASS;
CTA `Cerrar` en estados rollback/error permaneciÃ³ deshabilitado. CorrecciÃ³n:
los estados `COMPLETED` y `FAILED_SAFE` fuerzan `disabled=false`, limpian
`title` y conservan `requestClose()`/`coreCloseAllowed()`. Re-test fÃ­sico
pendiente.

QA fÃ­sico anterior: FAIL; el harness no tenÃ­a instalado el hook nativo.
CorrecciÃ³n aplicada: `runInstallerCoreFlowQA` instala el mismo hook, consulta
la instancia mutable sincronizada del reducer y registra eventos QA.
Artefacto regenerado: `ManusTerminalSetup-Integrated-QA-win-x64.exe`,
114416128 bytes, SHA256
`F75F0AC906D1013832F566E1CFEE829311ED9DEB598C07FFC8C3D2EB415CEBEC`.
Repetir QA fÃ­sico; no ejecutar instalaciÃ³n real.

Artefacto actualizado para re-test CTA: 114416128 bytes, SHA256
`90C70CE8E74C5F52E83211C765E8294DC0B087CDC6246F101D66493FABFB7C16`.

Refinamiento QA: el harness mantiene `INSTALL_AGENT RUNNING` y `ROLLBACK
RUNNING` durante 8 segundos; otros eventos usan 500 ms. Estos delays existen
solo en `--ui-core-flow-qa` y no afectan el Core real. El warning
`Failed to unregister class Chrome_WidgetWin_0. Error = 1412` coincide con
teardown de Chromium/WebView2; el hook restaura WndProc antes de `Destroy()`.
No hay evidencia de que el hook lo cause y no se cambia lifecycle.

Proteccion nativa WM_CLOSE/Alt+F4 y wiring observacional Core/WebView
implementados. Artefacto integrado solo para inspeccion:
`backend-perifericos/dist-installer/windows-x64/ManusTerminalSetup-Integrated-QA-win-x64.exe`
(114412032 bytes, SHA256 `CAA25978AAC33C1A76E8C6C1A85E631433CB879C3F076982388C8D1072579356`).
Contiene Agent `0.1.1-qa.4`; no ejecutar en la maquina QA actual.

### Fase 7.1C - QA final de aislamiento y cierre nativo

QA HARNESS ISOLATION: PASS.
SUCCESS SIDE EFFECTS: 0.
ROLLBACK-SUCCESS SIDE EFFECTS: 0.
ROLLBACK-FAIL SIDE EFFECTS: 0.

INSTALL_AGENT CLOSE DENY: PASS.
ROLLBACK CLOSE DENY: PASS.
X / ALT+F4 PROTECTION: PASS.
SERVICE RESIDUAL: NONE.
PROGRAM FILES RESIDUAL: NONE.
PROGRAMDATA RESIDUAL: NONE.

Los modos `--ui-core-flow-qa[=success|rollback-success|rollback-fail]`
quedan aislados antes del despacho productivo y terminan sin instalacion,
servicios, filesystem productivo, rollback real ni endpoints del Agent. El
hook nativo y la CTA consultan la misma politica `coreCloseAllowed`.

Warning conocido no bloqueante: `Failed to unregister class
Chrome_WidgetWin_0. Error = 1412`, observado durante teardown de
WebView2/Chromium. No hay evidencia de residuo ni de que el hook lo cause.

FASE 7.1C NATIVE CLOSE PHYSICAL QA: PASS.
FASE 7.1C QA HARNESS ISOLATION: PASS.
TERMINAL CTA "Cerrar": PASS.
CTA ENABLED EN ESTADO TERMINAL: PASS.
CTA CLOSE: PASS.

### Fase 7.1D/7.1E - repair de misma version

FASE 7.1D FRESH INSTALL E2E REAL: PASS (Agent `0.1.1-qa.4`).
FASE 7.1E SAME-VERSION REPAIR E2E: FAIL. El repair in-place elimino o dejo
incompleto `VERSION.json` en `versions\\0.1.1-qa.4`, con el servicio anterior
vivo y `current` aun apuntando al target. El rollback usaba el mismo path del
target, por lo que no existia una copia independiente. El EXE instalado siguio
siendo byte-identical al artefacto (`73F42C63...`), pero el estado de archivos
quedo hibrido y preflight lo clasifico erroneamente como fresh install.

La correccion transaccional queda implementada y pendiente de re-test fisico.
Same-version repair ahora prepara un staging unico, valida `VERSION.json` y
payload completo, detiene y confirma el servicio detenido antes de activar,
usa un backup independiente y restaura payload/current/servicio/health en
rollback. Preflight reporta `INCONSISTENT` cuando hay footprints sin metadata
valida. No se ejecuto ningun artefacto posterior al cambio.

PRODUCTION: BLOCKED hasta aprobar el re-test fisico 7.1E.

Artifact integrado regenerado sin ejecucion:
`ManusTerminalSetup-Integrated-QA-win-x64.exe`, 114438144 bytes, SHA256
`81601FD1160C120204FE31B882A2C4FA5009D4F72671C7AF0F879E862C031039`.
Embedded Agent: `0.1.1-qa.4`. El SHA anterior ya no representa este binario.

### Fase 7.1G1 - uninstall externo

STANDARD UNINSTALL: FAIL. La ejecucion desde
`current\\ManusTerminalSetup.exe` elimino `current`, `VERSION.json`,
`runtime`, `app` y el resto del payload. Quedo solamente
`versions\\0.1.1-qa.4\\ManusTerminalSetup.exe`; Windows rechazo su borrado
porque era el ejecutable en uso (`Access is denied`). Servicio, registry,
health y procesos quedaron ausentes; ProgramData se preservo. Preflight marco
`INCONSISTENT`.

SELF_DELETE_CONFIRMED: YES. Esto es una desinstalacion parcialmente
destructiva, no un residuo benigno. La correccion queda implementada:
el proceso instalado detiene/confirma el servicio, copia un helper a TEMP
fuera de `Program Files`, lo lanza con PID padre y rutas controladas, y sale.
El helper espera la terminacion del padre antes de borrar Program Files;
borra ProgramData solo con `--remove-data` y elimina registry despues de
confirmar el cleanup. FASE 7.1G1: IMPLEMENTED / PENDING PHYSICAL RETEST.
PRODUCTION: BLOCKED.

Artifact integrado regenerado para inspeccion (no ejecutado):
`ManusTerminalSetup-Integrated-QA-win-x64.exe`, 114502144 bytes, SHA256
`C2761D0C24D0FC9632BE119733C716906013877614E2534F180607C98D3B04CD`.
Embedded Agent: `0.1.1-qa.4`.

Retest fisico 7.1G1: SELF-DELETE PASS y helper externo PASS. El payload de
PeripheralAgent fue eliminado, servicio/procesos/registry quedaron ausentes y
ProgramData/config se preservaron byte-identicos. El contrato aun fallo porque
quedaron vacios `C:\\Program Files\\Manus` y el directorio TEMP del helper, y
preflight confundio ProgramData persistente con instalacion inconsistente.
Correccion aplicada: solo footprints de Program Files participan en preflight,
el padre `Manus` se elimina solo cuando esta vacio y el helper programa cleanup
seguro de su propio TEMP. 7.1G1: IMPLEMENTED / PENDING PHYSICAL RETEST.

Nueva evidencia fisica 7.1G1: STANDARD UNINSTALL CORE: PASS. Servicio,
procesos, `Program Files\\Manus`, registry y health quedaron ausentes;
ProgramData y `agent.config.local.json` se preservaron byte-identicos
(SHA256 `A0898183C3E0ABF7F6F4BBEFD32A0A0B39F9506204F22DD98CA923A9518A2204`).
El helper registro `parent exit confirmed`, cleanup exitoso, padre Manus vacio
y registry removido. Quedo solamente el directorio TEMP
`ManusTerminalSetup-uninstall-7280` despues de 60 segundos.

7.1G1: FAIL / TEMP CLEANUP RESIDUAL ONLY. La correccion ajusta el cleanup
diferido para ejecutar `cmd.exe` desde el directorio padre del target, con ruta
completa entre comillas y logging del comando/estrategia. Pendiente re-test
fisico; produccion sigue bloqueada.

Retest 7.1G1: el cleanup funcional paso, pero el directorio
`ManusTerminalSetup-uninstall-15352` permanecio tras 60 segundos. La estrategia
de un solo `rmdir` no fue suficiente para locks transitorios. Ahora se genera
un script `.cmd` fuera de `tempRoot`, con 12 reintentos acotados de 5 segundos,
logging por intento y auto-borrado del script. 7.1G1: IMPLEMENTED / PENDING
PHYSICAL RETEST.

## Fixtures visuales

WELCOME, INSTALLING, DEVICES_ZERO, DEVICES_SINGLE_USB, DEVICES_MULTI,
DEVICES_USB_NETWORK, ERROR, WARNING y COMPLETE. DEVICES_MULTI incluye XP-58,
XPrinter 80 mm y DIG-E200I como datos fixture, nunca como logica por modelo.

## Scope

Este change cubre la experiencia visual del installer. La integración visual
Web/Terminal y las estrategias de launcher/kiosk quedan para changes futuros.
No certificar autocut ni modificar discovery, RAW, cajon o LocalService.

### Fase 7.1G2 - remove-data

QA fisico anterior: core `--remove-data` PASS; Program Files, ProgramData,
registry y TEMP uninstall quedaron ausentes. Fallo final: persistio el log
externo `ManusTerminalSetup-cleanup-4248.log`. La causa era que no existia
una fase C de limpieza posterior al proceso que escribia ese log.

Correccion implementada: el script de fase B lanza un final cleaner externo,
fuera de `tempRoot`, que borra el log con 12 reintentos y elimina su propio
script solo tras exito. En fallo conserva diagnostico. 7.1G2:
IMPLEMENTED / PENDING PHYSICAL RETEST. Production sigue bloqueada.

Nuevo artefacto no ejecutado: `ManusTerminalSetup-Integrated-QA-win-x64.exe`,
114514432 bytes, SHA256
`39E0A4745DA0BBAD09153CB4882B7132B22738CFC43EAD816E7E9E0668856F18`.
Embedded Agent: `0.1.1-qa.4`.

### Certificacion fisica definitiva 7.1G2

`--remove-data`: PASS. Con el mismo artefacto certificado, fresh install y
  remove-data terminaron sin servicio, procesos, Program Files, ProgramData,
  registry ni tareas. TEMP residues: NONE. Health: NOT AVAILABLE. Preflight
  posterior: `CLEAN`, `fresh install`, sin warning ni rollback candidate.

### P8 final lifecycle certification - 7.2AB

Physical P8 lifecycle is PASS / CLOSED. Same-version repair, reboot/relaunch,
single-instance, standard uninstall with POS running, reinstall, `--remove-data`,
fresh install, first-launch CTA, POS launch, QA `/pos` load and fullscreen all
passed physically.

The original standard-uninstall defect was `POS_PROCESS_NOT_TERMINATED` plus
cleanup-helper failure. 7.2AB scopes processes by canonical executable path
under the POS root, performs bounded termination before POS deletion, preserves
ProgramData for standard uninstall, keeps `--remove-data` separate, and removes
registry metadata after successful payload cleanup.

Certified installer: `ManusTerminalSetup-Integrated-7.2AB-QA-standard-uninstall-cleanup-qa9.exe`,
490257408 bytes, SHA256
`6C9CCB2FBFAFC88AA4A1F546455F997D410F714A4F63BED79065271DF7123F21`.
Embedded POS hashes: EXE
`398A308C7BC5B131D41CB2253DD7651BFAA8D6271DBC211BE2A6BBB66E2E17BF`,
`app.asar`
`FDB3D2C0054AE9B118135D2FE9D717EB2D2C3505213AD0B0BEBB2ADAE0A7EAE3`.
Agent remains `0.1.1-qa.9`; Electron was not rebuilt.

After `--remove-data`, identity remained
`64e835b5-5a09-4865-817a-55cd10931a7e`, as expected: it is a random UUID
persisted in the LocalService `%LOCALAPPDATA%` state file, outside the
ProgramData removal scope. OpenSpec does not require regeneration. The fresh
config hash matched the deterministic embedded seed
`A0898183C3E0ABF7F6F4BBEFD32A0A0B39F9506204F22DD98CA923A9518A2204`.

TEMP directory `ManusTerminalSetup-uninstall-7372` was an unlocked inactive
orphan from the earlier failed standard uninstall, not from successful 7.2AB
remove-data; it was removed with explicit operator authorization.

Non-blocking findings remain separate: installer repair UI drawer hydration
displayed XP-58 while persisted drawer parent was POS-80, and the documented
ProgramData-vs-LocalService identity-path alignment.

### P8 standard uninstall process-lock regression

Physical P8 standard uninstall with `--remove-data` **not used** removed the
Agent service and current payload, but left `POS\\versions\\0.1.0` and the
uninstall registry entry. The cleanup helper stopped after confirming the
parent exit because multiple `Manus POS.exe` processes were still running
from the configured POS root. POS removal returned early, so registry
cleanup was never reached. ProgramData and `config\\agent.config.local.json`
remained byte-identical (SHA256
`A0898183C3E0ABF7F6F4BBEFD32A0A0B39F9506204F22DD98CA923A9518A2204`).

P8 standard uninstall remains **OPEN / pending fixed-candidate physical
retest**. The fix scopes process discovery by canonical executable path under
the POS root, performs bounded termination before POS deletion, preserves
ProgramData for standard uninstall, and removes uninstall metadata only after
payload cleanup succeeds.

Artifact: 114514432 bytes, SHA256
`39E0A4745DA0BBAD09153CB4882B7132B22738CFC43EAD816E7E9E0668856F18`.
Embedded Agent: `0.1.1-qa.4`.

7.1G1: PASS. Reinstall e identity preservation: PASS. 7.1G2 remove-data:
PASS PHYSICAL WINDOWS QA. Zero residue: PASS. Warning conocido
`Chrome_WidgetWin_0 Error = 1412`: no bloqueante de teardown; no hubo zombie
ni efectos funcionales.

## Fase 7.1B — instrumentación Core

Instrumentación observacional implementada con `installWithObserver`; el
algoritmo real conserva orden, current, servicio, health gate y rollback.
El entrypoint productivo aún no conecta estos eventos al WebView. No se ejecutó
el artefacto integrado ni instalación real.
