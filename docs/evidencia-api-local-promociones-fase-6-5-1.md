# Evidencia API local promociones - Fase 6.5.1

## Resumen

FASE 6.5.1 APROBADA.

Se valido la migracion local de promociones, rollback, reaplicacion y API real local de CRUD de promociones contra copia QA local de PRD.

No se toco PRD real. No se toco servidor remoto. No se integro promociones a POS ni Orders.

## Ambiente usado

- DB_HOST: `localhost`
- DB_PORT: `5432`
- DB_NAME: `manus_tienda_prd`
- API local: `http://localhost:4023/api`
- PostgreSQL: `PostgreSQL 16.12, compiled by Visual C++ build 1944, 64-bit`
- Servidor DB reportado: `::1/128:5432`
- Confirmacion: copia local QA de PRD, no PRD real.
- Token local: usado solo en runtime, no expuesto.

## Backup

Backup local previo:

`D:\Profe\backups\manus_tienda_prd_promotions_pre_20260601_112126.dump`

El backup quedo fuera del repo y no contiene secretos en esta evidencia.

## Migracion local

Archivo ejecutado:

`scripts/database/migrations/20260605_pricing_promotions_phase_1.sql`

Resultado: OK.

Tablas validadas:

- `promotions`
- `promotion_products`
- `promotion_branches`

Conteos base antes de la migracion:

- `products`: 6
- `sale_items`: 49
- `order_items`: 22

Conteos despues de migracion:

- `products`: 6
- `sale_items`: 49
- `order_items`: 22

## Constraints validadas

Promociones:

- `chk_promotions_discount_type`
- `chk_promotions_discount_value_non_negative`
- `chk_promotions_name_not_blank`
- `chk_promotions_percentage_range`
- `chk_promotions_priority_non_negative`
- `chk_promotions_promotion_type`
- `chk_promotions_valid_range`
- `promotions_created_by_fkey`
- `promotions_tenant_id_fkey`
- `promotions_pkey`

Productos de promocion:

- `promotion_products_pkey`
- `promotion_products_promotion_id_fkey`
- `promotion_products_product_id_fkey`
- `promotion_products_tenant_id_fkey`
- `uq_promotion_products_promotion_product`

Sucursales de promocion:

- `promotion_branches_pkey`
- `promotion_branches_promotion_id_fkey`
- `promotion_branches_branch_id_fkey`
- `promotion_branches_tenant_id_fkey`
- `uq_promotion_branches_promotion_branch`

## Indices validados

- `idx_promotions_tenant_active_dates`
- `idx_promotions_tenant_search`
- `promotions_pkey`
- `idx_promotion_products_tenant_product`
- `promotion_products_pkey`
- `uq_promotion_products_promotion_product`
- `idx_promotion_branches_tenant_branch`
- `promotion_branches_pkey`
- `uq_promotion_branches_promotion_branch`

## Rollback

Archivo ejecutado:

`scripts/database/migrations/20260605_pricing_promotions_phase_1_rollback.sql`

Resultado: OK.

Validaciones:

- `promotions`: desaparece.
- `promotion_products`: desaparece.
- `promotion_branches`: desaparece.
- `products`: 6, sin disminucion.
- `sale_items`: 49, sin disminucion.
- `order_items`: 22, sin disminucion.

## Reaplicacion

Se reaplico la migracion despues del rollback.

Resultado: OK.

Decision: DB local queda migrada para siguientes fases.

## API local probada

Producto fixture:

- `productId`: `30000000-0000-0000-0000-000000000005`
- Producto: `Huevos`
- `branchId`: `dc1b81e0-5ea9-4972-839c-2eb158112e40`
- Sucursal: `Adelita de Char`
- Tenant: `00000000-0000-0000-0000-000000000001`
- Prefijo fixture: `QA_PROMO_651_1780332040971_`

Endpoints:

- `POST /api/pricing/promotions`
- `GET /api/pricing/promotions`
- `GET /api/pricing/promotions?productId=:productId`
- `PATCH /api/pricing/promotions/:id`
- `PATCH /api/pricing/promotions/:id/deactivate`
- `GET /api/products/:id`
- `GET /api/inventory/products?branchId=:branchId`
- `POST /api/pricing/preview-line`

## Payloads sanitizados

Promocion porcentaje:

```json
{
  "name": "QA_PROMO_651_<timestamp>_PERCENTAGE",
  "discountType": "PERCENTAGE",
  "discountValue": 15,
  "productIds": ["<productId>"],
  "branchIds": []
}
```

Promocion valor fijo:

```json
{
  "name": "QA_PROMO_651_<timestamp>_FIXED_AMOUNT",
  "discountType": "FIXED_AMOUNT",
  "discountValue": 500,
  "productIds": ["<productId>"],
  "branchIds": []
}
```

Promocion precio especial:

```json
{
  "name": "QA_PROMO_651_<timestamp>_SPECIAL_PRICE",
  "discountType": "SPECIAL_PRICE",
  "discountValue": "<precio especial>",
  "productIds": ["<productId>"],
  "branchIds": []
}
```

Promocion por sucursal:

```json
{
  "name": "QA_PROMO_651_<timestamp>_WITH_BRANCH",
  "discountType": "PERCENTAGE",
  "discountValue": 5,
  "productIds": ["<productId>"],
  "branchIds": ["<branchId>"]
}
```

## Resultados API

Creacion:

- `PERCENTAGE`: `201`
- `FIXED_AMOUNT`: `201`
- `SPECIAL_PRICE`: `201`
- promocion con sucursal: `201`
- promocion sin sucursal: `201`

Listado:

- `GET /api/pricing/promotions?search=QA_PROMO_651_...`: `200`
- fixtures encontrados: 5

Filtro:

- `GET /api/pricing/promotions?productId=<productId>`: `200`
- contiene fixture de porcentaje: si

Actualizacion:

- `PATCH /api/pricing/promotions/:id`: `200`
- `discountValue` actualizado a `12`

Desactivacion:

- `PATCH /api/pricing/promotions/:id/deactivate`: `200`
- `isActive=false`
- registro sigue existiendo en DB: si

## Errores probados

- Porcentaje mayor a 100: `400`, mensaje contiene `percentage discountValue`.
- Vigencia invalida: `400`, mensaje contiene `endsAt`.
- Sin productos: `400`, mensaje contiene `productIds`.
- Producto inexistente: `400`, mensaje contiene `products must belong`.

## No impacto

Validaciones:

- `GET /api/products/:id`: `200`
- `GET /api/inventory/products?branchId=:branchId`: `200`
- `POST /api/pricing/preview-line`: `201`

Respuesta relevante de `preview-line`:

```json
{
  "discountAmount": 0,
  "discountPercent": 0,
  "appliedPromotionId": null,
  "appliedPromotionName": null
}
```

Confirmacion:

- POS no se toco.
- Orders no se toco.
- `SaleService` no se toco.
- `OrderService` no se toco.
- `inventory_create_sale_v2` no se toco.
- Promociones todavia no afectan ventas ni pedidos.

## Cleanup

Cleanup SQL local:

```sql
delete from promotion_branches
where promotion_id in (
  select id from promotions where name like 'QA_PROMO_651_%'
);

delete from promotion_products
where promotion_id in (
  select id from promotions where name like 'QA_PROMO_651_%'
);

delete from promotions
where name like 'QA_PROMO_651_%';
```

Resultado:

- fixtures antes de cleanup: 5
- `fixture_rows_remaining`: 0
- `products`: 6 antes, 6 despues
- `sale_items`: 49 antes, 49 despues
- `order_items`: 22 antes, 22 despues

## Comandos ejecutados

Sin secretos:

```powershell
pg_dump --format=custom --file D:\Profe\backups\manus_tienda_prd_promotions_pre_20260601_112126.dump
node <script-local-temporal> # ejecuta SQL de migracion con pg contra localhost/manus_tienda_prd
node <script-local-temporal> # ejecuta SQL de rollback con pg contra localhost/manus_tienda_prd
node <script-local-temporal> # reaplica SQL de migracion con pg contra localhost/manus_tienda_prd
npm run start:dev
```

La prueba API se ejecuto contra `http://localhost:4023/api` con token local redacted.

## Riesgos vivos

- Las promociones CRUD estan listas, pero `PricingService` aun no aplica promociones por diseno de fase.
- Falta fase de seleccion de promocion aplicable, conflictos por prioridad y trazabilidad en ventas/pedidos.
- Falta prueba UI futura cuando exista administracion de promociones en frontend.

## Proximos pasos

- Disenar aplicacion controlada de promociones en `PricingService`.
- Definir reglas de prioridad, acumulacion y vigencia por sucursal/canal.
- Integrar primero en preview, despues en POS/Orders con evidencia separada.
