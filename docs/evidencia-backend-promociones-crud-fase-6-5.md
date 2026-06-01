# Evidencia backend promociones CRUD - Fase 6.5

## Resultado

FASE 6.5 COMPLETADA.

Hardening CRUD promociones Fase 6.5.1-H completado sin cambio de contrato.

## Objetivo

Crear modelo de datos y backend CRUD para promociones simples por producto/sucursal, sin aplicar promociones en POS ni Orders todavia.

## Archivos modificados

- `api/src/modules/pricing/promotions.controller.ts`
- `api/src/modules/pricing/promotions.controller.spec.ts`
- `api/src/modules/pricing/promotions.repository.ts`
- `api/src/modules/pricing/promotions.service.ts`
- `api/src/modules/pricing/promotions.service.spec.ts`
- `api/src/modules/pricing/pricing.controller.spec.ts`
- `api/src/modules/pricing/promotions.types.ts`
- `api/src/modules/pricing/pricing.module.ts`
- `scripts/database/migrations/20260605_pricing_promotions_phase_1.sql`
- `scripts/database/migrations/20260605_pricing_promotions_phase_1_rollback.sql`
- `docs/runbook-migracion-promociones-fase-6-5.md`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`

## Migracion creada

Archivo:

- `scripts/database/migrations/20260605_pricing_promotions_phase_1.sql`

Tablas:

- `promotions`
- `promotion_products`
- `promotion_branches`

Constraints principales:

- `discount_type IN ('PERCENTAGE','FIXED_AMOUNT','SPECIAL_PRICE')`
- `discount_value >= 0`
- `PERCENTAGE <= 100`
- `ends_at > starts_at`
- `priority >= 0`
- `promotion_type IN ('PRODUCT_DISCOUNT')`
- `UNIQUE (promotion_id, product_id)`
- `UNIQUE (promotion_id, branch_id)`

Rollback:

- `scripts/database/migrations/20260605_pricing_promotions_phase_1_rollback.sql`

SQL no ejecutado contra PRD real.

## Endpoints creados

- `GET /api/pricing/promotions`
- `GET /api/pricing/promotions/:id`
- `POST /api/pricing/promotions`
- `PATCH /api/pricing/promotions/:id`
- `PATCH /api/pricing/promotions/:id/deactivate`

Filtros `GET`:

- `search`
- `isActive`
- `productId`
- `branchId`
- `startsAt`
- `endsAt`

## Reglas implementadas

- Promocion pertenece siempre a `tenantId` autenticado.
- `createdBy` se toma del usuario autenticado.
- Promocion debe tener al menos un producto.
- Producto objetivo debe pertenecer al tenant.
- Sucursal objetivo debe pertenecer al tenant.
- Si `branchIds` es vacio, aplica a todo el tenant.
- No se permite porcentaje mayor a `100`.
- No se permite descuento negativo.
- No se permite vigencia invalida.
- `priority` debe ser entero no negativo.
- No hay borrado fisico; `deactivate` marca `isActive=false`.
- No se evaluan promociones en ventas.
- No se modifican `sale_items` ni `order_items`.

## Hardening 6.5.1-H

No se cambio el contrato funcional de los endpoints existentes.

Se reforzo cobertura para:

- `discountType` invalido.
- `discountValue` negativo.
- `PERCENTAGE > 100`.
- `SPECIAL_PRICE` negativo y no finito.
- `startsAt` invalido.
- `endsAt` invalido.
- `priority` negativo.
- producto objetivo fuera del tenant.
- sucursal objetivo fuera del tenant.
- listado filtrado por `isActive=false`.
- query `isActive` invalida.
- request sin tenant autenticado.
- desactivacion logica de promocion existente.
- compatibilidad de `POST /api/pricing/preview-line` con campos de promocion aplicada.

No se agregaron migraciones, tablas, permisos ni paginacion.

## Pruebas ejecutadas

```bash
cd api && npx.cmd tsx --test src/modules/pricing/*.spec.ts
```

Resultado:

- 47 tests pass.
- 0 fail.

Casos cubiertos:

- crear promocion por producto.
- crear promocion con sucursal.
- crear promocion sin sucursal para todo el tenant.
- rechazar porcentaje `> 100`.
- rechazar vigencia invalida.
- rechazar promocion sin productos.
- listar promociones.
- filtrar por `productId`.
- filtrar por `isActive`.
- actualizar promocion.
- desactivar promocion.
- no borrar fisicamente.
- aislar tenant.
- controller usa tenant/user autenticados.
- controller rechaza query `isActive` invalida.
- controller rechaza request sin tenant.
- preview-line mantiene campos de promocion aplicada.

```bash
cd api && npm.cmd run build
```

Resultado:

- Build pass.

## Confirmacion de alcance

- No se aplicaron promociones en POS.
- No se aplicaron promociones en Orders.
- No se modifico `inventory_create_sale_v2`.
- No se modifico `SaleService`.
- No se modifico `OrderService`.
- No se toco frontend.
- No se toco `backend-reporteria/`.
- No se toco PRD real.
- No se hizo commit.

## Riesgos vivos

- No hay UI de promociones todavia.
- No existe permiso/menu dedicado para promociones; se usa `INVENTORY_PRODUCTS` como permiso operativo temporal.
- Integridad tenant fuerte en `promotion_products` y `promotion_branches` depende del service para escrituras API; una migracion futura podria agregar FKs compuestas si se decide blindar SQL manual.
- No hay paginacion en listado; queda fuera de alcance.

## Proximos pasos

- Crear UI administrativa de promociones.
- Definir permiso dedicado futuro si negocio separa precios/promociones de inventario.
