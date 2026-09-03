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

## Fixtures visuales

WELCOME, INSTALLING, DEVICES_ZERO, DEVICES_SINGLE_USB, DEVICES_MULTI,
DEVICES_USB_NETWORK, ERROR, WARNING y COMPLETE. DEVICES_MULTI incluye XP-58,
XPrinter 80 mm y DIG-E200I como datos fixture, nunca como logica por modelo.

## Scope

Este change cubre la experiencia visual del installer. La integración visual
Web/Terminal y las estrategias de launcher/kiosk quedan para changes futuros.
No certificar autocut ni modificar discovery, RAW, cajon o LocalService.
