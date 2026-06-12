# Evidencia QA operativo integral MVP-01.3

Fecha QA: 2026-06-11 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Resultado: `QA_OPERATIVO_COMPRAS_PAGOS_CAJA_BLOCKED`

## Contexto

MVP-01.2 quedo `READY`.

QA AWS esta operativa sobre `manus_tienda_qa`.

Este rerun valido compras, caja y reporteria asociada usando solo API QA.

## Ambiente

| Item | Valor |
| --- | --- |
| API QA | `https://api.apptiendamanus.space/api` |
| DB esperada | `manus_tienda_qa` |
| Tenant | `00000000-0000-0000-0000-000000000001` (`default`) |
| Branch | `ab41d3da-6686-4de3-9191-875a5a7da5a5` |
| Actor QA | `SUPER_ADMIN` seed desde env local ignorado |

No se imprimieron tokens, refresh tokens, passwords ni contenido de `.env`.

## Auth

| Check | Estado | Resultado |
| --- | --- | --- |
| `POST /api/auth/login/force` | PASS | HTTP 201, token recibido y no impreso. |
| `GET /api/auth/me` | PASS | HTTP 200, rol `SUPER_ADMIN`. |
| `GET /api/auth/context` | PASS | HTTP 200, tenant y branch disponibles. |

## Fixtures y caja

Al iniciar QA no habia metodos de pago activos ni cajas activas:

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/finance/payment-methods?active=true` | PASS | HTTP 200, `count=0`. |
| `GET /api/finance/cash-registers?activo=true` | PASS | HTTP 200, `count=0`. |

Se crearon fixtures QA por API, sin escrituras directas en DB:

| Recurso | ID | Codigo | Resultado |
| --- | --- | --- | --- |
| Metodo de pago CASH | `d08ecde7-0466-4f09-b874-2759cb8d8003` | `QA-CASH-MVP013-20260611161548` | HTTP 201, activo. |
| Caja | `c2256618-3b35-4e58-a33a-04ecab49aa8b` | `QA-CJA-MVP013-20260611161548` | HTTP 201, activa. |
| Sesion de caja | `d41b8a9b-c9f6-441e-ad44-fc6baa551e28` | caja QA | HTTP 201, apertura `100000`. |

Caja validada:

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/finance/cash-sessions/current` antes de abrir | PASS | No habia sesion abierta. |
| `POST /api/finance/cash-sessions/open` | PASS | HTTP 201, sesion abierta. |
| `GET /api/finance/cash-sessions/:id/summary` | PASS | HTTP 200, `expectedAmount=100000`, `movementCount=1`. |

## Compra controlada

Fixtures usados:

| Recurso | Valor |
| --- | --- |
| Proveedor | `92010000-0000-0000-0000-000000000001` (`QA Proveedor FE Base`) |
| Producto | `92030000-0000-0000-0000-000000000001` (`QA-BASE-LOT-001`) |
| Requiere lote | `true` |
| Requiere vencimiento | `true` |

Compra creada:

| Campo | Valor |
| --- | --- |
| Purchase ID | `e822426b-19c7-4605-99bb-7336d0e4159a` |
| Purchase item ID | `701ede1a-7622-41f1-bd75-c703cda349c9` |
| Tipo | `CREDIT` |
| Total | `18000` |
| Cantidad pedida | `2` |
| Costo unitario | `9000` |

Recepcion parcial:

| Check | Estado | Resultado |
| --- | --- | --- |
| `POST /api/purchases` | PASS | HTTP 201, compra creada. |
| `POST /api/purchases/:id/receive` | PASS | HTTP 201/200, recepcion parcial `1` de `2`. |
| `GET /api/purchases/:id` | PASS | HTTP 200, `status=PARTIAL`, `receivedQuantity=1`, `pendingQuantity=1`, `receivedSubtotal=9000`, `unreceivedSubtotal=9000`. |

Lote de recepcion usado:

```text
QA-MVP013-PARTIAL-MVP013-20260611161548
```

## Bloqueo principal

La liquidacion parcial falla en API.

| Check | Estado | Resultado |
| --- | --- | --- |
| `PATCH /api/purchases/e822426b-19c7-4605-99bb-7336d0e4159a/settle-partial` | BLOCKED | HTTP 500, body vacio. |

Payload enviado:

```json
{
  "motivoLiquidacion": "QA MVP-01.3 liquidacion parcial MVP013-20260611161548"
}
```

Estado observado antes del bloqueo:

```text
purchase.status=PARTIAL
purchase.paymentStatus=PENDING
purchase.total=18000
purchase.totalPaid=0
purchase.balanceDue=18000
item.orderedQuantity=2
item.receivedQuantity=1
item.pendingQuantity=1
```

Impacto:

- No se pudo validar `liquidacion parcial`.
- No se ejecuto pago parcial ni pago completo para no agregar pagos a una compra no liquidada.
- No se continuo con recepcion total ni cancelacion despues del bloqueo.

## Cleanup

Se cerro la sesion de caja abierta por esta QA:

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/finance/cash-sessions/:id/summary` antes de cerrar | PASS | HTTP 200, `expectedAmount=100000`. |
| `POST /api/finance/cash-sessions/:id/close` | PASS | HTTP 201, `status=CLOSED`, `closingAmount=100000`, `differenceAmount=0`. |
| `GET /api/finance/cash-movements?cashSessionId=:id&includeSummary=true` | PASS | HTTP 200, movimientos `OPENING` y `CLOSING`, `totalIn=100000`, `totalOut=100000`, `balance=0`. |
| `GET /api/finance/cash-sessions/current` despues de cerrar | PASS | Sin sesion abierta. |

Quedaron IDs QA documentados:

- Metodo de pago QA: `d08ecde7-0466-4f09-b874-2759cb8d8003`.
- Caja QA: `c2256618-3b35-4e58-a33a-04ecab49aa8b`.
- Sesion cerrada QA: `d41b8a9b-c9f6-441e-ad44-fc6baa551e28`.
- Compra parcial bloqueada: `e822426b-19c7-4605-99bb-7336d0e4159a`.

## Reporteria asociada

Los endpoints de reporteria requeridos tambien fallan con HTTP 500 y body vacio:

| Check | Estado | Resultado |
| --- | --- | --- |
| `GET /api/reports/purchases?tenantId=<tenant>&branchId=<branch>&dateFrom=2026-06-11&dateTo=2026-06-11` | BLOCKED | HTTP 500, body vacio. |
| `GET /api/reports/purchases/:purchaseId/ticket` | BLOCKED | HTTP 500, body vacio. |
| `GET /api/reports/cash-closings?tenantId=<tenant>&branchId=<branch>&dateFrom=2026-06-11&dateTo=2026-06-11` | BLOCKED | HTTP 500, body vacio. |
| `GET /api/reports/cash-closings/:cashSessionId/ticket` | BLOCKED | HTTP 500, body vacio. |

## Restricciones cumplidas

- No se modifico codigo.
- No se ejecutaron migraciones.
- No se ejecuto bootstrap.
- No se hizo deploy.
- No se reinicio PM2.
- No se hicieron escrituras directas en DB.
- Las escrituras fueron solo por API QA.
- No se toco `manus_tienda`.
- No se imprimieron secretos ni tokens.

## Decision

```text
QA_OPERATIVO_COMPRAS_PAGOS_CAJA_BLOCKED
```

Bloqueo exacto:

```text
PATCH /api/purchases/e822426b-19c7-4605-99bb-7336d0e4159a/settle-partial
=> HTTP 500, empty body
```

Bloqueo adicional de reporteria:

```text
GET /api/reports/purchases
GET /api/reports/purchases/:purchaseId/ticket
GET /api/reports/cash-closings
GET /api/reports/cash-closings/:cashSessionId/ticket
=> HTTP 500, empty body
```
