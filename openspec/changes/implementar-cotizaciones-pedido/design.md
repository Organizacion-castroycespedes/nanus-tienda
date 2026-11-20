## Context

Evidencia (`develop` @ `16e6e29c`, 2026-11-19):

- Pedidos: `OrderService.createOrder` valida cliente, productos, sucursal y terminal del tenant; valoriza cada línea con `PricingService.calculateLinePrice` (canal `ORDER`) en `calculatePricedItems`; inserta `orders` (`DRAFT`, `PENDING`) y `order_items` con `pricing_snapshot`; replica impuestos con `prc_replace_order_item_taxes` a partir de `pricing_snapshot.result.taxes` (`extractSnapshotTaxes`). Todo dentro de su propia transacción.
- `OrderItemEntity` acepta cantidades decimales positivas; la política entero/decimal por producto (`products.allows_decimal_quantity`, V118) se aplica en compras y POS.
- Motor de precios: `PricingChannel = "POS" | "ORDER"`; web previsualiza con `POST /pricing/preview-line` (`order-capture/order-pricing-preview.ts`).
- Parámetros (`public.parameters` / `tenant_settings`) solo admiten `MODE` y `BOOLEAN`.
- Menús: `menu_items` por tenant + `role_menu_permissions` (`access_level` + acciones jsonb), patrón de V070.
- Branding: `tenants.config` (`logo` data-URI, `colors`) y `tenants_detalles` (razón social, NIT, dirección, contacto, representante legal).
- Reportería: NestJS + pdfmake (`pdf/templates/base/report-layout.ts`, `thermal-layout.ts`).
- Referencia visual: flexibuild-core `web/components/obras/Quotation*` y `backend-documental/src/modules/quotation-pdf/quotation-pdf.renderer.ts` (pdfkit).

## Goals / Non-Goals

**Goals**
- Documento comercial previo al pedido, con precio congelado al aprobar y respetado al convertir mientras esté vigente.
- Conversión atómica 1 cotización → 1 pedido, con trazabilidad en ambos sentidos.
- Identidad visual de flexibuild en pantalla y PDF, con branding del tenant.
- Cero cambios de comportamiento en creación, entrega, cobro y facturación de pedidos existentes.

**Non-Goals:** ver "Fuera de alcance" en `proposal.md`.

## Decisions

### D1. Modelo de datos (V120)
- `quotations`: `id`, `tenant_id`, `branch_id` → `tenant_branches`, `customer_id` → `customers` (NOT NULL), `code` (UNIQUE `tenant_id, code`), `status` CHECK (`DRAFT`,`SENT`,`APPROVED`,`REJECTED`,`CONVERTED`), `issue_date`, `validity_days`, `valid_until` (CHECK `valid_until >= issue_date`), `subtotal`, `discount_total`, `tax_total`, `total` (numeric(14,2) ≥ 0), `commercial_terms`, `payment_delivery_terms`, `warranty_terms`, `notes`, `pricing_calculated_at`, `sent_at`, `approved_at`, `approved_by_user_id`, `rejected_at`, `rejection_reason`, `converted_order_id` → `orders` (UNIQUE), `converted_at`, `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`. CHECK: `CONVERTED ⇔ converted_order_id IS NOT NULL`.
- `quotation_items`: `id`, `tenant_id`, `quotation_id` (ON DELETE CASCADE), `line_number`, `product_id` → `products` (NOT NULL), `product_name`, `product_code`, `unit_code` (copia para el PDF), `quantity` numeric(14,3) > 0, `base_unit_price`, `final_unit_price`, `discount_amount`, `discount_percent`, `discount_total`, `applied_promotion_id`, `applied_promotion_name`, `tax_id`, `tax_rate`, `tax_base`, `tax_amount`, `line_total`, `pricing_snapshot` jsonb NOT NULL. Sin columna de texto libre: toda línea es un producto.
- `quotation_sequences (tenant_id PK, last_value bigint)`: consecutivo con `INSERT … ON CONFLICT DO UPDATE SET last_value = last_value + 1 RETURNING` dentro de la transacción de creación (sin huecos por concurrencia).
- `quotation_settings (tenant_id PK, default_validity_days int CHECK 1..365 DEFAULT 15, updated_by_user_id, updated_at)`. Sin fila ⇒ 15. Se usa tabla propia en lugar de `parameters` porque estos solo admiten `MODE`/`BOOLEAN` y ampliarlos afecta la configuración general.
- `orders.quotation_id uuid NULL` → `quotations`, índice único parcial `WHERE quotation_id IS NOT NULL`.
- Índices: `(tenant_id, status, issue_date DESC)`, `(tenant_id, customer_id)`, `(tenant_id, valid_until)`; `quotation_items (quotation_id, line_number)`.
- Menú `QUOTATIONS` (`/{tenant}/quotations`, ícono `file-text`, orden 145, junto a Pedidos) para todos los tenants y permisos: `USER` WRITE con `QUOTATIONS_VIEW/CREATE/UPDATE`; `ADMIN`, `SUPER_USER`, `SUPER_ADMIN` WRITE con además `QUOTATIONS_APPROVE`, `QUOTATIONS_CONVERT`, `QUOTATIONS_SETTINGS`. Upsert idempotente como V070.
- Rollback: se niega si existen cotizaciones o pedidos con `quotation_id`.

### D2. Estados y vigencia
| Desde | Acción | Hacia | Regla |
|---|---|---|---|
| — | crear | DRAFT | cliente activo, ≥ 1 línea |
| DRAFT/SENT | editar | igual | recalcula precios |
| DRAFT | enviar | SENT | marca `sent_at` |
| DRAFT/SENT | aprobar | APPROVED | vigente; congela precios |
| DRAFT/SENT/APPROVED | rechazar | REJECTED | motivo obligatorio |
| APPROVED | convertir | CONVERTED | vigente, sin pedido previo |
| DRAFT/SENT/APPROVED vencida | renovar | DRAFT | recalcula precios, `issue_date = hoy`, nueva vigencia |
| cualquiera | duplicar | nueva DRAFT | precios recalculados, vigencia por defecto |

`EXPIRED` no se persiste: estado efectivo = `EXPIRED` cuando `status IN (DRAFT, SENT, APPROVED)` y `valid_until < fecha actual en America/Bogota`. Se calcula en SQL (`effective_status`) para listar y filtrar, y se revalida en el servidor antes de aprobar o convertir. Así no se necesita un proceso programado.

### D3. Precios
- Al crear/editar/renovar/duplicar: cada línea se valoriza en el servidor con `PricingService.calculateLinePrice` (canal `ORDER`, cliente y sucursal de la cotización). El valor enviado por la web es solo una previsualización (`POST /pricing/preview-line`).
- `pricing_snapshot` usa la misma estructura que en `order_items` (`result.taxes` incluido) con `channel: "QUOTATION"` y `quotationId`, para que `extractSnapshotTaxes` funcione sin cambios al convertir.
- Al aprobar no se recalcula: los precios quedan congelados.
- Cantidades: misma política que POS/compras (`allows_decimal_quantity`; productos por peso admiten decimales). Validación en el servicio de cotizaciones.

### D4. Conversión a pedido
1. `BEGIN`; `SELECT … FROM quotations WHERE id = $1 AND tenant_id = $2 FOR UPDATE`.
2. Valida: `APPROVED`, vigente, `converted_order_id IS NULL`, cliente activo, productos activos del tenant, sucursal dentro del alcance del actor.
3. `OrderService.createOrderFromPricedItems(client, input)` — **método público nuevo**: reutiliza las validaciones e inserciones de `createOrder` (extraídas a un helper privado compartido) pero recibe las líneas ya valorizadas y usa el `client` de la transacción externa. `createOrder` conserva firma y comportamiento (sus pruebas existentes siguen pasando sin cambios).
4. `UPDATE orders SET quotation_id`; `UPDATE quotations SET status = 'CONVERTED', converted_order_id, converted_at`.
5. `COMMIT`; auditoría `QUOTATION_CONVERTED` y `ORDER_CREATED` (con `quotationId`).
- Tipo de pedido (`CASH`/`CREDIT`) se elige al convertir (por defecto `CASH`). Terminal y sesión de caja salen del contexto como en `createOrder`.
- Doble clic o reintento: el `FOR UPDATE` serializa y el segundo intento recibe 409 con el `orderId` existente.
- El stock no se reserva; la entrega del pedido sigue su flujo actual.

### D5. API (`api/src/modules/quotations`)
Controller → Service → Repository (SQL parametrizado), guardas `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `@RequirePermission({ menuKey: "QUOTATIONS", … })`.
- `GET /quotations` (q, status incl. `EXPIRED`, customerId, branchId, fromDate, toDate, page, limit) con KPIs (total, aprobadas, monto).
- `GET /quotations/:id` (encabezado, líneas, impuestos agrupados por tarifa, pedido enlazado).
- `POST /quotations`, `PUT /quotations/:id`.
- `POST /quotations/:id/send | approve | reject | renew | duplicate | convert-to-order`.
- `GET /quotations/settings`, `PUT /quotations/settings`.
- `GET /orders/:id` y el listado de pedidos exponen `quotationId`/`quotationCode` (solo lectura).

### D6. PDF (`backend-reporteria`)
- `GET /reports/quotations/:id/pdf` (en línea por defecto; `?disposition=attachment` para descargar). Alcance por sucursal con `ReportBranchScopeService`; código en `backend-reporteria/src/modules/quotations/` y plantilla en `pdf/templates/documents/` (con `amount-in-words.ts`). Lectura directa de `quotations`, `quotation_items`, `customers`, `tenants`, `tenants_detalles`.
- Plantilla pdfmake `pdf/templates/documents/quotation.template.ts` que replica la estructura de flexibuild: portada con banda de color primario y franja de acento, logo (o iniciales), título "COTIZACIÓN", badge por estado (borrador ámbar, enviada azul, aprobada verde, rechazada roja, vencida gris, convertida violeta), tarjetas cliente/NIT/fecha/vigencia/sucursal; secciones con título tipo píldora; tabla (#, código, producto, unidad, cantidad, precio, desc., IVA, total) con cabecera en color primario y filas alternas; cuadro económico (subtotal, descuentos, IVA por tarifa) con barra "TOTAL"; total en letras (pesos m/cte); condiciones comerciales, forma de pago/entrega, garantía, observaciones; firma del representante legal; pie institucional (razón social, NIT, dirección, teléfono, correo, web) con "Página x de y".
- Colores: `tenants.config.colors.primary`/`accent` si existen; si no, `#1f3b5b` y `#F2C94C` (valores de flexibuild). Logo: `tenants.config.logo` (data-URI validado como en `thermal-layout`).

### D7. Web
- Rutas `app/[tenant]/quotations/page.tsx`, `new/page.tsx`, `[id]/page.tsx`; código en `web/modules/quotations/{components,services,hooks}`.
- Componentes portados de flexibuild y adaptados: `QuotationForm` (encabezado + grid `2fr / 360px`), `QuotationSummaryCard` (subtotal, descuentos, IVA por tarifa, bloque oscuro "Total"), `QuotationItemsTable` (tabla estilo hoja de cálculo, cabecera `slate-800`, Enter avanza, campo único de búsqueda y escáner: Enter resuelve el código con `resolveInventoryBarcode` o la coincidencia única de `searchInventoryProducts`, sin modificarlos; precio informativo con `POST /pricing/preview-line`), `QuotationTotalsFooter` (fijo y colapsable), `QuotationTextBlocks` (condiciones comerciales, forma de pago y entrega, garantía), `QuotationStatusBadge`, `QuotationSettingsDialog`.
- Lista con KPIs (registros, aprobadas, vencidas, monto), filtros y acciones por fila (`RowActionsMenu`).
- Detalle con acciones según estado y permisos; previsualización PDF con `PdfPreviewModal`; "Convertir a pedido" con confirmación y elección de tipo; enlace al pedido generado.
- Todas las clases con variante `dark:`.
- `MENU_KEYS.QUOTATIONS` en web y API.

## Risks / Trade-offs

- Extraer el helper de `createOrder` toca un servicio crítico → se cubre con las pruebas existentes de `order.service.spec.ts` sin modificarlas y pruebas nuevas del método.
- Precios congelados frente a cambios de impuestos: se aceptan durante la vigencia (decisión del negocio); la renovación recalcula.
- `EXPIRED` calculado depende de la zona horaria: se usa siempre `America/Bogota` en SQL.
- `order.service.ts`, `order.controller.ts` y `web/domains/menu/constants.ts` tienen `current_ownership` de otros changes; este change toma su propiedad en `openspec-scope.json`.

### D8. Envío por correo (mejora post-QA, 2026-11-20)
- `POST /quotations/:id/send-email` `{ to?, message? }`, acción `QUOTATIONS_UPDATE`. Sin `to` usa `customers.email`; el destino se valida (formato, máx. 254). Estados permitidos: `DRAFT`, `SENT`, `APPROVED` vigentes; vencida, rechazada o convertida → 409.
- SMTP: se reutiliza la conexión ya configurada en MANUS (`readAlertsConfig`: `CONTROL_CENTER_SMTP_*`, `CONTROL_CENTER_ALERTS_FROM`) con `nodemailer`, igual que el estado de cuenta del control center; no depende del interruptor `CONTROL_CENTER_ALERTS_EMAIL_ENABLED`. Sin configuración → 422 con las variables faltantes. `Reply-To` = `tenants_detalles.email_corporativo` si es válido. No se modifican archivos del control center (solo se importan).
- PDF: la API lo pide a reportería (`GET {REPORTS_API_BASE_URL}/reports/quotations/:id/pdf`, por defecto `http://localhost:4021/api`) reenviando el `Authorization` del usuario (mismo `JWT_SECRET`), con timeout de 20 s, validación de `application/pdf` y tope de 10 MB. Se mantiene en memoria y se adjunta; no se escribe en disco ni en la base de datos. Así hay una sola plantilla.
- Estado: un `DRAFT` pasa a `SENT` (transacción con `FOR UPDATE`) **antes** de generar el PDF para que el documento muestre "ENVIADA"; si el PDF o el correo fallan se revierte a `DRAFT` solo si `sent_at` sigue siendo el de este intento, y se responde 502 con el error saneado (sin credenciales). Reenviar una `SENT`/`APPROVED` no cambia el estado.
- Auditoría `QUOTATION_EMAIL_SENT` (destino, `messageId`, si cambió el estado) y `QUOTATION_EMAIL_FAILED`. Sin cambios de esquema.
- Web: "Enviar por correo" reemplaza a "Enviar" en el detalle; diálogo con "Correo del cliente" (deshabilitado si no tiene uno válido) u "Otro correo" y mensaje opcional. La cotización nueva tiene "Volver" y "Cancelar" con confirmación si hay datos.
### D9. Captura con lector en cotizaciones (mejora post-QA, 2026-11-20)
- Se reutiliza la captura de Pedidos/Compras (HU-SCAN-001): `useInventoryBarcodeCapture` + `InventoryScanBar` + `inventory-scan-feedback` (mensajes y sonidos), sin modificarlos.
- Después de cada lectura el foco permanece en la barra; las cantidades ya no reciben el foco automáticamente. Escanear un producto ya agregado suma 1, también en productos con decimales o por peso (decisión del propietario: sin diálogo de peso en cotizaciones). Rebotes del lector dentro de 300 ms cuentan una vez.
- `fieldScanScope` = la sección de productos: si el lector escribe en una cantidad, la cantidad recupera su valor y la lectura se procesa como escaneo. Enter en una cantidad editada a mano vuelve a la barra; F2 también.
- La captura se libera mientras el foco está en el bloque de cliente/sucursal/observaciones (el buscador de clientes es un control compuesto), igual que Pedidos.
