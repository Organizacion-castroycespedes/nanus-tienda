# Runbook migracion promociones - Fase 6.5

## Objetivo

Crear tablas de promociones simples por producto/sucursal:

- `promotions`
- `promotion_products`
- `promotion_branches`

Esta migracion no aplica promociones en POS ni Orders.

## Precondiciones

- Confirmar ambiente local/QA, no PRD real.
- Confirmar backup disponible.
- Confirmar tablas base:
  - `tenants`
  - `users`
  - `products`
  - `tenant_branches`

## Backup

Usar `pg_dump` o mecanismo local seguro antes de ejecutar:

```bash
pg_dump --host localhost --port 5432 --dbname manus_tienda_prd --file backups/manus_tienda_prd_promotions_pre_20260605.sql
```

No exponer secretos en consola ni evidencia.

## Validacion PostgreSQL

```sql
SELECT version();
SELECT current_database(), inet_server_addr(), inet_server_port();
```

## Validar estructura base

```sql
SELECT to_regclass('public.products') AS products;
SELECT to_regclass('public.tenant_branches') AS tenant_branches;
SELECT to_regclass('public.tenants') AS tenants;
SELECT to_regclass('public.users') AS users;
```

## Ejecutar migracion local/QA

```bash
psql --host localhost --port 5432 --dbname manus_tienda_prd --file scripts/database/migrations/20260605_pricing_promotions_phase_1.sql
```

## Verificar tablas

```sql
SELECT to_regclass('public.promotions') AS promotions;
SELECT to_regclass('public.promotion_products') AS promotion_products;
SELECT to_regclass('public.promotion_branches') AS promotion_branches;
```

## Verificar constraints

```sql
SELECT conname
FROM pg_constraint
WHERE conrelid IN (
  'public.promotions'::regclass,
  'public.promotion_products'::regclass,
  'public.promotion_branches'::regclass
)
ORDER BY conname;
```

## Verificar indices

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('promotions', 'promotion_products', 'promotion_branches')
ORDER BY indexname;
```

## Validar compatibilidad

```sql
SELECT count(*) FROM products;
SELECT count(*) FROM sale_items;
SELECT count(*) FROM order_items;
```

Los conteos no deben bajar por esta migracion.

## Rollback

```bash
psql --host localhost --port 5432 --dbname manus_tienda_prd --file scripts/database/migrations/20260605_pricing_promotions_phase_1_rollback.sql
```

Validar:

```sql
SELECT to_regclass('public.promotions') AS promotions;
SELECT to_regclass('public.promotion_products') AS promotion_products;
SELECT to_regclass('public.promotion_branches') AS promotion_branches;
```

Debe devolver `NULL` para las tres tablas.

## Criterios de exito

- Migracion aplica sin error.
- Tablas, constraints e indices existen.
- POS/Orders no cambian comportamiento.
- No baja conteo de productos, ventas ni pedidos.
- Rollback elimina solo tablas de promociones.

## Criterios de abortar

- Ambiente no confirmado como local/QA.
- Falta backup.
- Falta tabla base.
- Error de constraint/FK inesperado.
- Conteo de productos, ventas o pedidos baja.
