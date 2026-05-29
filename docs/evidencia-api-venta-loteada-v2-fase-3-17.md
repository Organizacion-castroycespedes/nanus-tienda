# Evidencia Fase 3.17 - API real venta POS loteada con `inventory_create_sale_v2`

Fecha/hora: 2026-05-28 12:00:17 -05:00

## Objetivo

Validar por API real local/dev que `inventory_create_sale_v2` funciona para un tenant/sucursal piloto con `INVENTORY_SALE_V2_ENABLED=true`, manteniendo `inventory_create_sale` como fallback para sucursales no habilitadas.

## Ambiente usado

| Item | Resultado |
| --- | --- |
| Ambiente | Local/dev |
| API | `http://localhost:4027/api` |
| Base de datos | `manus_tienda_prd` local |
| PostgreSQL | 16 |
| Direccion DB | `::1/128` |
| PRD | No tocado |
| QA remoto | No tocado |

No se imprimieron secretos, passwords ni JWT reales.

## Config tenant/sucursal

Tenant fixture: `91000000-0000-0000-0000-000000000001`

Config aplicada en `tenants.config`:

```json
{
  "inventory": {
    "saleV2Enabled": true,
    "saleV2Branches": ["91000000-0000-0000-0000-000000000002"]
  }
}
```

Sucursal piloto v2: `91000000-0000-0000-0000-000000000002`

Sucursal control v1: `91000000-0000-0000-0000-000000000003`

## Archivos creados

| Archivo | Uso |
| --- | --- |
| `scripts/database/dev/20260602_fixture_sale_v2_api_local.sql` | Fixture local/dev para tenant, sucursales, usuario, caja, productos, lotes y saldos. |
| `scripts/database/dev/20260602_fixture_sale_v2_api_local_cleanup.sql` | Limpieza local/dev del tenant fixture. |
| `scripts/http/20260602_sale_v2_api_local_test.ts` | Prueba end-to-end por API real local. |

## Comandos ejecutados

```bash
psql -h <LOCAL_DB_HOST> -p <LOCAL_DB_PORT> -U <LOCAL_DB_USER> -d <LOCAL_DB_DATABASE> -v ON_ERROR_STOP=1 -f scripts/database/dev/20260602_fixture_sale_v2_api_local.sql
```

```bash
cd api
INVENTORY_SALE_V2_ENABLED=true PORT=4027 npx tsx src/main.ts
```

```bash
API_BASE_URL=http://localhost:4027/api api/node_modules/.bin/tsx.cmd --tsconfig api/tsconfig.json scripts/http/20260602_sale_v2_api_local_test.ts
```

```bash
psql -h <LOCAL_DB_HOST> -p <LOCAL_DB_PORT> -U <LOCAL_DB_USER> -d <LOCAL_DB_DATABASE> -v ON_ERROR_STOP=1 -f scripts/database/dev/20260602_fixture_sale_v2_api_local_cleanup.sql
```

## Curl sanitizado

```bash
curl -X POST "http://localhost:4027/api/sales" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "91000000-0000-0000-0000-000000000013",
    "type": "CASH",
    "items": [
      {
        "productId": "91000000-0000-0000-0000-000000000102",
        "quantity": 4,
        "price": 50
      }
    ],
    "payments": [
      {
        "paymentMethodId": "91000000-0000-0000-0000-000000000015",
        "cashSessionId": "91000000-0000-0000-0000-000000000018",
        "amount": 200
      }
    ]
  }'
```

```bash
curl -X POST "http://localhost:4027/api/sales/<SALE_ID>/cancel" \
  -H "Authorization: Bearer <TOKEN>"
```

## Resultados por escenario

| Escenario | Resultado | Evidencia |
| --- | --- | --- |
| A. Venta no loteada | OK | Sale creada; `sale_items` y `stock_movements OUT`; no crea `stock_movement_lots`. |
| B. Venta loteada con lote suficiente | OK | `stock_movement_lots OUT` creado; lote `S317-API-ONE-A` baja de 10 a 6. |
| C. Venta mixta | OK | Producto loteado crea link OUT; producto no loteado no crea link; lote mixto baja de 5 a 3. |
| D. Stock insuficiente loteado | OK | API falla; no deja `sales`, `sale_items`, `stock_movements`, `stock_movement_lots` ni balances parciales. |
| E. Cancelacion venta loteada | OK | Crea `stock_movements IN`, crea `stock_movement_lots IN`, balance vuelve a lote original; segunda cancelacion no duplica. |
| F. Cancelacion venta mixta | OK | Producto loteado vuelve a lote original; no loteado mantiene flujo normal. |
| G. Sucursal no habilitada | OK | Con env true, sucursal fuera de allowlist usa `inventory_create_sale`; no crea `stock_movement_lots`. |
| H. Reconciliacion piloto | OK | `criticalCount=0`, `highCount=0`, `discrepancies=0` para sucursal piloto. |

Salida resumida de la prueba:

```text
OK local database manus_tienda_prd; PostgreSQL 16; addr ::1/128
OK A venta no loteada via API
OK B venta loteada via API
OK C venta mixta via API
OK D stock insuficiente falla sin mutar
OK E cancelacion loteada via API
OK F cancelacion mixta via API
OK G sucursal no habilitada cae a v1
OK H reconciliacion piloto sin CRITICAL/HIGH
```

## Validacion de v1/v2

Log local del backend:

```text
DEBUG [SaleRepository] Using inventory_create_sale_v2 for POS sale creation
DEBUG [SaleRepository] Using inventory_create_sale for POS sale creation
```

Interpretacion:

- La sucursal piloto uso `inventory_create_sale_v2`.
- La sucursal no habilitada uso `inventory_create_sale`.
- `INVENTORY_SALE_V2_ENABLED=true` fue temporal solo para el proceso local.
- v1 sigue siendo default cuando el flag global no esta activo o cuando tenant/sucursal no califica.

## Validacion de balances

| Lote | Antes venta | Despues venta | Despues cancelacion |
| --- | ---: | ---: | ---: |
| `S317-API-ONE-A` | 10 | 6 | 10 |
| `S317-API-MIX-A` | 5 | 3 | 5 |

## Validacion `stock_movement_lots`

- Venta loteada creo link OUT con cantidad exacta consumida.
- Cancelacion loteada creo link IN con cantidad exacta revertida.
- Producto no loteado no creo link.
- Sucursal control v1 no creo link.

## Limpieza

Cleanup ejecutado:

```text
fixture_rows_remaining = 0
```

El backend local temporal en puerto `4027` fue detenido.

## Observaciones

- La prueba API real paso para venta, cancelacion, fallback v1 y reconciliacion read-only por service.
- Para evitar exponer JWT real, el documento usa `<TOKEN>`.
- No se tocaron `web/`, `backend-reporteria/`, POS UI, SQL functions ni migraciones.

## Riesgos vivos

- RIESGO: `InventoryLotReconciliationController` rechaza `branchId` UUID estandar en query por validador local incompleto. La reconciliacion de esta fase se ejecuto por service read-only. Conviene corregir el validador en una fase separada.
- RIESGO: `SaleService.normalizeSaleContext` no conserva roles al crear pagos; el fixture tuvo que incluir `personas` y `persona_tenant_branches` para que finanzas autorice la sucursal.
- RIESGO: v2 sigue detras de flag y piloto; no debe activarse masivamente sin QA controlado.

## Proximos pasos

1. Ejecutar piloto QA controlado con tenant/sucursal real de pruebas.
2. Corregir validador UUID del controller de reconciliacion.
3. Documentar runbook de activacion/desactivacion por tenant/sucursal.
4. Definir criterios para habilitar v2 en produccion por fases.
