# Evidencia — Registro de menú Gestión Operativa

## Resultado

`scripts/database/014_operational_management_menu.sql` es requerido para registrar la navegación aprobada:

- Padre: `OPERATIONS`, ruta `/{tenant}/operations`, icono `ClipboardList`.
- Hijo: `OPERATIONS_SALES`, ruta `/{tenant}/operations/sales`, icono `ReceiptText`.
- Permiso: `READ` para `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`.

## Correcciones

- Corregido el bug del hijo: `tenant_id` usa `parent.tenant_id`, no `parent.id`.
- Roles son globales y tienen `nombre` único. La pertenencia al tenant vive en `user_roles`; el permiso queda correctamente asociado por `role_menu_permissions.tenant_id`.
- No existe bug de JOIN entre roles por tenant en este esquema. El JOIN global por nombre es consistente con el modelo actual y no amplía el scope backend.
- Corregida la etiqueta a `Gestión Operativa`.
- `seed.sh` ejecuta el SQL después de los seeds de roles/permisos.

## Validación local

En PostgreSQL local desechable, con dos tenants y cuatro roles globales:

- Dos ejecuciones idempotentes: PASS.
- Un padre y un hijo por tenant: PASS.
- `parent_id` y `tenant_id` consistentes: PASS.
- Dieciséis permisos `READ` esperados: PASS.
- Permisos cross-tenant: `0`.
- Rutas e iconos válidos: PASS.

No se ejecutó contra QA ni PROD.

## QA execution gate

## Ejecución QA

Se ejecutó usando exclusivamente `scripts/config/db.env`. La guardia confirmó base `manus_tienda_qa`, esquema `public` y rol QA configurado. Los valores sensibles no se imprimieron.

- `014_operational_management_menu.sql`: primera ejecución PASS.
- Reejecución del mismo SQL: PASS.
- Cada tenant QA: un `OPERATIONS` y un `OPERATIONS_SALES` activo.
- `parent_id` y `tenant_id` del hijo: PASS.
- Rutas, etiquetas e iconos: PASS.
- Permisos `READ`: PASS para los cuatro roles globales; `8` filas esperadas en el tenant QA.
- Mismatches cross-tenant: `0`.
- Duplicados de menú: `0`.
- Duplicados de permisos: `0`.
- Hash y conteo de menús/permisos no relacionados: sin cambios.
- Política `SUPER_ADMIN`: preservada.

No se ejecutaron otros seeds, migraciones, FactuCore ni DIAN.

Validación estática final:

- `014_operational_management_menu.sql` aparece una sola vez en `seed.sh`.
- `bash -n scripts/database/seed.sh`: PASS.
- `git diff --check`: PASS.

## Seguridad

El menú solo controla visibilidad. La autorización de ventas sigue en `OperationalSaleScope` y en los guards backend. La política global existente de `SUPER_ADMIN` no cambia.
