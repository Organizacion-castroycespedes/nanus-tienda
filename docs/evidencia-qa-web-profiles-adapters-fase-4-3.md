# Evidencia QA: Web profiles/adapters - Fase 4.3

Fecha: 2026-06-03

## Objetivo

Validar que la pantalla web de perifericos muestra metadata de `profile`, `capabilities` y adapters retornada por `backend-perifericos`.

## Alcance

- Ruta: `/[tenant]/admin/peripherals`.
- URL local validada: `http://localhost:3000/00000000-0000-0000-0000-000000000001/admin/peripherals`.
- Frontend: `web/domains/peripherals`.
- Cambio OpenSpec: `add-pos-peripherals-platform`.
- Fase: `4.3 Validacion Web de profiles/adapters`.

## Archivos modificados

- `web/domains/peripherals/types.ts`
- `web/domains/peripherals/components/PeripheralsPage.tsx`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`
- `docs/evidencia-qa-web-profiles-adapters-fase-4-3.md`

## Metadata visual agregada

Listado de dispositivos:

- `profileId`
- `connectionType` como badge.
- `status`
- `type`
- `terminalId`

Resultado de impresion y caja:

- `adapterName`
- `profile.id`
- `profile.paperWidthMm`
- `profile.widthChars`
- `capabilities.supportsCut`
- `capabilities.supportsCashDrawerPulse`
- `commandCount`
- comandos conceptuales existentes.
- preview termico existente.

Componentes internos agregados o mejorados:

- `PeripheralDeviceProfileBadge`
- `PeripheralAdapterMetadata`
- `PeripheralCapabilitiesList`

## Pruebas realizadas

Backend local activo en `localhost:4050`.

Smoke HTTP:

```text
GET /devices
POST /printer/test-print
POST /printer/print-ticket
POST /cash-drawer/open
GET http://localhost:3000/00000000-0000-0000-0000-000000000001/admin/peripherals
```

Resultado smoke:

```text
webStatus           : 200
devicesCount        : 4
printerProfileId    : THERMAL_80MM
testAdapter         : MockPrinterAdapter
testProfile         : THERMAL_80MM
testWidthChars      : 48
testSupportsCut     : True
ticketAdapter       : MockPrinterAdapter
ticketHasTotal      : True
drawerAdapter       : MockCashDrawerAdapter
drawerSupportsPulse : True
drawerCommands      : INIT,CASH_DRAWER_PULSE
```

La primera validacion contra el web dev server devolvio un 500 de Next por cache/runtime dev stale despues de `next build`:

```text
TypeError: __webpack_modules__[moduleId] is not a function
```

Se reinicio solo el proceso web dev del proyecto y la ruta respondio `200`.

Intento de Browser DOM smoke:

- Se intento usar Browser plugin para validar texto visible.
- El runtime `node_repl` fallo por sandbox con `windows sandbox failed: spawn setup refresh`.
- No se uso como criterio de aprobacion.

## Resultado build web

Comando:

```powershell
cd web
npm.cmd run build
```

Resultado: PASS.

Observaciones:

- Build compila y genera ruta `/[tenant]/admin/peripherals`.
- Existen warnings previos de hooks e imagenes en modulos no relacionados.
- `web/package.json` no tiene script `test`; no se ejecuto `npm.cmd test`.

## Resultado backend-perifericos build/test

Comandos:

```powershell
cd backend-perifericos
npm.cmd run build
npm.cmd test
```

Resultado:

- Build: PASS.
- Tests: PASS, `25` tests.

## Resultado OpenSpec

Comando:

```powershell
openspec.cmd validate add-pos-peripherals-platform --type change --strict
```

Resultado:

```text
Change 'add-pos-peripherals-platform' is valid
```

Estado: PASS.

## Resultado git diff --check

Comando:

```powershell
git diff --check
```

Resultado: PASS.

Observacion: Git reporto warnings de normalizacion `LF will be replaced by CRLF` en archivos ya modificados previamente. No se reportaron errores de whitespace.

## Riesgos pendientes

- Validacion visual autenticada completa depende de sesion local y RBAC de usuario.
- Adapters reales siguen fuera de alcance.
- `backend-perifericos` aun no tiene seguridad local fuerte por token.
- Browser automation no pudo ejecutarse por restriccion de sandbox local.

## Confirmacion de restricciones

- No se conecto hardware real.
- No se instalaron drivers reales.
- No se uso ESC/POS real.
- No se uso USB.
- No se uso `serialport`.
- No se uso HID.
- No se integro Electron.
- No se integro Capacitor.
- No se modifico `database/`.
- No se modifico `backend-reporteria/`.
- No se modifico core de ventas, inventario, compras, caja ni facturacion.
