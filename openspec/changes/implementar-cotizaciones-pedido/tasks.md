## 1. Gobernanza

- [x] 1.1 Change `implementar-cotizaciones-pedido` (`.openspec.yaml`, proposal, design, tasks, spec `cotizaciones`).
- [x] 1.2 Entrada en `scripts/governance/openspec-scope.json` y traspaso de `current_ownership` de `order.service.ts`, `order.service.spec.ts`, `order.controller.ts`, `order.controller.spec.ts` y `web/domains/menu/constants.ts`.
- [x] 1.3 `openspec.cmd validate implementar-cotizaciones-pedido --strict` (válido, Windows, 2026-11-20).

## 2. Base de datos

- [x] 2.1 V120 (`quotations`, `quotation_items`, `quotation_sequences`, `quotation_settings`, `orders.quotation_id`, menú `QUOTATIONS` y permisos) + rollback protegido.
- [x] 2.2 Pruebas estáticas y funcionales de V120 (PostgreSQL 16).
- [x] 2.3 Aplicar V120 en local (`Claude outputs/aplicar-V120-local.cjs`). QA/PRD: runner oficial en el despliegue.

## 3. API

- [x] 3.1 `MENU_KEYS.QUOTATIONS` y acciones.
- [x] 3.2 Política de estados y vigencia (`quotation.policy.ts`) + pruebas.
- [x] 3.3 Repositorio (consecutivo, CRUD, `effective_status`, filtros, KPIs, settings).
- [x] 3.4 Servicio: crear/editar con valorización `ORDER`, enviar, aprobar, rechazar, renovar, duplicar, settings + pruebas.
- [x] 3.5 `OrderService.createOrderFromPricedItems` (helper compartido con `createOrder`) + pruebas; `createOrder` sin cambios de comportamiento.
- [x] 3.6 Conversión a pedido transaccional + pruebas (vencida, ya convertida, concurrencia, cliente inactivo).
- [x] 3.7 Controller y registro del módulo; `quotationId`/`quotationCode` en lectura de pedidos.

## 4. Reportería

- [x] 4.1 Servicio de datos y endpoint `GET /reports/quotations/:id/pdf`.
- [x] 4.2 Plantilla pdfmake con la identidad visual + pruebas (estructura, total en letras, colores del tenant, paginación).

## 5. Web

- [x] 5.1 Servicio API y tipos (`web/modules/quotations/services`).
- [x] 5.2 Componentes portados: formulario, resumen, tabla de líneas con búsqueda/escáner, totales, bloques de texto, badge, settings.
- [x] 5.3 Páginas lista, nueva y detalle con acciones por estado/permiso, PDF y conversión.
- [x] 5.4 Enlace al pedido generado desde la cotización (la API de pedidos ya devuelve `quotationId`/`quotationCode`).
- [x] 5.5 Fuera de alcance por decisión de cierre (queda propuesto para otro change): mostrar el código de cotización de origen en la tabla de pedidos (`web/app/[tenant]/orders/page.tsx`, hoy de `mejorar-flujo-pedidos-facturacion`).

## 6. Validación

- [x] 6.1 Suite API (`npx tsx --test src/**/*.spec.ts`) + build; tests y build de reportería; lint + build web.
- [x] 6.2 QA manual: crear → enviar → aprobar → PDF → convertir → entregar pedido; vencida → renovar; rechazar; duplicar; permisos USER/ADMIN.
- [x] 6.3 Evidencia `docs/evidencia-implementar-cotizaciones-pedido.md`.

## 7. Mejoras post-QA (2026-11-20)

- [x] 7.1 Botones Volver y Cancelar en `/quotations/new` con confirmación si hay datos sin guardar.
- [x] 7.2 API `POST /quotations/:id/send-email`: SMTP existente, PDF de reportería en memoria (sin almacenar), borrador → `SENT` con reversión si falla, auditoría + pruebas (`quotation-mail.spec.ts`, 5 casos nuevos en `quotation.service.spec.ts`).
- [x] 7.3 Web: "Enviar por correo" con destinatario del cliente u otro correo y mensaje opcional.
- [x] 7.4 QA del envío (correo real con adjunto; cliente sin correo; otro correo; SMTP sin configurar; falla de reportería).
- [x] 7.5 Captura con lector igual a Pedidos/Compras (`useInventoryBarcodeCapture` + `InventoryScanBar`, sin modificarlos): el foco vuelve a la barra tras cada lectura; escanear un producto ya agregado suma 1 (también con decimales o por peso); una lectura que cae en una cantidad se procesa como escaneo sin cambiarla; Enter en la cantidad vuelve a la barra; F2 enfoca la barra. Pruebas `quotation-lines.spec.ts`.
- [x] 7.6 QA de la captura con lector (doble escaneo = 2, lectura con foco en cantidad, Enter en cantidad, código ambiguo/inexistente).
