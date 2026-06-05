# Evidencia QA: Device Profiles y Print Adapters - Fase 4.2

Fecha: 2026-06-03

## Objetivo

Validar que `backend-perifericos` queda preparado con profiles y adapters internos para impresion futura, manteniendo el modo `MOCK/SIMULATOR` sin conectar hardware real.

## Alcance

- Servicio: `backend-perifericos`.
- Cambio OpenSpec: `add-pos-peripherals-platform`.
- Fase: `4.2 Device Profiles y Print Adapters`.
- No incluye `api/`, `web/`, `database/` ni `backend-reporteria/`.

## Arquitectura implementada

Se separo la responsabilidad en capas internas:

- Formateo termico: `shared/escpos-mock`.
- Profiles de dispositivo: `shared/profiles/device-profiles.ts`.
- Contratos de adapters: `shared/adapters/peripheral-adapter.types.ts`.
- Adapters MOCK: `MockPrinterAdapter` y `MockCashDrawerAdapter`.
- Resolucion de adapter: `PeripheralAdapterResolver`.

La seleccion actual queda asi:

- `MOCK + PRINTER + MOCK` -> `MockPrinterAdapter`.
- `MOCK + CASH_DRAWER + MOCK` -> `MockCashDrawerAdapter`.
- `USB`, `SERIAL`, `HID` y conexiones reales -> error controlado `Adapter for connection type ... is not implemented yet.`

## Profiles creados

| Profile | Papel | Ancho | Corte | Pulse caja |
| --- | ---: | ---: | --- | --- |
| `THERMAL_80MM` | `80mm` | `48` chars | Si | Si |
| `THERMAL_58MM` | `58mm` | `32` chars | Si | Si |
| `GENERIC_TEXT` | N/A | `40` chars | No | No |

Dispositivos MOCK compatibles:

- `mock-printer-001` usa `THERMAL_80MM`.
- `mock-cashdrawer-001` usa `THERMAL_80MM`.

## Endpoints validados

- `GET /health`
- `GET /devices`
- `POST /printer/test-print`
- `POST /printer/print-ticket`
- `POST /cash-drawer/open`
- `GET /logs`

Las responses de impresion y caja conservan campos previos y agregan:

- `profile`
- `capabilities`

## Logs seguros

Logs de impresion y caja incluyen metadata tecnica:

- `jobId` o `commandId`
- `terminalId`
- `deviceId`
- `profileId`
- `adapterName`
- `commandCount`
- `previewLength` cuando aplica

No se guarda `preview` completo en logs.

## WebSocket

Eventos de impresion y caja conservan comportamiento MOCK. Los eventos incluyen metadata tecnica como `profileId`, `adapterName`, `commandCount` y `previewAvailable`, pero no envian el preview completo.

## Comandos ejecutados

Desde `backend-perifericos`:

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run start
```

Desde raiz:

```powershell
openspec.cmd validate add-pos-peripherals-platform --type change --strict
git diff --check
git status --short
```

## Resultado build/test

- `npm.cmd run build`: PASS.
- `npm.cmd test`: PASS, `25` tests pasan.

## Smoke curl

Servicio iniciado temporalmente con `npm.cmd run start` sobre `localhost:4050`.

Resultado:

```text
GET /health                         200
GET /devices                        200
POST /printer/test-print            success true, profile THERMAL_80MM, adapter MockPrinterAdapter
POST /printer/print-ticket          success true, preview contiene TOTAL, profile THERMAL_80MM
POST /cash-drawer/open              success true, commands INIT,CASH_DRAWER_PULSE, adapter MockCashDrawerAdapter
GET /logs                           200
```

Validaciones adicionales:

- `test-print` retorna preview con `ESC/POS MOCK TEST`.
- `test-print` retorna comandos `INIT` y `CUT`.
- `print-ticket` retorna preview con `TOTAL`.
- `cash-drawer/open` retorna `CASH_DRAWER_PULSE`.
- Logs no contienen `preview` completo.
- Servicio temporal fue detenido al finalizar smoke.

## OpenSpec

```text
Change 'add-pos-peripherals-platform' is valid
```

Resultado: PASS.

## git diff --check

Resultado: PASS.

Observacion: Git reporto warnings de normalizacion `LF will be replaced by CRLF` en archivos ya modificados previamente. No se reportaron errores de whitespace.

## Riesgos pendientes

- Adapters reales `USB`, `SERIAL`, `HID`, `NETWORK` y `BLUETOOTH` siguen sin implementar.
- No hay token local fuerte para proteger el agent.
- No hay persistencia de profiles ni asignacion desde base de datos.
- Validacion con impresoras reales queda fuera de alcance.

## Confirmacion de restricciones

- No se conecto impresora real.
- No se instalaron drivers reales.
- No se uso `node-escpos`.
- No se uso USB real.
- No se uso `serialport`.
- No se uso HID real.
- No se integro Electron.
- No se integro Capacitor.
- No se modifico `api/` en esta fase.
- No se modifico `web/` en esta fase.
- No se modifico `database/` en esta fase.
- No se modifico `backend-reporteria/` en esta fase.
- No se modifico core de ventas, inventario, caja ni facturacion.
