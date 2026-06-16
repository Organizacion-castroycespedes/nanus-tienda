# Evidencia QA - mejoras funcionales operativas caja roles menu

## Datos

- Fecha: 2026-06-13 22:00:00 -05:00
- Rama: `feat/develop/mejoras-funcionales-operativas`
- Ambiente: local `D:\Profe\manus-tienda`
- Produccion: no tocada
- Deploy: no ejecutado
- Commit: no realizado

## Alcance ejecutado en este corte

- OpenSpec creado/actualizado: `mejoras-funcionales-operativas-caja-roles-menu`.
- FASE 1 diagnostico documentado en `tasks.md`.
- FASE 2 cierre de caja con `NoticeDialog`.
- FASE 3 ticket de cierre con vista previa, descarga e impresion.
- FASE 4 acciones de ticket en `/{tenantId}/finance/cash-sessions`.
- FASE 5 post-login a `/{tenantId}/dashboard`.
- FASE 6 POS bloqueado/desactivado sin caja abierta.
- FASE 7 seleccion de contexto y apertura de caja desde `/pos/select-context`.
- FASE 8 gestion de turno minima en caja abierta.
- FASE 9 permisos de compras por rol.
- FASE 10 permisos de productos, unidades, impuestos y proveedores.
- FASE 11 permisos de promociones segun modelo local.
- FASE 12 menu lateral por rol y estado operativo.
- FASE 13 QA manual por rol queda pendiente.

## Rutas revisadas o modificadas

- `/{tenantId}/finance/cash-sessions`
- `/login`
- `/{tenantId}/dashboard`
- `/{tenantId}/pos/select-context`
- `/{tenantId}/pos`
- `/{tenantId}/purchases`
- `/{tenantId}/inventory/products`
- `/{tenantId}/inventory/purchases`
- `/{tenantId}/inventory/units`
- `/{tenantId}/inventory/taxes`
- `/{tenantId}/inventory/suppliers`
- `/{tenantId}/inventory/promotions`
- menu lateral en layout tenant

## Endpoints relevantes

- `POST /api/finance/cash-sessions/:id/close`
- `GET /api/finance/cash-sessions/current`
- `GET /api/finance/cash-sessions/history`
- `GET /api/finance/cash-registers`
- `POST /api/finance/cash-sessions/open`
- `POST /api/pos/session`
- `GET /api/reports/cash-closings/:cashSessionId/ticket`
- `GET/POST/PUT/PATCH /api/purchases`
- `GET/POST/PUT/DELETE /api/products`
- `GET/POST/PUT/PATCH /api/products/:productId/barcodes`
- `GET/POST/PUT/DELETE /api/units`
- `GET/POST/PUT/DELETE /api/taxes`
- `GET/POST/PUT/DELETE /api/suppliers`
- `GET/POST/PATCH /api/pricing/promotions`
- `GET /api/reports/order-sales/:orderSaleId/ticket` queda con fix previo intacto.

## Hallazgos FASE 1

- `NoticeDialog` ya soporta variantes y contenido custom.
- Cierre de caja en web usaba `Toast`, no dialogo operacional.
- Historial de caja no tenia acciones de ticket.
- Reporteria ya tenia servicio `getCashClosingTicket`.
- `PdfPreviewModal` ya resolvia ver/descargar/imprimir PDFs.
- Endpoint de ticket de cierre existia en `backend-reporteria`.
- `ReportAuthzGuard` bloqueaba `USER` por defecto, por eso se agrego permiso solo en ruta de ticket de cierre.
- SQL `report_cash_closing_ticket` ya restringe tenant, branch y usuario para `USER`.
- Login enviaba a `/{tenantId}/pos/select-context`; se cambio a dashboard.
- POS ya tiene hook que redirige a seleccion de contexto si falta contexto POS, pero menu/bloqueo operativo completo queda pendiente.
- Compras UI limitaba gestion a `SUPER_ADMIN`/`SUPER_USER`; se agrego `ADMIN`.
- Productos UI limitaba gestion a `SUPER_ADMIN`/`SUPER_USER`; se agrego `ADMIN`.
- Unidades, impuestos y proveedores ya usaban permisos centrales en frontend, pero unidades/impuestos en API usaban key generica `INVENTORY`; se cambiaron a `INVENTORY_UNITS` e `INVENTORY_TAXES`.
- Codigos de barras de producto estaban visibles como accion de escritura sin validar permiso write en UI; ahora el panel recibe `canWrite`.
- Menu frontend podia sobreexponer hijos de `inventory` con `canAccessModule(item.module)`; ahora solo permite items por key propia o parents heredados.
- Seed/modelo local actual otorga promociones a `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`; se alineo API con ese modelo y `USER` sigue fuera de escrituras.

## Segundo corte local - FASES 6 a 8

- `/{tenantId}/pos` ahora valida sesion POS y caja abierta antes de renderizar `PosScreen`.
- Si falta contexto o caja, muestra bloqueo operativo y CTA a `/{tenantId}/pos/select-context`.
- Menu lateral mantiene POS visible; si no hay caja abierta muestra `Requiere caja` y lleva a seleccion de contexto.
- `/{tenantId}/pos/select-context` fija sucursal para `USER` y `ADMIN` usando la sucursal asignada del perfil.
- `SUPER_USER` conserva seleccion de sucursal dentro de su tenant.
- `SUPER_ADMIN` conserva seleccion de tenant y sucursal segun contexto disponible.
- La seleccion lista terminales de la sucursal seleccionada.
- La terminal debe tener caja activa asociada.
- Si no hay caja abierta del usuario en ese contexto, la pantalla solicita monto de apertura y ejecuta `POST /api/finance/cash-sessions/open` antes de crear `POST /api/pos/session`.
- Si ya existe caja abierta del usuario en otro contexto, bloquea cambio y pide cerrar esa caja.
- La vista `/{tenantId}/finance/cash-sessions` agrega seccion `Gestion del turno` para la caja abierta actual con ventas POS, pedidos recientes, compras, movimientos, arqueo, tickets y ultimos movimientos.
- Al abrir/cerrar caja se dispara evento local `manus:cash-session-changed` para refrescar estado del menu.

## Tercer corte local - FASES 9 a 12

- Compras: `ADMIN` queda habilitado en frontend y API para crear, actualizar, recibir, cancelar y liquidar parcial, siempre con `RequirePermission` y scope existente.
- Productos: `ADMIN` queda habilitado para crear, editar, cambiar precio y eliminar logicamente.
- Codigos de barras de producto: API permite `ADMIN` con permiso `INVENTORY_PRODUCTS` write; UI oculta acciones de escritura si no hay permiso.
- Unidades e impuestos: API usa keys dedicadas `INVENTORY_UNITS` e `INVENTORY_TAXES`, no permiso generico `INVENTORY`.
- Proveedores: API permite `ADMIN` para crear, actualizar y eliminar logicamente con `INVENTORY_SUPPLIERS` write.
- Promociones: API permite `ADMIN` porque el modelo local ya tiene `INVENTORY_PROMOTIONS` para `ADMIN`; no se agrego `USER` a escrituras.
- Menu/rutas: se agregaron keys frontend `INVENTORY_UNITS` e `INVENTORY_TAXES`; rutas directas de unidades/impuestos validan por key especifica.
- Menu lateral: `getAllowedMenuItems` ya no usa permiso generico del modulo para hijos normales; conserva parents heredados enviados por backend.

## Validaciones ejecutadas

### OpenSpec

- `openspec.cmd validate mejoras-funcionales-operativas-caja-roles-menu --type change --strict`
  - Resultado inicial: FAIL esperado. Causa: change nuevo sin deltas.
  - Resultado despues de specs: PASS.
- `openspec.cmd validate --strict`
  - Resultado inicial y final: FAIL por CLI local. Mensaje: `Nothing to validate`.
  - Se ejecuto equivalente practico: `openspec.cmd validate --all --strict`.
  - Resultado `--all --strict`: PASS, 14 items.

### Backend reporteria

- `npx.cmd tsx --test src/modules/auth/report-authz.guard.spec.ts src/modules/reports/cash-reports.controller.spec.ts src/modules/reports/orders-reports.service.spec.ts`
  - Resultado: PASS, 10 tests.
- `npm.cmd run build`
  - Resultado: PASS.

### Web

- `npm.cmd run build`
  - Resultado: PASS en primer corte, segundo corte y tercer corte.
  - Observacion: warnings existentes de hooks/img en varias paginas, sin fallo de build.
- `npm.cmd run lint`
  - Resultado: PASS en primer corte, segundo corte y tercer corte con warnings existentes.
- Browser plugin
  - Resultado: BLOCKED.
  - Causa: `node_repl kernel exited unexpectedly` con `windows sandbox failed: spawn setup refresh`.
- Smoke HTTP local
  - `http://localhost:3000/<TENANT_ID_LOCAL>/finance/cash-sessions`: FAIL por dev server existente stale, error `Cannot find module './vendor-chunks/next.js'`.
  - Se levanto dev server alterno en `http://localhost:3001`.
  - `Invoke-WebRequest -UseBasicParsing http://localhost:3001/<TENANT_ID_LOCAL>/finance/cash-sessions`: PASS HTTP 200.
  - `Invoke-WebRequest -UseBasicParsing http://localhost:3001/<TENANT_ID_LOCAL>/pos`: PASS HTTP 200.
  - `Invoke-WebRequest -UseBasicParsing http://localhost:3001/<TENANT_ID_LOCAL>/purchases`: PASS HTTP 200.
  - `Invoke-WebRequest -UseBasicParsing http://localhost:3001/<TENANT_ID_LOCAL>/inventory/products`: PASS HTTP 200.
  - `Invoke-WebRequest -UseBasicParsing http://localhost:3001/<TENANT_ID_LOCAL>/inventory/promotions`: PASS HTTP 200.
  - `Invoke-WebRequest -UseBasicParsing http://localhost:3001/<TENANT_ID_LOCAL>/inventory/units`: PASS HTTP 200.
  - `Invoke-WebRequest -UseBasicParsing http://localhost:3001/<TENANT_ID_LOCAL>/inventory/taxes`: PASS HTTP 200.
  - PID listener `3001`: `36952`.

### Backend API

- `npx.cmd tsx --test src/modules/inventory/controllers/operational-role-permissions.controller.spec.ts`
  - Resultado: PASS, 2 tests.
- `npx.cmd tsx --test src/modules/pricing/promotions.controller.spec.ts src/modules/inventory/controllers/product.controller.spec.ts`
  - Resultado: PASS, 7 tests.
- `npm.cmd run build`
  - Resultado: PASS.

### Git

- `git diff --check`
  - Resultado: PASS.
  - Observacion: warnings LF/CRLF en archivos tocados.
- `git status --short`
  - Resultado: ejecutado. Cambios locales sin commit.

### Validaciones finales QA manual - 2026-06-13 23:14:53 -05:00

- `openspec.cmd validate mejoras-funcionales-operativas-caja-roles-menu --type change --strict`
  - Resultado: PASS.
- `openspec.cmd validate --all --strict`
  - Resultado: PASS, 14 items.
- `git diff --check`
  - Resultado: PASS.
  - Observacion: warnings LF/CRLF en archivos tocados.
- `git status --short`
  - Resultado: ejecutado. Cambios locales sin commit.
- `npm.cmd run build` en API/Web:
  - No ejecutado en esta pasada porque no se tocaron archivos de app; solo `docs`, `openspec` y helper QA `scripts/qa/manual-role-qa-cdp.mjs`.
- `npm.cmd run lint` en Web:
  - No ejecutado en esta pasada por la misma causa.

## QA manual por rol

Fecha de ejecucion: 2026-06-13 22:55:00 -05:00.

Ambiente usado:

- Web: `http://localhost:3001`.
- API: `http://localhost:4020/api`.
- Tenant: `<TENANT_ID_LOCAL>`.
- Browser: Chrome local headless por CDP `9223`.
- Nota ambiente: el Browser plugin quedo bloqueado por sandbox. Se uso Chrome CDP local. Web se reinicio en `3001` con `NEXT_PUBLIC_REFRESH_TOKEN_STORAGE=session` para poder validar navegacion directa y refresh. API se levanto local con `CORS_ORIGIN=http://localhost:3001`. No se editaron `.env`.

Evidencia generada:

- `docs/qa-manual-role-results.json`.
- `docs/evidencia-user-qa-caja-roles-menu.png`.
- `docs/evidencia-admin-qa-caja-roles-menu.png`.
- `docs/evidencia-super_user-qa-caja-roles-menu.png`.
- `docs/evidencia-super_admin-qa-caja-roles-menu.png`.

### USER

- Estado: PARCIAL / PASS CON OBSERVACIONES.
- Usuario: `<USER_LOCAL>`.
- Rutas probadas:
  - `/login`
  - `/{tenantId}/dashboard`
  - `/{tenantId}/pos`
  - `/{tenantId}/pos/select-context`
  - `/{tenantId}/finance/cash-sessions`
  - `/{tenantId}/purchases`
  - `/{tenantId}/inventory/products`
  - `/{tenantId}/inventory/units`
  - `/{tenantId}/inventory/taxes`
  - `/{tenantId}/inventory/suppliers`
  - `/{tenantId}/inventory/promotions`
  - `/{tenantId}/pricing/promotions`
- Resultado obtenido:
  - Login normal redirige a `/{tenantId}/dashboard`: PASS.
  - Dashboard visible por link superior `Ir al dashboard`: PASS.
  - POS visible con estado `REQUIERE CAJA`: PASS.
  - Navegacion directa a POS sin caja muestra bloqueo operativo y CTA a seleccion de contexto: PASS.
  - `/pos/select-context` muestra sucursal fija `Sucursal Principal`, select disabled, y terminal `Terminal 1 (TERM-001)`: PASS.
  - `/finance/cash-sessions` muestra historial, estado `Sin sesion`, acciones `Ver ticket`, `Descargar PDF`, `Imprimir` en sesiones `CLOSED`: PASS visual.
  - Rutas administrativas `purchases`, `products`, `units`, `taxes`, `suppliers`, `inventory/promotions` redirigen a `unauthorized`: PASS.
  - Menu no muestra compras, productos, unidades, impuestos, proveedores ni promociones administrativas: PASS.
- Bugs encontrados: ninguno bloqueante para los pasos ejecutados.
- No ejecutado:
  - Abrir caja.
  - Operar POS con caja abierta.
  - Cerrar caja.
  - Validar `NoticeDialog` success/error en navegador.
  - Click real en Ver ticket/Descargar PDF/Imprimir.
- Observaciones:
  - `/{tenantId}/pricing/promotions` devuelve 404. Ruta real implementada: `/{tenantId}/inventory/promotions`.

### ADMIN

- Estado: FAIL.
- Usuario: `<ADMIN_LOCAL>`.
- Rutas probadas:
  - `/login`
  - `/{tenantId}/dashboard`
  - `/{tenantId}/pos`
  - `/{tenantId}/pos/select-context`
  - `/{tenantId}/finance/cash-sessions`
  - `/{tenantId}/purchases`
  - `/{tenantId}/inventory/products`
  - `/{tenantId}/inventory/units`
  - `/{tenantId}/inventory/taxes`
  - `/{tenantId}/inventory/suppliers`
  - `/{tenantId}/inventory/promotions`
  - `/{tenantId}/pricing/promotions`
- Resultado obtenido:
  - Login normal redirige a `/{tenantId}/dashboard`: PASS.
  - POS bloqueado sin caja y CTA a seleccion de contexto: PASS.
  - `/pos/select-context` muestra sucursal fija `Sucursal Principal`, select disabled, y terminal `Terminal 1 (TERM-001)`: PASS.
  - `/finance/cash-sessions` carga y muestra acciones de tickets en cierres: PASS visual.
  - Menu no muestra compras, productos, unidades, impuestos, proveedores ni promociones: FAIL.
  - Rutas directas esperadas para compras/catalogos/promociones redirigen a `unauthorized`: FAIL.
- Bugs encontrados:
  - Severidad ALTA: `ADMIN` no accede a `/{tenantId}/purchases`.
  - Severidad ALTA: `ADMIN` no accede a `/{tenantId}/inventory/products`.
  - Severidad ALTA: `ADMIN` no accede a `/{tenantId}/inventory/units`.
  - Severidad ALTA: `ADMIN` no accede a `/{tenantId}/inventory/taxes`.
  - Severidad ALTA: `ADMIN` no accede a `/{tenantId}/inventory/suppliers`.
  - Severidad ALTA: `ADMIN` no accede a `/{tenantId}/inventory/promotions` aunque el modelo local documentado lo permite.
- No ejecutado:
  - Crear/editar compras/catalogos.
  - Abrir/cerrar caja y validar ticket post-cierre.
- Observaciones:
  - `/{tenantId}/pricing/promotions` devuelve 404. Ruta real implementada: `/{tenantId}/inventory/promotions`.

### SUPER_USER

- Estado: FAIL.
- Usuario: `<SUPER_USER_LOCAL>`.
- Rutas probadas:
  - `/login`
  - `/{tenantId}/dashboard`
  - `/{tenantId}/pos`
  - `/{tenantId}/pos/select-context`
  - `/{tenantId}/finance/cash-sessions`
  - `/{tenantId}/purchases`
  - `/{tenantId}/inventory/products`
  - `/{tenantId}/inventory/units`
  - `/{tenantId}/inventory/taxes`
  - `/{tenantId}/inventory/suppliers`
  - `/{tenantId}/inventory/promotions`
  - `/{tenantId}/pricing/promotions`
- Resultado obtenido:
  - Login normal redirige a `/{tenantId}/dashboard`: PASS.
  - POS sin caja muestra bloqueo operativo: PASS.
  - `/pos/select-context` permite seleccionar sucursal del tenant; aparecen `Adelita de Char` y `Sucursal Principal`: PASS.
  - Terminal queda deshabilitada hasta escoger sucursal: PASS.
  - `/finance/cash-sessions` carga cierres y acciones de ticket: PASS visual.
  - Menu no muestra productos, unidades, impuestos, proveedores ni promociones; solo aparece `Compras` bajo reportería, no como modulo operativo: FAIL.
  - Rutas directas esperadas para compras/catalogos/promociones redirigen a `unauthorized`: FAIL.
- Bugs encontrados:
  - Severidad ALTA: `SUPER_USER` no accede a `/{tenantId}/purchases`.
  - Severidad ALTA: `SUPER_USER` no accede a `/{tenantId}/inventory/products`.
  - Severidad ALTA: `SUPER_USER` no accede a `/{tenantId}/inventory/units`.
  - Severidad ALTA: `SUPER_USER` no accede a `/{tenantId}/inventory/taxes`.
  - Severidad ALTA: `SUPER_USER` no accede a `/{tenantId}/inventory/suppliers`.
  - Severidad ALTA: `SUPER_USER` no accede a `/{tenantId}/inventory/promotions`.
- No ejecutado:
  - Elegir sucursal y abrir caja.
  - Operar POS.
  - Cerrar caja y validar ticket post-cierre.
  - Crear/editar compras/catalogos/promociones.
- Observaciones:
  - `/{tenantId}/pricing/promotions` devuelve 404. Ruta real implementada: `/{tenantId}/inventory/promotions`.

### SUPER_ADMIN

- Estado: PARCIAL / PASS CON OBSERVACIONES.
- Usuario: identificador no sensible `SUPER_ADMIN local`.
- Rutas probadas:
  - `/login`
  - `/{tenantId}/dashboard`
  - `/{tenantId}/pos`
  - `/{tenantId}/pos/select-context`
  - `/{tenantId}/finance/cash-sessions`
  - `/{tenantId}/purchases`
  - `/{tenantId}/inventory/products`
  - `/{tenantId}/inventory/units`
  - `/{tenantId}/inventory/taxes`
  - `/{tenantId}/inventory/suppliers`
  - `/{tenantId}/inventory/promotions`
  - `/{tenantId}/pricing/promotions`
- Resultado obtenido:
  - Login normal redirige a `/{tenantId}/dashboard`: PASS.
  - POS sin caja muestra bloqueo operativo: PASS.
  - `/pos/select-context` permite seleccionar empresa y sucursal del tenant: PASS.
  - Compras, productos, unidades, impuestos, proveedores y promociones cargan por ruta directa: PASS.
  - `/finance/cash-sessions` muestra sesiones abiertas/cerradas y acciones de ticket en cierres: PASS visual.
- Bugs encontrados: ninguno bloqueante para los pasos ejecutados.
- No ejecutado:
  - Abrir/cerrar caja.
  - Validar ticket post-cierre con click real.
  - Crear/editar compras/catalogos/promociones.
- Observaciones:
  - Menu lateral no lista productos, unidades, impuestos, proveedores ni promociones como links visibles; las rutas directas si cargan para `SUPER_ADMIN`.
  - `/{tenantId}/pricing/promotions` devuelve 404. Ruta real implementada: `/{tenantId}/inventory/promotions`.

### Estado QA manual

- Post-login por rol: PASS para USER, ADMIN, SUPER_USER y SUPER_ADMIN.
- QA manual completo por rol: FAIL/PARCIAL.
- Motivo: `ADMIN` y `SUPER_USER` fallan acceso/menu de compras, catalogos y promociones. Ademas no se ejecuto apertura/cierre/impresion de caja en esta pasada.

## Resultado por fase

- FASE 1: completada para diagnostico inicial.
- FASE 2: implementada.
- FASE 3: implementada con impresion no critica y fallback manual.
- FASE 4: implementada en UI y permiso puntual de reporteria.
- FASE 5: implementada.
- FASE 6: implementada.
- FASE 7: implementada en UI usando validaciones backend existentes de tenant/sucursal/terminal/caja.
- FASE 8: implementada como primera version funcional de gestion de turno.
- FASE 9: implementada para compras en frontend/API.
- FASE 10: implementada para productos, unidades, impuestos y proveedores en frontend/API.
- FASE 11: implementada segun modelo local de promociones con permiso explicito para `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`.
- FASE 12: implementada para menu/rutas/permisos frontend y POS por estado operativo.
- FASE 13: pendiente QA manual por rol.

## Riesgos y pendientes

- Antecedente 2026-06-13: QA manual por rol quedo FAIL/PARCIAL por bloqueos de `ADMIN` y `SUPER_USER` en compras/catalogos/promociones.
- Resuelto en mini-corte 2026-06-14: `ADMIN`, `SUPER_USER` y `SUPER_ADMIN` ven y acceden a compras, productos, unidades, impuestos, proveedores y promociones; `USER` sigue bloqueado.
- Ruta web de promociones resuelta: canónica `/{tenantId}/inventory/promotions`. `/api/pricing/promotions` se mantiene como endpoint API.
- Pendiente actual: ejecutar apertura de caja, POS operativo con caja abierta, cierre de caja, `NoticeDialog` success/error y acciones reales de ticket `Ver/Descargar/Imprimir`.
- `openspec.cmd validate --strict` exacto no valida en esta CLI sin item; usar `--all --strict` para validacion global hasta ajustar runbook.
- Browser plugin sigue bloqueado por sandbox; se uso Chrome CDP local como fallback.

## Confirmaciones

- Produccion no fue tocada.
- No se hizo deploy.
- No se hizo commit.
- No se imprimieron secretos ni tokens.

## Mini-corte correctivo permisos/rutas/menú

Fecha: 2026-06-14 20:37 -05:00.

Rama: `feat/develop/mejoras-funcionales-operativas`.

Ambiente local:

- Web: `http://localhost:3001`.
- API: `http://localhost:4020/api`.
- Tenant: `<TENANT_ID_LOCAL>`.
- Navegador QA: Chrome CDP local `9223`.

Causa raíz:

- El bloqueo real venía combinado de frontend y backend.
- Frontend: `route-permissions` y páginas podían consultar permisos, pero el menú venía desde `/me/menu` sin hijos administrativos visibles bajo inventario. Además `USER` tenía lecturas crudas de algunos `INVENTORY_*`, por lo que se necesitó bloqueo explícito de rutas admin para `USER`.
- Backend: los controllers tenían metadata de roles operativos, pero `PermissionsGuard` dependía de matriz DB para `INVENTORY_*`; en local esa matriz quedaba incompleta/inconsistente para escrituras operativas.
- Promociones web: la ruta canónica real es `/{tenantId}/inventory/promotions`. `/{tenantId}/pricing/promotions` no se mantiene como ruta web; `/api/pricing/promotions` sigue siendo endpoint API.

Decisión final promociones ADMIN:

- `ADMIN` sí gestiona promociones en este change.
- `USER` no ve menú de promociones, no accede a ruta web directa y no queda autorizado en `PromotionsController`.

Archivos modificados en este mini-corte:

- `web/lib/permissions.ts`
- `web/app/[tenant]/layout.tsx`
- `api/src/common/guards/permissions.guard.ts`
- `api/src/common/guards/permissions.guard.spec.ts`
- `api/src/modules/pricing/promotions.controller.ts`
- `api/src/modules/inventory/controllers/operational-role-permissions.controller.spec.ts`
- `scripts/qa/manual-role-qa-cdp.mjs`
- `docs/qa-manual-role-results.json`
- `openspec/changes/mejoras-funcionales-operativas-caja-roles-menu/tasks.md`

QA enfocado por rol:

| Rol | Estado | Resultado |
| --- | --- | --- |
| USER | PASS_CON_OBSERVACIONES | Login a dashboard. Menu admin oculto. 6 rutas admin redirigen a `unauthorized`. |
| ADMIN | PASS_CON_OBSERVACIONES | Menu muestra compras, productos, unidades, impuestos, proveedores y promociones. Rutas directas cargan. |
| SUPER_USER | PASS_CON_OBSERVACIONES | Menu muestra compras, productos, unidades, impuestos, proveedores y promociones. Rutas directas cargan. |
| SUPER_ADMIN | PASS_CON_OBSERVACIONES | Menu muestra compras, productos, unidades, impuestos, proveedores y promociones. Rutas directas cargan. |

Rutas web validadas:

- `/{tenantId}/purchases`
- `/{tenantId}/inventory/products`
- `/{tenantId}/inventory/units`
- `/{tenantId}/inventory/taxes`
- `/{tenantId}/inventory/suppliers`
- `/{tenantId}/inventory/promotions`

Evidencia:

- `docs/qa-manual-role-results.json`
- `docs/evidencia-user-qa-caja-roles-menu.png`
- `docs/evidencia-admin-qa-caja-roles-menu.png`
- `docs/evidencia-super_user-qa-caja-roles-menu.png`
- `docs/evidencia-super_admin-qa-caja-roles-menu.png`

Validaciones técnicas:

- `npx.cmd tsx --test src/common/guards/permissions.guard.spec.ts src/modules/inventory/controllers/operational-role-permissions.controller.spec.ts src/modules/pricing/promotions.controller.spec.ts`: PASS, 20 tests.
- `npm.cmd run build` en `api`: PASS.
- `openspec.cmd validate mejoras-funcionales-operativas-caja-roles-menu --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS, 14 items.
- `npm.cmd run build` en `web`: PASS con warnings existentes.
- `npm.cmd run lint` en `web`: PASS con warnings existentes.
- `git diff --check`: PASS, con warnings LF/CRLF.
- `git status --short`: PASS para inventario de cambios; sin commit.

Pendientes reales:

- QA manual completo por rol sigue pendiente para abrir caja, operar POS con caja abierta, cerrar caja, validar `NoticeDialog` success/error y acciones reales de ticket `Ver/Descargar/Imprimir`.
- No se ejecutó creación/edición real de compras/catálogos/promociones en esta pasada; el mini-corte validó acceso, menú y bloqueo de rutas.

Confirmaciones mini-corte:

- Producción no fue tocada.
- Deploy no realizado.
- Commit no realizado.

## QA operativo real de caja

Fecha: 2026-06-14 21:33 -05:00.

Rama: `feat/develop/mejoras-funcionales-operativas`.

Ambiente local:

- Web: `http://localhost:3001`.
- API: `http://localhost:4020/api`.
- Backend reporteria: `http://localhost:4021/api`.
- Tenant: `<TENANT_ID_LOCAL>`.
- Navegador QA: Chrome CDP local `9223`.

Preparacion local:

- Browser plugin no se pudo usar por sandbox interno; se uso Chrome CDP local.
- Web local quedo corriendo con `NEXT_PUBLIC_REFRESH_TOKEN_STORAGE=session` solo en proceso local para validar rutas directas despues de login.
- Backend reporteria se reinicio solo local con `CORS_ORIGIN=http://localhost:3000,http://localhost:3001`.
- Preflight CORS de ticket desde `http://localhost:3001` respondio `Access-Control-Allow-Origin: http://localhost:3001`.
- Antes y despues del QA se verifico que no quedaron cajas `OPEN` en el tenant local.

Script/evidencia generada:

- `scripts/qa/manual-cash-ops-qa-cdp.mjs`.
- `docs/qa-cash-ops-results.json`.
- `docs/evidencia-super_user-qa-caja-operativa-notice.png`.
- `docs/evidencia-super_user-qa-caja-operativa-final.png`.
- `docs/evidencia-user-qa-caja-operativa-notice.png`.
- `docs/evidencia-user-qa-caja-operativa-final.png`.
- `docs/evidencia-admin-qa-caja-operativa-notice.png`.
- `docs/evidencia-admin-qa-caja-operativa-final.png`.
- `docs/evidencia-super_admin-qa-caja-operativa-notice.png`.
- `docs/evidencia-super_admin-qa-caja-operativa-final.png`.

Resultado por rol:

| Rol | Estado | Caja abierta | Venta POS | Caja cerrada | NoticeDialog | Ver ticket | Descargar PDF | Imprimir |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| USER | PASS_CON_OBSERVACIONES | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| ADMIN | PASS_CON_OBSERVACIONES | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| SUPER_USER | PASS_CON_OBSERVACIONES | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| SUPER_ADMIN | PASS_CON_OBSERVACIONES | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

Detalle validado:

- Login normal redirige a `/{tenantId}/dashboard`.
- Ruta directa `/{tenantId}/pos` sin caja muestra bloqueo operativo y CTA a `/{tenantId}/pos/select-context`.
- `USER` y `ADMIN` usan sucursal asignada `Sucursal Principal` y terminal `Terminal 1 (TERM-001)`.
- `SUPER_USER` y `SUPER_ADMIN` pueden seleccionar sucursal del tenant; en QA se uso `Sucursal Principal` y `Terminal 1 (TERM-001)`.
- Apertura de caja con monto `1000`: PASS.
- POS queda operativo con caja abierta: PASS.
- Producto usado: `Leche PROD-LECHE-001`.
- Venta queda en estado `CONFIRMED`: PASS.
- Gestion de turno muestra venta POS de `$ 4.800`, ingreso, movimiento y total esperado: PASS.
- Cierre de caja: PASS.
- `NoticeDialog` success muestra `Caja cerrada correctamente`, resumen operativo y acciones `Ver ticket`, `Descargar PDF`, `Imprimir`: PASS.
- `/finance/cash-sessions` muestra acciones de ticket para sesiones `CLOSED` y texto operativo para sesion `OPEN`: PASS.
- Ticket real de cierre responde PDF `200` desde `GET /api/reports/cash-closings/:cashSessionId/ticket`: PASS.

PDFs descargados durante QA final:

- `SUPER_USER`: `ticket-cierre-a85a51ea-9744-4095-a5c1-a8198cc7c711.pdf`.
- `USER`: `ticket-cierre-55dae0dc-97d2-4df1-9156-fcbc909c0f39.pdf`.
- `ADMIN`: `ticket-cierre-59dbf43c-da62-4e6d-a2c9-fe4603cb90ca.pdf`.
- `SUPER_ADMIN`: `ticket-cierre-845a2823-1cc4-437e-b9d0-e300b78e0454.pdf`.

Observaciones no bloqueantes:

- El entorno local no tiene agente de perifericos disponible. La UI mostro `Venta guardada, pero no se pudo contactar el agente de perifericos`.
- La venta quedo confirmada igualmente (`ESTADO VENTA CONFIRMED`) y los totales de caja se actualizaron. No bloquea cierre funcional.
- La impresion abrio ventanas `blob:` imprimibles; depende del navegador aceptar popup/print, pero queda disponible boton manual.

Bugs encontrados:

- No quedan bugs bloqueantes abiertos en flujo operativo de caja.
- Correccion realizada durante QA: ajuste del helper CDP para detectar productos con texto `PRECIO FINAL` en mayusculas y aceptar venta confirmada con advertencia local de perifericos.
- Correccion local de ambiente: backend reporteria reiniciado con CORS local para `localhost:3001`; no hubo cambio de codigo de reporteria.

Pendientes reales:

- Ningun pendiente bloqueante para cierre funcional del change.
- Mantener observacion de agente de perifericos local si el QA se repite sin servicio WS/perifericos.

Validaciones finales de esta pasada:

- `openspec.cmd validate mejoras-funcionales-operativas-caja-roles-menu --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS, 14 items.
- `node -c scripts\qa\manual-cash-ops-qa-cdp.mjs`: PASS.
- `git diff --check`: PASS, con warnings LF/CRLF existentes.
- `git status --short`: ejecutado para inventario de cambios; sin commit.
- Builds de `web`, `api` y `backend-reporteria` no se re-ejecutaron en esta pasada porque no se tocaron archivos de aplicacion, solo helper QA, docs y tasks.

Confirmaciones QA operativo:

- Produccion no fue tocada.
- Deploy no realizado.
- Commit no realizado.
