# Evidencia QA - Fase 12.2 - QA Manual Autenticado

## Objetivo

Validar de forma autenticada los flujos operativos MOCK ya integrados con `backend-perifericos`, sin conectar hardware real y sin avanzar a fases de impresion real.

## Alcance

- Tenant validado: `00000000-0000-0000-0000-000000000001`.
- API local: `http://localhost:4020/api`.
- Web local: `http://localhost:3001`.
- Agent perifericos MOCK: `http://localhost:4050`.
- WebSocket agent: `ws://localhost:4050/peripherals`.

Nota de ambiente: `localhost:3000` estaba ocupado por otro proceso que devolvia `404` en `/login`. El servidor web de QA levanto en `localhost:3001`.

## Limitacion de navegador

La herramienta de navegador in-app no quedo disponible durante esta fase. El intento de usar `node_repl` fallo con `node_repl kernel exited unexpectedly` y luego solo quedaron expuestas herramientas parciales sin navegacion/click/screenshot. Tampoco habia Playwright/Puppeteer local en `web/node_modules`.

Por eso esta fase queda como QA autenticado parcial: se validaron API, rutas HTTP, contratos frontend, agent MOCK, WebSocket, RBAC y logs; no se pudo completar click a click el flujo visual autenticado en navegador ni tomar capturas.

## Usuarios utilizados

- `SUPER_ADMIN`: `icastror@hotmail.com`.
- `ADMIN`: `admin+default@manustienda.local`.
- `USER`: `user+default@manustienda.local`.

No se documentan passwords ni tokens.

## Migraciones aplicadas

Validado en `migrations_history`:

- `V053__products_sale_model_phase_11_1.sql`: `success=true`.
- `V054__pos_terminal_peripheral_settings_phase_12.sql`: `success=true`.

## Terminal utilizada

Terminal configurada:

- `pos_terminal_id`: `1111399d-8810-47f6-a1a8-7ae1ea5ce155`.
- `terminalId/code`: `local-terminal`.
- `branch_id`: `ab41d3da-6686-4de3-9191-875a5a7da5a5`.
- `mode`: `MOCK`.
- `printer_device_id`: `mock-printer-001`.
- `cash_drawer_device_id`: `mock-cashdrawer-001`.
- `scale_device_id`: `mock-scale-001`.
- `scanner_device_id`: `mock-scanner-001`.

## Checks base

- `GET /health`: `status=ok`, `mode=MOCK`.
- `GET /devices`: responde devices MOCK.
- `GET /logs`: responde logs.
- Web routes HTTP:
  - `/login`: `200`.
  - `/00000000-0000-0000-0000-000000000001/pos`: `200`.
  - `/00000000-0000-0000-0000-000000000001/admin/peripherals`: `200`.

## Resultados QA-01 a QA-15

| Caso | Resultado | Evidencia |
| --- | --- | --- |
| QA-01 Venta efectivo | PASS parcial | `runSalePeripheralOperations()` con pago `CASH` retorno `Ticket MOCK enviado` y `Caja MOCK abierta`. Logs tienen `printer.ticket_print.*` y `cashdrawer.open.simulated` con reason `SALE_CASH_PAYMENT`. No se ejecuto click visual/persistencia en navegador por limitacion de Browser. |
| QA-02 Venta no efectivo | PASS parcial | `runSalePeripheralOperations()` con pago `CARD` retorno solo `Ticket MOCK enviado`. No abrio caja. |
| QA-03 Compra efectivo | PASS parcial | `runPurchasePeripheralOperations()` con pago `CASH` retorno `Ticket MOCK de compra enviado` y `Caja MOCK abierta`. Logs tienen reason `PURCHASE_CASH_PAYMENT`. |
| QA-04 Compra credito | PASS parcial | `runPurchasePeripheralOperations()` sin pagos retorno solo `Ticket MOCK de compra enviado`. No abrio caja. |
| QA-05 Pedido con abono efectivo | PASS parcial | `runOrderPeripheralOperations()` con pago `CASH` retorno `Ticket MOCK de pedido enviado` y `Caja MOCK abierta`. Logs tienen reason `ORDER_CASH_PAYMENT`. |
| QA-06 Pedido sin abono | PASS parcial | `runOrderPeripheralOperations()` sin pagos retorno solo `Ticket MOCK de pedido enviado`. No abrio caja. |
| QA-07 Scanner MOCK | PASS parcial | `POST /scanner/simulate` con `46564567` emitio evento y WebSocket recibio `scanner.code.read`. API catalogo incluye producto `Aceite` con `primaryBarcode=46564567`, `barcodeCodes=["46564567"]`, stock `145`. Codigo `99999999` no tiene match en DB. No se observo carrito visual por limitacion de Browser. |
| QA-08 Balanza MOCK producto WEIGHT | PASS parcial | `GET /scale/current-weight` retorno `1.25 kg`, `stable=true`. Catalogo tiene producto `Cafe` con `saleType=WEIGHT`, `measurementUnit=KG`. No se observo cantidad en carrito visual por limitacion de Browser. |
| QA-09 Producto UNIT | PASS parcial | Catalogo tiene productos `UNIT/UND`; `Aceite` es `UNIT/UND`. `PosScreen.tsx` prioriza `saleType=UNIT` como no pesable. |
| QA-10 Producto BOTH | PASS parcial | Catalogo tiene `Arroz` y `Azucar` con `saleType=BOTH`, `measurementUnit=LB`. `PosScreen.tsx` considera `BOTH` como pesable y permite venta unidad/peso. |
| QA-11 Admin Peripherals | PASS parcial | Rutas HTTP y agent endpoints responden. `POST /devices` registro `network-printer-qa-12-2` seguro. `NETWORK` imprime con `400` por feature flag real apagado. No se valido pantalla visual por limitacion de Browser. |
| QA-12 RBAC | PASS | `SUPER_ADMIN` y `ADMIN` reciben menu perifericos. `USER` no recibe `POS_PERIPHERALS`. DB confirma permisos para `SUPER_ADMIN`, `SUPER_USER`, `ADMIN` y exclusion de `USER`. |
| QA-13 Agent offline | PASS parcial | Contrato `getPeripheralAgentHealth()` con URL offline retorno `success=false`, `error.code=AGENT_OFFLINE`. No se detuvo el proceso real de `4050` para no cortar el stack local activo. |
| QA-14 Fallback terminal | PASS parcial | `resolvePeripheralTerminalConfig()` con API base offline retorno `source=FALLBACK_MOCK`, `local-terminal`, `mock-printer-001`, `mock-cashdrawer-001`, `mock-scale-001`, `mock-scanner-001`. No se deshabilito la terminal real para no mutar DB de QA. |
| QA-15 Build final | PASS | `api` build PASS, `api` tests PASS, `web` build PASS con warnings preexistentes de lint, `backend-perifericos` build PASS, `backend-perifericos` tests PASS. OpenSpec y formato se validan al cierre. |

## Resultados de contratos MOCK

Salida resumida de contratos frontend:

- Venta CASH: `Ticket MOCK enviado`, `Caja MOCK abierta`.
- Venta CARD: `Ticket MOCK enviado`.
- Compra CASH: `Ticket MOCK de compra enviado`, `Caja MOCK abierta`.
- Compra credito/sin pago: `Ticket MOCK de compra enviado`.
- Pedido CASH: `Ticket MOCK de pedido enviado`, `Caja MOCK abierta`.
- Pedido pendiente/sin abono: `Ticket MOCK de pedido enviado`.

## Resultados scanner y balanza

- `scanner.code.read` con `46564567`: emitido y recibido por WebSocket.
- `scanner.code.read` con `99999999`: emitido para validar warning esperado en POS.
- `GET /products?branchId=...`: incluye `primaryBarcode`, `barcodeCodes`, `barcodes[]`, `saleType`, `measurementUnit`.
- `GET /scale/current-weight`: `weight=1.25`, `unit=kg`, `stable=true`.

## Bugs encontrados

No se encontro bug funcional nuevo en codigo durante esta fase.

Limitaciones de QA:

- Browser in-app no disponible para interaccion autenticada visual.
- `localhost:3000` ocupado por otro proceso; web QA uso `localhost:3001`.
- No se detuvo `backend-perifericos` real en `4050`; offline se valido con URL invalida para evitar cortar stack local.
- No se deshabilito la terminal configurada en DB; fallback se valido por API base offline.

## Fixes realizados

Ninguno. Esta fase fue QA-only.

## Comandos ejecutados

- `openspec.cmd status --change add-pos-peripherals-platform`
- `openspec.cmd instructions apply --change add-pos-peripherals-platform`
- `Invoke-WebRequest` para `/login`, `/pos`, `/admin/peripherals`, `/health`, `/devices`, `/logs`.
- `Invoke-RestMethod` para login `SUPER_ADMIN`, `ADMIN`, `USER`.
- `Invoke-RestMethod` para `POST /printer/test-print`, `POST /cash-drawer/open`, `GET /scale/current-weight`, `POST /scanner/simulate`, `POST /devices`.
- `npx.cmd tsx -e` para contratos de venta/compra/pedido, offline agent y fallback terminal.
- `psql` local para validar migraciones, RBAC, terminal y productos.

## Resultados build/test

- `api npm.cmd run build`: PASS.
- `api npx.cmd tsx --test "src/**/*.spec.ts"`: PASS, `377` tests pass, `1` skipped.
- `web npm.cmd run build`: PASS. Warnings de lint preexistentes en hooks y `<img>`.
- `web npm.cmd test`: no existe script de test frontend.
- `backend-perifericos npm.cmd run build`: PASS.
- `backend-perifericos npm.cmd test`: PASS, `33` tests pass.
- `openspec.cmd validate add-pos-peripherals-platform --type change --strict`: PASS.
- `git diff --check`: PASS, solo warnings CRLF de Git.

## Riesgos pendientes

- Ejecutar manualmente en navegador real los casos QA-01 a QA-14 con click/login/carrito/formularios.
- Confirmar visualmente WebSocket y toasts desde `/admin/peripherals` y `/pos`.
- Confirmar persistencia real de venta/compra/pedido desde UI autenticada.
- Confirmar screenshots si se requiere evidencia visual.

## Restricciones cumplidas

- No se conecto hardware real.
- No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No se uso USB, serialport ni HID.
- No se instalaron drivers.
- No se integro Electron.
- No se integro Capacitor.
- No se modifico `backend-reporteria/`.
- No se avanzo a Fase 13.
