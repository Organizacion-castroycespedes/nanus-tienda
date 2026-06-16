## 1. Analysis

- [x] Revisar modal/formulario de cierre de caja.
- [x] Revisar helpers existentes de formato moneda.
- [x] Revisar permisos frontend para inventario y terminales.
- [x] Revisar controllers/guards backend de ubicaciones, lotes, productos, promociones y terminales.
- [x] Revisar origen real de sidebar/menu y atajos operativos.
- [x] Diagnosticar regresion QA: menu dinamico dependia de BD incompleta y fallback local ocultaba/regresaba items.

## 2. Implementation

- [x] Agregar parseo/formato controlado para `Efectivo contado`.
- [x] Mostrar prefijo visual `$` en el campo.
- [x] Mantener `closingAmount` como numero en el payload.
- [x] Permitir `ADMIN` en escrituras operativas de ubicaciones y lotes.
- [x] Permitir `ADMIN` en ajuste de stock de productos.
- [x] Mantener terminales restringido a `SUPER_USER` y `SUPER_ADMIN`.
- [x] Mantener bloqueo de `USER` para escrituras administrativas.
- [x] Mostrar `Productos`, `Ubicaciones`, `Lotes` y `Promociones` en menu para `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`.
- [x] Mostrar `Terminales` en menu para `SUPER_USER` y `SUPER_ADMIN`.
- [x] Evitar duplicar rutas de menu cuando el menu dinamico ya trae el item.
- [x] Restaurar menu dinamico desde `menu_items` y `role_menu_permissions` como fuente principal.
- [x] Agregar SQL idempotente para `Productos`, `Unidades`, `Impuestos`, `Promociones`, `Ubicaciones`, `Lotes` y `Terminales`.
- [x] Aplicar SQL local dos veces para validar idempotencia.
- [x] Eliminar atajos locales de sidebar que reemplazaban o reducian el menu dinamico.
- [x] Confirmar ruta canonica de Terminales como `/{tenant}/config/terminals`.
- [x] Alinear controller/API de Terminales a `CONFIG_TERMINALS`.
- [x] Agregar redirect legado desde `/{tenant}/terminales` hacia la ruta canonica.
- [x] Corregir autorizacion puntual de `SUPER_USER` para `CONFIG_TERMINALS` en guards frontend/API.

## 3. Validation

- [x] `openspec.cmd validate ajustes-operativos-cierre-caja-permisos --type change --strict`
- [x] `openspec.cmd validate --all --strict`
- [x] Tests especificos de parseo/formato de caja.
- [x] Tests especificos de permisos/guards modificados.
- [x] Tests especificos de permisos de visibilidad de menu.
- [x] `cd web && npm.cmd run lint`
- [x] `cd web && npm.cmd run build`
- [x] `cd api && npm.cmd run build`
- [x] `git diff --check`
- [x] `git status --short`
- [ ] QA manual de cierre de caja y rutas/menu por rol.
