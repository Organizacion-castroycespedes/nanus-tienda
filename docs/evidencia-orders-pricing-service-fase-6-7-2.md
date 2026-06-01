# Evidencia Orders PricingService Fase 6.7.2

## Alcance

Se integro `PricingService` en `OrderService` para calcular lineas al crear pedidos y al actualizar pedidos `DRAFT` cuando llegan `items`.

No se modifico facturacion de pedidos ni ventas.

## Archivos

- `api/src/modules/inventory/inventory.module.ts`
- `api/src/modules/inventory/services/order.service.ts`
- `api/src/modules/inventory/services/order.service.spec.ts`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`

## Integracion

- `InventoryModule` importa `PricingModule`.
- `OrderService` inyecta `PricingService`.
- `createOrder` resuelve `branchId`, valida sucursal y calcula cada linea con `channel: "ORDER"`.
- `updateOrder` mantiene la regla de solo actualizar pedidos `DRAFT`.
- `updateOrder` recalcula solo cuando llegan `items`.

## Compatibilidad

El frontend puede seguir enviando `price`, `subtotal` y `total`.

Cuando el backend calcula items:

- `price` enviado por el cliente se ignora.
- `subtotal` enviado por el cliente se ignora.
- `total` enviado por el cliente se ignora.
- `order_items.price` queda como `finalUnitPrice`.
- `order_items.subtotal` queda como `lineTotal`.
- `orders.total` queda como suma de `lineTotal`.

## Snapshot persistido

Cada item calculado persiste:

- `base_unit_price`
- `final_unit_price`
- `discount_amount`
- `discount_percent`
- `discount_total`
- `applied_promotion_id`
- `applied_promotion_name`
- `tax_id`
- `tax_rate`
- `tax_base`
- `tax_amount`
- `line_total`
- `pricing_snapshot`
- `pricing_calculated_at`

## BranchId

En creacion, `branchId` se resuelve desde el alcance de permisos y luego desde `context.branchId`.

Si no hay `branchId`, la creacion responde error controlado antes de abrir transaccion o insertar datos.

En actualizacion, se usa `data.branchId` o el `branchId` guardado en auditoria del pedido.

## Riesgo documentado

Si en `updateOrder` cambia `branchId` o `customerId` sin enviar `items`, esta fase no recalcula snapshots existentes por alcance explicito. Ese caso queda para validacion funcional en Fase 6.7.3 o una fase posterior.

## Validaciones

- `cd api && npx.cmd tsx --test src/modules/inventory/services/order.service.spec.ts`: passed.
- `cd api && npx.cmd tsx --test src/modules/pricing/*.spec.ts`: passed.
- `cd api && npm.cmd run build`: passed.
- `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json`: passed.
- `git diff --check`: passed.

## No tocado

- `SaleService`
- `invoiceOrder`
- POS
- Frontend
- Facturacion electronica
- DIAN
- GetAcquirer
- Suppliers fiscales
- PRD real
- Comandos remotos
- Commits
