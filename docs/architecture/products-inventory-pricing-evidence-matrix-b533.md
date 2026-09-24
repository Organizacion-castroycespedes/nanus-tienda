# Matriz de evidencias — B5.3.3

| Tema | Evidencia | Qué demuestra | Clasificación |
|---|---|---|---|
| Producto | `api/src/modules/inventory/services/product.service.ts` | validaciones, impuestos, precios e historial | confirmado |
| Producto API | `api/src/modules/inventory/controllers/product.controller.ts` | rutas de catálogo y precio | confirmado |
| Inventario | `api/src/modules/inventory/services/inventory-lot-balance.service.ts` | saldos, reservas y cantidades | confirmado |
| Movimientos | `api/src/modules/inventory/services/stock-movement.service.ts` | persistencia de movimientos | confirmado |
| FEFO | `api/src/modules/inventory/services/inventory-fefo.service.ts` | filtro y orden FEFO | confirmado |
| FEFO pruebas | `api/src/modules/inventory/services/inventory-fefo.service.spec.ts` | selección, vencidos y estados excluidos | histórico |
| Pricing | `api/src/modules/pricing/pricing.service.ts` | canales, redondeo y desglose fiscal | confirmado |
| Pricing SQL | `api/src/modules/pricing/pricing.repository.ts` | snapshots de producto, impuestos y promociones | confirmado |
| Promociones | `api/src/modules/pricing/promotions.service.ts` | validación y transacción administrativa | confirmado |
| Promociones SQL | `scripts/database/migrations/20260605_pricing_promotions_phase_1.sql` | tablas, constraints e índices | DDL versionado |
| Multiimpuesto | `scripts/database/migrations/V078__sale_item_taxes_multi_tax_snapshot.sql` | snapshots y función de venta | DDL versionado |
| Idempotencia POS | `scripts/database/migrations/V086__sale_creation_idempotency.sql` | clave por tenant para venta | DDL versionado |
| Compra/venta | `purchase.service.ts`, `sale.service.ts` | transacciones y movimientos por rutas | confirmado por código |
| Web | `web/modules/inventory/services/`, `web/modules/pricing/` | consumidores frontend existentes | confirmado |
| QA actual | pruebas versionadas | no ejecutadas en esta fase | histórico |

## OpenSpec y pendientes

Las especificaciones sobre FEFO, pricing, promociones, impuestos, POS,
compras y pedidos se consideran diseño o tarea hasta encontrar evidencia de
código. Quedan pendientes E2E, concurrencia en QA, esquema instalado por
ambiente, DIAN, hardware, SBOM, licencias externas y revisión jurídica.
