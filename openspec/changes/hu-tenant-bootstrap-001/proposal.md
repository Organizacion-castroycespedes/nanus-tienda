## Why

Hoy `POST /api/tenants` solo inserta la fila en `tenants`. Las semillas de menú, permisos, consumidor final, unidades, impuestos y métodos de pago se aplicaron a los tenants existentes cuando corrieron las migraciones (`006`, `007`, `011`, `V058`, `V077`, `V092`, `V105`), pero una empresa creada después queda sin menú, sin permisos y sin catálogos, y no se puede operar hasta que alguien la configure a mano en base de datos.

HU-TENANT-BOOTSTRAP-001 pide que, al crear una empresa desde el SUPER_ADMIN, su configuración base se inicialice de forma segura, atómica y auditable a partir de los registros vigentes del tenant principal (`00000000-0000-0000-0000-000000000001`), sin copiar datos operativos ni configuraciones exclusivas de otra empresa.

## What Changes

- **Alta atómica:** la creación del tenant y su aprovisionamiento corren en una sola transacción PostgreSQL (`REPEATABLE READ`) con el mismo cliente. Si algo falla, no queda ni el tenant ni datos parciales.
- **Aprovisionamiento desde el tenant plataforma** (`PLATFORM_TENANT_ID`), según una matriz explícita COPY / REFERENCE / GENERATE / EXCLUDE / MANUAL:
  - copia menús (con jerarquía remapeada y sin los ítems `PLATFORM_ONLY`), permisos por rol (con `role_id` global), unidades activas, impuestos activos y clasificados con sus tarifas vigentes, y métodos de pago activos con sus vínculos a entidades financieras globales;
  - genera un consumidor final único y predeterminado sin correo, teléfono, dirección ni ubicación del origen;
  - referencia los catálogos globales (roles, catálogos fiscales, entidades financieras globales, parámetros);
  - excluye usuarios, credenciales, sucursales, terminales, cajas, productos, inventario, ventas, compras, documentos y configuración DIAN, overrides de `tenant_settings` y datos del Control Center.
- **Impuestos ambiguos:** si el origen tiene impuestos activos con el mismo tipo y nombre, o sin clasificación fiscal, no se copian; se reportan como pendientes manuales en la respuesta y en la auditoría.
- **Verificación y auditoría:** antes de confirmar se verifican conteos, jerarquía, aislamiento entre tenants y el consumidor final. Se registra `TENANT_BOOTSTRAP_COMPLETED` en `auditoria_eventos` dentro de la transacción, con el resumen.
- **Autorización:** `POST /api/tenants` exige además `PlatformTenantGuard` (SUPER_ADMIN vigente del tenant plataforma, revalidado en base de datos).
- **Kill switch:** `TENANT_BOOTSTRAP_ENABLED=false` vuelve al alta sin catálogos sin desplegar código.
- **Respuesta:** se agrega `bootstrap` (estado, conteos y pendientes manuales) a la respuesta existente; los campos actuales no cambian.

## Capabilities

### New Capabilities

- `tenant-bootstrap`: aprovisionamiento automático, atómico e idempotente de la configuración base de una empresa nueva desde el tenant plataforma.

### Modified Capabilities

Ninguna capacidad publicada en `openspec/specs/` cambia.

## Impact

- **API:** `api/src/modules/tenants/**` (servicio de aprovisionamiento, política, controlador, módulo y pruebas) y `api/.env.example`.
- **Web:** sin cambios. El frontend ya consume `id` y `slug` de la respuesta.
- **Base de datos:** sin migraciones ni cambios de constraints. Usa DML con el usuario runtime, que ya tiene `SELECT, INSERT, UPDATE, DELETE` en `public` (`012_runtime_db_grants.sql`).
- **Comportamiento:** un SUPER_ADMIN de un tenant distinto al plataforma ya no puede crear empresas (403).
