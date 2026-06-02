# Runbook migracion productos e inventario - Fase 2.1

## Objetivo

Preparar la base de datos para producto enriquecido, barcodes multiples, ubicaciones fisicas, lotes, saldos por lote, relacion movimiento-lote, historial de precios y alertas operativas.

Esta migracion no activa comportamiento funcional. No modifica endpoints, servicios, frontend, reporteria ni funciones SQL criticas como `inventory_create_sale` o `inventory_invoice_order`.

## Alcance

Archivos:

- `scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql`
- `scripts/database/migrations/20260601_inventory_products_lots_phase_1_rollback.sql`

Incluye:

- Columnas nuevas compatibles en `products`.
- Tablas nuevas: `product_barcodes`, `inventory_locations`, `inventory_lots`, `inventory_lot_balances`, `stock_movement_lots`, `product_price_history`, `inventory_alert_rules`, `inventory_alerts`.
- Checks, FKs simples, uniques e indices.
- `quantity_available` como generated column para PostgreSQL 16.

No incluye:

- Seeds de productos.
- Lotes legacy masivos.
- Scheduler/job de alertas.
- Cambios en POS, compras, pedidos o reporteria.
- Cambios en funciones SQL transaccionales.

## Precondiciones

1. Confirmar ventana de mantenimiento.
2. Confirmar conexion a la base correcta.
3. Confirmar que existe respaldo reciente.
4. Ejecutar primero en local/dev.
5. Ejecutar despues en QA.
6. Solo despues de aprobacion, planear produccion.

Validar PostgreSQL:

```sql
SELECT version();
```

Debe indicar PostgreSQL 16.x.

Validar tablas base:

```sql
SELECT to_regclass('public.products') AS products_table,
       to_regclass('public.stock_movements') AS stock_movements_table,
       to_regclass('public.tenants') AS tenants_table,
       to_regclass('public.tenant_branches') AS tenant_branches_table;
```

`products_table` y `stock_movements_table` deben existir.

## Backup

Antes de aplicar en cualquier ambiente compartido:

```bash
pg_dump --format=custom --file=backup_before_inventory_products_lots_phase_1.dump "$DATABASE_URL"
```

Si el ambiente usa variables separadas:

```bash
pg_dump --host "$DB_HOST" --port "$DB_PORT" --username "$DB_USER" --dbname "$DB_NAME" --format=custom --file backup_before_inventory_products_lots_phase_1.dump
```

## Ejecucion local/dev

Usar el flujo normal del repositorio para migraciones. Si se ejecuta manualmente:

```bash
psql "$DATABASE_URL" -f scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql
```

No ejecutar rollback salvo que se active plan de reversa.

## Ejecucion QA

1. Restaurar o apuntar a base QA representativa.
2. Tomar backup QA.
3. Ejecutar migracion principal.
4. Correr validaciones de este runbook.
5. Probar humo funcional:
   - Login.
   - Listado de productos.
   - Crear producto basico actual si QA lo permite.
   - Compra/recepcion existente sin lote obligatorio.
   - Venta POS de producto no loteado.
   - Reportes existentes de ventas/compras/caja.

## Validar columnas en `products`

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name IN (
    'is_perishable',
    'requires_lot',
    'requires_expiration',
    'operational_status',
    'rotation_class',
    'min_stock',
    'max_stock'
  )
ORDER BY column_name;
```

Validar defaults en productos existentes:

```sql
SELECT
  COUNT(*) FILTER (WHERE is_perishable = false) AS not_perishable,
  COUNT(*) FILTER (WHERE requires_lot = false) AS not_requires_lot,
  COUNT(*) FILTER (WHERE requires_expiration = false) AS not_requires_expiration,
  COUNT(*) FILTER (WHERE operational_status = 'ACTIVE') AS active_operational_status,
  COUNT(*) AS total_products
FROM public.products;
```

Los cuatro contadores deben coincidir con `total_products` salvo que ya existieran datos nuevos previos.

## Validar tablas nuevas

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'product_barcodes',
    'inventory_locations',
    'inventory_lots',
    'inventory_lot_balances',
    'stock_movement_lots',
    'product_price_history',
    'inventory_alert_rules',
    'inventory_alerts'
  )
ORDER BY table_name;
```

Deben aparecer las ocho tablas.

## Validar constraints

```sql
SELECT conrelid::regclass AS table_name, conname, contype
FROM pg_constraint
WHERE conrelid IN (
  'public.products'::regclass,
  'public.product_barcodes'::regclass,
  'public.inventory_locations'::regclass,
  'public.inventory_lots'::regclass,
  'public.inventory_lot_balances'::regclass,
  'public.stock_movement_lots'::regclass,
  'public.product_price_history'::regclass,
  'public.inventory_alert_rules'::regclass,
  'public.inventory_alerts'::regclass
)
ORDER BY table_name::text, conname;
```

Revisar que existan checks y FKs esperadas. FKs opcionales pueden no existir si la tabla referenciada no existe en ese ambiente.

## Validar indices

```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'products',
    'product_barcodes',
    'inventory_locations',
    'inventory_lots',
    'inventory_lot_balances',
    'stock_movement_lots',
    'product_price_history',
    'inventory_alert_rules',
    'inventory_alerts'
  )
ORDER BY tablename, indexname;
```

Validar indices clave:

- `ux_product_barcodes_tenant_barcode`
- `ux_product_barcodes_primary_active`
- `ux_inventory_locations_tenant_branch_code`
- `ux_inventory_lots_tenant_branch_product_code`
- `idx_inventory_lots_fefo`
- `ux_inventory_lot_balances_without_location`
- `ux_inventory_lot_balances_with_location`
- `idx_inventory_lot_balances_available_fefo`
- `idx_stock_movement_lots_tenant_movement`
- `idx_product_price_history_tenant_product_valid_from`
- `ux_inventory_alert_rules_tenant_type_severity`

## Validar generated column

```sql
SELECT column_name, generation_expression
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inventory_lot_balances'
  AND column_name = 'quantity_available';
```

Debe mostrar expresion basada en `quantity_on_hand - quantity_reserved`.

## Validar no activacion de lotes en productos existentes

```sql
SELECT COUNT(*) AS products_requiring_lot
FROM public.products
WHERE requires_lot = true
   OR requires_expiration = true;
```

En migracion inicial debe ser `0`, salvo datos manuales previos.

## Validar no seed de alertas

```sql
SELECT COUNT(*) AS alert_rules
FROM public.inventory_alert_rules;
```

Debe ser `0` si no existian reglas previas.

## Validar humo funcional

Despues de migrar en local/dev o QA:

1. Abrir app web.
2. Login con usuario normal de pruebas.
3. Listar productos.
4. Consultar dashboard de inventario.
5. Crear compra de prueba si el ambiente lo permite.
6. Recibir compra sin lote para producto existente no loteado.
7. Vender en POS producto existente no loteado.
8. Cancelar venta de prueba si el flujo QA lo permite.
9. Consultar reportes existentes de ventas, compras y caja.

Resultado esperado: todo se comporta igual que antes, porque no hay reglas funcionales nuevas activadas.

## Plan de rollback

Usar solo si la migracion falla o si validaciones criticas no pasan.

```bash
psql "$DATABASE_URL" -f scripts/database/migrations/20260601_inventory_products_lots_phase_1_rollback.sql
```

ADVERTENCIA: El rollback elimina datos capturados en tablas nuevas:

- `product_barcodes`
- `inventory_locations`
- `inventory_lots`
- `inventory_lot_balances`
- `stock_movement_lots`
- `product_price_history`
- `inventory_alert_rules`
- `inventory_alerts`

No elimina ventas, compras, `stock_movements`, productos base ni funciones SQL.

## Criterios de exito

- PostgreSQL reporta version 16.x.
- La migracion termina sin errores.
- Las columnas nuevas existen en `products`.
- Productos existentes quedan con defaults seguros.
- Las ocho tablas nuevas existen.
- Checks, FKs e indices clave existen.
- `inventory_lot_balances.quantity_available` es generated column.
- No se crearon lotes legacy masivos.
- No se activaron `requires_lot` ni `requires_expiration`.
- Ventas POS, compras y reportes existentes pasan prueba de humo.

## Criterios para abortar

Abortar y evaluar rollback si ocurre cualquiera:

- Error al agregar columnas en `products`.
- Error por tabla base faltante.
- Error creando generated column en PostgreSQL 16.
- Productos existentes quedan con `requires_lot = true` o `requires_expiration = true` sin decision manual.
- Venta POS basica falla despues de migrar.
- Compra/recepcion basica falla despues de migrar.
- Reportes existentes fallan despues de migrar.

## Riesgos conocidos

RIESGO: FKs simples no garantizan por si solas consistencia tenant-aware entre tablas. La implementacion funcional de Fase 3 debe validar `tenant_id` y `branch_id` en transaccion.

RIESGO: No existe trigger global confirmado de `updated_at`; la migracion deja comentario TODO y no crea funcion global nueva.

RIESGO: `inventory_lot_balances` es proyeccion operativa futura. Hasta Fase 3 no debe considerarse fuente funcional de stock.

PREGUNTA ABIERTA: Definir en Fase 3 si el endurecimiento de FK compuestas se hace antes o despues de activar lotes en produccion.
