# Evidencia QA - Web ESC/POS preview - Fase 4.1

## Objetivo

Validar que la pantalla Web de perifericos muestra respuestas enriquecidas del `backend-perifericos` en modo ESC/POS MOCK: preview textual, comandos conceptuales, resultado de accion y estado MOCK.

## Alcance

- Ruta Web: `/00000000-0000-0000-0000-000000000001/admin/peripherals`.
- Cliente HTTP local de perifericos.
- Acciones `POST /printer/test-print`, `POST /printer/print-ticket` y `POST /cash-drawer/open`.
- Panel de resultado, preview, comandos, copiar preview y limpiar resultado.
- Build Web y validaciones backend-perifericos.

Fuera de alcance:

- Hardware real.
- Drivers reales.
- ESC/POS real.
- USB.
- `serialport`.
- Electron.
- Capacitor.
- Cambios en `database/`, `backend-reporteria/` o core de negocio.

## Archivos modificados

- `web/domains/peripherals/types.ts`
- `web/domains/peripherals/api.ts`
- `web/domains/peripherals/components/PeripheralsPage.tsx`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`
- `docs/evidencia-qa-web-escpos-preview-fase-4-1.md`

## Implementacion validada

- `PrintCommand`, `PrintJobResponse` y `CashDrawerResponse` agregados.
- `testPrint` tipado con preview y comandos.
- `printMockTicket` envia ticket demo `SALE`.
- `openCashDrawer` tipado con comandos conceptuales.
- Panel `PeripheralActionResult` muestra modo, `jobId`, `commandId`, `deviceId` y `terminalId`.
- Panel `PeripheralPrintPreviewPanel` muestra preview con fuente monoespaciada.
- Panel `PeripheralCommandList` muestra comandos conceptuales.
- Boton copiar preview implementado con `navigator.clipboard.writeText`.
- Boton limpiar resultado implementado.
- Errores no borran automaticamente el ultimo preview exitoso.
- WebSocket mantiene eventos existentes y no consume preview desde eventos.

## Acciones probadas

Smoke local con `backend-perifericos` temporal:

| Accion | Resultado |
| --- | --- |
| `GET /health` | `ok` |
| `GET /devices` | 4 dispositivos |
| `POST /printer/test-print` | `preview=true`, `INIT=true`, `CUT=true` |
| `POST /printer/print-ticket` | `preview=true`, total visible |
| `POST /cash-drawer/open` | `CASH_DRAWER_PULSE=true` |
| `GET /logs` | `200` |
| Web route `localhost:3000/.../admin/peripherals` | `200` |

## Ejemplo breve de preview

```text
               Castro & Cespedes
------------------------------------------------
Tipo                                        SALE
Terminal                          local-terminal
Device                          mock-printer-001
Cajero                                    Caja 1
Documento                            FV-MOCK-001
```

## Comandos conceptuales visibles

- `INIT`
- `ALIGN_CENTER`
- `ALIGN_LEFT`
- `ALIGN_RIGHT`
- `FEED`
- `CUT`
- `CASH_DRAWER_PULSE`

## Build y tests

| Componente | Comando | Resultado |
| --- | --- | --- |
| `backend-perifericos` | `npm.cmd run build` | PASS |
| `backend-perifericos` | `npm.cmd test` | PASS, 20 tests |
| `web` | `npm.cmd run build` | PASS |
| `web` | `npm.cmd test` | No existe script `test` |

El build de `web` mantiene warnings existentes de hooks e imagenes, sin fallar.

## OpenSpec y Git

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate add-pos-peripherals-platform --type change --strict` | PASS, change valid |
| `git diff --check` | PASS, sin errores de whitespace; Git reporto warnings LF/CRLF en archivos existentes |
| `git status --short` | PASS, muestra cambios acumulados del cambio `add-pos-peripherals-platform` |
| `rg -n "[ \t]+$" web/domains/peripherals docs/evidencia-qa-web-escpos-preview-fase-4-1.md openspec/changes/add-pos-peripherals-platform/tasks.md` | PASS, sin trailing whitespace |

## Riesgos pendientes

- No se ejecuto click visual automatizado de copiar/limpiar por falta de herramienta Browser operativa en este entorno.
- La ruta Web respondio `200` y el build tipado paso; la validacion visual final queda recomendada con navegador humano.
- El preview es MOCK y no garantiza layout identico en una impresora termica real futura.

## Confirmacion de restricciones

- No se conecto impresora real.
- No se instalaron drivers.
- No se uso ESC/POS real.
- No se uso USB.
- No se uso `serialport`.
- No se integro Electron.
- No se integro Capacitor.
- No se modifico `database/`.
- No se modifico `backend-reporteria/`.
- No se modifico core de ventas, inventario, caja ni facturacion.
