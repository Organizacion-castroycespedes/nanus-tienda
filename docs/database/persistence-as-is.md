# Persistencia PostgreSQL AS-IS

## Alcance

Esta ficha describe persistencia demostrable desde SQL y runtime. No consulta bases activas. El dump QA no se trata como migración.

## Fuentes y runners

| Fuente | Función | Evidencia |
|---|---|---|
| `api/database/` | SQL histórico de esquema base, auth, menú y auditoría | archivos `initial_schema.sql` y migraciones fechadas |
| `scripts/database/[0-9][0-9][0-9]_*.sql` | familia numerada base y seeds | `scripts/database/migrate.sh` |
| `scripts/database/migrations/*.sql` | incrementales funcionales | `scripts/database/migrate_prd.sh` |
| `scripts/database/migrations/V###__*.sql` | formato recomendado para cambios nuevos | `scripts/database/migrations/README.md` |
| `database/manus_tienda_qa.sql` | dump de estado QA | archivo de dump; no runner |

### Diferencia entre runners

`run_migrations.sh:88` selecciona únicamente `[0-9]{8}_*.sql`. Por eso no selecciona `V087__report_product_inventory.sql`.

`migrate_prd.sh` construye la lista con `find ... -name '*.sql' | sort` (`migrate_prd.sh:504`), excluyendo rollback y fixtures según sus reglas.

`migrate.sh` aplica la familia numerada de la raíz de `scripts/database/` y registra `migrations_history`.

Los tres mecanismos no son intercambiables sin revisar selección, orden, fixtures y entorno.

## Historial de migraciones

Los runners crean o utilizan `public.migrations_history`, con:

- `version` único.
- `applied_at`.
- `applied_by`.
- `checksum`.
- `success`.
- `details`.

Evidencia: `scripts/database/run_migrations.sh:39-47` y `scripts/database/migrate_prd.sh:125-147`.

No se consultó el contenido real de `migrations_history` en QA ni producción.

## Conjunto de migraciones verificable

La rama contiene migraciones de:

- Base y extensiones.
- Inventario, lotes, ubicaciones y FEFO.
- Ventas y funciones POS.
- Compras y liquidación parcial.
- Clientes y proveedores fiscales.
- Precios y promociones.
- Domicilios.
- Caja y pagos.
- Facturación electrónica.
- Integration Outbox.
- Terminales y vínculos con dispositivos.
- Idempotencia de creación de ventas.
- Reportes de inventario.

Ejemplos trazables:

| Dominio | Migración | Evidencia |
|---|---|---|
| Inventario | `20260601_inventory_products_lots_phase_1.sql` | tablas de códigos, ubicaciones, lotes, balances y alertas |
| Facturación | `V072__electronic_billing_base_persistence.sql` | documentos, líneas, impuestos, referencias y entregas |
| Inbox | `V073__electronic_billing_inbox_events.sql` | inbox de eventos fiscales |
| Outbox | `V074__integration_outbox_events.sql` | `integration_outbox_events` |
| Terminales | `V075__terminal_device_binding.sql` | `terminal_devices`, `terminal_device_bindings` |
| Idempotencia | `V086__sale_creation_idempotency.sql` | `sale_creation_idempotency` |
| Reporte inventario | `V087__report_product_inventory.sql` | función `fnc_report_product_inventory` |
| Caja multiusuario | `V093__cash_multiuser_and_document_parameters.sql` | asignaciones y parámetros |

## Matriz de tablas y funciones verificables

| Dominio | Objeto | Evidencia SQL | Clave/relación observada |
|---|---|---|---|
| Inventario | `product_barcodes` | `20260601_inventory_products_lots_phase_1.sql:116-126` | `tenant_id`, `product_id`, índices únicos por tenant |
| Inventario | `inventory_locations` | `20260601_inventory_products_lots_phase_1.sql:128-139` | tenant y branch |
| Inventario | `inventory_lots` | `20260601_inventory_products_lots_phase_1.sql:141-157` | tenant, branch, product, supplier/purchase opcionales |
| Inventario | `inventory_lot_balances` | `20260601_inventory_products_lots_phase_1.sql:159-173` | tenant, branch, product, lot, location |
| Inventario | `stock_movement_lots` | `20260601_inventory_products_lots_phase_1.sql:175-184` | movimiento, producto, lote y ubicación |
| Inventario | `product_price_history` | `20260601_inventory_products_lots_phase_1.sql:186-200` | producto, usuario y estado de aplicación |
| Fiscal | `electronic_billing_providers` | `V072__electronic_billing_base_persistence.sql:6-19` | proveedor fiscal |
| Fiscal | `tenant_electronic_billing_configs` | `V072__electronic_billing_base_persistence.sql:21-39` | tenant y proveedor |
| Fiscal | `electronic_documents` | `V072__electronic_billing_base_persistence.sql:41-90` | documento, tenant y configuración fiscal |
| Fiscal | `electronic_document_lines` | `V072__electronic_billing_base_persistence.sql:92-124` | documento y líneas |
| Fiscal | `electronic_billing_inbox_events` | `V073__electronic_billing_inbox_events.sql:3-29` | evento recibido y documento opcional |
| Integración | `integration_outbox_events` | `V074__integration_outbox_events.sql:1-40` | evento, tenant, source y estado |
| Terminales | `terminal_devices` | `V075__terminal_device_binding.sql:25-52` | dispositivo y tenant |
| Terminales | `terminal_device_bindings` | `V075__terminal_device_binding.sql:54-81` | terminal/dispositivo, tenant y binding activo |
| Ventas | `sale_creation_idempotency` | `V086__sale_creation_idempotency.sql:18-36` | PK compuesta tenant + idempotency key |
| Reportería | `fnc_report_product_inventory` | `V087__report_product_inventory.sql:3-40` | función estable; no tabla |
| Caja | `cash_register_user_assignments` | `V093__cash_multiuser_and_document_parameters.sql:35-57` | caja, usuario y asignación activa |
| Configuración | `tenant_settings` | `V093__cash_multiuser_and_document_parameters.sql:243-267` | tenant/branch/terminal y parámetro |

## Modelo relacional por dominio

### Identidad y tenant

- `tenants` → `tenant_branches`.
- `tenants` → `users`.
- `users` ↔ `roles` por `user_roles`.
- `users` → `personas` cuando existe perfil persona.
- `personas` ↔ `tenant_branches` por `persona_tenant_branches`.
- `users` → `auth_sessions` y `auth_refresh_tokens`.

### Catálogo e inventario

- `products` → `product_barcodes`.
- `products` → `inventory_lots`.
- `inventory_lots` → `inventory_lot_balances`.
- `inventory_locations` pertenece a tenant y sucursal.
- `stock_movements` registra entradas, salidas y referencias operativas.
- `stock_movement_lots` enlaza movimientos con lotes.
- `products` se relaciona con `units`, `taxes`, categorías y subcategorías.

### Operación comercial

- `customers` → `orders` y `sales`.
- `suppliers` → `purchases`.
- `orders` → `order_items`.
- `purchases` → `purchase_items`.
- `sales` → `sale_items`, `sale_item_taxes` y `sale_payment_methods`.
- `sales` → `sale_creation_idempotency` mediante relación tenant/venta.

### Caja y pagos

- `tenant_branches` → `cash_registers`.
- `cash_registers` → `cash_sessions`.
- `cash_sessions` → `cash_counts` y `cash_movements`.
- `payments` → `payment_allocations` y, cuando aplica, `cash_movements`.
- `payment_methods` se relaciona con configuración fiscal y entidades financieras.

### Fiscal e integración

- `electronic_billing_providers` → configuraciones y documentos.
- `electronic_documents` → líneas, impuestos, referencias, entregas, adjuntos y eventos.
- `electronic_billing_inbox_events` recibe eventos externos/internos.
- `integration_outbox_events` emite eventos desde API hacia facturación.

## Claves, aislamiento e índices

Patrones demostrados:

- UUID como clave primaria en el esquema operativo.
- `tenant_id` en tablas multi-tenant.
- Claves foráneas con `ON DELETE CASCADE`, `RESTRICT` o `SET NULL` según dominio.
- Índices compuestos por tenant y entidad.
- Índices únicos para códigos, SKU, vínculos activos e idempotencia.
- Restricciones `CHECK` para estados, cantidades, porcentajes y relaciones fiscales.

El aislamiento lógico está diseñado alrededor de `tenant_id`, pero no se certifica globalmente sin revisar cada consulta y cada ambiente.

## Diferencias y límites

| Comparación | Resultado |
|---|---|
| Migraciones vs código runtime | Hay tablas y funciones usadas por runtime y cubiertas por migraciones incrementales; requiere matriz exhaustiva |
| Migraciones vs dump QA | No se ejecutó diff estructural ni se consultó QA |
| `api/database/` vs `scripts/database/` | Son familias históricas distintas; no son equivalentes |
| Estado aplicado por ambiente | No verificado |
| Producción | No consultada por restricción de seguridad |
