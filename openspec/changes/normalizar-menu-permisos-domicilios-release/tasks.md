## 1. Discovery

- [x] 1.1 Verificar cambios SQL actuales de Domicilios en `scripts/database/migrations`.
- [x] 1.2 Confirmar script local inexistente en AWS como causa (`scripts/database/security/20260620_1730_deliveries_permissions_local_qa.sql`) para versionado formal.
- [x] 1.3 Confirmar nombres de columnas de destino:
  - `roles.nombre`
  - `menu_items.key`
  - `role_menu_permissions.access_level`
  - `role_menu_permissions.actions`

## 2. Implementation

- [x] 2.1 Crear migración `scripts/database/migrations/V070__deliveries_menu_permissions_seed.sql`.
- [x] 2.2 Definir `INSERT ... ON CONFLICT` idempotente para `menu_items` `DELIVERIES` con `visible = TRUE`.
- [x] 2.3 Definir `INSERT ... ON CONFLICT` idempotente para `role_menu_permissions`:
  - `USER`: permisos base.
  - `ADMIN`: permisos extendidos.
  - `SUPER_USER`: permisos extendidos.
  - `SUPER_ADMIN`: permisos extendidos.
- [x] 2.4 Generar evidencia QA con consultas de validación y alcance en docs.

## 3. Validation

- [x] 3.1 Generar `docs/evidencia-qa-migracion-v070-domicilios-menu-permisos.md`.
- [x] 3.2 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 3.3 Ejecutar `git diff --check`.
