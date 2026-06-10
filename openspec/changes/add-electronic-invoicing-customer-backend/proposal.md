# Propuesta: add-electronic-invoicing-customer-backend

## Resumen ejecutivo

Esta fase define el fortalecimiento backend de clientes/adquirientes para preparar facturacion electronica en Colombia.

El proyecto ya tiene clientes operativos en `api/src/modules/inventory` y tabla `customers`. Ese contrato alimenta ventas, pedidos, POS, reportes y datos demo. Por eso la propuesta no reemplaza el modelo actual. La evolucion debe ser aditiva, tenant-aware y compatible.

La recomendacion es crear un backend especializado bajo `electronic-invoicing/customers` y `electronic-invoicing/dian-acquirer`, usando `customers` como cliente canonico y agregando datos fiscales, catalogos DIAN y trazabilidad de consultas DIAN en fases posteriores.

## Diagnostico actual

### Backend

- `api/` es NestJS con modulos en `api/src/modules`.
- `AppModule` importa `AuthModule`, `UsersModule`, `TenantsModule`, `BranchesModule`, `MenuModule`, `InventoryModule`, `FinanceModule`, `SystemModule` y otros.
- La base de datos se consume con `pg` a traves de `DatabaseService`, repositorios y SQL directo.
- No hay ORM global.
- Los DTOs existen en algunos modulos, pero el modulo actual de clientes usa tipos inline en el controller.

### Clientes actuales

El cliente actual vive en `InventoryModule`:

- `api/src/modules/inventory/controllers/customer.controller.ts`
- `api/src/modules/inventory/services/customer.service.ts`
- `api/src/modules/inventory/repositories/customer.repository.ts`
- `api/src/modules/inventory/entities/customer.entity.ts`

Contrato REST actual:

- `POST /api/customers`
- `GET /api/customers`
- `GET /api/customers/:id`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`

Campos actuales:

- `id`
- `tenantId`
- `name`
- `documentNumber`
- `phone`
- `email`
- `address`
- `departamentoId`
- `municipioId`
- `ciudad`
- `departamento`
- `isActive`
- `createdAt`
- `updatedAt`

Limitaciones actuales:

- No existe `documentTypeCode`.
- No existe `verificationDigit`.
- No existe email especializado de recepcion de factura electronica.
- No existe estado DIAN ni ultima consulta DIAN.
- No hay historial de consultas DIAN.
- No hay auditoria especifica en create/update/delete de clientes.
- El endpoint actual solo usa `JwtAuthGuard`; no usa `RolesGuard` ni `PermissionsGuard`.
- No hay DTOs formales para el contrato fiscal.

### Multi-tenant, companias y sucursales

- `JwtAuthGuard` valida JWT con `JWT_SECRET`, exige `sub`, `tenant_id` y `session_id`, y valida sesion activa en `auth_sessions`.
- El tenant efectivo viaja en `request.user.tenantId`.
- `tenantMiddleware` existe, pero no esta conectado como middleware principal.
- `tenants` representa el tenant SaaS.
- `tenants_detalles` guarda datos fiscales de la compania del tenant: `nit`, `dv`, razon social, regimen, responsabilidades DIAN, resolucion DIAN y otros.
- `tenant_branches` representa sucursales con `estado`, direccion y datos de contacto.
- Usuarios viven en `users`, personas en `personas`, roles en `roles` y `user_roles`.

### SQL y migraciones

Hay dos zonas historicas:

- `api/database/*.sql`
- `scripts/database/**/*.sql`

El flujo mas actual esta en `scripts/database`:

- `scripts/database/migrate.sh`
- `scripts/database/run_migrations.sh`
- `scripts/database/migrations/*.sql`
- `scripts/database/products/*.sql`
- `scripts/database/seed.sh`

Clientes actuales nacen en:

- `scripts/database/products/2026_04_26_inventory_customers.sql`
- `scripts/database/products/2026_04_26_inventory_customers_location.sql`
- `scripts/database/products/2026_04_26_seed_inventory_customers.sql`
- `scripts/database/011_prd_default_customer.sql`

`scripts/database/011_prd_default_customer.sql` agrega `customers.is_default` y un indice unico parcial por tenant para consumidor final.

### Auditoria, soft delete y estado

- `AuditService` escribe en `auditoria_eventos`.
- `BranchesService`, ventas, pedidos, compras y otros flujos ya registran eventos.
- `customers` usa `is_active` para inactivar.
- `menu_items` usa `deleted_at`.
- `users` usa `estado`.
- `tenant_branches` usa `estado`.

### Contratos que no se deben romper

- `customers.id` sigue siendo el `customerId` usado por `orders` y `sales`.
- `POST /api/sales` requiere `customerId`.
- `POST /api/orders` requiere `customerId`.
- Reportes SQL y tickets consultan `customers.name` y `customers.document_number`.
- El consumidor final actual existe como `customers.is_default = true` por tenant.
- Las rutas `/api/customers` deben seguir funcionando para clientes existentes.
- Los flujos POS, pedidos, caja, compras, reporteria y frontend no deben exigir datos fiscales en esta fase.

## Problema

El modelo actual de clientes sirve para POS y CRM basico, pero no tiene la semantica fiscal necesaria para facturacion electronica:

- No distingue tipo de documento DIAN.
- No modela NIT con digito de verificacion.
- No controla unicidad fiscal por tenant.
- No diferencia email general de email de recepcion de factura electronica.
- No registra fuente/manual/DIAN de los datos fiscales.
- No permite consultar DIAN sin sobrescribir datos existentes.
- No deja trazabilidad de consultas DIAN.
- No tiene modulo backend especializado para adquirientes.

## Objetivo funcional

Preparar el backend para gestionar clientes/adquirientes fiscales en Colombia, sin generar facturas electronicas todavia.

El cambio debe definir:

- Gestion fiscal de clientes/adquirientes.
- Catalogo minimo de tipos de documento DIAN.
- Modulos backend `electronic-invoicing/customers` y `electronic-invoicing/dian-acquirer`.
- Integracion DIAN GetAcquirer desacoplada.
- Variables de entorno DIAN.
- Endpoints REST propuestos protegidos con JWT y tenant-aware.
- Reglas funcionales.
- Modelo de datos recomendado.
- DTOs propuestos.
- Casos de uso.
- Criterios de aceptacion.
- Seguridad.
- Riesgos vivos.
- Preguntas pendientes.

## Alcance de esta fase

Incluye:

- Analisis del estado actual.
- Diseno backend.
- Especificacion OpenSpec.
- Contratos API propuestos.
- Modelo de datos recomendado.
- Plan de tareas para implementar en fases futuras.
- Validacion OpenSpec strict.

## Fuera de alcance

No incluye:

- Codigo funcional.
- Migraciones SQL.
- Cambios frontend.
- Cambios en produccion.
- Generacion de facturas electronicas.
- XML UBL.
- Firma digital de factura.
- CUFE/CUDE.
- Numeracion DIAN.
- Integracion real de emision de documentos.
- Cambio de contratos POS actuales.

## Impacto esperado

| Area | Resultado esperado |
| --- | --- |
| Clientes | Datos fiscales confiables por tenant. |
| POS | Sigue operando con `customerId` actual. |
| Facturacion futura | Base lista para identificar adquiriente fiscal. |
| DIAN | Consulta desacoplada y reversible. |
| Seguridad | Datos personales protegidos y auditados. |
| Migracion futura | Cambio aditivo, sin romper clientes existentes. |

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Romper POS o pedidos | Mantener `customers.id` y rutas actuales. |
| Duplicar clientes fiscales | Definir unicidad por `tenant_id`, `document_type_code`, `document_number_normalized`. |
| Sobrescribir datos manuales con DIAN | Usar preview y confirmacion explicita por campo. |
| Depender fuerte de DIAN | Permitir `DIAN_ACQUIRER_ENABLED=false` y registro manual. |
| Exponer datos personales | Enmascarar logs y auditar accesos sensibles. |
| Catalogos DIAN cambian | Catalogo versionado y validacion contra fuente oficial antes de migrar. |
| Consumidor final mal modelado | Conservar `is_default` actual y definir regla fiscal clara antes de implementar. |

## Criterios generales de aceptacion

1. La especificacion valida con `openspec validate add-electronic-invoicing-customer-backend --strict`.
2. No hay cambios funcionales en `api/`.
3. No hay migraciones nuevas.
4. No hay cambios en `web/`.
5. No se toca produccion.
6. El diseno preserva `/api/customers`, ventas, pedidos y reportes actuales.
7. El diseno define endpoints nuevos tenant-aware y protegidos por JWT.
8. El diseno permite desactivar DIAN sin bloquear registro manual.
9. El diseno evita sobrescritura automatica de datos existentes.
10. El diseno registra ultima consulta DIAN y su resultado.

## Preguntas abiertas

PREGUNTA ABIERTA: El consumidor final debe ser unico por tenant o por compania fiscal si en el futuro hay varias companias dentro de un tenant?

PREGUNTA ABIERTA: Cual documento y numero exacto usara el consumidor final para factura electronica segun proveedor tecnologico o DIAN?

PREGUNTA ABIERTA: Se usara DIAN directo, proveedor tecnologico o ambos con una interfaz comun?

PREGUNTA ABIERTA: Que menu key final se usara para permisos: `ELECTRONIC_INVOICING_CUSTOMERS`, `CRM_CUSTOMERS` o una combinacion?

PREGUNTA ABIERTA: La consulta DIAN se hara sincrona desde el formulario o asincrona con job y polling?

PREGUNTA ABIERTA: Que version exacta de catalogos DIAN queda aprobada para la primera migracion?
