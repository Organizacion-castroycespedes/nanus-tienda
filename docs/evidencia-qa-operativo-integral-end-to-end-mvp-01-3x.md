# Evidencia QA operativo integral end-to-end MVP-01.3X FINAL CONFIRMATION

Fecha ejecucion: 2026-06-12 UTC / 2026-06-11 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_OPERATIVO_END_TO_END_READY`

## Contexto

Se re-ejecuto QA E2E final sobre QA AWS despues de los fixes P0/P1.
La confirmacion final se ejecuto despues de aplicar `V061` en QA y reiniciar `backend-reporteria`.
Primero se valido `GET /api/reports/pos-sales`; luego se ejecuto smoke E2E corto con llamadas GET autenticadas sobre datos QA existentes.

Restricciones cumplidas:

- No se corrigio codigo.
- No se ejecutaron migraciones.
- No se hizo deploy.
- No se reinicio PM2.
- No se hicieron escrituras directas en DB.
- Las escrituras del rerun base fueron solo por API QA.
- La confirmacion final no hizo escrituras; solo uso API QA autenticada.
- No se toco `manus_tienda`.
- No se documentaron tokens, refresh tokens, passwords ni contenido de `.env`.

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
| Run base | `MVP013X-FINAL-20260612024947` |
| Run confirmacion | `MVP013X-FINAL-CONFIRM-20260612033347` |
| Rango reportes | `2026-06-11` a `2026-06-13` |

## Datos creados o usados

| Recurso | ID / valor |
| --- | --- |
| Cliente QA | `92020000-0000-0000-0000-000000000001` |
| Producto QA loteado | `92030000-0000-0000-0000-000000000001` |
| Proveedor QA | `92010000-0000-0000-0000-000000000001` |
| Metodo pago CASH | `d08ecde7-0466-4f09-b874-2759cb8d8003` |
| Caja QA final | `2c0ff9fc-cd38-44e1-916b-078ed6766d76` |
| Sesion caja | `043329b0-c125-400b-b5e6-0a9273360963` |
| POS session | `fd27f7d1-1917-4283-ad39-7de5ad201e4c` |
| Compra total pagada | `102f0b60-06e2-4b59-a982-233154bf9c95` |
| Compra parcial liquidada | `e6bf7ebb-4c4c-40bf-a73a-ee9dc6154630` |
| Pedido | `01512703-2f9f-46a8-988a-f6e0e5861fec` |
| Venta desde pedido | `c879fdb1-65c8-4d4c-83bc-982e2fb75018` |
| Venta POS directa | `6b6dab84-7d8f-4b8f-8d36-0ce81a0f5ea1` |

Cleanup ejecutado:

- La sesion de caja `043329b0-c125-400b-b5e6-0a9273360963` fue cerrada por API con `closingAmount=110000`.

## Resumen

| Tipo | Total |
| --- | ---: |
| Checks ejecutados base | 52 |
| PASS acumulado | 52 |
| FAIL/BLOCKED | 0 |
| P0 bloqueantes | 0 |
| P1 bloqueantes | 0 |
| P2 fallidos | 0 |
| Smoke confirmacion V061 | 14/14 PASS |
| Confirmaciones totales | 15/15 PASS |

## Confirmacion final V061

| Validacion | Resultado | Evidencia |
| --- | --- | --- |
| `GET /api/reports/pos-sales` primero | PASS | HTTP 200 JSON, `rows=8`, `summaryCount=8`. |
| `GET /api/purchases/e6bf7ebb-4c4c-40bf-a73a-ee9dc6154630` | PASS | HTTP 200, `status=CERRADA_PARCIAL`, `paymentStatus=PAID`, `balanceDue=0`. |
| `GET /api/reports/purchases` | PASS | HTTP 200 JSON, `rows=9`, `summaryCount=9`. |
| `GET /api/reports/cash-closings` | PASS | HTTP 200 JSON, `rows=5`, `summaryCount=5`. |
| `GET /api/reports/pos-sales` smoke | PASS | HTTP 200 JSON, `rows=8`, `summaryCount=8`. |
| `GET /api/reports/order-sales` | PASS | HTTP 200 JSON, `rows=4`, `summaryCount=4`. |
| `GET /api/reports/customers/orders-status` | PASS | HTTP 200 JSON, `rows=1`, `summaryCount=1`. |
| `GET /api/reports/purchases/102f0b60-06e2-4b59-a982-233154bf9c95/ticket` | PASS | HTTP 200 PDF, `bytes=3007`. |
| `GET /api/reports/cash-closings/043329b0-c125-400b-b5e6-0a9273360963/ticket` | PASS | HTTP 200 PDF, `bytes=3214`. |
| `GET /api/reports/pos-sales/6b6dab84-7d8f-4b8f-8d36-0ce81a0f5ea1/ticket` | PASS | HTTP 200 PDF, `bytes=3140`. |
| `GET /api/reports/order-sales/01512703-2f9f-46a8-988a-f6e0e5861fec/ticket` | PASS | HTTP 200 PDF, `bytes=3021`. |
| `GET /api/sales/6b6dab84-7d8f-4b8f-8d36-0ce81a0f5ea1` | PASS | HTTP 200, `status=CONFIRMED`, `paymentStatus=PAID`, `total=12500`. |
| `GET /api/orders/01512703-2f9f-46a8-988a-f6e0e5861fec` | PASS | HTTP 200, `status=COMPLETED`, `paymentStatus=PAID`, `total=12500`. |
| `GET /api/finance/cash-sessions/043329b0-c125-400b-b5e6-0a9273360963/summary` | PASS | HTTP 200, `status=CLOSED`. |
| `GET /api/finance/cash-movements?cashSessionId=043329b0-c125-400b-b5e6-0a9273360963&includeSummary=true` | PASS | HTTP 200 JSON, `items=7`. |

## Matriz QA

| modulo | endpoint/flujo | resultado | evidencia | prioridad | recomendacion |
| --- | --- | --- | --- | --- | --- |
| Web | `GET https://www.apptiendamanus.space` | PASS | HTTP 200, `text/html`. | P1 | Sin accion. |
| Health | `GET /api/system/version` | PASS | HTTP 200, `version=0.0.1`. | P1 | Sin accion. |
| Health/Reporteria | `GET /api/reports/health` | PASS | HTTP 200, `status=ok`. | P1 | Sin accion. |
| Auth | `POST /api/auth/login/force` | PASS | HTTP 201, actor `SUPER_ADMIN`, token recibido y no documentado. | P0 | Sin accion. |
| Auth | `GET /api/auth/me` | PASS | HTTP 200, role `SUPER_ADMIN`, tenant `default`. | P0 | Sin accion. |
| Auth | `GET /api/auth/context` | PASS | HTTP 200, `tenants=1`. | P0 | Sin accion. |
| Auth/RBAC | `GET /api/auth/menu` | PASS | HTTP 200, `menuCount=9`. | P1 | Sin accion. |
| Units | `GET /api/units` | PASS | HTTP 200, `count=4`. | P0 | Sin accion. |
| Taxes | `GET /api/taxes` | PASS | HTTP 200, `count=2`. | P0 | Sin accion. |
| Productos | `GET /api/products?branchId=<branch>` | PASS | HTTP 200, `count=6`, fixture encontrado. | P0 | Sin accion. |
| Inventario loteado | `GET /api/inventory/lot-balances?...` | PASS | HTTP 200, `count=8`. | P0 | Sin accion. |
| FE base | `GET /api/electronic-invoicing/customers/default` | PASS | HTTP 200, default presente. | P0 | Sin accion. |
| FE base | `POST /api/electronic-invoicing/customers/default/ensure` | PASS | HTTP 201, idempotente. | P0 | Sin accion. |
| Pagos | `GET /api/finance/payment-methods?active=true` | PASS | HTTP 200, `count=1`. | P0 | Sin accion. |
| Caja | `POST /api/finance/cash-registers` | PASS | HTTP 201, caja `2c0ff9fc-cd38-44e1-916b-078ed6766d76`. | P0 | Sin accion. |
| Caja | `GET /api/finance/cash-sessions/current` | PASS | HTTP 200, sin sesion previa para caja nueva. | P0 | Sin accion. |
| Caja | `POST /api/finance/cash-sessions/open` | PASS | HTTP 201, sesion `043329b0-c125-400b-b5e6-0a9273360963`. | P0 | Sin accion. |
| Caja | `GET /api/finance/cash-sessions/:id/summary` inicial | PASS | HTTP 200, `expected=100000`. | P0 | Sin accion. |
| POS | `GET /api/pos-terminals/resolve-current` | PASS | HTTP 200, `mode=MOCK`, `posTerminalId=e186b5bd-4873-49bb-9450-f141570cce80`. | P0 | Sin accion. |
| Perifericos MOCK | `GET /api/pos-terminals/:id/peripherals` | PASS | HTTP 200, `printSale=true`, `scanner=true`. | P1 | Sin accion. |
| POS | `POST /api/pos/session` | PASS | HTTP 201, `posSessionId=fd27f7d1-1917-4283-ad39-7de5ad201e4c`. | P0 | Sin accion. |
| Compras | `POST /api/purchases` compra total | PASS | HTTP 201, compra `102f0b60-06e2-4b59-a982-233154bf9c95`. | P0 | Sin accion. |
| Compras | `POST /api/purchases/:id/receive` total | PASS | HTTP 201, `status=RECEIVED`. | P0 | Sin accion. |
| Pagos | `POST /api/finance/payments` compra parcial | PASS | HTTP 201, pago `4000`. | P0 | Sin accion. |
| Pagos | `POST /api/finance/payments` compra completo | PASS | HTTP 201, pago `5000`. | P0 | Sin accion. |
| Compras | `GET /api/purchases/:id` post-pagos | PASS | HTTP 200, `status=RECEIVED`, `paymentStatus=PAID`, `balanceDue=0`. | P0 | Sin accion. |
| Compras | `POST /api/purchases` compra parcial | PASS | HTTP 201, compra `e6bf7ebb-4c4c-40bf-a73a-ee9dc6154630`. | P0 | Sin accion. |
| Compras | `POST /api/purchases/:id/receive` parcial | PASS | HTTP 201, `status=PARTIAL`. | P0 | Sin accion. |
| Compras | `PATCH /api/purchases/:id/settle-partial` | PASS | HTTP 200, `Compra liquidada correctamente...`. | P0 | Sin accion. |
| Pagos | `POST /api/finance/payments` compra parcial liquidada | PASS | HTTP 201, pago `6000`. | P0 | Sin accion. |
| Compras | `GET /api/purchases/:id` post settle | PASS | HTTP 200, `status=CERRADA_PARCIAL`, `paymentStatus=PAID`, `balanceDue=0`. | P0 | Sin accion. |
| Pedidos | `POST /api/orders` | PASS | HTTP 201, `status=DRAFT`. | P0 | Sin accion. |
| Pedidos | `POST /api/orders/:id/confirm` | PASS | HTTP 201, `status=CONFIRMED`. | P0 | Sin accion. |
| Pedidos | `POST /api/orders/:id/deliver` | PASS | HTTP 201, `status=COMPLETED`. | P0 | Sin accion. |
| Pedidos/Invoice | `POST /api/orders/:id/invoice` | PASS | HTTP 201, venta `c879fdb1-65c8-4d4c-83bc-982e2fb75018`. | P0 | Sin accion. |
| POS/Ventas | `POST /api/sales` | PASS | HTTP 201, venta `6b6dab84-7d8f-4b8f-8d36-0ce81a0f5ea1`, `paymentStatus=PAID`. | P0 | Sin accion. |
| Ventas | `GET /api/sales` | PASS | HTTP 200, `count=8`. | P1 | Sin accion. |
| Ventas | `GET /api/sales/:id` | PASS | HTTP 200, `total=12500`. | P1 | Sin accion. |
| Promociones | `GET /api/pricing/promotions?branchId=<branch>` | PASS/WARN | HTTP 200, `count=0`. | P2 | Crear fixture de promocion activa si MVP exige promocion aplicada. |
| Pricing | `POST /api/pricing/preview-line` | PASS | HTTP 201, `lineTotal=12500`, sin promocion aplicada. | P1 | Sin accion. |
| Caja | `GET /api/finance/cash-movements?includeSummary=true` | PASS | HTTP 200, `count=6`, summary presente. | P0 | Sin accion. |
| Caja | `GET /api/finance/cash-sessions/:id/summary` post-flujos | PASS | HTTP 200, `expected=110000`, `salesPayments=25000`, `purchasePayments=15000`. | P0 | Sin accion. |
| Caja | `POST /api/finance/cash-sessions/:id/close` | PASS | HTTP 201, `status=CLOSED`, `closingAmount=110000`. | P0 | Sin accion. |
| Reporteria | `GET /api/reports/purchases` | PASS | HTTP 200 JSON. | P1 | Sin accion. |
| Reporteria | `GET /api/reports/purchases/:purchaseId/ticket` | PASS | HTTP 200 PDF, `bytes=3007`. | P1 | Sin accion. |
| Reporteria | `GET /api/reports/cash-closings` | PASS | HTTP 200 JSON. | P1 | Sin accion. |
| Reporteria | `GET /api/reports/cash-closings/:cashSessionId/ticket` | PASS | HTTP 200 PDF, `bytes=3214`. | P1 | Sin accion. |
| Reporteria | `GET /api/reports/pos-sales` | PASS | HTTP 200 JSON, `rows=8`, `summaryCount=8`, despues de `V061`. | P1 | Sin accion. |
| Reporteria | `GET /api/reports/pos-sales/:saleId/ticket` | PASS | HTTP 200 PDF, `bytes=3140`. | P1 | Sin accion. |
| Reporteria | `GET /api/reports/order-sales` | PASS | HTTP 200 JSON. | P1 | Sin accion. |
| Reporteria | `GET /api/reports/order-sales/:orderId/ticket` | PASS | HTTP 200 PDF, `bytes=3021`. | P1 | Sin accion. |
| Reporteria | `GET /api/reports/customers/orders-status` | PASS | HTTP 200 JSON. | P1 | Sin accion. |

## Confirmaciones solicitadas

| Validacion | Resultado |
| --- | --- |
| `PATCH /api/purchases/:id/settle-partial` | PASS |
| Purchases reports | PASS |
| Cash closings | PASS |
| POS sales | PASS, lista HTTP 200; ticket PASS |
| Order sales | PASS |
| Customer reports | PASS |
| Compras | PASS |
| Pagos | PASS |
| Caja | PASS |
| Pedidos | PASS |
| POS | PASS |
| Ventas | PASS |
| Promociones | PASS/WARN, endpoint PASS con `count=0` |
| FE base | PASS |
| Perifericos MOCK | PASS |

## Backlog priorizado

### P0

No quedan P0 en esta corrida.

### P1

No quedan P1 en esta corrida. `GET /api/reports/pos-sales` quedo confirmado con HTTP 200 despues de `V061`.

### P2

1. `GET /api/pricing/promotions` responde HTTP 200 con `count=0`.
   - Impacto: pricing funciona, pero no hay promocion activa aplicada.
   - Recomendacion: crear fixture de promocion activa si MVP requiere validar descuento aplicado.

## Decision

```text
QA_OPERATIVO_END_TO_END_READY
```
