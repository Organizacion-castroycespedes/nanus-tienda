# Estados y límites transaccionales — B5.3.1

## Estados

| Dominio | Estados observados | Transiciones verificadas |
|---|---|---|
| Compra | `DRAFT`, `PENDING`, `PARTIAL`, `RECEIVED`, `CANCELLED` | creación, edición DRAFT/PENDING, recepción parcial o completa, cancelación y liquidación parcial |
| Pago de compra | `PENDING`, `PARTIAL`, `PAID`, `OVERPAID` | calculado desde pagos relacionados |
| Pedido | `DRAFT`, `CONFIRMED`, `PARTIAL`, `COMPLETED`, `CANCELLED` | edición DRAFT, confirmación, entrega parcial/completa, cancelación |
| Pago de pedido | `PENDING`, `PARTIAL`, `PAID`, `OVERPAID` | derivado de pagos y total |
| Facturación de pedido | `UNBILLED`, `PARTIAL`, `INVOICED` | recalculado desde venta/documento |
| Venta operativa fiscal | `PENDING`, `PROCESSING`, `ACCEPTED`, `REJECTED`, `TECHNICAL_ERROR`, `MANUAL_REVIEW`, `CANCELLED`, `AMBIGUOUS` | consulta, refresh, retry y recovery según servicio fiscal |

## Operaciones con transacción explícita

| Operación | `PoolClient` | BEGIN/COMMIT/ROLLBACK | Bloqueo | Garantía demostrada |
|---|---|---|---|---|
| Crear compra | Sí | Sí | validaciones de contexto | atomicidad de esa operación de servicio |
| Actualizar compra | Sí | Sí | compra consultada dentro de transacción | rollback ante error |
| Recibir compra | Sí | Sí | `purchases ... FOR UPDATE` | serialización de la fila de compra |
| Liquidar compra parcial | Sí | Sí | `purchases ... FOR UPDATE` | rollback de la operación |
| Cancelar compra | Sí | Sí | `purchases ... FOR UPDATE` | rollback y trazabilidad |
| Crear pedido | Sí | Sí | validaciones y fila de pedido | atomicidad de esa operación de servicio |
| Actualizar pedido | Sí | Sí | fila de pedido | rollback ante error |
| Entregar pedido | Sí | Sí | fila y líneas según ruta | atomicidad de la ruta observada |
| Confirmar pedido | No observado | No; usa `UPDATE ... WHERE status = 'DRAFT'` | condición de estado en SQL | actualización condicional; no se certifica una transacción multioperación |
| Cancelar pedido | No observado | No; usa `UPDATE ... WHERE status = 'DRAFT'` | condición de estado en SQL | actualización condicional; no se certifica una transacción multioperación |
| Facturar pedido | Delegado a `SaleService.createSaleFromOrderDelivery` | Depende de la transacción de venta derivada | validaciones de pedido antes de delegar | frontera fiscal/comercial propia de la venta derivada |
| Ventas operativas | No observado como creador | No observado en módulo | consultas de repositorio | lectura y acciones fiscales delegadas |

Fuentes: `api/src/modules/inventory/services/purchase.service.ts` y
`order.service.ts`. Los números de línea exactos pueden variar si cambia el
archivo; las búsquedas auditadas encontraron `BEGIN`, `COMMIT`, `ROLLBACK`,
`PoolClient` y `FOR UPDATE` en los rangos documentados en la ficha B5.3.1.

## Tablas y SQL relacionado

- `purchases`, `purchase_items`
- `orders`, `order_items`, `order_item_taxes`
- `sales`, `sale_items`, `sale_item_taxes`
- `payments`
- `stock_movements`, `stock_movement_lots`
- `inventory_lots`, `inventory_lot_balances`, `inventory_locations`
- `cash_sessions`, `cash_registers`
- `deliveries`
- `electronic_documents`

Fuentes DDL y funciones:

- `scripts/database/migrations/20260527_purchase_partial_liquidation.sql`
- `scripts/database/migrations/20260527_purchase_cancellation_traceability.sql`
- `scripts/database/migrations/V059__purchase_status_constraint_partial_liquidation_drift_fix.sql`
- `scripts/database/migrations/V063__deliveries_base.sql`
- `scripts/database/migrations/V069__orders_purchases_current_cash_scope.sql`
- `scripts/database/migrations/20260607_orders_pricing_snapshot_phase_6_7_1.sql`
- `scripts/database/migrations/V078__sale_item_taxes_multi_tax_snapshot.sql`
- `scripts/database/migrations/20260507_reporting_phase5_business_reports.sql`

Este inventario usa DDL versionado. No certifica que QA y producción tengan el
mismo esquema ni que todas las migraciones estén aplicadas.
