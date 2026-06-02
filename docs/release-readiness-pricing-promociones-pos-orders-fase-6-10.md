# Release readiness pricing, promociones, POS y Orders - Fase 6.10

## Resumen ejecutivo

Este documento cierra tecnicamente el bloque de pricing, promociones, Orders y POS. El bloque queda listo para predeploy controlado, sujeto a checklist, backup, migraciones en orden y validacion en ambiente destino.

La fase consolida evidencia ya generada. No agrega codigo funcional, no agrega SQL, no modifica frontend, no modifica backend y no toca PRD real.

La consulta DIAN de clientes y proveedores no se implementa en esta fase. Queda separada como epica FE-3 para evitar mezclar facturacion electronica con pricing/POS.

## Fases completadas

| Fase | Resultado |
| --- | --- |
| 6.0 | Diseno fiscal de pricing, promociones y base futura para facturacion electronica, sin implementar facturacion electronica. |
| 6.4 | `PricingService` separa calculo base sin promociones y mantiene `POST /api/pricing/preview-line`. |
| 6.5 | Backend CRUD de promociones y tablas `promotions`, `promotion_products`, `promotion_branches`. |
| 6.5.1 | QA local de migracion, rollback, reaplicacion y API real de promociones. |
| 6.5.2 | Permiso dedicado `INVENTORY_PROMOTIONS` para endpoints de promociones. |
| 6.6 | `PricingService` aplica promociones activas en preview. |
| 6.6.1 | QA local de `POST /api/pricing/preview-line` con promociones, impuestos y no persistencia. |
| 6.7.1 | Snapshot de pricing preparado en `order_items`. |
| 6.7.2 | `OrderService` usa `PricingService` al crear/actualizar pedidos con items. |
| 6.7.3 | QA local confirma que Orders ignora montos basura del cliente y persiste snapshot. |
| 6.7.4.1 | Snapshot nullable agregado a `sale_items`. |
| 6.7.4.2 | `inventory_invoice_order` factura desde snapshot de `order_items`. |
| 6.7.4.3 / QA | Validacion local de invoice order snapshot, fallback legacy, item sin impuesto y redondeo parcial. |
| 6.7.4.5 / 6.7.4.6 | Absorcion de redondeo en ultima factura parcial y compatibilidad en `SaleItemEntity`. |
| 6.8.1 | Diseno POS con `PricingService` y snapshot. |
| 6.8.2 | `SaleService` calcula payload POS con `PricingService` e ignora `items[].price` para calculo final. |
| 6.8.3 | `inventory_create_sale_v2` persiste snapshot POS. |
| 6.8.4 | QA local POS pricing con promocion, IVA, FEFO, CASH mismatch y legacy. |
| 6.8.5 | Hardening de carga `JWT_SECRET` / dotenv para auth. |
| 6.9 | Frontend POS consume preview pricing y refleja promociones en carrito. |
| 6.9.1 | Frontend administracion de promociones. |
| 6.9.2 | QA local de promociones admin y preview POS. |
| 6.9.3 | Fixes QA de promociones admin, tenant slug, validaciones y menu visible. |
| 6.10 | Cierre documental de release readiness. |

## Cambios backend NestJS

- `PricingService` calcula precio base, impuesto, descuento, promocion aplicada, `finalUnitPrice`, `lineTotal`, `taxBase` y `taxAmount`.
- `POST /api/pricing/preview-line` queda como preview no persistente para POS y Orders.
- `PromotionsController`, `PromotionsService` y `PromotionsRepository` exponen CRUD de promociones.
- Endpoints de promociones usan permiso dedicado `INVENTORY_PROMOTIONS`.
- `OrderService` recalcula pedidos con `PricingService` cuando el request trae `items`.
- `OrderService` ignora `price`, `subtotal` y `total` enviados por cliente en flujos con items recalculados.
- `OrderService` persiste snapshot de pricing en `order_items`.
- `SaleService` calcula lineas POS con `PricingService`.
- `SaleService` valida pagos `CASH` contra total backend y no autoajusta pagos.
- `SaleRepository` serializa payload POS enriquecido hacia `inventory_create_sale_v2`.
- `SaleItemEntity` permite subtotal absorbido cuando `pricingSource = ORDER_ITEM_SNAPSHOT` y conserva validacion legacy.
- Auth carga `.env` antes de inicializar JWT y evita fallback inseguro fuera de `NODE_ENV=local` o `NODE_ENV=test`.

## Cambios frontend

- POS llama `POST /api/pricing/preview-line` al agregar producto, cambiar cantidad o rehidratar carrito con pricing pendiente.
- POS muestra precio final, descuento, promocion aplicada y total de linea.
- POS usa `lineTotal` para totales visibles y envia `finalUnitPrice` como `price` compatible a `POST /api/sales`.
- POS mantiene backend como fuente de verdad para precio, promociones, impuestos y persistencia.
- POS muestra error por item y toast si preview falla; cobrar queda bloqueado hasta resolver pricing.
- Se creo ruta `web/app/[tenant]/inventory/promotions/page.tsx`.
- Se creo servicio `web/modules/pricing/services/promotions.service.ts`.
- UI de promociones lista, filtra, crea, edita, inactiva y selecciona productos/sucursales.
- Se corrigio uso de slug `default` como `tenantId` para productos/sucursales.
- Se alinearon validaciones UX con backend para `FIXED_AMOUNT`, `PERCENTAGE` y `SPECIAL_PRICE`.

## Cambios SQL/migraciones

| Archivo | Proposito |
| --- | --- |
| `scripts/database/migrations/20260605_pricing_promotions_phase_1.sql` | Crea tablas de promociones por producto/sucursal. |
| `scripts/database/migrations/20260605_pricing_promotions_phase_1_rollback.sql` | Rollback de tablas de promociones. |
| `scripts/database/migrations/20260606_pricing_promotions_menu_permissions.sql` | Crea permiso/menu `INVENTORY_PROMOTIONS`. |
| `scripts/database/migrations/20260607_orders_pricing_snapshot_phase_6_7_1.sql` | Agrega snapshot de pricing a `order_items`. |
| `scripts/database/migrations/20260607_orders_pricing_snapshot_phase_6_7_1_rollback.sql` | Rollback de snapshot en `order_items`. |
| `scripts/database/migrations/V048__sale_items_pricing_snapshot_phase_6_7_4_1.sql` | Agrega snapshot nullable a `sale_items`. |
| `scripts/database/rollbacks/V048__sale_items_pricing_snapshot_phase_6_7_4_1_rollback.sql` | Rollback de snapshot en `sale_items`. |
| `scripts/database/migrations/V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2.sql` | Actualiza `inventory_invoice_order` para usar snapshot de `order_items`. |
| `scripts/database/rollbacks/V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2_rollback.sql` | Restaura `inventory_invoice_order` legacy. |
| `scripts/database/migrations/V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5.sql` | Absorbe redondeo en ultima factura parcial y crea `idx_sale_items_tenant_order_item`. |
| `scripts/database/rollbacks/V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5_rollback.sql` | Restaura `inventory_invoice_order` de Fase 6.7.4.2. |
| `scripts/database/migrations/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql` | Actualiza `inventory_create_sale_v2` para persistir snapshot POS. |
| `scripts/database/rollbacks/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3_rollback.sql` | Restaura `inventory_create_sale_v2` legacy. |
| `scripts/database/migrations/20260608_promotions_menu_visible_phase_6_9_3.sql` | Hace visible el menu de promociones. |
| `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql` | Fresh DB actualizado con funciones de venta/facturacion alineadas. |

## Funciones SQL modificadas

- `public.inventory_invoice_order(...)`
  - Usa snapshot de `order_items` cuando existe informacion suficiente.
  - No recalcula precio, promocion ni impuesto desde `products` o `taxes` en rama snapshot.
  - Crea `sale_item_taxes` desde `order_items.tax_id`, `tax_rate` y `tax_amount` prorrateado.
  - Mantiene fallback `LEGACY_ORDER_ITEM_NO_PRICING_SNAPSHOT`.
  - Absorbe diferencia de redondeo en la ultima factura parcial con `ORDER_ITEM_SNAPSHOT`.

- `public.inventory_create_sale_v2(...)`
  - Lee payload enriquecido POS con `pricing_source = 'POS_PRICING_SERVICE'`.
  - Persiste `sale_items.price = final_unit_price`.
  - Persiste `sale_items.subtotal = line_total`.
  - Persiste descuento, promocion aplicada, tax snapshot, `pricing_snapshot` y `pricing_calculated_at`.
  - Inserta `sale_item_taxes` desde snapshot de pricing.
  - Mantiene comportamiento legacy cuando no llega `POS_PRICING_SERVICE`.
  - Mantiene stock, FEFO, lotes, pagos y caja dentro de la funcion transaccional.

## Cambios en POS

- POS directo ya no depende del precio enviado por el frontend para el calculo final backend.
- `SaleService` calcula cada item con `PricingService`.
- `inventory_create_sale_v2` persiste snapshot POS.
- `sale_item_taxes` usa impuesto del snapshot cuando el item viene de `POS_PRICING_SERVICE`.
- CASH mismatch se rechaza sin crear ventas ni movimientos huerfanos.
- FEFO/lotes siguen dentro de SQL y fueron validados junto con snapshot POS.
- Frontend POS muestra precio final, promocion, descuento y total antes de cobrar.

## Cambios en Orders

- `order_items` tiene columnas snapshot para precio base, final, descuento, promocion, impuesto, total y metadata.
- `POST /api/orders` y `PUT /api/orders/:id` con `items` recalculan con `PricingService`.
- Orders ignora montos basura del cliente en flujos recalculados.
- `inventory_invoice_order` factura usando snapshot de `order_items`.
- Facturacion parcial prorratea montos y la ultima factura absorbe centavos.
- Fallback legacy sigue disponible para pedidos sin snapshot suficiente.

## Cambios en promociones

- Modelo SQL: `promotions`, `promotion_products`, `promotion_branches`.
- Tipos soportados por pricing: `PERCENTAGE`, `FIXED_AMOUNT`, `SPECIAL_PRICE`.
- Promociones aplican por tenant, producto, fecha y sucursal opcional.
- Menor `priority` gana; no hay acumulacion en esta fase.
- CRUD backend expone listar, detalle, crear, actualizar e inactivar.
- Permiso dedicado `INVENTORY_PROMOTIONS`.
- UI permite administracion y hace visible el acceso desde inventario.
- Preview pricing refleja promocion activa sin persistir venta o pedido.

## Validaciones ejecutadas

- Tests backend de pricing y promociones con `npx.cmd tsx --test src/modules/pricing/*.spec.ts`.
- Tests backend de `OrderService`.
- Tests backend de `SaleService` y `SaleRepository`.
- Tests backend de `SaleItemEntity`.
- Build de `api/`.
- Lint y build de `web/`.
- `openspec validate` en fases previas.
- `git diff --check` en fases previas.
- QA local de migracion promociones, rollback y reaplicacion.
- QA local de promociones CRUD por API.
- QA local de `POST /api/pricing/preview-line` con promociones reales.
- QA local de Orders con payload basura y snapshot persistido.
- QA local de `inventory_invoice_order` con snapshot, fallback legacy, item sin impuesto y facturacion parcial.
- QA local de absorcion de redondeo en ultima factura parcial.
- QA local POS con promocion + IVA, mutacion posterior de producto/tax/promocion, CASH mismatch, FEFO/lotes y legacy.
- QA local de ruta `/default/inventory/promotions` y endpoints de promociones.
- Fase 6.10 debe cerrar con `openspec.cmd validate fortalecer-productos-inventario --type change --strict --json` y `git diff --check`.

## Evidencias generadas

- `docs/evidencia-pricing-service-base-fase-6-4.md`
- `docs/evidencia-backend-promociones-crud-fase-6-5.md`
- `docs/evidencia-api-local-promociones-fase-6-5-1.md`
- `docs/evidencia-permiso-promociones-fase-6-5-2.md`
- `docs/evidencia-pricing-service-promociones-preview-fase-6-6.md`
- `docs/evidencia-api-local-pricing-promociones-preview-fase-6-6-1.md`
- `docs/evidencia-orders-pricing-snapshot-fase-6-7-1.md`
- `docs/evidencia-orders-pricing-service-fase-6-7-2.md`
- `docs/evidencia-api-local-orders-pricing-fase-6-7-3.md`
- `docs/evidencia-sale-items-pricing-snapshot-fase-6-7-4-1.md`
- `docs/evidencia-invoice-order-uses-order-snapshot-fase-6-7-4-2.md`
- `docs/evidencia-api-local-invoice-order-snapshot-fase-6-7-4-3.md`
- `docs/evidencia-api-local-invoice-order-snapshot-qa-fase-6-7-4.md`
- `docs/evidencia-invoice-order-partial-rounding-fase-6-7-4-5.md`
- `docs/evidencia-api-local-invoice-order-partial-rounding-fase-6-7-4-5.md`
- `docs/diseno-pos-pricing-service-fase-6-8-1.md`
- `docs/evidencia-pos-pricing-payload-fase-6-8-2.md`
- `docs/evidencia-pos-sql-persists-pricing-snapshot-fase-6-8-3.md`
- `docs/evidencia-api-local-pos-pricing-fase-6-8-4.md`
- `docs/evidencia-auth-env-loading-hardening-fase-6-8-5.md`
- `docs/evidencia-frontend-pos-pricing-fase-6-9.md`
- `docs/evidencia-frontend-promotions-admin-fase-6-9-1.md`
- `docs/evidencia-frontend-promotions-admin-qa-fase-6-9-2.md`
- `docs/evidencia-promotions-admin-fixes-fase-6-9-3.md`
- `docs/runbook-migracion-promociones-fase-6-5.md`
- `docs/release-readiness-pricing-promociones-pos-orders-fase-6-10.md`

## Riesgos pendientes

- No se ha ejecutado predeploy contra PRD real. Toda evidencia es local/dev/copia QA.
- Si migraciones se aplican con `psql -f`, `migrations_history` puede no reflejar la realidad. Usar runner oficial o registrar controladamente.
- `20260606_pricing_promotions_menu_permissions.sql` y `20260608_promotions_menu_visible_phase_6_9_3.sql` no tienen rollback dedicado en la lista actual; rollback de menu debe ser manual/idempotente o por backup.
- El rollback de V050 no recrea `chk_sale_items_subtotal_matches`; esto evita invalidar filas con redondeo absorbido.
- Ventas y pedidos historicos no reciben snapshot inventado. Es correcto, pero reportes deben tolerar `NULL`.
- POS frontend bloquea cobrar si preview pricing falla; operacion necesita procedimiento de retry y monitoreo.
- Promociones no son acumulables en esta fase.
- La regla fiscal final para facturacion electronica sigue separada y no debe mezclarse con pricing/POS.
- Consulta DIAN clientes/proveedores sigue pendiente estrategico FE-3.

## Orden sugerido de migraciones

Precondiciones si el ambiente no las tiene:

1. `scripts/database/migrations/20260601_inventory_products_lots_phase_1.sql`
2. `scripts/database/migrations/20260602_inventory_create_sale_v2.sql`

Bloque pricing/promociones/Orders/POS:

1. `scripts/database/migrations/20260605_pricing_promotions_phase_1.sql`
2. `scripts/database/migrations/20260606_pricing_promotions_menu_permissions.sql`
3. `scripts/database/migrations/20260607_orders_pricing_snapshot_phase_6_7_1.sql`
4. `scripts/database/migrations/V048__sale_items_pricing_snapshot_phase_6_7_4_1.sql`
5. `scripts/database/migrations/V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2.sql`
6. `scripts/database/migrations/V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5.sql`
7. `scripts/database/migrations/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql`
8. `scripts/database/migrations/20260608_promotions_menu_visible_phase_6_9_3.sql`

Para fresh DB, confirmar que `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql` contiene las versiones alineadas de `inventory_create_sale_v2` e `inventory_invoice_order`.

## Checklist predeploy

- [ ] Confirmar ambiente destino y ventana aprobada.
- [ ] Confirmar backup completo antes de migrar.
- [ ] Confirmar que no se esta operando contra PRD real sin aprobacion.
- [ ] Confirmar `JWT_SECRET` real, sin fallback `changeme`.
- [ ] Ejecutar migraciones en staging en el orden sugerido.
- [ ] Confirmar tablas `promotions`, `promotion_products`, `promotion_branches`.
- [ ] Confirmar columnas snapshot en `order_items` y `sale_items`.
- [ ] Confirmar `inventory_invoice_order` contiene `ORDER_ITEM_SNAPSHOT`.
- [ ] Confirmar `inventory_create_sale_v2` contiene `POS_PRICING_SERVICE`.
- [ ] Confirmar `chk_sale_items_subtotal_matches` no existe si V050 aplica.
- [ ] Confirmar menu/permiso `INVENTORY_PROMOTIONS`.
- [ ] Ejecutar tests backend pricing, orders, sales y sale item entity.
- [ ] Ejecutar build de `api/`.
- [ ] Ejecutar lint/build de `web/`.
- [ ] Ejecutar `openspec validate` y `git diff --check`.

## Checklist postdeploy

- [ ] Login con usuario autorizado.
- [ ] Ver menu de promociones.
- [ ] Abrir `/{tenant}/inventory/promotions`.
- [ ] Crear promocion `PERCENTAGE` y verla en listado.
- [ ] Crear promocion `FIXED_AMOUNT` valida y confirmar rechazo de valor `0`.
- [ ] Inactivar promocion y verla en filtro inactivo.
- [ ] Ejecutar `POST /api/pricing/preview-line` con promocion activa.
- [ ] Crear pedido con payload de montos incorrectos y confirmar snapshot correcto.
- [ ] Facturar pedido y confirmar `pricing_source = ORDER_ITEM_SNAPSHOT`.
- [ ] Ejecutar POS con promocion + IVA y confirmar `pricing_source = POS_PRICING_SERVICE`.
- [ ] Validar `sale_item_taxes.tax_rate` y `tax_amount` desde snapshot.
- [ ] Validar CASH mismatch sin ventas ni movimientos huerfanos.
- [ ] Validar producto loteado con FEFO si ambiente tiene fixtures/lotes.
- [ ] Revisar logs de API, errores 4xx/5xx y tiempos de respuesta.
- [ ] Confirmar que no quedan fixtures de QA.

## Rollback general

Rollback recomendado: restaurar backup de base de datos y volver app/web/api al build anterior cuando se requiera reversa completa.

Rollback SQL parcial, solo con aprobacion y aceptando perdida de datos nuevos:

1. Ejecutar `scripts/database/rollbacks/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3_rollback.sql`.
2. Ejecutar `scripts/database/rollbacks/V050__invoice_order_partial_rounding_absorption_phase_6_7_4_5_rollback.sql`.
3. Ejecutar `scripts/database/rollbacks/V049__invoice_order_uses_order_item_snapshot_phase_6_7_4_2_rollback.sql`.
4. Ejecutar `scripts/database/rollbacks/V048__sale_items_pricing_snapshot_phase_6_7_4_1_rollback.sql`.
5. Ejecutar `scripts/database/migrations/20260607_orders_pricing_snapshot_phase_6_7_1_rollback.sql`.
6. Ejecutar `scripts/database/migrations/20260605_pricing_promotions_phase_1_rollback.sql`.
7. Ocultar o retirar manualmente `INVENTORY_PROMOTIONS` si se necesita rollback de menu.

Notas:

- No eliminar snapshot si ya hay ventas/pedidos reales dependientes sin respaldo.
- V050 rollback no recrea `chk_sale_items_subtotal_matches`.
- Si hay datos reales de promociones, el rollback de `20260605` elimina tablas y datos de promociones.
- Si la reversa es por incidente operativo, preferir feature/app rollback y conservar datos hasta diagnostico.

## Fuera de alcance

- No se implementa consulta DIAN de clientes.
- No se implementa consulta DIAN de proveedores.
- No se consume DIAN real.
- No se implementa GetAcquirer real en esta fase.
- No se implementa facturacion electronica.
- No se modifica `backend-reporteria/`.
- No se agregan cambios funcionales en Fase 6.10.
- No se toca SQL en Fase 6.10.
- No se toca frontend en Fase 6.10.
- No se toca backend en Fase 6.10.
- No se toca PRD real.
- No se ejecuta remoto.
- No se hace commit.

## Pendiente estrategico: consulta DIAN clientes/proveedores

La consulta DIAN de clientes y proveedores no se implementa en esta fase. Queda separada como epica FE-3 para evitar mezclar facturacion electronica con pricing/POS.

FE-3 debe tratar DIAN/GetAcquirer como integracion fiscal separada, con certificados, ambiente, permisos, privacidad, reintentos, auditoria y reglas propias. Pricing, POS y Orders deben seguir funcionando aunque DIAN no este disponible.
