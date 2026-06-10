# Diagnostico tecnico: productos e inventario

## Resumen ejecutivo

MANUS-TIENDA ya tiene un modulo operativo de productos, compras, pedidos, ventas POS, caja y reporteria. No es una base vacia. La arquitectura real observada es:

| Capa | Responsabilidad actual |
| --- | --- |
| `api/` | Logica transaccional: productos, compras, pedidos, ventas, movimientos de stock, caja, pagos, tenants, sucursales, permisos. |
| `backend-reporteria/` | Consultas consolidadas por funciones SQL, reportes JSON, tickets PDF y reportes PDF. |
| `web/` | Frontend Next.js 14 con rutas operativas, POS, inventario, compras, caja y reporteria. |
| `scripts/` | SQL manual versionado por dominios: base, productos, ventas, finanzas, reporteria y migraciones acumuladas. |

El inventario actual se calcula desde `stock_movements`. No existe una tabla de saldo fisico directa por producto, lote o ubicacion. La entrada de inventario ocurre al recibir compras. La salida ocurre por ventas POS, entregas de pedidos y ajustes manuales `OUT`. Este modelo sirve para stock basico, pero no soporta vencimientos, lotes, FEFO, ubicacion fisica, rotacion formal ni historial de precios.

RIESGO: La venta POS usa funciones SQL (`inventory_create_sale`, `inventory_invoice_order`) para insertar venta, items y movimientos. Cualquier evolucion de lotes/FEFO debe adaptar esas funciones con extrema compatibilidad.

RIESGO: `StockAdjustmentController` recibe `reason`, pero el motivo no queda persistido en una tabla propia de ajustes. El ajuste se representa como `stock_movements` con `reference_type = 'ADJUSTMENT'` y `reference_id` aleatorio.

SUPUESTO: La decision objetivo debe mantener `api/` como dueno transaccional y `backend-reporteria/` como consumidor de consultas consolidadas, PDFs y exportables.

## Estructura revisada

| Area | Estado observado |
| --- | --- |
| `api/` | NestJS 10. Modulos en `src/modules`. Inventario vive principalmente en `src/modules/inventory`. Finanzas/caja vive en `src/modules/finance`. |
| `backend-reporteria/` | NestJS separado. Usa `FunctionRunnerService` para llamar funciones PostgreSQL y `PdfmakeEngine` para PDFs. |
| `web/` | Next.js 14, React 18, Redux Toolkit, Tailwind. No es Vite en el codigo actual. |
| `docs/` | Ya documenta modulos, arquitectura, flujos de inventario, ventas, compras, POS, RBAC y base de datos. |
| `scripts/` | Contiene SQL por dominios: `products`, `sale`, `finance`, `migrations`, seeds y scripts de migracion. |
| `README.md` | Describe estado general, pero tiene partes desactualizadas: reportes y caja aparecen como incompletos aunque ya hay `backend-reporteria/` y modulos `finance`. |
| `AGENTS.md` | Tiene reglas utiles, pero mezcla rutas antiguas `apps/*` con rutas reales `api/`, `web/`, `backend-reporteria/`. Tambien contiene diagnosticos de seguridad antiguos que no coinciden del todo con el `JwtAuthGuard` actual. |
| `openspec/` | Existia con `changes/`, `changes/archive/` y `specs/`, pero sin specs activas detectadas antes de esta fase. |

## Estado actual del modulo productos

### Backend `api/`

Archivos principales:

| Tipo | Archivo |
| --- | --- |
| Controller | `api/src/modules/inventory/controllers/product.controller.ts` |
| Service | `api/src/modules/inventory/services/product.service.ts` |
| Repository | `api/src/modules/inventory/repositories/product.repository.ts` |
| Entity | `api/src/modules/inventory/entities/product.entity.ts` |
| SQL | `scripts/database/products/2026_04_25_inventory_products.sql` |

Campos actuales inferidos desde SQL y entidad:

| Campo | Estado |
| --- | --- |
| `id` | UUID primario. |
| `tenant_id` | Obligatorio. |
| `unit_id` | Obligatorio, referencia `units`. |
| `tax_id` | Opcional, referencia `taxes`. |
| `name` | Obligatorio. |
| `description` | Opcional. |
| `sku` | Obligatorio, unico por `tenant_id`. |
| `price` | Obligatorio, no negativo en service/entity. |
| `cost` | Obligatorio, no negativo. |
| `price_with_tax` | Obligatorio. Actualmente se deriva por default desde `price`. |
| `price_without_tax` | Obligatorio. Actualmente se deriva por default desde `price`. |
| `is_active` | Booleano para baja logica. |
| `created_at`, `updated_at` | Timestamps. |

Endpoints actuales:

| Endpoint | Uso |
| --- | --- |
| `POST /api/products` | Crea producto. |
| `GET /api/products` | Lista productos con stock por sucursal obligatoria. |
| `GET /api/products/:id` | Obtiene producto. |
| `PUT /api/products/:id` | Actualiza producto. |
| `DELETE /api/products/:id` | Baja logica: `is_active = false`. |
| `GET /api/inventory/products` | Lista consolidada producto + tenant + sucursal + stock. |

Validaciones actuales:

| Validacion | Estado |
| --- | --- |
| Nombre requerido | En `ProductService` y `ProductEntity`. |
| SKU requerido y normalizado | Se hace `trim().toUpperCase()`. |
| SKU unico por tenant | `ProductService` consulta `findBySku`; SQL tiene `ux_products_tenant_id_sku`. |
| Precio/costo no negativos | En service/entity. Frontend exige precio mayor a 0. |
| UUIDs | En `ProductEntity`. |
| DTO con `class-validator` | No hay DTO dedicado para producto. |
| `ValidationPipe` global | No se observo en `api/src/main.ts`. |

Brechas del producto:

| Capacidad | Estado |
| --- | --- |
| Producto perecedero/no perecedero | No existe. |
| Lote obligatorio | No existe. |
| Vencimiento obligatorio | No existe. |
| Codigo de barras | No existe campo diferenciado. `sku` podria usarse, pero no equivale a barcode. |
| Estado operativo detallado | Solo `is_active`. |
| Clasificacion operativa | No existe. |
| Imagen/categoria/marca | No observado en producto actual. |
| Historial de precios | No existe. |

## Estado actual del inventario

El inventario actual es un ledger de movimientos. No hay tabla de existencias por lote, ubicacion o vencimiento.

Archivos principales:

| Tipo | Archivo |
| --- | --- |
| Controller | `api/src/modules/inventory/controllers/inventory.controller.ts` |
| Service | `api/src/modules/inventory/services/inventory.service.ts` |
| Repository | `api/src/modules/inventory/repositories/inventory.repository.ts` |
| Movimiento | `api/src/modules/inventory/services/stock-movement.service.ts` |
| Entity movimiento | `api/src/modules/inventory/entities/stock-movement.entity.ts` |
| Dashboard SQL | `scripts/database/products/2026_05_01_inventory_dashboard.sql` |
| Contexto stock SQL | `scripts/database/products/2026_04_28_inventory_stock_movements_pos_context.sql` |

Tabla `stock_movements` actual:

| Campo | Estado |
| --- | --- |
| `id` | UUID primario. |
| `tenant_id` | Obligatorio. |
| `product_id` | Obligatorio. |
| `type` | `IN` o `OUT`. |
| `quantity` | Positiva. |
| `reference_type` | `PURCHASE`, `SALE`, `ADJUSTMENT`. |
| `reference_id` | UUID. |
| `branch_id` | Agregado luego, opcional en tabla, usado para stock por sucursal. |
| `terminal_id` | Opcional. |
| `pos_session_code` | Texto. Guarda id de sesion POS como texto. |
| `user_id` | Opcional. |
| `reference_table` | Texto: `purchases`, `sales`, `orders`, `stock_adjustments`. |
| `stock_before`, `stock_after` | Calculados al crear movimientos desde servicio. |
| `created_at` | Timestamp. |

Reglas actuales:

| Regla | Estado |
| --- | --- |
| Stock por producto/sucursal | Se calcula con `SUM(IN) - SUM(OUT)` filtrando `tenant_id`, `product_id`, `branch_id`. |
| No stock negativo por servicio | `StockMovementService.createMovement` bloquea `OUT` si `stockAfter < 0`. |
| No stock negativo por funcion SQL de venta | `inventory_create_sale` valida stock disponible y lanza `insufficient stock for product %`. |
| Auditoria | `StockMovementService.logMovementAuditEvent` crea evento con stock antes/despues cuando aplica. |
| Ajustes manuales | `POST /api/stock-adjustments`, solo `SUPER_ADMIN` y `SUPER_USER`. |

Dashboard actual:

| Indicador | Fuente |
| --- | --- |
| `stockTotal` | Suma de stock calculado por producto/sucursal. |
| `productsLow` | Stock positivo menor o igual a salidas del periodo. |
| `productsOut` | Stock menor o igual a 0. |
| `pendingPurchases` | Compras `DRAFT`, `PENDING`, `PARTIAL`. |
| `pendingOrders` | Pedidos `DRAFT`, `CONFIRMED`, `PARTIAL`. |
| `salesDay` | Ventas del dia final. |
| `recentMovements` | Movimientos del periodo. |
| `criticalProducts` | Productos sin stock o con stock bajo segun salida del periodo. |

Brechas de inventario:

| Capacidad | Estado |
| --- | --- |
| Existencias por lote | No existe. |
| Vencimiento por lote | No existe. |
| Ubicacion fisica | No existe. |
| FEFO | No existe. |
| Reserva de stock | No observada. |
| Rotacion formal | No existe clasificacion persistida. Solo indicadores simples por salidas del periodo. |
| Alertas operativas configurables | No existe entidad ni regla dedicada. Hay badges de stock bajo en frontend. |
| Ajuste con motivo persistente | Motivo llega desde web, pero no queda persistido de forma estructurada. |

## Estado actual de compras

Archivos principales:

| Tipo | Archivo |
| --- | --- |
| Controller | `api/src/modules/inventory/controllers/purchase.controller.ts` |
| Service | `api/src/modules/inventory/services/purchase.service.ts` |
| Entity | `api/src/modules/inventory/entities/purchase.entity.ts` |
| Item entity | `api/src/modules/inventory/entities/purchase-item.entity.ts` |
| SQL base | `scripts/database/products/2026_04_25_inventory_purchases.sql` |
| SQL items | `scripts/database/products/2026_04_25_inventory_purchase_items.sql` |
| SQL recepcion parcial | `scripts/database/products/2026_04_26_inventory_purchase_items_partial_reception.sql` |
| SQL tipo/saldo | `scripts/database/products/2026_04_26_inventory_purchases_type_balance.sql` |
| SQL liquidacion parcial | `scripts/database/migrations/20260527_purchase_partial_liquidation.sql` |
| SQL cancelacion | `scripts/database/migrations/20260527_purchase_cancellation_traceability.sql` |

Estados actuales de compra:

| Estado | Significado observado |
| --- | --- |
| `DRAFT` | Compra creada, editable. |
| `PENDING` | Compra pendiente sin recepcion. |
| `PARTIAL` | Recepcion parcial. |
| `RECEIVED` | Recepcion completa. |
| `CERRADA_PARCIAL` | Compra parcial liquidada con cantidad recibida real. |
| `CANCELLED` | Compra cancelada. |

Reglas actuales de compras:

| Flujo | Regla |
| --- | --- |
| Crear | Requiere proveedor, sucursal, total e items. Queda `DRAFT`. No mueve inventario. |
| Actualizar | No permite actualizar `RECEIVED`, `CANCELLED` o `CERRADA_PARCIAL`. |
| Recibir | Requiere items con cantidad positiva. Crea movimientos `IN` por producto y actualiza `received_quantity`. |
| Recibir parcial | Si no todo fue recibido, estado queda `PARTIAL`. |
| Recibir completa | Si todo fue recibido, estado queda `RECEIVED`. |
| Liquidar parcial | Requiere motivo obligatorio y estado `PARTIAL`. Ajusta totales a valor recibido. |
| Cancelar | Requiere motivo obligatorio. Solo permite `DRAFT` o `PENDING`, sin pagos ni movimientos ni recepcion. |
| Pagos | Integrado con `payments` y `payment_allocations`. |

Brechas en compras:

| Capacidad | Estado |
| --- | --- |
| Capturar lote al recibir | No existe. |
| Capturar vencimiento al recibir | No existe. |
| Capturar ubicacion al recibir | No existe. |
| FEFO desde compras | No aplica aun. |
| Costo por lote | Solo costo por item de compra. |
| Trazabilidad lote-producto-proveedor | No existe. |

## Estado actual de ventas POS

Archivos principales:

| Tipo | Archivo |
| --- | --- |
| Controller | `api/src/modules/inventory/controllers/sale.controller.ts` |
| Service | `api/src/modules/inventory/services/sale.service.ts` |
| Repository | `api/src/modules/inventory/repositories/sale.repository.ts` |
| Entity | `api/src/modules/inventory/entities/sale.entity.ts` |
| Item entity | `api/src/modules/inventory/entities/sale-item.entity.ts` |
| Funcion SQL venta | `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql` |
| Funcion SQL acumulada | `scripts/database/migrations/V047__sync_dev_functions_to_prd.sql` |
| Front POS | `web/modules/pos/components/PosScreen.tsx` |

Endpoints actuales:

| Endpoint | Uso |
| --- | --- |
| `POST /api/sales` | Crea venta POS. |
| `GET /api/sales` | Lista ventas. |
| `GET /api/sales/:id` | Detalle venta. |
| `POST /api/sales/:id/cancel` | Cancela/refunda venta y revierte stock/pagos. |

Reglas actuales de ventas:

| Flujo | Regla |
| --- | --- |
| POS activo | `SaleService` exige contexto POS con tenant, usuario, sucursal, terminal y `posSessionId`. |
| Funcion SQL | `SaleRepository.createSaleWithFunction` llama `inventory_create_sale`. |
| Stock | La funcion calcula disponibilidad por `stock_movements` y bloquea insuficiencia. |
| Salida | La venta inserta movimientos `OUT` con `reference_type = 'SALE'`, `reference_table = 'sales'`. |
| Pagos | El service crea pagos con `PaymentsService.createInTransaction`. |
| Cancelacion | Crea movimientos `IN` para revertir stock y maneja reembolsos/pagos. |
| Front POS | Bloquea agregar producto si `stock <= 0` y evita superar stock del producto en carrito. |

Brechas en ventas POS:

| Capacidad | Estado |
| --- | --- |
| Seleccion automatica FEFO | No existe. |
| Descontar por lote | No existe. |
| Mostrar vencimiento/lote al cajero | No existe. |
| Bloquear lote vencido | No existe. |
| Vender por codigo de barras separado de SKU | No existe. |
| Mantener compatibilidad de ventas historicas con precio | El item guarda precio unitario en `sale_items`; esto ayuda. |

## Estado actual de pedidos

Pedidos funcionan como flujo relacionado de inventario.

| Archivo | Uso |
| --- | --- |
| `api/src/modules/inventory/controllers/order.controller.ts` | Endpoints de pedidos. |
| `api/src/modules/inventory/services/order.service.ts` | Crear, confirmar, entregar, facturar, cancelar. |
| `scripts/database/products/2026_04_26_inventory_orders.sql` | Tabla `orders`. |
| `scripts/database/products/2026_04_26_inventory_order_items.sql` | Tabla `order_items`. |

Reglas relevantes:

| Flujo | Regla |
| --- | --- |
| Entrega | `deliverOrder` crea movimientos `OUT` con `reference_type = 'SALE'` y `reference_table = 'orders'`. |
| Stock | Verifica stock antes de entregar. |
| Facturacion | `invoiceOrder` crea venta desde pedido entregado usando `SaleService.createSaleFromOrderDelivery`. |

RIESGO: Al estar ligado a ventas y stock, FEFO/lotes tambien debe cubrir entregas de pedidos, no solo ventas POS directas.

## Estado actual de caja y pagos

Archivos principales:

| Area | Archivos |
| --- | --- |
| Caja | `api/src/modules/finance/cash-registers`, `cash-sessions`, `cash-movements` |
| Pagos | `api/src/modules/finance/payments`, `payment-methods` |
| SQL finance | `scripts/database/finance/migrations/*` |
| Front finance | `web/modules/finance/*` |

Responsabilidad actual:

| Capacidad | Estado |
| --- | --- |
| Metodos de pago | `payment_methods`. |
| Pagos y asignaciones | `payments`, `payment_allocations`. |
| Sesiones de caja | `cash_sessions`. |
| Movimientos de caja | `cash_movements`. |
| POS | Requiere caja activa para efectivo en frontend. |
| Compras | Usa `DocumentPaymentForm` con direction `OUT`. |

RIESGO: Alertas o reportes de inventario no deben mezclar responsabilidad de caja. Caja debe seguir registrando dinero, no decidir lotes ni vencimientos.

## Estado actual de reportes relacionados

`backend-reporteria/` ya tiene patrones claros:

| Reporte | Controller | Service | Adapter | Funcion SQL |
| --- | --- | --- | --- | --- |
| Ventas POS | `sales-reports.controller.ts` | `sales-reports.service.ts` | `sales-report.adapter.ts` | `report_pos_sales`, `report_pos_sale_ticket`, `report_pos_sale_cancel_ticket` |
| Compras | `purchases-reports.controller.ts` | `purchases-reports.service.ts` | `purchases-report.adapter.ts` | `report_purchases`, `report_purchase_ticket` |
| Caja | `cash-reports.controller.ts` | `cash-reports.service.ts` | `cash-report.adapter.ts` | `report_cash_closings`, `report_cash_closing_ticket`, `report_cash_audit`, `report_cash_audit_ticket` |
| Pedidos | `orders-reports.controller.ts` | `orders-reports.service.ts` | `orders-report.adapter.ts` | `report_order_sales`, tickets de pedido |
| Clientes | `customers-reports.controller.ts` | `customers-reports.service.ts` | `customers-report.adapter.ts` | `report_customer_orders_status` |

Patron PDF:

| Pieza | Uso |
| --- | --- |
| `FunctionRunnerService` | Ejecuta funciones PostgreSQL seguras por nombre. |
| `PdfmakeEngine` | Genera Buffer PDF con pdfmake. |
| `templates/reports/*` | Reportes A4. |
| `templates/tickets/*` | Tickets termicos. |
| `templates/base/report-layout.ts` | Layout base de reporte. |
| `templates/base/thermal-layout.ts` | Layout base termico. |

Brechas de reporteria:

| Reporte objetivo | Estado |
| --- | --- |
| Productos proximos a vencer | No existe. |
| Productos vencidos | No existe. |
| Baja rotacion | No existe. |
| Inventario valorizado | No existe. |
| Historial de precios | No existe. |
| Exportables inventario futuro | No existe. |

SUPUESTO: Los reportes nuevos deben vivir en `backend-reporteria/` y consumir funciones SQL o consultas consolidadas. No deben duplicar logica transaccional de `api/`.

## Responsabilidades actuales de `api/`

`api/` hoy hace:

| Responsabilidad | Estado |
| --- | --- |
| Autenticacion y sesiones | JWT, refresh tokens, `auth_sessions`. |
| RBAC | Roles, permisos de menu y guards. |
| Tenants y sucursales | `tenants`, `tenant_branches`, asignacion de persona a sucursal. |
| POS | Sesion POS por usuario/terminal/sucursal. |
| Producto | CRUD basico, unidad, impuesto, SKU, precio/costo. |
| Inventario | Ledger de movimientos y dashboard. |
| Compras | Compra, recepcion, cancelacion, liquidacion parcial. |
| Pedidos | Pedido, entrega, facturacion. |
| Ventas | POS, items, impuestos, pagos y cancelacion. |
| Caja/pagos | Metodos, pagos, sesiones y movimientos de caja. |

Debe seguir siendo dueno de:

- Reglas de stock.
- Reglas de lote/vencimiento/FEFO futuras.
- Validacion transaccional de compras, ventas, pedidos, ajustes.
- Auditoria transaccional.
- Compatibilidad multi-tenant y sucursal.

## Responsabilidades actuales de `backend-reporteria/`

`backend-reporteria/` hoy hace:

| Responsabilidad | Estado |
| --- | --- |
| Autorizacion de reportes | `JwtAuthGuard` y `ReportAuthzGuard`. |
| Consulta consolidada | Adaptadores llaman funciones SQL. |
| Normalizacion de dataset | Services convierten numeros y fechas. |
| PDF | `PdfmakeEngine` y templates. |
| Tickets | Ventas, compras, caja, cancelaciones. |
| Reportes A4 | Ventas, compras, caja, pedidos/clientes. |

Debe seguir limitado a:

- Reportes.
- Tickets.
- PDFs.
- Exportables.
- Consultas consolidadas.

No debe:

- Mover stock.
- Decidir FEFO.
- Cambiar precios.
- Crear compras o ventas.
- Modificar caja.

## Responsabilidades actuales de `web/`

Rutas relevantes:

| Ruta | Uso |
| --- | --- |
| `/{tenant}/inventory` | Dashboard contextual de inventario. |
| `/{tenant}/inventory/products` | Productos y ajustes de stock. |
| `/{tenant}/inventory/purchases` | Reexporta `/{tenant}/purchases`. |
| `/{tenant}/purchases` | Compras, recepcion, pagos, cancelacion, ticket. |
| `/{tenant}/orders` | Pedidos. |
| `/{tenant}/pos` | POS operativo. |
| `/{tenant}/pos/select-context` | Seleccion de contexto POS. |
| `/{tenant}/finance/*` | Caja, sesiones, movimientos, metodos de pago. |
| `/{tenant}/reporteria/*` | Reportes POS, compras, caja, pedidos, clientes. |
| `/{tenant}/inventory/units` | Unidades. |
| `/{tenant}/inventory/taxes` | Impuestos. |
| `/{tenant}/inventory/suppliers` | Proveedores. |

Componentes reutilizables:

| Tipo | Componentes |
| --- | --- |
| Base UI | `Button`, `Input`, `Select`, `Textarea`, `Modal`, `Tabs`, `Toast`, `NoticeDialog`, `DataTable`, `DateRangePicker`, `SearchFilters`. |
| Inventario | `ProductForm`, `StockAdjustmentForm`, `InventoryDashboard`, `PurchaseForm`, `PurchaseReceiveForm`, `PurchaseDetailPanel`, `SettlePartialPurchaseForm`, `CancelPurchaseForm`. |
| POS | `PosScreen`, `usePosCartStore`, `posCart` Redux. |
| Reporteria | `FiltersBar`, `PdfPreviewModal`, `ReportStatusBadge`, `ReportMetricCard`, `ReportExportCard`, paginas de reportes. |
| Finanzas | `DocumentPaymentForm`, `FinanceStatusBadge`, `FinanceMetricCard`, `FinanceAccessNotice`. |

Patron visual:

- Secciones tipo card con borde slate y `shadow-sm`.
- Tablas HTML manuales en inventario/compras.
- `DataTable` en reporteria.
- Badges de estado por clases Tailwind.
- Filtros con `Input`, `Select`, `DateRangePicker`.
- Modales/preview PDF con `iframe` y `Blob`.

RIESGO: El sistema usa muchas cards con radios grandes. Nuevas pantallas deben respetar patron existente sin romper ergonomia de POS.

## Base de datos y scripts relevantes

Tablas actuales relacionadas:

| Dominio | Tablas |
| --- | --- |
| Productos | `products`, `units`, `taxes` |
| Inventario | `stock_movements` |
| Compras | `suppliers`, `purchases`, `purchase_items` |
| Pedidos | `customers`, `orders`, `order_items` |
| Ventas | `sales`, `sale_items`, `sale_item_taxes`, `sale_payment_methods` |
| Caja/pagos | `payment_methods`, `payments`, `payment_allocations`, `cash_registers`, `cash_sessions`, `cash_movements`, `cash_counts` |
| POS | `terminals`, `pos_user_sessions` |
| Tenant/sucursal | `tenants`, `tenants_detalles`, `tenant_branches`, `persona_tenant_branches` |
| Usuarios/RBAC | `users`, `roles`, `user_roles`, `permissions`, `menu_items`, `role_menu_permissions` |
| Auditoria | `auditoria_eventos`, `security_audit_logs` |

Funciones y vistas relevantes:

| Nombre | Uso |
| --- | --- |
| `inventory_dashboard_snapshot` | Dashboard inventario. |
| `inventory_create_sale` | Crea venta POS y descuenta stock. |
| `inventory_invoice_order` | Factura pedido entregado. |
| `report_pos_sales` | Reporte ventas POS. |
| `report_pos_sale_ticket` | Ticket venta POS. |
| `report_pos_sale_cancel_ticket` | Ticket cancelacion venta. |
| `report_purchases` | Reporte compras. |
| `report_purchase_ticket` | Ticket compra. |
| `report_cash_closings` | Reporte cierres caja. |
| `report_cash_closing_ticket` | Ticket cierre caja. |
| `report_cash_audit` | Arqueos. |
| `report_cash_audit_ticket` | Ticket arqueo. |
| `vw_direcciones_completas`, `vw_tenant_direcciones` | Vistas de direcciones. |

No encontrado:

- Tabla de lotes.
- Tabla de vencimientos.
- Tabla de ubicaciones fisicas de inventario.
- Tabla de saldo por lote/sucursal.
- Tabla de historial de precio.
- Tabla de alertas de inventario.
- Funcion FEFO.
- Reporte de vencimientos.
- Reporte de rotacion formal.

## Riesgos tecnicos

| Riesgo | Detalle |
| --- | --- |
| Venta POS en SQL function | `inventory_create_sale` concentra reglas criticas. Cambios de lote deben actualizar funcion, service, tests y tickets. |
| Doble fuente de reglas | Stock se valida en service y en funcion SQL. Si se agrega lote en una sola capa, habra inconsistencias. |
| Ajustes sin entidad propia | No hay trazabilidad estructurada de motivo ni aprobacion. |
| DTOs limitados | Producto, compra y venta usan tipos locales, no DTOs validados globalmente. |
| Sin `ValidationPipe` global observado | Decoradores de `class-validator` no garantizan ejecucion si no hay pipe. |
| Reportes SQL acoplados | Reporteria depende de funciones SQL. Nuevas columnas deben mantener compatibilidad de datasets. |
| Documentacion desactualizada | README y AGENTS mezclan estados anteriores. Puede confundir implementacion. |
| Inventario por sucursal derivado | Calcular todo por movimientos puede crecer costoso sin indices/resumen por lote. |

## Riesgos de datos

| Riesgo | Detalle |
| --- | --- |
| Datos existentes sin lote | Migracion futura debe crear estrategia para stock historico sin lote. |
| Datos existentes sin vencimiento | Productos perecederos antiguos no tendran fecha por lote. |
| Ventas historicas | Deben conservar precio vendido y no recalcular contra precio actual. |
| Stock negativo historico | Si existen movimientos antiguos sin `branch_id` o con saldos raros, lotificacion puede quedar incompleta. |
| Movimientos sin referencia estructurada | `ADJUSTMENT` tiene `reference_id` aleatorio y no tabla real. |
| Compras parciales liquidadas | Cantidades no recibidas no deben convertirse a lotes. |

## Riesgos de compatibilidad

| Riesgo | Detalle |
| --- | --- |
| POS | No debe pedir lote al cajero si la regla puede resolverse por FEFO. |
| Compras | Recepcion actual solo captura producto/cantidad. Agregar lote/vencimiento debe ser incremental. |
| Reportes existentes | Tickets actuales de venta/compra no deben romper si lote es null. |
| API contracts | `ProductResponse` actual no tiene campos nuevos. Campos nuevos deben ser opcionales al inicio. |
| Permisos | Nuevas pantallas/reportes requieren menu y `role_menu_permissions` sin bloquear rutas actuales. |
| Multi-tenant | Toda consulta nueva debe filtrar `tenant_id` y `branch_id` cuando aplique. |

## Puntos reutilizables

| Punto | Como reutilizar |
| --- | --- |
| `StockMovementService` | Mantener como punto central de movimientos, ampliandolo con lote/ubicacion cuando se implemente. |
| `InventoryService` | Reusar resolucion de scope por tenant/sucursal/rol. |
| `FinanceAccessRepository` | Reusar sucursales accesibles. |
| `PurchaseService.receivePurchase` | Punto natural para capturar lotes y vencimientos. |
| `inventory_create_sale` | Punto obligado para FEFO en POS. |
| `inventory_invoice_order` | Punto obligado para FEFO en pedidos facturados. |
| `InventoryDashboard` | Base para alertas operativas. |
| `DataTable`, `FiltersBar`, `ReportStatusBadge` | Base para nuevos reportes de inventario en web. |
| `FunctionRunnerService` | Patron para nuevos reportes en `backend-reporteria`. |
| `PdfmakeEngine` y templates | Patron para PDFs/exportables futuros. |
| `auditoria_eventos` | Base para auditar precio, lote, ajuste y reglas. |

## Brechas funcionales

| Objetivo | Brecha actual |
| --- | --- |
| Control de vencimiento | No hay fecha de vencimiento por producto/lote. |
| Manejo de lotes | No hay entidad ni relacion con compras/ventas. |
| Rotacion | No hay clasificacion ABC/alta/media/baja ni parametros. |
| Ubicacion fisica | No hay bodega/pasillo/estante/bin. |
| Historial de cambios de precios | No hay historial ni motivo obligatorio. |
| Alertas operativas | Solo badges simples de stock bajo/sin stock. |
| Integracion compras | Recepcion no captura lote/vencimiento/ubicacion. |
| Integracion ventas | Venta descuenta stock agregado, no lote FEFO. |
| Integracion reportes | No hay reportes de vencimiento/rotacion/valor/historial. |
| Frontend claro | Productos e inventario muestran stock simple, no semaforos por vencimiento/lote. |

## Recomendacion de arquitectura objetivo

### Principios

1. `api/` sigue siendo dueno transaccional.
2. `backend-reporteria/` solo consulta, consolida y genera documentos.
3. `web/` muestra y captura datos operativos sin duplicar reglas criticas.
4. Todas las capacidades nuevas deben ser multi-tenant y branch-aware.
5. Las ventas historicas no se recalculan por precio actual.
6. La evolucion debe ser incremental y compatible con productos existentes sin lote.

### Modelo conceptual propuesto

| Concepto | Proposito |
| --- | --- |
| Producto enriquecido | Agrega flags operativos: perecedero, lote obligatorio, vencimiento obligatorio, clasificacion, barcode, estado. |
| Lote de inventario | Representa una cantidad recibida con lote, vencimiento, costo y proveedor/compra origen. |
| Existencia por lote y sucursal | Permite saber stock disponible por lote, sucursal y ubicacion. |
| Ubicacion fisica | Describe donde esta el stock dentro de la sucursal. |
| Historial de precio | Registra precio anterior/nuevo, motivo, usuario y vigencia. |
| Alerta operativa | Resultado de reglas de vencimiento, stock bajo, agotado, baja rotacion y lote vencido. |
| Reporte consolidado | Lectura desde funciones SQL para reporteria. |

PREGUNTA ABIERTA: El nombre final de las tablas nuevas debe definirse en Fase 2. En esta fase no se proponen migraciones.

### Flujo objetivo

| Flujo | Recomendacion |
| --- | --- |
| Crear producto | Permitir configurar si requiere lote/vencimiento y clasificacion operativa. |
| Recibir compra | Si producto requiere lote/vencimiento, bloquear recepcion sin esos datos. |
| Ajustar inventario | Exigir motivo persistente y, si aplica, lote/ubicacion. |
| Vender POS | Resolver lote automaticamente por FEFO, sin cargar al cajero con decision manual. |
| Entregar pedido | Usar misma regla FEFO que POS. |
| Cambiar precio | Crear evento de historial con motivo obligatorio y usuario. |
| Reportar | `backend-reporteria/` expone reportes de vencidos, proximos a vencer, baja rotacion, valorizado e historial. |

### Estrategia incremental sugerida

| Fase | Resultado |
| --- | --- |
| Fase 0 | Diagnostico y riesgos. |
| Fase 1 | OpenSpec y decisiones. |
| Fase 2 | Modelo de datos compatible, sin romper stock actual. |
| Fase 3 | `api/`: producto enriquecido, lotes, FEFO, alertas, historial precio. |
| Fase 4 | `backend-reporteria/`: funciones SQL, reportes y PDFs futuros. |
| Fase 5 | `web/`: formularios, listados, badges, filtros. |
| Fase 6 | Integracion compras/ventas/pedidos/caja. |
| Fase 7 | Pruebas de regresion POS, compras, reportes. |
| Fase 8 | Documentacion, migracion operativa y cierre. |

## Preguntas abiertas antes de implementar

1. PREGUNTA ABIERTA: Que productos actuales deben considerarse perecederos al migrar: ninguno, todos segun categoria futura, o seleccion manual?
2. PREGUNTA ABIERTA: Se permitira vender productos perecederos sin lote durante una fase transitoria?
3. PREGUNTA ABIERTA: Cual es la ventana de "proximo a vencer": 7, 15, 30 dias o configurable por tenant/producto?
4. PREGUNTA ABIERTA: La ubicacion fisica sera obligatoria por producto, por lote o solo opcional por sucursal?
5. PREGUNTA ABIERTA: La clasificacion de rotacion sera calculada bajo demanda, persistida por periodo, o ambas?
6. PREGUNTA ABIERTA: El cambio de precio requiere aprobacion o solo motivo obligatorio?
7. PREGUNTA ABIERTA: El barcode puede repetirse entre tenants? SUPUESTO: si, debe ser unico solo por tenant.
8. PREGUNTA ABIERTA: El costo valorizado debe usar ultimo costo, costo promedio, costo por lote o FEFO?
9. PREGUNTA ABIERTA: Los ajustes manuales deben crear documento/auditoria separada antes de modificar stock?
10. PREGUNTA ABIERTA: Los reportes futuros deben incluir exportacion Excel/CSV ademas de PDF?
