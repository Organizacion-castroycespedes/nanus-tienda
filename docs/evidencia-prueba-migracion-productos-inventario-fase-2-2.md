# Evidencia prueba migracion productos e inventario - Fase 2.2

## Resumen

Resultado final: APROBADO.

Se ejecuto prueba controlada en ambiente local/dev. La migracion principal paso, las validaciones de integridad pasaron, el rollback paso, y luego se volvio a aplicar la migracion para dejar la base local/dev en estado migrado.

No se ejecuto nada contra produccion ni QA remoto.
No se modifico codigo funcional.
No se modificaron endpoints.
No se modificaron funciones SQL criticas.
No se crearon seeds operativos.
No se activaron `requires_lot` ni `requires_expiration` en productos existentes.

## Fecha/hora de prueba

- Fecha/hora local: `2026-05-28 00:21:09 -05:00`
- Ambiente: local/dev
- Fuente de configuracion: `scripts/config/db.env`
- Base de datos: `manus_tienda_prd`
- Host: `localhost`
- Puerto: `5432`
- Usuario: `postgres`
- Secretos: no documentados

OBSERVACION: El nombre de la base contiene `prd`, pero el host es `localhost` y `ENVIRONMENT=dev`.

## Version PostgreSQL

```json
{
  "version": "PostgreSQL 16.12, compiled by Visual C++ build 1944, 64-bit",
  "database": "manus_tienda_prd",
  "server_addr": "::1/128",
  "server_port": 5432
}
```

## Tablas base antes de migrar

```json
{
  "users": true,
  "tenants": true,
  "products": true,
  "purchases": true,
  "suppliers": true,
  "sale_items": true,
  "purchase_items": true,
  "stock_movements": true,
  "tenant_branches": true
}
```

## Conteos antes de migrar

```json
{
  "users": 5,
  "products": 5,
  "purchases": 11,
  "sale_items": 39,
  "stock_movements": 56
}
```

## Ejecucion migracion principal

Archivo ejecutado:

```text
scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql
```

Resultado:

- Exit code: `0`
- Transaccion: `BEGIN` / `COMMIT`
- `pgcrypto`: ya existia, PostgreSQL lo omitio con notice esperado.
- No hubo errores.

## Validacion columnas en `products`

```json
[
  {"type": "boolean", "column": "is_perishable", "default": "false", "nullable": "NO"},
  {"type": "numeric", "column": "max_stock", "default": null, "nullable": "YES"},
  {"type": "numeric", "column": "min_stock", "default": null, "nullable": "YES"},
  {"type": "text", "column": "operational_status", "default": "'ACTIVE'::text", "nullable": "NO"},
  {"type": "boolean", "column": "requires_expiration", "default": "false", "nullable": "NO"},
  {"type": "boolean", "column": "requires_lot", "default": "false", "nullable": "NO"},
  {"type": "text", "column": "rotation_class", "default": null, "nullable": "YES"}
]
```

## Validacion defaults productos existentes

```json
{
  "total_products": 5,
  "requires_lot_false": 5,
  "is_perishable_false": 5,
  "operational_status_active": 5,
  "requires_expiration_false": 5
}
```

Resultado: APROBADO. Todos los productos existentes quedaron con defaults seguros.

## Validacion tablas nuevas

```json
{
  "inventory_lots": true,
  "inventory_alerts": true,
  "product_barcodes": true,
  "inventory_locations": true,
  "stock_movement_lots": true,
  "inventory_alert_rules": true,
  "product_price_history": true,
  "inventory_lot_balances": true
}
```

Resultado: APROBADO.

## Validacion constraints principales

```json
{
  "chk_products_stock_range": true,
  "chk_inventory_alerts_type": true,
  "chk_inventory_alerts_status": true,
  "chk_products_rotation_class": true,
  "chk_inventory_alerts_severity": true,
  "chk_inventory_alert_rules_type": true,
  "chk_products_operational_status": true,
  "chk_inventory_alert_rules_severity": true,
  "chk_products_max_stock_non_negative": true,
  "chk_products_min_stock_non_negative": true,
  "chk_products_perishable_has_control": true,
  "chk_products_expiration_requires_lot": true,
  "chk_product_price_history_new_non_negative": true,
  "chk_inventory_lot_balances_on_hand_non_negative": true,
  "chk_inventory_lot_balances_reserved_lte_on_hand": true,
  "chk_product_price_history_previous_non_negative": true,
  "chk_inventory_lot_balances_reserved_non_negative": true
}
```

Resultado: APROBADO.

## Validacion indices

```json
{
  "idx_inventory_lots_fefo": true,
  "idx_inventory_lots_active": true,
  "idx_inventory_alerts_tenant_branch": true,
  "ux_product_barcodes_primary_active": true,
  "ux_product_barcodes_tenant_barcode": true,
  "idx_inventory_alerts_tenant_product": true,
  "idx_stock_movement_lots_tenant_movement": true,
  "ux_inventory_lot_balances_with_location": true,
  "ux_product_price_history_current_applied": true,
  "idx_inventory_lot_balances_available_fefo": true,
  "ux_inventory_locations_tenant_branch_code": true,
  "idx_stock_movement_lots_tenant_product_lot": true,
  "ux_inventory_lot_balances_without_location": true,
  "idx_inventory_alerts_tenant_status_severity": true,
  "ux_inventory_lots_tenant_branch_product_code": true,
  "ux_inventory_alert_rules_tenant_type_severity": true,
  "idx_inventory_lot_balances_tenant_branch_product": true,
  "idx_product_price_history_tenant_product_valid_from": true
}
```

Resultado: APROBADO.

## Validacion funciones criticas

Existencia posterior a migracion:

```json
{
  "inventory_create_sale": true,
  "inventory_invoice_order": true
}
```

Validacion de archivos de migracion:

```text
rg -n "CREATE OR REPLACE FUNCTION|inventory_create_sale|inventory_invoice_order" scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql scripts/database/migrations/20260601_inventory_products_lots_phase_1_rollback.sql
```

Resultado:

- Sin coincidencias.
- Exit code `1` de `rg`, esperado cuando no hay matches.

Resultado: APROBADO. La migracion no modifica funciones criticas.

## Conteos despues de migracion

```json
{
  "users": 5,
  "products": 5,
  "purchases": 11,
  "sale_items": 39,
  "stock_movements": 56
}
```

Resultado: APROBADO. No disminuyeron conteos base.

## Resultado OpenSpec

Comando:

```text
openspec validate fortalecer-productos-inventario --type change --strict --json
```

Resultado:

```json
{
  "items": [
    {
      "id": "fortalecer-productos-inventario",
      "type": "change",
      "valid": true,
      "issues": [],
      "durationMs": 5
    }
  ],
  "summary": {
    "totals": {
      "items": 1,
      "passed": 1,
      "failed": 0
    }
  }
}
```

Resultado: APROBADO.

## Resultado `git diff --check`

Comando:

```text
git diff --check
```

Resultado:

- Exit code: `0`
- Sin errores de whitespace.

Resultado: APROBADO.

## Resultado rollback

Archivo ejecutado:

```text
scripts/database/migrations/20260601_inventory_products_lots_phase_1_rollback.sql
```

Resultado:

- Exit code: `0`
- Transaccion: `BEGIN` / `COMMIT`
- No hubo errores.

Tablas nuevas despues de rollback:

```json
{
  "inventory_lots": false,
  "inventory_alerts": false,
  "product_barcodes": false,
  "inventory_locations": false,
  "stock_movement_lots": false,
  "inventory_alert_rules": false,
  "product_price_history": false,
  "inventory_lot_balances": false
}
```

Columnas nuevas de `products` despues de rollback:

```json
{
  "max_stock": false,
  "min_stock": false,
  "requires_lot": false,
  "is_perishable": false,
  "rotation_class": false,
  "operational_status": false,
  "requires_expiration": false
}
```

Tablas base despues de rollback:

```json
{
  "sales": true,
  "products": true,
  "purchases": true,
  "stock_movements": true
}
```

Conteos base despues de rollback:

```json
{
  "users": 5,
  "products": 5,
  "purchases": 11,
  "sale_items": 39,
  "stock_movements": 56
}
```

Resultado: APROBADO.

## Estado final local/dev

Despues de validar rollback, se volvio a ejecutar la migracion principal para dejar local/dev en estado migrado.

Validacion final:

```json
{
  "users": 5,
  "products": 5,
  "purchases": 11,
  "sale_items": 39,
  "tables_present": true,
  "stock_movements": 56,
  "requires_lot_true": 0,
  "requires_expiration_true": 0
}
```

Resultado: APROBADO.

## Comandos ejecutados

Sin secretos:

```text
openspec status --change fortalecer-productos-inventario --json
openspec instructions apply --change fortalecer-productos-inventario --json
SELECT version();
SELECT to_regclass(...) para tablas base
SELECT COUNT(*) para products, stock_movements, purchases, sale_items, users
psql -f scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql
SELECT ... validacion columnas products
SELECT ... validacion defaults products
SELECT ... validacion tablas nuevas
SELECT ... validacion constraints principales
SELECT ... validacion indices principales
SELECT ... validacion funciones criticas
rg -n "CREATE OR REPLACE FUNCTION|inventory_create_sale|inventory_invoice_order" scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql scripts/database/migrations/20260601_inventory_products_lots_phase_1_rollback.sql
openspec validate fortalecer-productos-inventario --type change --strict --json
git diff --check
psql -f scripts/database/migrations/20260601_inventory_products_lots_phase_1_rollback.sql
SELECT ... validacion rollback
psql -f scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql
SELECT ... validacion final
```

## Observaciones

- La prueba uso PostgreSQL 16.12 local.
- `pgcrypto` ya existia; el notice fue esperado.
- La base local/dev quedo migrada al final.
- No se crearon alert rules por seed.
- No se crearon lotes legacy.
- No se activaron reglas funcionales.

## Riesgos vivos

RIESGO: Las FKs son simples en esta fase. Fase 3 debe validar `tenant_id` y `branch_id` en servicios/transacciones.

RIESGO: `updated_at` no tiene trigger global confirmado. Las tablas nuevas tienen columna, pero no actualizacion automatica por trigger.

RIESGO: `inventory_lot_balances` existe, pero todavia no debe usarse como fuente funcional de stock hasta Fase 3.

RIESGO: Rollback elimina datos capturados en tablas nuevas. En ambientes compartidos requiere backup.

## Proximos pasos

1. Validar con responsables si el nombre local `manus_tienda_prd` debe renombrarse para evitar confusion.
2. Preparar Fase 3 de `api/` sin tocar POS hasta definir pruebas de regresion.
3. Definir capa transaccional para mantener `stock_movements`, `stock_movement_lots` e `inventory_lot_balances` juntos.
4. Definir politica de `updated_at`.
5. Definir estrategia futura de FKs compuestas tenant-aware.
