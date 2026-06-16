## 1. Diagnostico

- [x] 1.1 Revisar patron de foco en Pedidos y Compras.
- [x] 1.2 Revisar estado actual de Clientes, Unidades, Proveedores e Impuestos.
- [x] 1.3 Confirmar que no se requieren cambios API, SQL, permisos ni guards.

## 2. Implementacion UX

- [x] 2.1 Extender `ConfirmDialog` para soportar variante visual `success`.
- [x] 2.2 Aplicar `FocusActionLayout` y confirmacion de exito en Clientes.
- [x] 2.3 Aplicar `FocusActionLayout` y confirmacion de exito en Unidades.
- [x] 2.4 Aplicar `FocusActionLayout` y confirmacion de exito en Proveedores.
- [x] 2.5 Aplicar `FocusActionLayout` y confirmacion de exito en Impuestos.
- [x] 2.6 Mantener filtros, listados y paginacion fuera del foco visual durante accion activa.

## 3. Validacion

- [x] 3.1 Ejecutar `openspec.cmd validate mejorar-focus-acciones-clientes-unidades-proveedores --type change --strict`.
- [x] 3.2 Ejecutar `npm.cmd run build` en `web`.
- [x] 3.3 Ejecutar `git diff --check`.
- [x] 3.4 Registrar QA manual o pendiente real sin inventar PASS.

Nota QA manual: PASS visual manual reportado por usuario en navegador local.

## 4. Consolidacion documental

- [x] 4.1 Consolidar OpenSpec para indicar alcance final: Clientes, Unidades, Proveedores e Impuestos.
- [x] 4.2 Documentar nombre conceptual: `Focus UX para acciones de catalogo`.
- [x] 4.3 Crear guia reusable `docs/frontend/catalog-action-focus-ux.md`.
- [x] 4.4 Crear evidencia `docs/evidencia-qa-focus-ux-catalogos.md`.
- [x] 4.5 Registrar que QA visual manual queda PASS.

## 5. QA visual manual PASS

Clientes:

- [x] Crear cliente.
- [x] Editar cliente.
- [x] Cancelar accion.
- [x] ConfirmDialog success.
- [x] Mobile.

Unidades:

- [x] Crear unidad.
- [x] Editar unidad.
- [x] Cancelar accion.
- [x] ConfirmDialog success.
- [x] Mobile.

Proveedores:

- [x] Crear proveedor.
- [x] Editar proveedor.
- [x] Cancelar accion.
- [x] ConfirmDialog success.
- [x] Mobile.

Impuestos:

- [x] Crear impuesto.
- [x] Editar impuesto.
- [x] Cancelar accion.
- [x] ConfirmDialog success.
- [x] Mobile.
