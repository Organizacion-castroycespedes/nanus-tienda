## Context

- `TenantsService.createTenant` insertaba el tenant con `DatabaseService.query`, que toma y libera una conexión por sentencia; no había transacción ni aprovisionamiento previo (verificado en `develop` 3426fc53).
- Los menús de casi todas las migraciones se siembran recorriendo todos los tenants (`006`, `013`, `014`, `V070`, `V105`…); la excepción es `CONTROL_CENTER` (`V111`), sembrado solo en el tenant plataforma con `metadata.scope = 'PLATFORM_ONLY'`. Por eso copiar del tenant plataforma reproduce la intención de las semillas.
- `roles` es global (`uq_roles_nombre`); `menu_items`, `role_menu_permissions`, `customers`, `units`, `taxes`, `tax_rates`, `payment_methods` y `payment_method_financial_institutions` son tenant-scoped.
- Las FK de `menu_items.parent_id` y `role_menu_permissions.menu_item_id` no exigen el mismo tenant; el aislamiento debe garantizarlo el aprovisionamiento.
- `customers.id`, `units.id` y `taxes.id` no tienen default: hay que generar el UUID.
- `PlatformTenantGuard` y `readControlCenterConfig().platformTenantId` ya existen y se reutilizan.

### Análisis de `tax_rates`

`uq_tax_rates_scope UNIQUE NULLS NOT DISTINCT (tenant_id, tax_id, tax_product_category_id, effective_from)`.

- Las filas que parecen duplicadas por impuesto y fecha (por ejemplo, cuatro tarifas de ICL o ad valórem con `effective_from = 2026-01-01`) se distinguen por `tax_product_category_id` (categorías de licor `16000000-…-0010` a `…-0013`). No violan el constraint.
- `NULLS NOT DISTINCT` solo impide dos tarifas genéricas (`tax_product_category_id` nulo) del mismo impuesto con la misma fecha de inicio.
- La resolución (`fnc_list_product_taxes_for_pricing`, `V079`) toma la categoría exacta antes que la genérica y, dentro de ella, el `effective_from` más reciente vigente.
- Copiar 1:1 las tarifas de cada impuesto copiado, con un UUID nuevo de impuesto, conserva la unicidad del origen. No hace falta tocar el constraint.

La ambigüedad real está en `taxes`, no en `tax_rates`: `V099` referencia en PRD impuestos de licor duplicados ("incluido" y "no incluido") creados fuera del repositorio, con UUID propios de PRD. El repositorio no permite saber cuál es el canónico, así que esos grupos no se copian (D5).

## Goals / Non-Goals

**Goals:**

- Empresa nueva operable con menú, permisos, consumidor final y catálogos base desde el primer login de sus usuarios.
- Atomicidad total entre alta y aprovisionamiento.
- Ninguna fuga de datos operativos, personales, fiscales propios o secretos del tenant plataforma.
- Contrato idempotente y verificable.

**Non-Goals:**

- Crear el primer usuario, la sucursal o las terminales de la empresa (siguen siendo pasos manuales del onboarding).
- Aprovisionar retroactivamente tenants existentes (queda como seguimiento; el servicio ya admite un tenant vacío creado antes).
- Sincronizar cambios futuros del tenant plataforma hacia tenants ya creados.
- Cambiar constraints, migraciones o datos de QA/PRD.

## Decisions

### D1. Servicio NestJS con SQL por conjuntos, sin función SQL nueva

`TenantBootstrapService.bootstrap(client, input)` ejecuta sentencias parametrizadas sobre el cliente transaccional del llamador. Se descartó una función PL/pgSQL porque exigiría una migración `V###` (asignación de `NEXT_SAFE_VERSION` y gobernanza de migraciones), sin ganar atomicidad: el servicio usa la misma transacción que el alta. La matriz vive como código en `tenant-bootstrap.policy.ts` y la prueban los specs.

### D2. Transacción única `REPEATABLE READ`

`createTenant` hace `BEGIN ISOLATION LEVEL REPEATABLE READ`, inserta el tenant, aprovisiona y hace `COMMIT`; ante cualquier error, `ROLLBACK` y `release`. `REPEATABLE READ` da una foto consistente del origen entre todas las sentencias. Solo se escribe en filas nuevas del destino, por lo que no hay conflictos de serialización con quien edite el origen.

### D3. Autorización

`POST /tenants` mantiene `JwtAuthGuard`, `RolesGuard` (`SUPER_ADMIN`) y suma `PlatformTenantGuard`, que revalida en base de datos usuario activo, tenant plataforma activo y rol vigente. Como el alta copia configuración del tenant plataforma, un SUPER_ADMIN de otro tenant no debe poder dispararla.

### D4. Remapeo

- **Menús:** UUID nuevo; `parent_id` se resuelve por `key` (única por tenant entre no eliminados) en una segunda sentencia. Se excluyen los eliminados, los `PLATFORM_ONLY` con todo su subárbol y los hijos cuyo padre está eliminado o pertenece a otro tenant (estos se reportan como manuales).
- **Permisos:** se conservan `role_id`, `access_level` y `actions`; `menu_item_id` se resuelve por `key`.
- **Impuestos y tarifas:** una sola sentencia con CTE `MATERIALIZED` que genera el UUID nuevo de cada impuesto y lo usa para sus tarifas.
- **Métodos de pago:** los vínculos con entidades financieras se resuelven por `codigo`; solo entidades globales activas.

### D5. Reglas fiscales

- Se copian los impuestos activos con `tax_type_id`, `calculation_method_id` y `tax_base_type_id` definidos.
- Un grupo de impuestos activos con el mismo `tax_type_id` y nombre normalizado (`UPPER(BTRIM(name))`) se considera ambiguo: no se copia ninguno y se lista en `bootstrap.manual`.
- Los impuestos activos sin clasificación fiscal también quedan manuales.
- Se copian las tarifas activas no vencidas (`effective_to` nulo o mayor o igual a `CURRENT_DATE` de la base), incluidas las futuras; no se copian vencidas ni inactivas.

### D6. Consumidor final

Se genera uno, activo y predeterminado. Toma como plantilla la identidad del consumidor final del origen (nombre, nombre comercial, tipo y número de documento DIAN, tipo de persona, régimen y responsabilidades) y nunca copia correo, teléfono, dirección, municipio, departamento, códigos de ubicación ni `dian_metadata`. Sin plantilla, usa "Consumidor Final" como en `V058`. Siempre queda `fiscal_status = NOT_REQUIRED`, `fiscal_data_source = MANUAL` e `is_dian_validated = false`.

### D7. Contrato idempotente y tenants parciales

- `pg_advisory_xact_lock` por tenant destino serializa ejecuciones concurrentes sobre el mismo destino.
- Si existe `TENANT_BOOTSTRAP_COMPLETED` para el destino, devuelve el resumen guardado con `status = ALREADY_COMPLETED` y no escribe nada.
- Si el destino ya tiene filas en alguna tabla gestionada sin esa marca, falla con `TENANT_BOOTSTRAP_TARGET_NOT_EMPTY` (409): se trata como parcialmente inicializado y requiere revisión manual, nunca una mezcla automática.
- Un reintento de `POST /tenants` crea otra empresa (comportamiento previo del endpoint); dos altas simultáneas con el mismo slug terminan con una creada y otra con 409, sin residuos.

### D8. Validaciones, verificación y errores

| Código | HTTP | Cuándo |
|---|---|---|
| `TENANT_BOOTSTRAP_INVALID_INPUT` | 422 | UUID inválido o destino igual al origen |
| `TENANT_BOOTSTRAP_SOURCE_MISSING` | 503 | `PLATFORM_TENANT_ID` no existe |
| `TENANT_BOOTSTRAP_SOURCE_INACTIVE` | 503 | Tenant origen inactivo |
| `TENANT_BOOTSTRAP_SOURCE_INCOMPLETE` | 503 | El origen no tiene menú copiable |
| `TENANT_BOOTSTRAP_TARGET_NOT_EMPTY` | 409 | Destino con datos y sin marca de finalización |
| `TENANT_BOOTSTRAP_INTEGRITY_FAILED` | 422 | Falla la verificación final |
| `TENANT_SLUG_TAKEN` | 409 | Colisión concurrente de slug |

La verificación final compara conteos esperados y copiados (menús, hijos, permisos, impuestos y tarifas) y comprueba que no haya padres o menús de otro tenant, ítems `PLATFORM_ONLY`, vínculos a entidades no globales y que exista exactamente un consumidor final predeterminado.

### D9. Auditoría

`auditoria_eventos` con `modulo = tenants`, `entidad = tenants`, `entidad_id = <tenant>`, `accion = TENANT_BOOTSTRAP_COMPLETED`, `usuario_id = actor` y el resumen en `datos_despues`. Se inserta en la misma transacción (no con el `AuditService` asíncrono), así que existe si y solo si el aprovisionamiento se confirmó.

## Matriz de clonación

| Tabla | Decisión | Regla |
|---|---|---|
| `tenants` | GENERATE | Misma transacción. |
| `roles` | REFERENCE | Global; se conserva `role_id`. |
| `menu_items` | COPY | No eliminados; sin `PLATFORM_ONLY` ni subárbol; padre remapeado por `key`. |
| `role_menu_permissions` | COPY | De ítems copiados; `role_id` global. |
| `customers` | GENERATE | Un consumidor final sin datos de contacto ni ubicación. |
| `units` | COPY | Activas; una por abreviatura normalizada. |
| `taxes` | COPY | Activos, clasificados y no ambiguos; el resto, MANUAL. |
| `tax_rates` | COPY | De impuestos copiados; activas y no vencidas. |
| `tax_types`, `tax_calculation_methods`, `tax_base_types`, `tax_categories`, `tax_product_categories` | REFERENCE | Globales. |
| `payment_methods` | COPY | Activos. |
| `payment_method_financial_institutions` | COPY | Solo a entidades globales activas. |
| `financial_institutions` | REFERENCE / EXCLUDE | Globales referenciadas; las del origen, excluidas. |
| `parameters` | REFERENCE | Defaults globales. |
| `tenant_settings` | EXCLUDE | Overrides del origen (afectan facturación electrónica). |
| `tenants_detalles` | MANUAL | Datos legales y bancarios propios. |
| `permissions` | EXCLUDE | Tabla legada sin uso en la API. |
| `users`, `personas`, `user_roles`, `auth_*`, `password_resets`, `pos_user_sessions` | EXCLUDE | Identidades y credenciales. |
| `tenant_branches`, `terminals`, `pos_terminals`, `terminal_*`, `cash_registers` | MANUAL | Infraestructura propia. |
| `products*`, `product_categories`, `product_subcategories`, `promotions*`, `inventory_*`, `stock_*`, `suppliers` | EXCLUDE | Comercial e inventario. |
| `sales*`, `orders*`, `purchases*`, `payments`, `cash_*`, `deliveries*`, `delivery_drivers` | EXCLUDE | Operativo. |
| `tenant_electronic_billing_configs`, `electronic_*` | EXCLUDE | Resoluciones, llaves, credenciales, historial DIAN. |
| `control_center.*` | EXCLUDE | Datos comerciales de la plataforma. |
| `auditoria_eventos` | GENERATE | Un evento de finalización. |

## Risks / Trade-offs

- **Configuración real de PRD desconocida.** El repositorio no reproduce el catálogo fiscal de PRD (ver hallazgos). Mitigación: impuestos ambiguos y sin clasificar no se copian y se reportan; QA debe revisar `bootstrap.manual` y los conteos en una copia de PRD antes de promover.
- **Personalizaciones del tenant plataforma se propagan** (etiquetas, visibilidad, permisos editados desde la UI). Es la intención de la HU ("registros vigentes"). `ELECTRONIC_BILLING_PROVIDERS` se copia porque `V105` lo siembra en todos los tenants.
- **Cambio de autorización.** Un SUPER_ADMIN de otro tenant pierde el alta de empresas. Requiere confirmación del propietario; revertirlo es quitar `@UseGuards(PlatformTenantGuard)`.
- **Futuras migraciones de menú** deben seguir recorriendo todos los tenants o, si son exclusivas del plataforma, marcar `metadata.scope = 'PLATFORM_ONLY'`.
- **Fecha de vigencia:** se usa `CURRENT_DATE` de la base. Si la zona horaria del servidor no es Bogotá, una tarifa que vence hoy podría tratarse distinto cerca de medianoche.

## Migration Plan

Sin migraciones. Despliegue de API con `TENANT_BOOTSTRAP_ENABLED=true` (default). Orden: LOCAL → QA (con copia saneada de PRD) → PRD con aprobación.

## Rollback

1. **Inmediato, sin despliegue:** `TENANT_BOOTSTRAP_ENABLED=false` y reinicio de la API. El alta vuelve a insertar solo el tenant.
2. **Código:** revertir el commit. No hay cambios de esquema.
3. **Datos:** un alta fallida no deja datos (transacción única). Para retirar una empresa creada con aprovisionamiento antes de usarla: borrar en una transacción las filas del tenant en `auditoria_eventos`, `customers`, `units`, `taxes` (arrastra `tax_rates`) y luego `tenants` (arrastra menús, permisos y métodos de pago), solo con aprobación y respaldo.

## Open Questions

Resueltas por el propietario (2026-11-11):

- el alta de empresas queda restringida al SUPER_ADMIN del tenant plataforma (D3);
- los impuestos ambiguos "incluido/no incluido" quedan como configuración manual; la limpieza del catálogo de PRD, si se hace, será una tarea aparte con respaldo y aprobación.

Pendiente:

- ¿Se debe aprovisionar retroactivamente a los tenants creados sin catálogos? El servicio lo admite solo si el tenant está vacío.
