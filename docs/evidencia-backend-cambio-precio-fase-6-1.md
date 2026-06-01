# Evidencia backend cambio de precio - Fase 6.1

## Objetivo

Implementar backend para cambiar `products.price` con historial, motivo obligatorio y trazabilidad, sin tocar POS, Orders, ventas historicas, frontend, `backend-reporteria` ni funciones SQL de venta.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/controllers/product.controller.ts` | Agrega `POST /api/products/:id/change-price` y `GET /api/products/:id/price-history`. |
| `api/src/modules/inventory/services/product.service.ts` | Agrega flujo transaccional de cambio de precio e historial. |
| `api/src/modules/inventory/repositories/product.repository.ts` | Agrega consultas parametrizadas para `product_price_history`, `FOR UPDATE` de producto y cierre de vigencia anterior. |
| `api/src/modules/inventory/services/product.service.spec.ts` | Agrega pruebas unitarias de cambio de precio e historial. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Registra Fase 6.1 completada. |

## Migracion

No se creo migracion nueva.

La tabla `product_price_history` ya esta definida en `scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql` con:

- `tenant_id`
- `product_id`
- `previous_price`
- `new_price`
- `reason`
- `changed_by`
- `valid_from`
- `valid_to`
- `status`
- `approved_by`
- `approved_at`
- `created_at`

La implementacion de Fase 6.1 asume esa migracion aplicada en ambientes donde se usen los endpoints.

## Endpoints creados

### `POST /api/products/:id/change-price`

Payload:

```json
{
  "newPrice": 12000,
  "reason": "Ajuste por nuevo costo de proveedor"
}
```

Respuesta:

```json
{
  "productId": "...",
  "previousPrice": 10000,
  "newPrice": 12000,
  "reason": "Ajuste por nuevo costo de proveedor",
  "changedBy": "...",
  "appliedAt": "..."
}
```

### `GET /api/products/:id/price-history`

Retorna historial de precio del producto dentro del tenant autenticado, ordenado por `valid_from DESC, created_at DESC`.

## Reglas implementadas

- `newPrice` debe ser numerico y `>= 0`.
- `reason` es obligatorio y debe tener minimo 5 caracteres despues de `trim`.
- El producto se busca por `id` y `tenant_id`.
- El cambio corre en transaccion.
- El producto se bloquea con `FOR UPDATE`.
- Se cierra el historial aplicado vigente con `valid_to`.
- Se inserta historial nuevo con `status = 'APPLIED'`.
- Se actualiza solo `products.price`.
- `price_with_tax` y `price_without_tax` no se recalculan en esta fase para no inventar regla fiscal nueva.
- `changed_by` se toma del usuario autenticado.
- No se recalculan `sale_items`.
- No se recalculan `order_items`.
- No se modifica `inventory_create_sale_v2`.

## Pruebas ejecutadas

```bash
cd api && npx.cmd tsx --test src/modules/inventory/services/product.service.spec.ts
```

Resultado: 13 tests pasan.

```bash
cd api && npm.cmd run build
```

Resultado: build pasa.

```bash
openspec.cmd validate fortalecer-productos-inventario --type change --strict --json
```

Resultado: pasa con `valid = true`.

```bash
git diff --check
```

Resultado: pasa. Solo se observaron warnings CRLF de Git en archivos existentes/modificados.

## Confirmacion de compatibilidad

- No se modifico POS.
- No se modifico Orders.
- No se modifico `sale_items`.
- No se modifico `order_items`.
- No se modifico `inventory_create_sale_v2`.
- No se modifico frontend.
- No se modifico `backend-reporteria`.
- No se modificaron migraciones ni SQL de venta.
- `GET /api/products` conserva el flujo existente porque `listProducts` no cambio contrato.

## Riesgos vivos

- `price_with_tax` y `price_without_tax` quedan con la regla actual del sistema; Fase 6.2 debe definir calculo central en `PricingService`.
- Si un ambiente no aplico `20260601_inventory_products_lots_phase_1.sql`, los endpoints fallaran por falta de `product_price_history`.
- El endpoint `PUT /api/products/:id` todavia permite actualizar `price` directamente; una fase posterior deberia restringir o redirigir cambios de precio al flujo auditado.
- No hay frontend para capturar motivo todavia.
- No hay reporte dedicado de historial en `backend-reporteria` todavia.

## Proximos pasos

- Fase 6.2: disenar/implementar `PricingService` base sin promociones.
- Fase 6.3: promociones simples por producto/sucursal.
- Fase futura: cerrar o proteger cambio directo de `price` por `PUT /api/products/:id`.
- Fase futura: agregar UI para cambio de precio con motivo e historial.
