# Evidencia QA operativo integral end-to-end MVP-01.3X RERUN

Fecha rerun: 2026-06-11 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_OPERATIVO_END_TO_END_BLOCKED`

## Contexto

Se recibio confirmacion de deploy y configuracion QA:

- `settle-partial` fix aplicado.
- `backend-reporteria` auth guard fix aplicado.
- `REPORTS_ALLOW_MOCK_AUTH=true` en QA.
- Runtime DB grants corregidos.
- `manus_tienda_qa` operativa.

Esta corrida re-ejecuto QA E2E por API/Web QA publica. No se corrigio codigo y no se detuvo en el primer error.

## Ambiente

| Item | Valor |
| --- | --- |
| API QA | `https://api.apptiendamanus.space/api` |
| Web QA | `https://www.apptiendamanus.space` |
| DB esperada | `manus_tienda_qa` |
| Tenant | `00000000-0000-0000-0000-000000000001` (`default`) |
| Branch | `ab41d3da-6686-4de3-9191-875a5a7da5a5` |
| Terminal API | `693921eb-d28d-4c1b-af17-087b589c6467` |
| POS terminal resuelto | `e186b5bd-4873-49bb-9450-f141570cce80` |
| Actor QA | `SUPER_ADMIN` seed |
| Run | `MVP013X-RERUN-20260611202132` |
| Rango reportes | `2026-06-11` a `2026-06-12` |

No se documentaron tokens, refresh tokens, passwords ni contenido de `.env`.

## Datos creados o usados

| Recurso | ID / valor |
| --- | --- |
| Cliente QA | `92020000-0000-0000-0000-000000000001` |
| Producto QA loteado | `92030000-0000-0000-0000-000000000001` |
| Lote balance fixture | `92060000-0000-0000-0000-000000000001` |
| Proveedor QA | `92010000-0000-0000-0000-000000000001` |
| Metodo pago CASH | `d08ecde7-0466-4f09-b874-2759cb8d8003` |
| Caja QA creada | `9004fa5f-58e8-4ad9-aeda-8be689047e32` |
| Sesion caja | `270a66c1-c7a9-4029-b444-15b3fc765c3f` |
| POS session | `7b666a3f-906d-462a-b732-5fe1d85b7deb` |
| Compra total pagada | `76f5f670-b842-4c13-8d6f-35da0b8093fa` |
| Compra parcial bloqueada | `ab57bd27-19ce-4dc1-ae99-67855c092f52` |
| Compra draft cancelada | `29be5a15-f7b1-4b9f-ad55-2331d82910f6` |
| Pedido | `9e5b1fb0-a463-4ccf-b40f-78cacbc1c456` |
| Venta desde pedido | `7a3ef413-fbe2-41c6-9722-29cfddcd0089` |
| Venta POS directa | `72778304-c252-4ce7-8be0-6b67c3e6bdd8` |

Cleanup ejecutado:

- La sesion de caja `270a66c1-c7a9-4029-b444-15b3fc765c3f` fue cerrada por API con `closingAmount=116000` y `differenceAmount=0`.
- No existe endpoint de cierre para `POST /api/pos/session`; se deja `posSessionId` documentado.

## Resumen

| Tipo | Total |
| --- | ---: |
| Checks ejecutados | 60 |
| PASS | 50 |
| FAIL/BLOCKED | 10 |
| P0 bloqueantes | 1 |
| P1 bloqueantes | 9 |
| P2 fallidos | 0 |

## Matriz QA

| modulo | endpoint/flujo | resultado | evidencia | prioridad | recomendacion |
| --- | --- | --- | --- | --- | --- |
| Web | `GET https://www.apptiendamanus.space` | PASS | HTTP 200, `text/html`. | P1 | Sin accion. |
| Web | `GET https://www.apptiendamanus.space/login` | PASS | HTTP 200, `text/html`. | P1 | Sin accion. |
| Health | `GET /api/system/version` | PASS | HTTP 200, `version=0.0.1`. | P1 | Agregar build/commit en MVP-05. |
| Health/Reporteria | `GET /api/reports/health` | PASS | HTTP 200, `status=ok`, `service=backend-reporteria`. | P1 | Sin accion. |
| Auth | `POST /api/auth/login/force` | PASS | HTTP 201, token recibido y no documentado. | P0 | Sin accion. |
| Auth | `GET /api/auth/me` | PASS | HTTP 200, rol `SUPER_ADMIN`, tenant `default`. | P0 | Sin accion. |
| Auth | `GET /api/auth/context` | PASS | HTTP 200, tenant, branch y terminal disponibles. | P0 | Sin accion. |
| Auth/RBAC | `GET /api/auth/menu` | PASS | HTTP 200, `menuCount=9`. | P1 | Sin accion. |
| Units | `GET /api/units` | PASS | HTTP 200, `count=4`, `UND` presente. | P0 | Sin accion. |
| Taxes | `GET /api/taxes` | PASS | HTTP 200, `count=2`, IVA presente. | P0 | Sin accion. |
| Productos | `GET /api/products?branchId=<branch>` | PASS | HTTP 200, `count=6`, fixture `QA-BASE-LOT-001` encontrado. | P0 | Sin accion. |
| Productos | `GET /api/products/:id` | PASS | HTTP 200, `sku=QA-BASE-LOT-001`, `requiresLot=true`. | P0 | Sin accion. |
| Inventario loteado | `GET /api/inventory/lot-balances?...` | PASS | HTTP 200, fixture encontrado, `quantityAvailable=24`. | P0 | Sin accion. |
| FE | `GET /api/electronic-invoicing/customers/default` | PASS | HTTP 200, `isFinalConsumer=true`. | P0 | Sin accion. |
| FE | `POST /api/electronic-invoicing/customers/default/ensure` | PASS | HTTP 201, idempotente. | P0 | Sin accion. |
| FE | `GET /api/electronic-invoicing/customers?search=QA Cliente FE Base` | PASS | HTTP 200, fixture encontrado. | P1 | Sin accion. |
| FE | `GET /api/electronic-invoicing/suppliers?search=QA Proveedor FE Base` | PASS | HTTP 200, fixture encontrado. | P1 | Sin accion. |
| FE | `POST /api/electronic-invoicing/customers/lookup` | PASS/WARN | HTTP 201, `provider=NONE`, `lookupStatus=SKIPPED`. | P2 | Configurar mock fiscal si se requiere `FOUND`. |
| FE | `POST /api/electronic-invoicing/suppliers/lookup` | PASS/WARN | HTTP 201, `provider=NONE`, `lookupStatus=SKIPPED`. | P2 | Configurar mock fiscal si se requiere `FOUND`. |
| Promociones | `GET /api/pricing/promotions?branchId=<branch>` | PASS/WARN | HTTP 200, `count=0`. | P2 | Crear fixture de promocion si MVP exige promo activa. |
| Pricing | `POST /api/pricing/preview-line` | PASS | HTTP 201, `lineTotal=12500`, sin promocion aplicada. | P1 | Sin accion. |
| Pagos | `GET /api/finance/payment-methods?active=true` | PASS | HTTP 200, metodo CASH activo. | P0 | Sin accion. |
| Caja | `GET /api/finance/cash-sessions/current` antes de abrir | PASS | HTTP 200, sin sesion actual. | P0 | Sin accion. |
| Caja | `POST /api/finance/cash-registers` | PASS | HTTP 201, caja QA creada. | P0 | Sin accion. |
| Caja | `POST /api/finance/cash-sessions/open` | PASS | HTTP 201, apertura `100000`. | P0 | Sin accion. |
| Caja | `GET /api/finance/cash-sessions/:id/summary` inicial | PASS | HTTP 200. | P0 | Sin accion. |
| POS | `GET /api/pos-terminals/resolve-current` | PASS | HTTP 200, `posTerminalId=e186b5bd-4873-49bb-9450-f141570cce80`, `mode=MOCK`. | P0 | Sin accion. |
| Perifericos MOCK | `GET /api/pos-terminals/:posTerminalId/peripherals` | PASS | HTTP 200, settings MOCK disponibles. | P1 | Sin accion. |
| POS | `POST /api/pos/session` | PASS | HTTP 201, `posSessionId=7b666a3f-906d-462a-b732-5fe1d85b7deb`. | P0 | Sin endpoint de cierre documentado. |
| Compras | `POST /api/purchases` compra total | PASS | HTTP 201, compra `76f5f670-b842-4c13-8d6f-35da0b8093fa`. | P0 | Sin accion. |
| Compras | `POST /api/purchases/:id/receive` total | PASS | HTTP 201, `status=RECEIVED`. | P0 | Sin accion. |
| Pagos | `POST /api/finance/payments` compra parcial | PASS | HTTP 201, pago `3000`. | P0 | Sin accion. |
| Pagos | `POST /api/finance/payments` compra completo | PASS | HTTP 201, pago `6000`. | P0 | Sin accion. |
| Compras | `GET /api/purchases/:id` post-pagos | PASS | HTTP 200, `status=RECEIVED`, `paymentStatus=PAID`, `balanceDue=0`. | P0 | Sin accion. |
| Compras | `POST /api/purchases` compra parcial | PASS | HTTP 201, compra `ab57bd27-19ce-4dc1-ae99-67855c092f52`. | P0 | Sin accion. |
| Compras | `POST /api/purchases/:id/receive` parcial | PASS | HTTP 201, `status=PARTIAL`, recibido `1`. | P0 | Sin accion. |
| Compras | `PATCH /api/purchases/:id/settle-partial` | BLOCKED | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}`. | P0 | Fix no fue efectivo en QA o queda otra causa runtime. Requiere logs API QA o nuevo fix. |
| Compras | `GET /api/purchases/:id` post-fallo settle | PASS | HTTP 200, `status=PARTIAL`, `paymentStatus=PENDING`, `total=18000`, `balanceDue=18000`, `received=1`, `pending=1`, `totalLiquidado=null`. | P0 | Usar como estado base para diagnostico. |
| Compras | `PATCH /api/purchases/:id/cancel` draft | PASS | HTTP 200, compra draft cancelada. | P1 | Sin accion. |
| Pedidos | `POST /api/orders` | PASS | HTTP 201, `status=DRAFT`. | P0 | Sin accion. |
| Pedidos | `POST /api/orders/:id/confirm` | PASS | HTTP 201, `status=CONFIRMED`. | P0 | Sin accion. |
| Pedidos | `POST /api/orders/:id/deliver` | PASS | HTTP 201, `status=COMPLETED`. | P0 | Sin accion. |
| Pedidos/Invoice | `POST /api/orders/:id/invoice` | PASS | HTTP 201, venta `7a3ef413-fbe2-41c6-9722-29cfddcd0089`, `paymentStatus=PAID`. | P0 | Sin accion. |
| POS/Ventas | `POST /api/sales` | PASS | HTTP 201, venta `72778304-c252-4ce7-8be0-6b67c3e6bdd8`, `paymentStatus=PAID`. | P0 | Sin accion. |
| Ventas | `GET /api/sales` | PASS | HTTP 200, `count=4`. | P1 | Sin accion. |
| Ventas | `GET /api/sales/:id` | PASS | HTTP 200, total `12500`. | P1 | Sin accion. |
| Caja | `GET /api/finance/cash-movements?includeSummary=true` | PASS | HTTP 200, `movementCount=5`, `totalIn=125000`, `totalOut=9000`. | P0 | Sin accion. |
| Caja | `GET /api/finance/cash-sessions/:id/summary` post-flujos | PASS | HTTP 200, `salesPayments=25000`, `purchasePayments=9000`. | P0 | Sin accion. |
| Caja | `POST /api/finance/cash-sessions/:id/close` | PASS | HTTP 201, `status=CLOSED`, `closingAmount=116000`, `difference=0`. | P0 | Sin accion. |
| Caja | `GET /api/finance/cash-sessions/current` post-cierre | PASS | HTTP 200, sin sesion abierta. | P2 | Sin accion. |
| Reporteria/Auth | `GET /api/reports/health` con Bearer invalido | PASS | HTTP 200. Confirma fallback `REPORTS_ALLOW_MOCK_AUTH=true`. | P1 | Auth guard fix esta activo. |
| Reporteria/Auth | `GET /api/reports/demo` con Bearer invalido | PASS | HTTP 200. Confirma actor mock autorizado. | P1 | El 500 no parece ser auth guard. |
| Reporteria | `GET /api/reports/purchases` | FAIL | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}` en corrida principal; aislamiento con Bearer invalido devolvio HTTP 500 body vacio. | P1 | Revisar adapter/SQL/function/grants de reporte compras. |
| Reporteria | `GET /api/reports/purchases/:purchaseId/ticket` | FAIL | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}`. | P1 | Revisar ticket compra y funcion asociada. |
| Reporteria | `GET /api/reports/cash-closings` | FAIL | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}`. | P1 | Revisar adapter/SQL/function/grants de cierre caja. |
| Reporteria | `GET /api/reports/cash-closings/:cashSessionId/ticket` | FAIL | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}`. | P1 | Revisar ticket cierre caja. |
| Reporteria | `GET /api/reports/pos-sales` | FAIL | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}`. | P1 | Endpoint funcional real para ventas POS; revisar adapter/SQL/function. |
| Reporteria | `GET /api/reports/pos-sales/:saleId/ticket` | FAIL | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}`. | P1 | Revisar ticket venta POS. |
| Reporteria | `GET /api/reports/order-sales` | FAIL | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}`. | P1 | Endpoint funcional real para pedidos; revisar adapter/SQL/function. |
| Reporteria | `GET /api/reports/order-sales/:orderId/ticket` | FAIL | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}`. | P1 | Revisar ticket pedido. |
| Reporteria | `GET /api/reports/customers/orders-status` | FAIL | HTTP 500, body `{"statusCode":500,"message":"Internal server error"}`. | P1 | Endpoint funcional real para clientes; revisar adapter/SQL/function. |

Nota sobre endpoints de reporteria:

- La Web actual usa `pos-sales`, `order-sales` y `customers/orders-status`.
- Los nombres solicitados `reports/sales`, `reports/orders` y `reports/customers` se validaron como flujos funcionales mediante sus rutas reales.

## Backlog priorizado

### P0

1. `Compras - PATCH /api/purchases/:id/settle-partial` sigue devolviendo HTTP 500.
   Impacto: bloquea liquidacion parcial de compras.
   Evidencia: compra `ab57bd27-19ce-4dc1-ae99-67855c092f52` queda `PARTIAL`, `balanceDue=18000`, `totalLiquidado=null`.
   Recomendacion: revisar logs API QA del request y confirmar si el binario desplegado contiene el fix; si si, diagnosticar nueva excepcion runtime.

### P1

1. `GET /api/reports/purchases` devuelve HTTP 500.
2. `GET /api/reports/purchases/:purchaseId/ticket` devuelve HTTP 500.
3. `GET /api/reports/cash-closings` devuelve HTTP 500.
4. `GET /api/reports/cash-closings/:cashSessionId/ticket` devuelve HTTP 500.
5. `GET /api/reports/pos-sales` devuelve HTTP 500.
6. `GET /api/reports/pos-sales/:saleId/ticket` devuelve HTTP 500.
7. `GET /api/reports/order-sales` devuelve HTTP 500.
8. `GET /api/reports/order-sales/:orderId/ticket` devuelve HTTP 500.
9. `GET /api/reports/customers/orders-status` devuelve HTTP 500.

Diagnostico acotado:

- `GET /api/reports/health` PASS.
- `GET /api/reports/demo` con Bearer invalido PASS.
- `REPORTS_ALLOW_MOCK_AUTH=true` parece activo.
- Por tanto, el bloqueo P1 no parece ser el auth guard. Queda en adapter, SQL/function, DB grants runtime de reporteria, drift de queries, o dependencia PDF/datos.

### P2

1. FE lookup sigue en `provider=NONE`, `lookupStatus=SKIPPED`.
2. `GET /api/pricing/promotions` responde `count=0`.
3. No existe endpoint publico de cierre de `pos/session`; se deja `posSessionId` documentado.
4. `GET /api/system/version` solo devuelve `version=0.0.1`.

## Restricciones cumplidas

- No se corrigio codigo.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se reinicio PM2.
- No se hicieron escrituras directas en DB.
- Las escrituras fueron solo por API QA.
- No se toco `manus_tienda`.
- No se documentaron secretos ni tokens.

## Decision

```text
QA_OPERATIVO_END_TO_END_BLOCKED
```

Bloqueo exacto P0:

```text
PATCH /api/purchases/ab57bd27-19ce-4dc1-ae99-67855c092f52/settle-partial
=> HTTP 500
=> {"statusCode":500,"message":"Internal server error"}
```

Bloqueos P1:

```text
GET /api/reports/purchases
GET /api/reports/purchases/:purchaseId/ticket
GET /api/reports/cash-closings
GET /api/reports/cash-closings/:cashSessionId/ticket
GET /api/reports/pos-sales
GET /api/reports/pos-sales/:saleId/ticket
GET /api/reports/order-sales
GET /api/reports/order-sales/:orderId/ticket
GET /api/reports/customers/orders-status
=> HTTP 500
=> {"statusCode":500,"message":"Internal server error"}
```
