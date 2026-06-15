# Tasks: mejoras-funcionales-operativas-caja-roles-menu

## Validacion inicial

- [x] 1. Crear change `mejoras-funcionales-operativas-caja-roles-menu`.
- [x] 2. Ejecutar validacion inicial `openspec.cmd validate mejoras-funcionales-operativas-caja-roles-menu --type change --strict`.
- [x] 3. Registrar resultado inicial: falla esperada porque el change nuevo no tenia deltas.
- [x] 4. Ejecutar validacion inicial `openspec.cmd validate --strict`.
- [x] 5. Registrar resultado inicial: falla con `Nothing to validate` al no usar `--all`, `--changes`, `--specs` ni item concreto.

## FASE 1 - Diagnostico obligatorio

- [x] 1. Revisar `web/components/design-system/NoticeDialog.tsx`: soporta `success`, `error`, `warning`, `info`, acciones confirm/cerrar y `children`.
- [x] 2. Revisar flujo de cierre de caja: `web/app/[tenant]/finance/cash-sessions/page.tsx` usa `Toast`, no `NoticeDialog`, y cierra modal al exito.
- [x] 3. Revisar `/finance/cash-sessions`: historial existe, pero no muestra Ver ticket, Descargar PDF ni Imprimir para cierres.
- [x] 4. Revisar login/post-login: `web/app/login/page.tsx` redirige a `/{tenantId}/pos/select-context` en login normal, force-login y sesion ya autenticada.
- [x] 5. Revisar reporteria cash tickets: `web/modules/reporteria/services/reporting.service.ts` ya expone `getCashClosingTicket(cashSessionId)`.
- [x] 6. Revisar visor PDF: `web/modules/reporteria/components/PdfPreviewModal.tsx` ya permite vista previa, descarga e impresion.
- [x] 7. Revisar endpoint real: `backend-reporteria/src/modules/reports/cash-reports.controller.ts` expone `GET /reports/cash-closings/:cashSessionId/ticket`.
- [x] 8. Revisar guard reporteria: `ReportAuthzGuard` permite por defecto `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`; `USER` requiere `@ReportRoles(...)` por ruta.
- [x] 9. Revisar SQL cash ticket: `report_cash_closing_ticket` filtra tenant, branch y restringe `USER` a sesiones abiertas/cerradas por el actor.
- [x] 10. Revisar POS guard frontend: `web/domains/pos/hooks/useRequirePosSession.ts` redirige a `/pos/select-context` si falta contexto POS.
- [x] 11. Revisar seleccion contexto: `web/domains/pos/components/PosContextSelector.tsx` existe como pantalla base.
- [x] 12. Revisar menu lateral: `web/app/[tenant]/layout.tsx`, `web/lib/permissions.ts`, `web/lib/route-permissions.ts` centralizan permisos/menu.
- [x] 13. Revisar compras: `web/app/[tenant]/purchases/page.tsx` limita gestion a `SUPER_ADMIN`/`SUPER_USER`, por eso `ADMIN` aparece incompleto.
- [x] 14. Revisar en profundidad unidades/impuestos/proveedores/promociones frontend y endpoints API antes de cambiar permisos.
- [x] 15. Documentar modulos ocultos incorrectamente por rol despues de mapear menu seed/RBAC real: compras/productos tenian hard-block sin `ADMIN`; menu frontend podia sobreexponer hijos de `inventory` por fallback de modulo; rutas directas de unidades/impuestos usaban permiso generico `inventory`.

## FASE 2 - Cierre de caja con NoticeDialog

- [x] 1. Reemplazar feedback de cierre exitoso por `NoticeDialog` variant `success`.
- [x] 2. Mostrar "Caja cerrada correctamente".
- [x] 3. Mostrar resumen operativo si datos disponibles.
- [x] 4. Ofrecer Ver ticket, Descargar PDF e Imprimir.
- [x] 5. Refrescar caja actual e historial despues del cierre exitoso.
- [x] 6. Usar `NoticeDialog` variant `error` para cierre fallido.
- [x] 7. Mantener formulario abierto cuando cierre falla.

## FASE 3 - Evento de impresion de ticket de cierre

- [x] 1. Reutilizar `getCashClosingTicket`, `PdfPreviewModal` y `downloadBlob`.
- [x] 2. Agregar accion manual de impresion.
- [x] 3. Tratar fallo/bloqueo de impresion como no critico.

## FASE 4 - Acciones de ticket en `/finance/cash-sessions`

- [x] 1. Agregar Ver ticket para sesiones `CLOSED`.
- [x] 2. Agregar Descargar PDF para sesiones `CLOSED`.
- [x] 3. Agregar Imprimir para sesiones `CLOSED`.
- [x] 4. Mostrar texto operativo para sesiones abiertas o sin cierre.
- [x] 5. Mostrar feedback si ticket falla o usuario no esta autorizado.
- [x] 6. Permitir `USER` en endpoint puntual de ticket de cierre manteniendo scope SQL.

## FASE 5 - Redireccion inicial post-login

- [x] 1. Cambiar login normal a `/{tenantId}/dashboard`.
- [x] 2. Cambiar force-login a `/{tenantId}/dashboard`.
- [x] 3. Cambiar sesion ya autenticada a `/{tenantId}/dashboard`.
- [x] 4. Validar manualmente con USER, ADMIN, SUPER_USER y SUPER_ADMIN: PASS post-login a dashboard en navegador local con Chrome CDP.

## FASES 6 a 13 - Pendientes por alcance

- [x] 1. POS desactivado/operativo en menu si no hay caja abierta: POS queda visible con estado `Requiere caja` y redirige a `/pos/select-context`.
- [x] 2. Bloqueo operativo de ruta directa POS sin caja abierta con CTA: `/pos` muestra bloqueo y CTA a seleccion de contexto.
- [x] 3. Apertura de caja obligando seleccion previa de contexto con reglas por rol en UI y backend existente: `USER`/`ADMIN` usan sucursal asignada; `SUPER_USER`/`SUPER_ADMIN` pueden escoger dentro de su tenant/alcance.
- [x] 4. Gestion de turno minima con ventas, pedidos recientes, compras, movimientos, arqueo y estado de tickets de caja abierta.
- [x] 5. Permisos de compras por rol en frontend y API: `ADMIN` habilitado para acciones de compras con `RequirePermission` intacto; `USER` sigue fuera de escrituras.
- [x] 6. Permisos de productos, unidades, impuestos y proveedores por rol en frontend y API: `ADMIN` habilitado para escrituras de catalogos; unidades/impuestos usan keys dedicadas; codigos de barras de producto respetan permiso write.
- [x] 7. Permisos de promociones por rol en frontend y API: backend alineado con modelo local que ya otorga `INVENTORY_PROMOTIONS` a `ADMIN`/`SUPER_USER`/`SUPER_ADMIN`; `USER` no queda en escrituras.
- [x] 8. Menu lateral visible/oculto/desactivado segun rol y estado operativo para compras/catalogos/promociones: filtro frontend deja de usar permiso generico de modulo para hijos normales y mantiene parents heredados.
- [x] 9. QA manual completo por rol: QA operativo real 2026-06-14 deja PASS_CON_OBSERVACIONES para `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`; apertura de caja, POS con caja abierta, cierre con `NoticeDialog`, ticket real, descarga PDF e impresion manual quedaron validados.
- [x] 10. Mini-corte correctivo permisos/rutas/menu: `ADMIN` accede y ve compras, productos, unidades, impuestos, proveedores y promociones.
- [x] 11. Mini-corte correctivo permisos/rutas/menu: `SUPER_USER` accede y ve compras, productos, unidades, impuestos, proveedores y promociones.
- [x] 12. Mini-corte correctivo permisos/rutas/menu: `SUPER_ADMIN` ve links administrativos y accede a rutas directas.
- [x] 13. Mini-corte correctivo permisos/rutas/menu: `USER` sigue sin ver menu administrativo y rutas directas quedan en `unauthorized`.
- [x] 14. Ruta canonica de promociones alineada en QA helper a `/{tenantId}/inventory/promotions`; no se usa `/{tenantId}/pricing/promotions` como ruta web.

## Validaciones tecnicas

- [x] 1. Ejecutar `openspec.cmd validate mejoras-funcionales-operativas-caja-roles-menu --type change --strict`: PASS despues de crear deltas.
- [x] 2. Ejecutar `openspec.cmd validate --strict`: FAIL por CLI local con `Nothing to validate`; se ejecuto `openspec.cmd validate --all --strict`: PASS.
- [x] 3. Ejecutar tests especificos de `backend-reporteria` tocados: PASS 10 tests.
- [x] 4. Ejecutar `npm.cmd run build` en `backend-reporteria` si se toca: PASS.
- [x] 5. Ejecutar `npm.cmd run build` en `web`: PASS con warnings existentes.
- [x] 6. Ejecutar `npm.cmd run lint` en `web` si viable: PASS con warnings existentes.
- [x] 7. Ejecutar `git diff --check`: PASS, con warnings LF/CRLF en archivos tocados.
- [x] 8. Ejecutar `git status --short`: PASS para inventario de cambios sin commit.
- [x] 9. Ejecutar tests especificos API de permisos operativos: PASS 9 tests.
- [x] 10. Ejecutar `npm.cmd run build` en `api`: PASS.
- [x] 11. Ejecutar smoke HTTP local para compras/productos/promociones/unidades/impuestos en `http://localhost:3001`: PASS HTTP 200.
- [x] 12. Mini-corte correctivo: ejecutar tests especificos API de guard/permisos/promociones: PASS 20 tests.
- [x] 13. Mini-corte correctivo: ejecutar `npm.cmd run build` en `api`: PASS.
- [x] 14. Mini-corte correctivo: ejecutar `npm.cmd run build` en `web`: PASS con warnings existentes.
- [x] 15. Mini-corte correctivo: ejecutar `npm.cmd run lint` en `web`: PASS con warnings existentes.
- [x] 16. Mini-corte correctivo: ejecutar QA enfocado Chrome CDP por rol: PASS_CON_OBSERVACIONES para `USER`, `ADMIN`, `SUPER_USER`, `SUPER_ADMIN`.
- [x] 17. Mini-corte correctivo: ejecutar `git diff --check`: PASS con warnings LF/CRLF.
- [x] 18. Mini-corte correctivo: ejecutar `git status --short`: PASS para inventario de cambios sin commit.
- [x] 19. QA operativo real de caja Chrome CDP: PASS_CON_OBSERVACIONES para `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`.
- [x] 20. QA operativo real: `node -c scripts\qa\manual-cash-ops-qa-cdp.mjs`: PASS.
- [x] 21. QA operativo real: preflight CORS local de reporteria para `http://localhost:3001`: PASS.
- [x] 22. QA operativo real: verificar DB sin cajas `OPEN` al cierre de la pasada: PASS.
- [x] 23. QA operativo real: ejecutar `openspec.cmd validate mejoras-funcionales-operativas-caja-roles-menu --type change --strict`: PASS.
- [x] 24. QA operativo real: ejecutar `openspec.cmd validate --all --strict`: PASS, 14 items.
- [x] 25. QA operativo real: ejecutar `git diff --check`: PASS con warnings LF/CRLF.
- [x] 26. QA operativo real: ejecutar `git status --short`: PASS para inventario de cambios sin commit.

## Evidencia

- [x] 1. Crear o actualizar `docs/evidencia-qa-mejoras-funcionales-operativas-caja-roles-menu.md`.
- [x] 2. Registrar fecha, rama, ambiente local, roles, rutas, endpoints, builds/tests, OpenSpec, QA manual, pendientes/riesgos.
- [x] 3. Confirmar produccion no tocada.
- [x] 4. Confirmar commit no realizado.
