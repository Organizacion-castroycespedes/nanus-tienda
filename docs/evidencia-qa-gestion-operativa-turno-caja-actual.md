# Evidencia QA - Gestion operativa de turno caja actual

Fecha: 2026-06-15

Rama: `feat/develop/mejoras-funcionales-operativas`

Change OpenSpec: `gestion-operativa-turno-caja-actual`

Ambiente: local, sin produccion, sin deploy, sin commit.

## Diagnostico tecnico

- `cash_sessions` identifica caja abierta por tenant, sucursal, caja registradora y usuario.
- `cash_movements` tiene `cash_session_id` directo.
- `payments` tiene `cash_session_id`; ventas POS, pedidos y compras se asocian al turno cuando existe pago o asignacion de pago vinculada a la caja.
- `cash_counts` tiene `cash_session_id`.
- Pedidos y compras no tienen una columna directa `cash_session_id`; no se infiere por fecha/sucursal para evitar mezclar datos no garantizados.
- Tickets existentes reutilizados: venta POS, pedido, compra, arqueo y cierre de caja.
- Ticket de cierre no aplica a caja abierta actual; aparece desde cierres existentes.

## Implementacion validada tecnicamente

- Endpoint agregado: `GET /api/reports/current-shift`.
- Vista agregada: `/{tenantId}/finance/current-shift`.
- Acceso agregado en navegacion interna de finanzas y en accesos rapidos de Finanzas.
- Pestanas disponibles:
  - Ventas.
  - Pedidos.
  - Compras.
  - Movimientos.
  - Arqueo.
  - Tickets.
- Estado sin caja abierta muestra CTA hacia `/{tenantId}/pos/select-context`.
- Acciones de ticket:
  - Ver.
  - Descargar PDF.
  - Imprimir.

## QA manual por rol

Estado: NO EJECUTADO en navegador autenticado durante esta pasada.

Causa: esta pasada implemento el modulo y ejecuto validaciones tecnicas. No se conto con una sesion manual autenticada por rol en navegador dentro del turno actual.

### USER

Estado: NO EJECUTADO.

Pendiente:
- Abrir caja.
- Hacer venta POS.
- Revisar pestanas de Gestion del turno.
- Ver/descargar/imprimir ticket disponible.
- Cerrar caja.

### ADMIN

Estado: NO EJECUTADO.

Pendiente:
- Abrir caja.
- Crear compra o pedido con pago asociado si el flujo local lo permite.
- Revisar pestanas de Gestion del turno.
- Validar tickets.

### SUPER_USER

Estado: NO EJECUTADO.

Pendiente:
- Seleccionar contexto.
- Abrir caja autorizada.
- Validar que no se mezclan datos de otro tenant.

### SUPER_ADMIN

Estado: NO EJECUTADO.

Pendiente:
- Validar segun usuario local disponible y alcance actual.

## Validaciones tecnicas

Ejecutado:

- `npx.cmd tsx --test src/modules/reports/current-shift-reports.service.spec.ts src/modules/reports/current-shift-reports.controller.spec.ts`
  - Resultado: PASS, 8 tests.
- `npm.cmd run build` en `backend-reporteria`
  - Resultado: PASS.
- `npm.cmd run lint` en `web`
  - Resultado: PASS con warnings existentes.
- `npm.cmd run build` en `web`
  - Resultado: PASS con warnings existentes.
- `openspec.cmd validate gestion-operativa-turno-caja-actual --type change --strict`
  - Resultado: PASS.
- `openspec.cmd validate --all --strict`
  - Resultado: PASS, 15 items.
- `git diff --check`
  - Resultado: PASS con warnings LF/CRLF.
- Revision de secretos:
  - Resultado: sin JWT/cookies reales; solo placeholders sanitizados y JWT sintetico de test unitario.
- `openspec.cmd validate gestion-operativa-turno-caja-actual --type change --strict`
  - Resultado: PASS.
- `openspec.cmd validate --all --strict`
  - Resultado: PASS, 15 items.
- `git diff --check`
  - Resultado: PASS con warnings LF/CRLF.
- Revision de secretos en evidencia y cambios:
  - Resultado: sin JWT, cookies ni credenciales reales; solo placeholders sanitizados.
- `openspec.cmd validate gestion-operativa-turno-caja-actual --type change --strict`.
  - Resultado: PASS.
- `openspec.cmd validate --all --strict`.
  - Resultado: PASS, 15 items.
- `git diff --check`.
  - Resultado: PASS con warnings LF/CRLF.
- `git status --short`.
  - Resultado: ejecutado, cambios locales sin staging.

Pendiente:

- QA manual por rol en navegador local.

## Riesgos y limites

- Pedidos y compras sin pago asociado a `cash_session_id` no aparecen en la gestion del turno.
- Arqueo puede estar vacio mientras la caja sigue abierta.
- Impresion depende del navegador; si bloquea popup, el usuario puede usar Ver ticket.

## Fix rapido tickets POS y compra SUPER_USER

Fecha: 2026-06-15

Estado: PASS tecnico, QA manual real pendiente.

### Causa raiz BUG 1

`GET /api/reports/pos-sales/:saleId/ticket` quedaba con roles por defecto de `ReportAuthzGuard`.

El default permite `SUPER_ADMIN`, `SUPER_USER` y `ADMIN`, pero no `USER`. Por eso el guard devolvia:

```json
{
  "message": "Report role is not authorized",
  "error": "Forbidden",
  "statusCode": 403
}
```

El bloqueo ocurria antes de llegar al servicio y antes del scope SQL `report_pos_sale_ticket`.

### Causa raiz BUG 2

`PurchaseForm` solo usaba la terminal activa del estado POS (`state.pos.terminalId`).

Para `SUPER_USER`, cuando seleccionaba una sucursal distinta a la sucursal del contexto POS actual, el formulario no cargaba terminales autorizadas de esa sucursal ni permitia seleccionar una terminal valida. La validacion local terminaba en:

`No hay terminal activa para registrar la compra.`

### Cambios realizados

- Ticket POS:
  - Se agrego `@ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")` solo en `GET /api/reports/pos-sales/:saleId/ticket`.
  - Se agrego chequeo `saleExists` para responder `403 Forbidden` cuando la venta existe pero queda fuera del scope autorizado.
  - Se mantiene el scope SQL real por tenant/sucursal/usuario.

- Compra SUPER_USER:
  - `PurchaseForm` carga `/api/auth/context`.
  - Filtra terminales por tenant y sucursal seleccionada.
  - Si hay terminales, autoasigna la primera o muestra selector cuando hay varias.
  - Si no hay terminal resoluble, muestra mensaje operativo y CTA a `/pos/select-context`.
  - El payload de `POST /api/purchases` envia `terminalId` valido cuando se resuelve.

### Curl sanitizado

```bash
curl 'http://localhost:4021/api/reports/pos-sales/<POS_SALE_ID>/ticket' \
  -H 'authorization: Bearer <JWT_USER>' \
  -H 'x-pos-session-id: <POS_SESSION_ID>'
```

### Resultado tecnico

- Tests ticket POS/current-shift:
  - `npx.cmd tsx --test src/modules/reports/sales-reports.service.spec.ts src/modules/reports/sales-reports.controller.spec.ts src/modules/reports/current-shift-reports.service.spec.ts src/modules/reports/current-shift-reports.controller.spec.ts`
  - Resultado: PASS, 15 tests.
- `npm.cmd run build` en `backend-reporteria`
  - Resultado: PASS.
- `npm.cmd run lint` en `web`
  - Resultado: PASS con warnings existentes.
- `npm.cmd run build` en `web`
  - Resultado: PASS con warnings existentes.

### QA enfocado por rol

USER:
- Estado: NO EJECUTADO en navegador durante esta pasada.
- Pendiente: ver/descargar/imprimir ticket POS desde Gestion del turno.

ADMIN:
- Estado: NO EJECUTADO en navegador durante esta pasada.
- Pendiente: ver/descargar/imprimir ticket POS autorizado.

SUPER_USER:
- Estado: NO EJECUTADO en navegador durante esta pasada.
- Pendiente: crear compra desde `/{tenantId}/purchases?action=create` con sucursal del tenant.

SUPER_ADMIN:
- Estado: NO EJECUTADO en navegador durante esta pasada.
- Pendiente: validar segun usuario local disponible.

### Pendientes reales

- Reejecutar QA manual real por rol para ticket POS.
- Reejecutar QA manual real para compra `SUPER_USER`.
- Confirmar que compras aparecen en Gestion del turno solo cuando quedan vinculadas a `cash_session_id`.

## Fix rapido facturacion de pedidos con sesion POS

Fecha: 2026-06-15

Estado: PASS tecnico, QA manual real pendiente.

### Causa raiz

`POST /api/orders/:orderId/invoice` usa `@RequirePosSession()`.

El frontend marcaba la request con `includePosSession: true`, pero si el estado local no tenia `posSessionId`, no enviaba `x-pos-session-id`. El guard cortaba antes del servicio con:

```json
{
  "message": "Sesion POS requerida",
  "error": "Forbidden",
  "statusCode": 403
}
```

### Cambios realizados

- `JwtAuthGuard` ahora, solo para endpoints con `@RequirePosSession()`, puede resolver una sesion POS activa del mismo usuario, tenant y `auth_session_id` cuando falta `x-pos-session-id`.
- Si no existe sesion POS activa autorizada, mantiene `403` con `Sesion POS requerida`.
- `OrderService.invoiceOrder` bloquea facturacion cuando la sesion POS activa pertenece a una sucursal distinta a la sucursal del pedido.
- `OrderInvoiceForm` consulta `GET /api/pos/session/current`, rehidrata el contexto POS local cuando existe, muestra mensaje operativo y CTA a `/{tenantId}/pos/select-context` cuando falta contexto.

### Curl sanitizado

```bash
curl 'http://localhost:4020/api/orders/<ORDER_ID>/invoice' \
  -H 'authorization: Bearer <JWT_USER>' \
  -H 'content-type: application/json' \
  --data-raw '{"type":"CASH","payments":[]}'
```

### Resultado tecnico

- `npx.cmd tsx --test src/common/guards/jwt-auth.guard.spec.ts`
  - Resultado: PASS, 7 tests.
- `npx.cmd tsx --test src/modules/inventory/services/order.service.spec.ts`
  - Resultado: PASS, 11 tests.
- `npm.cmd run build` en `api`
  - Resultado: PASS.
- `npm.cmd run lint` en `web`
  - Resultado: PASS con warnings existentes.
- `npm.cmd run build` en `web`
  - Resultado: PASS con warnings existentes.

### QA enfocado por rol

USER:
- Estado: NO EJECUTADO en navegador durante esta pasada.
- Pendiente: facturar pedido autorizado con caja/sesion POS valida.

ADMIN:
- Estado: NO EJECUTADO en navegador durante esta pasada.
- Pendiente: facturar pedido autorizado dentro de su sucursal/contexto.

SUPER_USER:
- Estado: NO EJECUTADO en navegador durante esta pasada.
- Pendiente: facturar pedido autorizado dentro del tenant y validar sucursal/contexto.

SUPER_ADMIN:
- Estado: NO EJECUTADO en navegador durante esta pasada.
- Pendiente: validar segun usuario local disponible y alcance actual.

### Pendientes reales

- Reejecutar QA manual real por rol desde `/{tenantId}/orders`.
- Validar con caja abierta/sesion POS valida que la facturacion no devuelve `Sesion POS requerida`.
- Validar que sin caja/sesion POS la UI muestra CTA a seleccion de contexto.

## Confirmaciones

- Produccion no tocada.
- Deploy no realizado.
- Commit no realizado.
- No se agregaron PDFs ni logs.
- No se documentaron tokens, cookies ni credenciales reales.
