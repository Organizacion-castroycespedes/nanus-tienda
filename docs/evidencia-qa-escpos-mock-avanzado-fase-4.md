# Evidencia QA - ESC/POS MOCK avanzado - Fase 4

## Objetivo

Validar que `backend-perifericos` genera tickets termicos MOCK tipo ESC/POS, preview textual, comandos conceptuales y apertura de caja mock sin hardware real.

## Alcance

- `POST /printer/test-print`.
- `POST /printer/print-ticket`.
- `POST /cash-drawer/open`.
- `GET /health`.
- `GET /devices`.
- `GET /logs`.
- Logs tecnicos en memoria.
- Eventos WebSocket mock de impresion sin preview completo.

Fuera de alcance:

- Impresora real.
- ESC/POS real en bytes.
- USB real.
- Serial real.
- `serialport`.
- `node-escpos`.
- Drivers reales.
- Electron.
- Capacitor.

## Archivos modificados

- `backend-perifericos/src/shared/config/peripherals.config.ts`
- `backend-perifericos/src/shared/escpos-mock/escpos-mock.types.ts`
- `backend-perifericos/src/shared/escpos-mock/thermal-ticket.formatter.ts`
- `backend-perifericos/src/modules/printer/printer.types.ts`
- `backend-perifericos/src/modules/printer/printer.service.ts`
- `backend-perifericos/src/modules/cash-drawer/cash-drawer.types.ts`
- `backend-perifericos/src/modules/cash-drawer/cash-drawer.service.ts`
- `backend-perifericos/test/mock-simulator.spec.ts`
- `backend-perifericos/README.md`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`

## Configuracion validada

| Variable | Default | Resultado |
| --- | --- | --- |
| `PERIPHERALS_PRINTER_WIDTH_CHARS` | `48` | PASS |
| `PERIPHERALS_MODE` | `MOCK` | PASS |

El ancho de preview es conceptual para 80mm y puede variar segun fuente o impresora real futura.

## Ejemplo de preview

```text
               Castro & Cespedes
------------------------------------------------
Tipo                                        SALE
Fecha                   2026-06-04T04:04:05.904Z
Terminal                          local-terminal
Device                          mock-printer-001
Cajero                                    Caja 1
Documento                            FV-MOCK-001
------------------------------------------------
ITEMS
```

El preview completo se retorna en response HTTP, pero no se guarda en logs ni se envia por WebSocket.

## Comandos conceptuales validados

Impresion:

- `INIT`
- `ALIGN_CENTER`
- `BOLD_ON`
- `BOLD_OFF`
- `ALIGN_LEFT`
- `ALIGN_RIGHT`
- `FEED`
- `CUT`

Caja:

- `INIT`
- `CASH_DRAWER_PULSE`

No se generan ni envian bytes reales.

## Build y tests

```powershell
cd backend-perifericos
npm.cmd run build
npm.cmd test
```

Resultado:

- Build: PASS.
- Tests: PASS, 20 tests, 20 pass.

Cobertura agregada:

- `test-print` retorna preview.
- `print-ticket` retorna preview.
- Preview incluye total.
- Preview respeta ancho configurable.
- Comandos incluyen `INIT` y `CUT`.
- Cash drawer incluye `CASH_DRAWER_PULSE`.
- Logs no guardan preview completo.
- Eventos de impresion no guardan preview completo.
- Endpoints runtime siguen resolviendo servicios Nest.

## Smoke curl

Servicio levantado temporalmente con:

```powershell
cd backend-perifericos
npm.cmd run start
```

Resultados:

| Endpoint | Resultado |
| --- | --- |
| `GET /health` | `200` |
| `GET /devices` | `200` |
| `POST /printer/test-print` | PASS, `preview=true`, `commands=9` |
| `POST /printer/print-ticket` | PASS, `preview=true`, `commands=8`, `hasTotal=true` |
| `POST /cash-drawer/open` | PASS, `INIT,CASH_DRAWER_PULSE` |
| `GET /logs` | `200` |

El proceso temporal fue detenido al finalizar el smoke.

## OpenSpec y Git

| Comando | Resultado |
| --- | --- |
| `openspec.cmd validate add-pos-peripherals-platform --type change --strict` | PASS, change valid |
| `git diff --check` | PASS, sin errores de whitespace; Git reporto warnings LF/CRLF en archivos existentes |
| `git status --short` | PASS, muestra cambios acumulados del cambio `add-pos-peripherals-platform` |

## Riesgos pendientes

- No hay drivers reales ni certificacion de modelos de impresora.
- El ancho `48` depende de fuente, firmware y papel real en fases futuras.
- `CASH_DRAWER_PULSE` es conceptual; no abre caja fisica.
- Falta validacion con impresoras ESC/POS reales en una fase aprobada posterior.

## Confirmacion de restricciones

- No se conecto impresora real.
- No se conecto caja real.
- No se uso USB real.
- No se uso serial real.
- No se instalo `serialport`.
- No se instalo `node-escpos`.
- No se instalaron drivers.
- No se modifico `api/`.
- No se modifico `web/`.
- No se modifico `database/`.
- No se modifico `backend-reporteria/`.
- No se modifico core de ventas, inventario, caja ni facturacion.
