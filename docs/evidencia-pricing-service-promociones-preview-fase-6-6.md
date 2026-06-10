# Evidencia PricingService promociones preview - Fase 6.6

## Resumen

FASE 6.6 APROBADA.

`POST /api/pricing/preview-line` ahora calcula promociones activas aplicables al producto, sucursal, tenant y fecha. El calculo sigue siendo solo preview: no persiste datos y no afecta ventas ni pedidos.

## Archivos modificados

- `api/src/modules/pricing/pricing.types.ts`
- `api/src/modules/pricing/pricing.repository.ts`
- `api/src/modules/pricing/pricing.service.ts`
- `api/src/modules/pricing/pricing.service.spec.ts`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-pricing-service-promociones-preview-fase-6-6.md`

## Reglas implementadas

`PricingService.calculateLinePrice` ahora:

- valida `tenantId`, `branchId`, `productId`, `quantity`, `channel` y `date`.
- lee producto por `tenantId + productId`.
- mantiene `products.price` como precio visible con impuesto incluido.
- consulta promociones activas aplicables.
- calcula descuento unitario y precio final unitario.
- recalcula impuesto sobre `finalUnitPrice`.
- no escribe en DB.
- no modifica productos, promociones, ventas ni pedidos.

Promocion aplicable:

- `promotions.tenant_id` coincide.
- `promotions.is_active = true`.
- `starts_at <= date`.
- `ends_at >= date`.
- `promotion_products` contiene `productId`.
- `promotion_branches` esta vacio o contiene `branchId`.

## Tipos de descuento

`PERCENTAGE`:

- `discountAmount = baseUnitPrice * percentage / 100`.
- `finalUnitPrice = baseUnitPrice - discountAmount`.

`FIXED_AMOUNT`:

- `discountAmount = fixed amount`.
- Si el monto supera el precio base, se limita a `baseUnitPrice`.
- Esto evita precio final negativo en preview.

`SPECIAL_PRICE`:

- `finalUnitPrice = special price`.
- `discountAmount = baseUnitPrice - special price`.
- Si `special price >= baseUnitPrice`, no se aplica porque no beneficia al cliente.

Reglas de seguridad:

- `finalUnitPrice` nunca baja de `0`.
- `discountAmount` nunca baja de `0`.
- `discountAmount` nunca supera `baseUnitPrice`.
- Promociones con descuento efectivo `0` no se aplican.

## Prioridad

Las promociones no son acumulables en esta fase.

Criterio de seleccion:

1. menor `priority`.
2. si empata, mayor `discountAmount`.
3. si empata, `createdAt` mas reciente.
4. si empata, `id` ascendente como criterio estable.

## Impuestos

Regla conservada:

- `products.price` es precio visible con impuesto incluido.
- `finalUnitPrice` tambien se trata como precio visible con impuesto incluido.
- `taxBase` y `taxAmount` se recalculan sobre `finalUnitPrice`.
- redondeo a 2 decimales.

Ejemplo cubierto en test:

- precio base `119`
- impuesto `0.19`
- precio especial `59.5`
- cantidad `2`
- `lineTotal = 119`
- `taxBase = 100`
- `taxAmount = 19`

## Tests ejecutados

Comando:

```powershell
cd api
npx.cmd tsx --test src/modules/pricing/*.spec.ts
```

Resultado:

- suites: 4
- tests: 32
- pass: 32
- fail: 0

Casos cubiertos:

- sin promociones mantiene comportamiento base.
- promocion `PERCENTAGE` activa.
- promocion `FIXED_AMOUNT` activa.
- promocion `SPECIAL_PRICE` activa.
- `SPECIAL_PRICE` no beneficiosa no aplica.
- vencida, inactiva, otro producto u otra sucursal no aplican cuando el repositorio no las retorna.
- promocion sin sucursal aplica a todo el tenant.
- multiples promociones: gana menor prioridad.
- empate de prioridad: gana mayor descuento.
- empate de prioridad y descuento: gana mas reciente.
- no permite precio final negativo.
- recalcula impuestos sobre precio final.
- no persiste datos.

Build:

```powershell
cd api
npm.cmd run build
```

Resultado: OK.

## Confirmacion de no alcance

No se modifico:

- POS.
- Orders.
- `inventory_create_sale_v2`.
- `SaleService`.
- `OrderService`.
- `web/`.
- `backend-reporteria/`.
- SQL o migraciones.
- PRD real.

`preview-line` solo calcula y retorna respuesta. No crea `sale_items`, `order_items` ni tablas de aplicacion de promociones.

## Riesgos vivos

- Falta persistir promocion aplicada cuando una venta o pedido se confirme en una fase futura.
- Falta decidir si el descuento guardado en ventas sera unitario o total por linea.
- Falta definir reglas de acumulacion si negocio aprueba promociones stackables.
- Falta validar API real local de `preview-line` con promociones fixture despues de esta fase.

## Proximos pasos

- Crear prueba API local real de `preview-line` con promociones activas.
- Disenar persistencia futura de descuento y promocion aplicada en ventas/pedidos.
- Integrar gradualmente POS y Orders usando `PricingService`, con feature flag o fase controlada.
