# Evidencia inventory_create_sale_v2 - Fase 3.12

Fecha: 2026-05-28

Ambiente: local/dev en `localhost:5432`.

Base usada: `manus_tienda_prd` local. No se expusieron credenciales.

## Objetivo

Crear migracion SQL real para agregar `public.inventory_create_sale_v2` con soporte FEFO/lotes, dejando `inventory_create_sale` v1 intacta y sin activar v2 desde backend.

## Archivos creados

| Archivo | Proposito |
| --- | --- |
| `scripts/database/migrations/20260602_inventory_create_sale_v2.sql` | Crea o reemplaza solo `public.inventory_create_sale_v2`. |
| `scripts/database/migrations/20260602_inventory_create_sale_v2_rollback.sql` | Elimina solo `public.inventory_create_sale_v2`. |
| `docs/evidencia-inventory-create-sale-v2-fase-3-12.md` | Evidencia tecnica de esta fase. |

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 3.12 como migracion preparada y validada. |

## Firma de v2

```sql
public.inventory_create_sale_v2(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_terminal_id UUID,
  p_user_id UUID,
  p_pos_session_id UUID,
  p_customer_id UUID,
  p_order_id UUID,
  p_type VARCHAR(20),
  p_items JSONB,
  p_payment_methods JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  customer_id UUID,
  order_id UUID,
  type VARCHAR(20),
  status VARCHAR(20),
  total NUMERIC(12, 2),
  balance NUMERIC(12, 2),
  created_at TIMESTAMPTZ
)
```

## Reglas implementadas en la funcion

- Mantiene flujo compatible de v1 para `sales`, `sale_items`, `sale_item_taxes`, `sale_payment_methods` y totales.
- Mantiene `stock_movements` como ledger principal.
- Inserta `stock_movements OUT` con `RETURNING id`.
- Productos `requires_lot=false` no crean `stock_movement_lots` ni modifican `inventory_lot_balances`.
- Productos `requires_lot=true` consumen `inventory_lot_balances` por FEFO.
- FEFO ordena por `expiration_date ASC NULLS LAST`, `received_at ASC`, `lot_code ASC`, `lot.id ASC`.
- Usa `FOR UPDATE` sobre filas de `inventory_lot_balances`.
- Excluye lotes que no tengan `status = 'ACTIVE'`.
- Excluye lotes vencidos.
- Rechaza producto `requires_expiration=true` si hay balance activo disponible sin `expiration_date`.
- Decrementa `quantity_on_hand`.
- Crea `stock_movement_lots` asociado al `stock_movement_id` real.
- Lanza error si el stock loteado no alcanza.

## Confirmacion v1 intacta

La migracion nueva solo contiene:

- `CREATE OR REPLACE FUNCTION public.inventory_create_sale_v2(...)`

No contiene:

- `CREATE OR REPLACE FUNCTION inventory_create_sale(`
- `CREATE OR REPLACE FUNCTION public.inventory_create_sale(`
- `CREATE OR REPLACE FUNCTION public.inventory_invoice_order(`
- `ALTER TABLE`
- `CREATE TABLE`
- `CREATE INDEX`
- triggers
- seeds

## Confirmacion backend no activado

No se modificaron:

- `api/src/modules/inventory/services/sale.service.ts`
- `api/src/modules/inventory/repositories/sale.repository.ts`
- `api/src/modules/inventory/controllers/sale.controller.ts`
- `web/`
- `backend-reporteria/`
- `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql`
- `scripts/database/migrations/V047__sync_dev_functions_to_prd.sql`

El backend sigue usando v1 porque no se agrego llamada a `inventory_create_sale_v2`.

## Ejecucion local/dev

Se valido que `DB_HOST=localhost`. No se ejecuto nada contra PRD remoto.

Version PostgreSQL:

```text
PostgreSQL 16.12, compiled by Visual C++ build 1944, 64-bit
```

Comandos ejecutados, sin secretos:

```powershell
psql -h localhost -p 5432 -d manus_tienda_prd -v ON_ERROR_STOP=1 -f scripts/database/migrations/20260602_inventory_create_sale_v2.sql
```

Resultado:

```text
CREATE FUNCTION
```

Validacion de existencia despues de migrar:

```json
{"db": "manus_tienda_prd", "v1": true, "v2": true, "invoice_order": true}
```

Validacion final por nombre/firma registrada en `pg_proc`:

```json
[
  "inventory_invoice_order(uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb)",
  "inventory_create_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)",
  "inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)"
]
```

SUPUESTO: `inventory_invoice_order` se valida por nombre existente porque su firma local tiene 8 parametros.

Rollback local/dev:

```powershell
psql -h localhost -p 5432 -d manus_tienda_prd -v ON_ERROR_STOP=1 -f scripts/database/migrations/20260602_inventory_create_sale_v2_rollback.sql
```

Resultado:

```text
DROP FUNCTION
{"v1": true, "v2": false, "invoice_order": true}
```

Reaplicacion local/dev:

```powershell
psql -h localhost -p 5432 -d manus_tienda_prd -v ON_ERROR_STOP=1 -f scripts/database/migrations/20260602_inventory_create_sale_v2.sql
```

Resultado:

```text
CREATE FUNCTION
{"v1": true, "v2": true, "invoice_order": true}
```

No se ejecutaron ventas reales. No se inventaron fixtures.

## Validaciones hechas

| Validacion | Resultado |
| --- | --- |
| Migracion local/dev crea v2 | OK |
| Rollback local/dev elimina v2 | OK |
| Reaplicacion local/dev deja v2 disponible | OK |
| `inventory_create_sale` v1 existe despues de migracion | OK |
| `inventory_invoice_order` existe despues de migracion | OK |
| Backend no activado | OK |
| OpenSpec validate | OK |
| `git diff --check` | OK con warnings CRLF existentes |

## Riesgos vivos

- RIESGO: v2 existe en local/dev, pero backend aun no la usa. Fase futura debe activar por flag y probar venta end-to-end.
- RIESGO: No se probaron ventas reales porque no se crearon fixtures controlados en esta fase.
- RIESGO: Productos con stock agregado legacy pero sin `inventory_lot_balances` fallaran si se venden por v2 y tienen `requires_lot=true`.
- RIESGO: Cancelacion loteada todavia no esta implementada; una venta v2 futura requerira reverso por `stock_movement_lots`.
- RIESGO: `FOR UPDATE` sin `SKIP LOCKED` puede causar espera en ventas concurrentes del mismo producto/lote.

## Proximos pasos

1. Crear tests SQL/controlados para `inventory_create_sale_v2` con datos de local/dev.
2. Agregar activacion backend bajo flag apagado por defecto.
3. Implementar decision v1/v2 en `SaleRepository` o `SaleService` sin romper POS.
4. Implementar cancelacion loteada usando `stock_movement_lots`.
5. Ejecutar reconciliacion despues de pruebas de venta y cancelacion.
