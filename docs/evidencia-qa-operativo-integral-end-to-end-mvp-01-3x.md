# Evidencia QA operativo integral end-to-end MVP-01.3X

Fecha QA: 2026-06-11 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_OPERATIVO_END_TO_END_BLOCKED`

## Contexto

MVP-01.1 quedo `READY`.
MVP-01.2 quedo `READY`.
MVP-01.3 quedo `BLOCKED` por:

- `PATCH /api/purchases/:id/settle-partial` con HTTP 500 y body vacio.
- Reportes de compras/caja con HTTP 500 y body vacio.

Esta corrida continuo aunque hubiera errores. No se detuvo en el primer fallo.

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
| Actor QA | `SUPER_ADMIN` seed desde env local ignorado |

No se versionaron ni documentaron tokens, refresh tokens, passwords ni contenido de `.env`.

## Datos creados o usados

| Recurso | ID |
| --- | --- |
| Run | `MVP013X-20260611180418` |
| Cliente QA | `92020000-0000-0000-0000-000000000001` |
| Producto QA loteado | `92030000-0000-0000-0000-000000000001` |
| Proveedor QA | `92010000-0000-0000-0000-000000000001` |
| Metodo pago CASH | `d08ecde7-0466-4f09-b874-2759cb8d8003` |
| Caja | `c2256618-3b35-4e58-a33a-04ecab49aa8b` |
| Sesion caja | `ebc115b5-2396-4654-90ef-c551e35cc147` |
| POS session | `3ef53edc-1e3c-4d92-8c86-3bbc6bf4fe4c` |
| Compra total pagada | `055360eb-e4ea-4fea-81cf-b90ec9b014ca` |
| Compra parcial bloqueada | `946ae1f9-c013-4973-b1cd-fb443588e388` |
| Pedido | `27043282-c270-4210-a40c-1de3db4e7f72` |
| Venta desde pedido | `e697a769-52f0-43b6-b022-14985a7a2642` |
| Venta POS directa | `baf18a9b-0c4c-4b8f-ac9e-a505151e5617` |

Cleanup ejecutado:

- La sesion de caja `ebc115b5-2396-4654-90ef-c551e35cc147` fue cerrada por API con `closingAmount=116000` y diferencia `0`.
- No existe endpoint de cierre para `POST /api/pos/session`; se deja `posSessionId` documentado.

## Matriz QA

| modulo | endpoint/flujo | resultado | evidencia | prioridad | recomendacion |
| --- | --- | --- | --- | --- | --- |
| Auth | `POST /auth/login/force` | PASS | HTTP 201, token recibido y no documentado. | P0 | Mantener uso solo QA controlado. |
| Auth | `GET /auth/me` | PASS | HTTP 200, rol `SUPER_ADMIN`. | P0 | Sin accion. |
| Auth | `GET /auth/context` | PASS | HTTP 200, tenant, branch y terminal disponibles. | P0 | Sin accion. |
| Auth/RBAC | `GET /auth/menu` | PASS | HTTP 200, menu cargado. | P1 | Revisar solo si UI no muestra menu. |
| Web | `GET https://www.apptiendamanus.space` | PASS | HTTP 200. | P1 | Sin accion. |
| Web | `GET /login` | PASS | HTTP 200. | P1 | Sin accion. |
| Health | `GET /system/version` | PASS | HTTP 200, `version=0.0.1`. | P1 | Agregar build/release en MVP-05. |
| Health/Reporteria | `GET /reports/health` | FAIL | HTTP 500, body vacio. | P1 | Revisar runtime `backend-reporteria` y guard/adapter health. |
| Clientes | `GET /customers` | PASS | HTTP 200, `count=7`. | P0 | Mantener fixture cliente operativo. |
| Productos | `GET /products?branchId=<branch>` | PASS | HTTP 200, producto `QA-BASE-LOT-001` disponible. | P0 | Mantener producto/lote QA. |
| Promociones | `POST /pricing/preview-line` | PASS | HTTP 201, `lineTotal=12500`, sin promocion aplicada. | P1 | Mantener preview como contrato de precio POS. |
| Promociones | `GET /pricing/promotions` | WARN | HTTP 200, `count=0`. | P2 | Crear fixture de promocion si el MVP exige promo activa. |
| Pagos | `GET /finance/payment-methods?active=true` | PASS | HTTP 200, CASH activo `QA-CASH-MVP013-20260611161548`. | P0 | Convertir a seed QA minimo si no debe depender de QA previa. |
| Caja | `GET /finance/cash-registers?activo=true` | PASS | HTTP 200, caja activa `QA-CJA-MVP013-20260611161548`. | P0 | Convertir a seed QA minimo si no debe depender de QA previa. |
| Caja | `GET /finance/cash-sessions/current` | PASS | HTTP 200, sin sesion actual antes de abrir. | P0 | Abrir caja cuando no exista sesion. |
| Caja | `POST /finance/cash-sessions/open` | PASS | HTTP 201, apertura `100000`. | P0 | Sin accion. |
| Caja | `GET /finance/cash-sessions/:id/summary` | PASS | HTTP 200, `expectedAmount=100000`, `movementCount=1`. | P0 | Sin accion. |
| POS | `GET /pos-terminals/resolve-current` | PASS | HTTP 200, `posTerminalId=e186b5bd-4873-49bb-9450-f141570cce80`. | P0 | Usar `posTerminalId` en endpoints de perifericos. |
| Perifericos MOCK | `GET /pos-terminals/:posTerminalId/peripherals` | PASS | HTTP 200, devices MOCK `mock-printer-001`, `mock-cashdrawer-001`, `mock-scale-001`, `mock-scanner-001`. | P1 | Sin accion. |
| POS | `POST /pos/session` | PASS | HTTP 201, `posSessionId=3ef53edc-1e3c-4d92-8c86-3bbc6bf4fe4c`. | P0 | Agregar cierre o expiracion operativa si aplica. |
| Compras | `POST /purchases` compra total | PASS | HTTP 201, compra `055360eb-e4ea-4fea-81cf-b90ec9b014ca`. | P0 | Sin accion. |
| Compras | `POST /purchases/:id/receive` total | PASS | HTTP 201, `status=RECEIVED`. | P0 | Sin accion. |
| Pagos | `POST /finance/payments` compra parcial | PASS | HTTP 201, pago `3000`. | P0 | Sin accion. |
| Pagos | `POST /finance/payments` compra completa | PASS | HTTP 201, pago `6000`. | P0 | Sin accion. |
| Compras | `GET /purchases/:id` post-pagos | PASS | HTTP 200, `paymentStatus=PAID`, `totalPaid=9000`, `balanceDue=0`. | P0 | Sin accion. |
| Compras | `POST /purchases` parcial | PASS | HTTP 201, compra `946ae1f9-c013-4973-b1cd-fb443588e388`. | P0 | Sin accion. |
| Compras | `POST /purchases/:id/receive` parcial | PASS | HTTP 201, `status=PARTIAL`. | P0 | Sin accion. |
| Compras | `PATCH /purchases/:id/settle-partial` | BLOCKED | HTTP 500, body vacio. | P0 | Corregir 500; debe liquidar parcial o responder error controlado. |
| Compras | `PATCH /purchases/:id/cancel` | PASS | HTTP 200, compra draft cancelada. | P1 | Sin accion. |
| Pedidos | `POST /orders` | PASS | HTTP 201, `status=DRAFT`. | P0 | Sin accion. |
| Pedidos | `POST /orders/:id/confirm` | PASS | HTTP 201, `status=CONFIRMED`. | P0 | Sin accion. |
| Pedidos | `POST /orders/:id/deliver` | PASS | HTTP 201, `status=COMPLETED`. | P0 | Sin accion. |
| Pedidos/Ventas | `POST /orders/:id/invoice` | PASS | HTTP 201, venta `e697a769-52f0-43b6-b022-14985a7a2642`. | P0 | Sin accion. |
| POS/Ventas | `POST /sales` | PASS | HTTP 201, venta `baf18a9b-0c4c-4b8f-ac9e-a505151e5617`, `paymentStatus=PAID`. | P0 | Sin accion. |
| Ventas | `GET /sales` | PASS | HTTP 200, `count=2`. | P1 | Sin accion. |
| Ventas | `GET /sales/:id` | PASS | HTTP 200. | P1 | Sin accion. |
| Caja | `GET /finance/cash-movements?includeSummary=true` | PASS | HTTP 200, `movementCount=5`, `totalIn=125000`, `totalOut=9000`. | P0 | Sin accion. |
| Caja | `GET /finance/cash-sessions/:id/summary` post-flujos | PASS | HTTP 200, `expectedAmount=116000`, `salesPayments=25000`, `purchasePayments=9000`. | P0 | Sin accion. |
| FE | `GET /electronic-invoicing/customers/default` | PASS | HTTP 200, `isFinalConsumer=true`. | P0 | Sin accion. |
| FE | `POST /electronic-invoicing/customers/default/ensure` | PASS | HTTP 201, idempotente. | P0 | Sin accion. |
| FE | `GET /electronic-invoicing/customers?search=QA` | PASS | HTTP 200, fixture QA encontrado. | P1 | Sin accion. |
| FE | `GET /electronic-invoicing/suppliers?search=QA` | PASS | HTTP 200, fixture QA encontrado. | P1 | Sin accion. |
| FE | `POST /electronic-invoicing/customers/lookup` | WARN | HTTP 201, `provider=NONE`, `lookupStatus=SKIPPED`. | P2 | Configurar `MOCK_LOCAL` si se requiere respuesta `FOUND`. |
| FE | `POST /electronic-invoicing/suppliers/lookup` | WARN | HTTP 201, `provider=NONE`, `lookupStatus=SKIPPED`. | P2 | Configurar `MOCK_LOCAL` si se requiere respuesta `FOUND`. |
| Reporteria | `GET /reports/purchases` | FAIL | HTTP 500, body vacio. | P1 | Corregir adapter/function de compras. |
| Reporteria | `GET /reports/purchases/:purchaseId/ticket` | FAIL | HTTP 500, body vacio. | P1 | Corregir ticket compra. |
| Reporteria | `GET /reports/cash-closings` | FAIL | HTTP 500, body vacio. | P1 | Corregir reporte cierre caja. |
| Reporteria | `GET /reports/pos-sales` | FAIL | HTTP 500, body vacio. | P1 | Corregir reporte ventas POS. |
| Reporteria | `GET /reports/pos-sales/:saleId/ticket` | FAIL | HTTP 500, body vacio. | P1 | Corregir ticket venta. |
| Reporteria | `GET /reports/order-sales` | FAIL | HTTP 500, body vacio. | P1 | Corregir reporte pedidos. |
| Reporteria | `GET /reports/order-sales/:orderId/ticket` | FAIL | HTTP 500, body vacio. | P1 | Corregir ticket pedido. |
| Reporteria | `GET /reports/customers/orders-status` | FAIL | HTTP 500, body vacio. | P1 | Corregir reporte clientes/pedidos. |
| Perifericos MOCK | `GET http://api.apptiendamanus.space:4023/health` | WARN | Sin conexion publica. | P2 | Esperado si el servicio es local-only; validar por SSH o evidencia humana. |
| Perifericos MOCK | `ssh ubuntu@api.apptiendamanus.space curl http://127.0.0.1:4023/health` | WARN | `Permission denied (publickey)`. | P2 | Proveer SSH QA o salida sanitaria para validar health local. |
| Caja | `POST /finance/cash-sessions/:id/close` | PASS | HTTP 201, `closingAmount=116000`, diferencia `0`. | P0 | Sin accion. |
| Caja | `GET /finance/cash-sessions/current` post-cleanup | PASS | HTTP 200, sin sesion abierta. | P2 | Sin accion. |

## Backlog priorizado

### P0

1. `Compras - PATCH /purchases/:id/settle-partial` devuelve HTTP 500 con body vacio.
   Impacto: bloquea liquidacion parcial de compras. La operacion no puede cerrar diferencias entre pedido y recibido.
   Recomendacion: corregir excepcion interna; devolver 200 con cierre parcial o 4xx controlado con mensaje funcional.

### P1

1. `GET /reports/health` devuelve HTTP 500.
   Impacto: health de reporteria no permite diagnostico operativo.
   Recomendacion: revisar runtime/guard/adapter de `backend-reporteria`.

2. `GET /reports/purchases` devuelve HTTP 500.
   Impacto: compras operan, pero reporte de compras queda inutilizable.
   Recomendacion: revisar funcion `report_purchases` y adapter.

3. `GET /reports/purchases/:purchaseId/ticket` devuelve HTTP 500.
   Impacto: no se puede emitir ticket de compra.
   Recomendacion: revisar funcion `report_purchase_ticket` y plantilla PDF.

4. `GET /reports/cash-closings` devuelve HTTP 500.
   Impacto: cierre de caja opera, pero reporte de cierres no.
   Recomendacion: revisar funcion `report_cash_closings` y adapter.

5. `GET /reports/pos-sales` y `GET /reports/pos-sales/:saleId/ticket` devuelven HTTP 500.
   Impacto: ventas operan, pero reporte/ticket POS no.
   Recomendacion: revisar funciones de reporte POS y trazabilidad de pagos/caja.

6. `GET /reports/order-sales` y `GET /reports/order-sales/:orderId/ticket` devuelven HTTP 500.
   Impacto: pedidos operan y facturan, pero reporte/ticket de pedido no.
   Recomendacion: revisar funciones de reporte pedidos.

7. `GET /reports/customers/orders-status` devuelve HTTP 500.
   Impacto: reporte cliente/pedidos no disponible.
   Recomendacion: revisar adapter de clientes en `backend-reporteria`.

### P2

1. FE lookup responde `provider=NONE`, `lookupStatus=SKIPPED`.
   Impacto: FE basico opera, pero no se valida escenario `FOUND`/`NOT_FOUND`.
   Recomendacion: habilitar `MOCK_LOCAL` en QA si se requiere lookup fiscal simulado.

2. `GET /pricing/promotions` responde `count=0`.
   Impacto: pricing preview opera, pero no hay promocion activa para validar descuento real.
   Recomendacion: agregar fixture de promocion si el MVP necesita demo de promociones.

3. `backend-perifericos` local `4023` no es publico y SSH QA falla por public key.
   Impacto: API de terminales tiene settings MOCK, pero health local del agente no pudo validarse desde esta sesion.
   Recomendacion: proveer SSH QA o salida sanitaria de `curl -fsS http://127.0.0.1:4023/health`.

4. `GET /system/version` solo devuelve `version=0.0.1`.
   Impacto: soporte no ve release/build/commit.
   Recomendacion: completar MVP-05 versionamiento.

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

Motivo:

```text
P0: PATCH /api/purchases/:id/settle-partial => HTTP 500, body vacio
```

Core operativo que si paso:

- Compra total, recepcion total y pagos parcial/completo.
- Caja, movimientos, summary y cierre.
- Pedido, confirmacion, entrega e invoice.
- POS session y venta POS directa.
- FE consumidor final, fixtures de clientes/proveedores y ensure.
- Pricing preview.
- Perifericos MOCK configurados por `posTerminalId`.
