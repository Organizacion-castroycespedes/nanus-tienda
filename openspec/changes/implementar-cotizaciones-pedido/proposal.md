## Why

Las tiendas necesitan entregar al cliente una propuesta formal (precios, impuestos, condiciones y vigencia) antes de comprometer un pedido. Hoy manus solo permite crear el pedido directamente: no hay documento previo que el cliente apruebe, no se congela el precio ofrecido y no queda trazabilidad entre lo cotizado y lo pedido. flexibuild-core ya resolvió el flujo de cotizaciones (con identidad visual en pantalla y PDF), pero para obras: actividades con detalle libre y AIU. Se requiere el mismo flujo adaptado a los productos del catálogo de manus y que termine en un pedido.

## What Changes

- Nuevo módulo **Cotizaciones** (`QUOTATIONS`): cotización por tenant y sucursal con cliente registrado obligatorio, líneas solo de productos del catálogo (sin texto libre), valorizadas con el motor de precios (canal `ORDER`) con IVA por producto y promociones, consecutivo `COT-000001` por tenant, fecha de emisión y vigencia.
- Estados `DRAFT → SENT → APPROVED | REJECTED → CONVERTED`; `EXPIRED` se calcula cuando vence la vigencia. Se edita solo en `DRAFT`/`SENT`; al aprobar se congelan los precios.
- **Convertir a pedido**: una cotización `APPROVED` y vigente genera un único pedido `DRAFT` con los **precios cotizados** (sin recalcular), en una sola transacción, y queda enlazada (`orders.quotation_id`). Una cotización vencida no se convierte; se puede **renovar** (recalcula precios con el motor y abre una nueva vigencia).
- **Vigencia**: 15 días por defecto, configurable por tenant (`quotation_settings`).
- Acciones adicionales: aprobar, rechazar (con motivo), duplicar.
- **Envío por correo**: la cotización se envía al correo del cliente o a otro correo que confirma el usuario, con el PDF adjunto y un mensaje opcional. Reutiliza la conexión SMTP de MANUS (`CONTROL_CENTER_SMTP_*`, `CONTROL_CENTER_ALERTS_FROM`) y el PDF de reportería (`REPORTS_API_BASE_URL`); el PDF se genera en memoria y no se guarda en el servidor. Un borrador pasa a `SENT`.
- Botones Volver y Cancelar en la cotización nueva (con confirmación si hay datos sin guardar).
- **PDF** de la cotización en `backend-reporteria` (pdfmake) con la identidad visual de flexibuild (portada con banda de color, logo, badge de estado, tarjetas de datos, secciones tipo píldora, tabla de detalle, cuadro económico, total en letras, firma del representante legal y pie institucional paginado), usando el logo/colores del tenant y `tenants_detalles`.
- **Web** `/{tenant}/quotations` (lista, nueva, detalle) con el layout de flexibuild adaptado a productos: formulario + resumen financiero fijo, tabla estilo hoja de cálculo con búsqueda/escáner de productos, totales fijos, bloques de texto de la oferta, modo oscuro.
- V120: tablas `quotations`, `quotation_items`, `quotation_sequences`, `quotation_settings`, columna `orders.quotation_id`, menú `QUOTATIONS` y permisos por rol. Rollback protegido.

## Impact

- API: nuevo `api/src/modules/quotations`; `OrderService` gana un método público para crear un pedido desde líneas ya valorizadas dentro de una transacción externa. `createOrder`, `deliverOrder`, FEFO, `consumeDeliveryLots` e `inventory_create_sale_v2` no cambian (regla del propietario).
- Reportería: plantilla y endpoint PDF nuevos.
- Web: rutas y módulo nuevos; clave de menú `QUOTATIONS`.
- BD: migración V120 (local con script Node; QA/PRD con el runner oficial).
- Fuera de alcance: líneas de texto libre o servicios no catalogados, descuentos manuales por línea, AIU, reserva de stock, conversión parcial o a varios pedidos, envío por WhatsApp, copia (CC) o varios destinatarios, historial de correos fuera de la auditoría, versionado de cotizaciones, firma electrónica del cliente, cotización desde el POS.
