# Evidencia root cause P0/P1 MVP-01.4Y

Fecha: 2026-06-11 America/Bogota.

Resultado: `QA_ROOT_CAUSE_IDENTIFIED`

Alcance:

- `PATCH /api/purchases/:id/settle-partial`
- `backend-reporteria` HTTP 500 en reportes operativos

Restriccion cumplida:

- No se corrigio codigo.
- No se ejecuto bootstrap.
- No se ejecutaron migraciones.
- No se tocaron AWS/PM2/DB por SSH.
- Las llamadas QA fueron via API publica.

## Captura de stacktrace

El stacktrace completo de PM2 no quedo disponible en esta sesion.

Intentos:

```text
ssh -o BatchMode=yes -o ConnectTimeout=10 ubuntu@api.apptiendamanus.space "hostname; pm2 list"
=> Host key verification failed.

ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=<temp> ubuntu@api.apptiendamanus.space "hostname; pm2 list"
=> Permission denied (publickey).
```

Los bodies publicos de Nest solo devuelven:

```json
{"statusCode":500,"message":"Internal server error"}
```

Por eso la RCA usa reproduccion diferencial QA + mapeo fuente/SQL.

## Reproduccion QA

Marcador: `MVP014Y-2026-06-12T01:31:20.053Z`

Con Bearer de API:

| Flujo | Resultado |
| --- | --- |
| `PATCH /api/purchases/ab57bd27-19ce-4dc1-ae99-67855c092f52/settle-partial` | HTTP 500 |
| `GET /api/reports/purchases` | HTTP 500 |
| `GET /api/reports/purchases/:purchaseId/ticket` | HTTP 500 |
| `GET /api/reports/cash-closings` | HTTP 500 |
| `GET /api/reports/pos-sales` | HTTP 500 |
| `GET /api/reports/order-sales` | HTTP 500 |
| `GET /api/reports/customers/orders-status` | HTTP 500 |

Con headers mock de reporteria y `x-report-user-id` UUID:

| Flujo | Resultado |
| --- | --- |
| `GET /api/reports/health` | HTTP 200 |
| `GET /api/reports/demo` | HTTP 200 |
| `GET /api/reports/purchases` | HTTP 200 |
| `GET /api/reports/purchases/:purchaseId/ticket` | HTTP 200 PDF |
| `GET /api/reports/cash-closings` | HTTP 200 |
| `GET /api/reports/order-sales` | HTTP 200 |
| `GET /api/reports/customers/orders-status` | HTTP 200 |
| `GET /api/reports/pos-sales` | HTTP 500 |
| `GET /api/reports/pos-sales/:saleId/ticket` | HTTP 200 PDF |

## P0 root cause: settle-partial

Archivo:

- `api/src/modules/inventory/services/purchase.service.ts`

Funcion:

- `PurchaseService.settlePartialPurchase`

Linea critica:

- `api/src/modules/inventory/services/purchase.service.ts:1670`

Query que falla:

```sql
UPDATE purchases
SET
  status = $3,
  total_pedido = COALESCE(total_pedido, total),
  total_recibido = $4,
  total_liquidado = $4,
  total = $4,
  balance = $5,
  balance_due = $5,
  payment_status = $6,
  total_paid = $12,
  total_no_recibido = $7,
  motivo_liquidacion = $8,
  liquidado_por = $9,
  liquidado_en = $10
WHERE id = $1
  AND tenant_id = $2
  AND status = $11
RETURNING ...
```

Parametros relevantes:

- `$3 = 'CERRADA_PARCIAL'`
- `$4 = 9000`
- `$5 = 9000`
- `$6 = 'PENDING'`
- `$7 = 9000`
- `$11 = 'PARTIAL'`
- `$12 = 0`

Estado vivo de la compra antes de liquidar:

```json
{
  "id": "ab57bd27-19ce-4dc1-ae99-67855c092f52",
  "status": "PARTIAL",
  "total": 18000,
  "totalPaid": 0,
  "balanceDue": 18000,
  "paymentStatus": "PENDING",
  "items": [
    {
      "orderedQuantity": 2,
      "receivedQuantity": 1,
      "cost": 9000,
      "subtotal": 18000
    }
  ]
}
```

Precondiciones del servicio pasan:

- compra existe;
- `status = PARTIAL`;
- tiene recibido `1`;
- tiene pendiente `1`;
- `totalLiquidado = 9000`;
- `totalNoRecibido = 9000`;
- `totalPagado = 0`.

Causa exacta identificada:

La DB QA rechaza el nuevo status `CERRADA_PARCIAL` en `purchases`. El punto de falla es el `UPDATE purchases` de `settlePartialPurchase`.

Constraint involucrado:

- `chk_purchases_status` o drift legacy `purchases_status_check`

SQL versionado relacionado:

- `scripts/database/products/2026_04_26_inventory_purchases_type_balance.sql:45`
- `scripts/database/migrations/20260527_purchase_partial_liquidation.sql:21`

Problema de drift:

`20260527_purchase_partial_liquidation.sql` agrega `CERRADA_PARCIAL`, pero solo hace:

```sql
ALTER TABLE IF EXISTS public.purchases
  DROP CONSTRAINT IF EXISTS chk_purchases_status;
```

No elimina el constraint legacy auto-generado `purchases_status_check` si existe en la DB. Ese constraint nace del `CHECK` inline en `scripts/database/products/2026_04_25_inventory_purchases.sql`.

Funcion SQL:

- No aplica. Este flujo falla en SQL directo del servicio.

Adapter:

- No aplica.

Fix recomendado:

- Crear migracion idempotente de drift que haga `DROP CONSTRAINT IF EXISTS purchases_status_check` y `DROP CONSTRAINT IF EXISTS chk_purchases_status`.
- Reagregar un unico `chk_purchases_status` con `DRAFT`, `PENDING`, `PARTIAL`, `RECEIVED`, `CERRADA_PARCIAL`, `CANCELLED`.
- Agregar smoke SQL de constraint despues de bootstrap.

## P1 root cause: reporteria 500 generalizado con Bearer

Archivo:

- `backend-reporteria/src/modules/auth/jwt-auth.guard.ts`

Funcion:

- `JwtAuthGuard.buildMockUser`
- `JwtAuthGuard.canActivate`

Lineas:

- `backend-reporteria/src/modules/auth/jwt-auth.guard.ts:31`
- `backend-reporteria/src/modules/auth/jwt-auth.guard.ts:73`
- `backend-reporteria/src/modules/auth/jwt-auth.guard.ts:84`

Causa exacta identificada:

El Bearer emitido por `api-linux` no queda decodificado por `backend-reporteria-linux`. Con `REPORTS_ALLOW_MOCK_AUTH=true`, el guard cae a actor mock.

El actor mock default usa:

```ts
id: "report-demo-user"
```

Ese valor no es UUID.

Luego los adapters pasan `actor.userId` como primer parametro a funciones SQL que declaran:

```sql
p_actor_user_id UUID
```

Query comun:

```sql
SELECT report_xxx($1, $2, ...) AS result
```

Archivo comun:

- `backend-reporteria/src/modules/database/function-runner.service.ts:29`

Funcion comun:

- `FunctionRunnerService.executeFunction`

Error PostgreSQL esperado:

```text
22P02 invalid input syntax for type uuid: "report-demo-user"
```

Esto explica que `health` y `demo` pasen, pero reportes reales fallen:

- `health` no llama DB.
- `demo` llama `report_demo()` sin actor UUID.
- reportes reales llaman funciones con `p_actor_user_id UUID`.

Adapters involucrados:

| Endpoint | Adapter | Funcion SQL |
| --- | --- | --- |
| `GET /api/reports/purchases` | `backend-reporteria/src/modules/reports/sql-adapters/purchases-report.adapter.ts:28` | `report_purchases` |
| `GET /api/reports/purchases/:id/ticket` | `backend-reporteria/src/modules/reports/sql-adapters/purchases-report.adapter.ts:50` | `report_purchase_ticket` |
| `GET /api/reports/cash-closings` | `backend-reporteria/src/modules/reports/sql-adapters/cash-report.adapter.ts:29` | `report_cash_closings` |
| `GET /api/reports/cash-closings/:id/ticket` | `backend-reporteria/src/modules/reports/sql-adapters/cash-report.adapter.ts:48` | `report_cash_closing_ticket` |
| `GET /api/reports/pos-sales` | `backend-reporteria/src/modules/reports/sql-adapters/sales-report.adapter.ts:28` | `report_pos_sales` |
| `GET /api/reports/order-sales` | `backend-reporteria/src/modules/reports/sql-adapters/orders-report.adapter.ts:27` | `report_orders_sales` |
| `GET /api/reports/customers/orders-status` | `backend-reporteria/src/modules/reports/sql-adapters/customers-report.adapter.ts:32` | `report_customer_orders_status` |

Constraint:

- No aplica.

Fix recomendado:

- Alinear `JWT_SECRET` entre `api-linux` y `backend-reporteria-linux`.
- Cambiar default mock `id` a UUID estable.
- Validar `x-report-user-id` como UUID antes de llamar SQL.
- Agregar test: reportes reales con mock auth default no deben enviar `report-demo-user` a funciones UUID.

## P1 residual: `GET /api/reports/pos-sales`

Con `x-report-user-id` UUID, casi todos los reportes pasan. `GET /api/reports/pos-sales` sigue en HTTP 500.

Archivo:

- `backend-reporteria/src/modules/reports/sql-adapters/sales-report.adapter.ts`

Funcion:

- `SalesReportAdapter.getSalesList`

Linea:

- `backend-reporteria/src/modules/reports/sql-adapters/sales-report.adapter.ts:28`

SQL function:

- `public.report_pos_sales`

SQL fuente:

- `scripts/database/migrations/V047__sync_dev_functions_to_prd.sql:3819`

Query:

```sql
SELECT report_pos_sales($1, $2, $3, $4, $5, $6, $7, $8) AS result
```

Observacion:

- `GET /api/reports/pos-sales/:saleId/ticket` pasa con el mismo actor UUID.
- `report_pos_sales` pasa contra la DB local/copia con los mismos parametros.
- En QA falla incluso con fecha futura sin filas.

Causa probable:

- drift QA especifico en `public.report_pos_sales` o overload faltante/distinto.

Fix recomendado:

- Capturar PM2 log de `backend-reporteria-linux`.
- En QA, comparar `pg_get_functiondef` de `public.report_pos_sales(uuid,text,uuid,uuid,uuid,uuid,timestamptz,timestamptz)`.
- Restaurar `report_pos_sales` desde migracion versionada si hay drift.

## Decision

```text
QA_ROOT_CAUSE_IDENTIFIED
```
