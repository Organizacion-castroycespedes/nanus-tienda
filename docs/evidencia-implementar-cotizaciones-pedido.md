# Evidencia — implementar-cotizaciones-pedido

Rama: `feature/develop/implementar-cotizaciones-pedido` (base `develop` @ `16e6e29c`), sin commit.
Discovery y decisiones: proyecto "manus tienda" → `claude/cotizaciones-pedido-discovery.md`, `claude/cotizaciones-pedido-decisiones-y-estado.md`.
Referencia visual: flexibuild-core (`web/components/obras/Quotation*`, `backend-documental/src/modules/quotation-pdf/quotation-pdf.renderer.ts`).

## Decisiones del propietario (2026-11-19)
1. Al convertir se respeta el precio cotizado mientras la cotización esté vigente.
2. Solo productos del catálogo (sin líneas de texto libre).
3. Cliente registrado obligatorio desde la creación.
4. Una cotización → un solo pedido.
5. Vigencia de 15 días por defecto, configurable por tenant.

## Fase 1 — Gobernanza
- Change `openspec/changes/implementar-cotizaciones-pedido/` (`.openspec.yaml`, proposal, design, tasks, spec `cotizaciones` con 8 requisitos).
- `scripts/governance/openspec-scope.json`: entrada del change y `current_ownership` de los archivos compartidos que se modifican (`order.service(.spec).ts`, `order.controller(.spec).ts`, `api/src/modules/app.module.ts`, `api/src/common/constants/menu-keys.ts`, `web/domains/menu/constants.ts`, V120 y sus pruebas, el propio manifiesto).
- Diagnóstico `openspec_governance_diagnostic.py --enforcement-mode STRICT` en la VM: manifiesto válido, migración CLEAN, todos los archivos asociados solo a este change; el único bloqueo fue `OPENSPEC_TOOL_UNAVAILABLE` (sin CLI en la VM).

## Fase 2 — Base de datos (V120)
- `scripts/database/migrations/V120__quotations.sql`:
  - `quotations` (cliente obligatorio, estados `DRAFT/SENT/APPROVED/REJECTED/CONVERTED`, vigencia, totales, textos, trazabilidad de envío/aprobación/rechazo/conversión; CHECK `CONVERTED ⇔ converted_order_id`, motivo obligatorio al rechazar);
  - `quotation_items` (solo `product_id`, cantidad > 0, snapshot de precio e impuestos);
  - `quotation_sequences` + `fnc_quotation_next_code` (`COT-000001` por tenant);
  - `quotation_settings` (vigencia 1–365, por defecto 15);
  - `fnc_quotation_effective_status` (`EXPIRED` calculado con la fecha de America/Bogota);
  - `orders.quotation_id` con índice único parcial;
  - menú `QUOTATIONS` y permisos por rol (USER ver/crear/editar; ADMIN, SUPER_USER, SUPER_ADMIN todo).
  - No modifica `inventory_create_sale_v2`, `sales`, `sale_items`, `stock_movements` ni `order_items`.
- Rollback `scripts/database/rollbacks/V120__quotations_rollback.sql`: falla si hay cotizaciones o pedidos con `quotation_id`.
- Pruebas: `tests/test_v120_quotations_migration.py`, `tests/v120_quotations_scenarios.sql`, `tests/fixtures/v120_minimal_schema.sql`.

### Validación (Cowork, 2026-11-19, PostgreSQL 16 desechable)
- 7/7 con `MANUS_SQL_SCRATCH_PG`: aplicar en una transacción → rechazo de reaplicación (`QUOTATIONS_V120_ALREADY_APPLIED`) → rollback bloqueado con datos → rollback limpio → volver a aplicar. Escenarios: menú y permisos (incluido un menú borrado que se recrea), consecutivo por tenant, estado efectivo (el último día sigue vigente), restricciones de cliente, vigencia, líneas, rechazo, conversión y un solo pedido por cotización. Se saboteó un escenario para confirmar que las pruebas detectan fallas.
- Local: `Claude outputs/aplicar-V120-local.cjs` (pendiente de ejecutar en Windows). QA/PRD: runner oficial antes de desplegar la API.

## Fase 3 — API
- `api/src/modules/quotations/` (`quotation.policy.ts`, `quotation.repository.ts`, `quotation.service.ts`, `quotation.controller.ts`, `quotations.module.ts`), registrado en `app.module.ts`; `MENU_KEYS.QUOTATIONS`.
- Rutas `/api/quotations`: listar (filtros y KPIs), detalle, crear, editar, `send`, `approve`, `reject`, `renew`, `duplicate`, `convert-to-order`, `settings` (GET/PUT).
- Precio siempre calculado en el servidor con `PricingService.calculateLinePrice` (canal `ORDER`); se congela al aprobar.
- Conversión: transacción con `FOR UPDATE` + `OrderService.createOrderFromPricedItems` (método nuevo; `createOrder` reorganizado con un helper compartido sin cambio de comportamiento). Auditoría `ORDER_CREATED` (con `branchId` y `quotationId`) y `QUOTATION_CONVERTED` después del COMMIT.
- Pedidos: `GET /orders` y `GET /orders/:id` devuelven `quotationId` y `quotationCode`.

### Validación
- Usuario, Windows, 2026-11-20: `npx tsx --test src/**/*.spec.ts` → 1292 pruebas, **1284 aprobadas, 0 fallas**, 8 omitidas (integración de alta de tenant sin `TENANT_BOOTSTRAP_TEST_DATABASE_URL`). `npm run build` OK.
- Pruebas nuevas: `quotation.policy.spec.ts` (8), `quotation.service.spec.ts` (13), `order.service.priced-items.spec.ts` (3). Regresión de pedidos (`order.service.spec.ts`, `order.controller.spec.ts`) sin cambios y en verde.

## Fase 4 — PDF (reportería)
- `GET /reports/quotations/:quotationId/pdf` (en línea; `?disposition=attachment` descarga), `JwtAuthGuard` + `ReportAuthzGuard`, alcance por sucursal con `ReportBranchScopeService`.
- `backend-reporteria/src/modules/quotations/` y `src/modules/pdf/templates/documents/` (`quotation.template.ts`, `amount-in-words.ts`).
- Identidad visual de flexibuild con logo y colores del tenant (fallback `#1f3b5b` / `#F2C94C`); total en letras en pesos m/cte.
- Ejemplos: `Claude outputs/cotizacion-ejemplo-colores-tenant.pdf` y `cotizacion-ejemplo-colores-defecto.pdf` (revisados visualmente).

### Validación
- Usuario, Windows, 2026-11-20: suite completa 176/177; la única falla (`thermal-layout.spec.ts`, "POS ticket preserves full totals") es **preexistente** y no es de este change: el ticket POS formatea COP sin `minimumFractionDigits` y el ICU reciente de Node ya no agrega decimales (reproducido en Node 22 / ICU 78.3). Las 15 pruebas nuevas pasan. `npm run build` OK.

## Fase 5 — Web
- `web/app/[tenant]/quotations/` (lista, `new`, `[id]`) y `web/modules/quotations/` (tipos, servicio, permisos, formato, hooks de precio y permisos, componentes portados de flexibuild).
- Lista con filtros, KPIs y vigencia restante; formulario con cliente, sucursal, resumen fijo, bloques de texto, tabla estilo hoja de cálculo con búsqueda/escáner y totales fijos; detalle con acciones por estado y permisos, vista previa del PDF y conversión a pedido; modo oscuro.

### Validación
- Usuario, Windows, 2026-11-20: `npm run lint` sin advertencias ni errores; `npm run build` OK (rutas `/[tenant]/quotations`, `/[tenant]/quotations/new`, `/[tenant]/quotations/[id]`).
- `quotation-permissions.spec.ts` 6/6 (VM).

## Fase 6 — QA manual (usuario, Windows, 2026-11-20: PASS)
Prerrequisitos: `openspec.cmd validate implementar-cotizaciones-pedido --strict` y V120 aplicada en local antes de levantar la API.

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| QA-01 | El menú "Cotizaciones" aparece para USER y ADMIN | Visible junto a Pedidos | PASS |
| QA-02 | Crear cotización con cliente y 2 productos (uno con decimales permitidos) | Guarda `COT-000001`, DRAFT, vigencia +15 días | PASS |
| QA-03 | Cantidad decimal en producto que no la permite | Rechazo con mensaje | PASS |
| QA-04 | Escanear código de barras en el campo de productos | Agrega el producto; repetir suma 1 | PASS |
| QA-05 | Editar en DRAFT y guardar | Precios recalculados por el servidor | PASS |
| QA-06 | Enviar y aprobar (ADMIN) | Estado APROBADA, formulario en solo lectura | PASS |
| QA-07 | USER intenta aprobar / convertir | Botones ocultos; API responde 403 | PASS |
| QA-08 | Vista previa y descarga del PDF | Identidad visual, logo/colores del tenant, total en letras | PASS |
| QA-09 | Cambiar el precio del producto y convertir a pedido | Pedido DRAFT con el precio cotizado; cotización CONVERTIDA | PASS |
| QA-10 | Convertir dos veces (doble clic / otra pestaña) | Un solo pedido; la segunda responde conflicto | PASS |
| QA-11 | Entregar y facturar el pedido generado | Flujo de pedidos sin cambios | PASS |
| QA-12 | Cotización vencida (ajustar `valid_until` en la BD local) | Estado VENCIDA, no convierte; Renovar recalcula y vuelve a DRAFT | PASS |
| QA-13 | Rechazar con motivo | Estado RECHAZADA y motivo visible | PASS |
| QA-14 | Duplicar | Nueva cotización DRAFT con precios actuales | PASS |
| QA-15 | Cambiar la vigencia por defecto (ADMIN) | Aplica a cotizaciones nuevas; no cambia las existentes | PASS |
| QA-16 | Modo oscuro en lista, formulario y detalle | Legible y consistente | PASS |

## Fase 7 — Mejoras post-QA (2026-11-20)
Solicitadas por el propietario después del QA:
1. `/quotations/new`: botones **Volver** (encabezado) y **Cancelar** (junto a Guardar); si hay datos sin guardar pide confirmación ("Descartar cotización").
2. **Envío por correo** con el PDF adjunto:
   - API `POST /api/quotations/:id/send-email` `{ to?, message? }` (acción `QUOTATIONS_UPDATE`). Destino: correo del cliente o el que confirme el usuario.
   - SMTP: la conexión que MANUS ya usa (`CONTROL_CENTER_SMTP_*`, `CONTROL_CENTER_ALERTS_FROM`, `nodemailer`), sin depender de `CONTROL_CENTER_ALERTS_EMAIL_ENABLED`; `Reply-To` = correo corporativo del tenant.
   - PDF: la API lo pide a reportería (`REPORTS_API_BASE_URL`, ya presente en `docker-compose.yml` y `.env.example`; por defecto `http://localhost:4021/api`) con el token del usuario y lo adjunta desde memoria. **No se guarda en disco ni en la base de datos.**
   - Un borrador pasa a ENVIADA antes de generar el PDF (el documento muestra "ENVIADA") y vuelve a borrador si el PDF o el correo fallan; el error se devuelve saneado. Auditoría `QUOTATION_EMAIL_SENT` / `QUOTATION_EMAIL_FAILED`. Sin cambios de esquema.
   - Web: "Enviar por correo" reemplaza a "Enviar"; diálogo con "Correo del cliente" u "Otro correo" y mensaje opcional.

### Validación (VM)
- API: `tsc --noEmit` limpio; `quotation.policy.spec.ts` 8, `quotation.service.spec.ts` 18 (5 nuevas del correo: envío al cliente con paso a ENVIADA y adjunto en memoria, otro correo y reenvío sin cambio de estado, validaciones y SMTP sin configurar, reversión ante falla de correo y de PDF sin filtrar credenciales, rechazada no se envía), `quotation-mail.spec.ts` 4 → **30/30**.
- Web: `tsc` estricto y `eslint` limpios; `quotation-permissions.spec.ts` 6/6.

### QA del envío (usuario, 2026-11-20: PASS)

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| QA-17 | Volver/Cancelar en una cotización nueva con y sin datos | Con datos pide confirmación; sin datos vuelve a la lista | PASS |
| QA-18 | Enviar un borrador al correo del cliente | Llega el correo con `cotizacion-COT-xxxxxx.pdf` (estado ENVIADA en el PDF); la cotización queda ENVIADA | PASS |
| QA-19 | Enviar a otro correo con mensaje | Llega al otro correo con el mensaje; el cliente no cambia | PASS |
| QA-20 | Cliente sin correo | Opción del cliente deshabilitada; exige otro correo | PASS |
| QA-21 | SMTP sin configurar / reportería detenida | Error claro; la cotización sigue en borrador | PASS |
| QA-22 | Reenviar una aprobada | Se envía; sigue APROBADA | PASS |
| QA-23 | En el servidor no quedan PDF | Sin archivos nuevos en el servidor de la API ni de reportería | PASS |

## Fase 8 — Captura con lector (mejora post-QA, 2026-11-20)
- Problema reportado: tras el primer escaneo el foco pasaba a la cantidad y el siguiente escaneo escribía el código de barras dentro de ella; no se podía cotizar 2 unidades escaneando dos veces.
- Solución: `QuotationItemsTable` usa la captura de Pedidos/Compras (`useInventoryBarcodeCapture` + `InventoryScanBar`, sin modificarlos). El foco vuelve a la barra después de cada lectura; escanear un producto ya agregado suma 1 (también con decimales o por peso); una lectura con el foco en una cantidad se procesa como escaneo y la cantidad no cambia; Enter en una cantidad vuelve a la barra; F2 enfoca la barra; avisos y sonidos de lectura agregada, código inexistente, ambiguo o repetido. La lógica de "agregar o sumar 1" quedó en `web/modules/quotations/quotation-lines.ts`.
- Validación (VM): `tsc` estricto y `eslint` limpios; `quotation-lines.spec.ts` 3/3 y `quotation-permissions.spec.ts` 6/6.
- QA del usuario (2026-11-20): PASS.

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| QA-24 | Escanear el mismo producto dos veces | Una línea con cantidad 2; el foco sigue en la barra | PASS |
| QA-25 | Escanear con el foco en una cantidad | La cantidad no cambia; el producto escaneado se agrega o suma 1 | PASS |
| QA-26 | Editar una cantidad a mano y presionar Enter | Queda la cantidad digitada y el foco vuelve a la barra | PASS |
| QA-27 | Producto con decimales (cable por metro) escaneado dos veces | Cantidad 2; se puede ajustar a 10,85 a mano | PASS |
| QA-28 | Código inexistente / ambiguo | Aviso de error / lista para elegir | PASS |
| QA-29 | Buscar cliente mientras se usa el lector | El buscador de clientes no pierde el foco | PASS |

## Pendientes fuera de este change
- Opcional (tarea 5.5): mostrar `quotationCode` en la tabla de pedidos (página de otro change).
- Change aparte para el ticket POS (`thermal-layout.spec.ts`): decidir si muestra siempre centavos o actualizar la prueba.

## Cierre (2026-11-20)
- QA manual del propietario: **PASS** en QA-01 a QA-29 (flujo completo, PDF, conversión, vencida/renovar, permisos, envío por correo y captura con lector).
- Validación automática en Windows: API 1284/1292 sin fallas (8 omitidas por BD de integración) + build; reportería build (única falla de su suite, preexistente: `thermal-layout.spec.ts`); web lint + build.
- Pendiente antes del merge: `openspec.cmd validate implementar-cotizaciones-pedido --strict` y CI de gobernanza en el PR.
- Despliegue QA/PRD: aplicar V120 con `apply_single_migration.sh` **antes** de la API; la API necesita `CONTROL_CENTER_SMTP_*` + `CONTROL_CENTER_ALERTS_FROM` y alcanzar reportería por `REPORTS_API_BASE_URL`.
