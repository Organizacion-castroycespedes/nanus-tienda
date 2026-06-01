# Diseno: add-electronic-invoicing-customer-backend

## Contexto actual observado

### Estructura backend

`api/` es el backend principal NestJS. Su estructura real:

```text
api/
  src/
    main.ts
    modules/
      app.module.ts
      auth/
      users/
      tenants/
      branches/
      menu/
      inventory/
      finance/
      system/
      ...
    common/
      db/
      guards/
      decorators/
      services/
```

`main.ts` carga `.env`, configura CORS y usa prefijo global `/api`.

`DatabaseService` centraliza consultas `pg`. Los modulos usan repositorios con SQL directo.

### Modulo de clientes actual

El cliente actual esta dentro de `InventoryModule`, no en un modulo fiscal:

```text
api/src/modules/inventory/controllers/customer.controller.ts
api/src/modules/inventory/services/customer.service.ts
api/src/modules/inventory/repositories/customer.repository.ts
api/src/modules/inventory/entities/customer.entity.ts
```

Rutas actuales:

| Metodo | Ruta | Uso |
| --- | --- | --- |
| POST | `/api/customers` | Crear cliente operativo. |
| GET | `/api/customers` | Listar clientes del tenant. |
| GET | `/api/customers/:id` | Obtener cliente. |
| PUT | `/api/customers/:id` | Actualizar cliente. |
| DELETE | `/api/customers/:id` | Inactivar cliente con `is_active = false`. |

El controller actual usa `JwtAuthGuard` y obtiene `tenantId` desde `request.user.tenantId`.

El modelo actual valida:

- UUID de `id`.
- UUID de `tenantId`.
- `name` requerido.
- email con regex basico.
- UUID opcional de departamento y municipio.

No valida:

- tipo documento DIAN.
- digito de verificacion.
- unicidad por documento.
- consumidor final protegido.
- email fiscal separado.
- DIAN status.

### Tablas y SQL actuales de clientes

Tabla actual propuesta por scripts:

```text
customers
  id uuid primary key
  tenant_id uuid not null
  name varchar(255) not null
  document_number varchar(100) null
  phone varchar(50) null
  email varchar(255) null
  address text null
  departamento_id uuid null
  municipio_id uuid null
  ciudad varchar(150) null
  departamento varchar(150) null
  is_active boolean not null default true
  created_at timestamptz
  updated_at timestamptz
```

`scripts/database/011_prd_default_customer.sql` agrega:

```text
customers.is_default boolean not null default false
unique (tenant_id) where is_default = true
```

El seed crea un cliente `CONSUMIDOR FINAL` por tenant.

### Multi-tenant, auth y permisos

`JwtAuthGuard`:

- verifica Bearer token.
- exige `sub`, `tenant_id` y `session_id`.
- valida sesion activa en `auth_sessions`.
- adjunta `request.user.id`, `request.user.roles`, `request.user.tenantId` y `request.user.sessionId`.

`PermissionsGuard`:

- consulta `role_menu_permissions`.
- usa `menu_items`.
- permite bypass a `SUPER_ADMIN`.
- soporta `actions` por menu.

`RolesGuard`:

- compara roles del JWT contra `@Roles`.

Patron recomendado para el nuevo modulo:

```text
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
@RequirePermission({ menuKey: "ELECTRONIC_INVOICING_CUSTOMERS", level: "READ|WRITE" })
```

Decision cerrada:

- Menu key principal: `ELECTRONIC_INVOICING_CUSTOMERS`.
- Menu keys futuras reservadas: `ELECTRONIC_INVOICING_DOCUMENTS`, `ELECTRONIC_INVOICING_SETTINGS` y `ELECTRONIC_INVOICING_REPORTS`.
- Los seeds de menu/permisos se disenan en una fase posterior. Esta fase solo fija nombres.

### Companias y sucursales

`tenants` es el tenant SaaS.

`tenants_detalles` contiene la informacion fiscal de la compania del tenant:

- razon social.
- NIT.
- DV.
- tipo persona.
- responsabilidades DIAN.
- regimen.
- obligado a facturacion electronica.
- resolucion DIAN.
- direccion fiscal.
- representante legal.

`tenant_branches` contiene sucursales y establecimientos.

Decision recomendada:

- En esta fase, el alcance fiscal de cliente queda por `tenant_id`.
- Si luego se agrega tabla de companias multiples, se debe elevar la unicidad fiscal a `company_id`.
- No usar `branch_id` para definir identidad fiscal del adquiriente.
- La sucursal viene del contexto de venta, pedido o POS, no del cliente.
- El consumidor final debe existir una sola vez por tenant, no una vez por sucursal.

### Migraciones actuales

Hay SQL historico en `api/database`, pero el flujo operativo esta en `scripts/database`.

Patron observado:

- scripts idempotentes.
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- `CREATE TABLE IF NOT EXISTS`.
- `CREATE INDEX IF NOT EXISTS`.
- migraciones versionadas en `scripts/database/migrations`.
- seeds separados.

Decision:

- FE-0.1 no creo migraciones.
- FE-1 crea migraciones SQL seguras y rollback conservador para preparar datos fiscales.
- La fase de implementacion debe usar `scripts/database/migrations/YYYYMMDD_*.sql`.
- Los seeds de catalogo DIAN y permisos deben ir separados.

### Auditoria y estados

`AuditService` escribe en `auditoria_eventos` de forma asincrona.

Patrones actuales:

- `is_active` en `customers`, productos, unidades, impuestos y terminales.
- `estado` en usuarios y sucursales.
- `deleted_at` en `menu_items`.
- `auditoria_eventos` para eventos funcionales.
- `security_audit_logs` existe para menu/admin.

Decision:

- El nuevo modulo debe registrar auditoria en `auditoria_eventos`.
- Desactivar cliente fiscal debe usar `is_active=false`, no delete fisico.
- El consumidor final no debe inactivarse ni eliminarse.
- Las consultas DIAN o proveedor deben registrar evento de consulta y resultado, sin guardar datos sensibles innecesarios.
- La primera version no debe guardar raw response completo de DIAN/proveedor.
- La trazabilidad debe guardar solo resumen operativo: `status`, `statusCode`, `message`, `provider`, `lookupAt`, `requestHash` y `responseSummary`.
- Si una fase futura requiere raw response, debe guardarse cifrado o en almacenamiento seguro, no como JSON plano en base transaccional.

## Contratos existentes que no se deben romper

| Contrato | Motivo |
| --- | --- |
| `GET /api/customers` | Lo usa frontend actual de clientes/POS. |
| `POST /api/customers` | Flujo operativo actual. |
| `PUT /api/customers/:id` | Edicion operativa actual. |
| `DELETE /api/customers/:id` | Inactivacion actual. |
| `customers.id` | FK logica usada por `orders` y `sales`. |
| `customers.name` | Reportes, tickets y listados. |
| `customers.document_number` | Reportes y busquedas actuales. |
| `customers.is_active` | Validacion de venta en `SaleRepository.validateCustomer`. |
| `customers.is_default` | Consumidor final por tenant. |
| `orders.customer_id` | Pedidos. |
| `sales.customer_id` | POS y ventas. |
| `inventory_create_sale*` | Funciones SQL criticas de POS. |
| `inventory_invoice_order` | Facturacion operativa de pedidos como venta interna, no FE. |

## Arquitectura propuesta

Crear un modulo backend nuevo y especializado:

```text
api/src/modules/electronic-invoicing/
  electronic-invoicing.module.ts
  customers/
    controllers/electronic-invoicing-customers.controller.ts
    services/electronic-invoicing-customers.service.ts
    repositories/electronic-invoicing-customers.repository.ts
    entities/electronic-invoicing-customer.entity.ts
    dto/
  dian-acquirer/
    controllers/dian-acquirer.controller.ts
    services/dian-acquirer.service.ts
    gateways/dian-acquirer.gateway.ts
    gateways/dian-soap-acquirer.gateway.ts
    repositories/dian-acquirer-lookups.repository.ts
    dto/
  document-types/
    controllers/dian-document-types.controller.ts
    services/dian-document-types.service.ts
    repositories/dian-document-types.repository.ts
```

El modulo nuevo debe leer/escribir la identidad canonica en `customers`, no crear una tabla paralela de clientes.

Razon:

- `customers.id` ya es usado por ventas y pedidos.
- Duplicar cliente fiscal y cliente POS crea riesgo de dos identidades para el mismo adquiriente.
- La facturacion electronica futura necesita el mismo `customerId` que ventas.

### Ajuste FE-2.1R: backend especializado y sincronizacion fiscal de terceros

La vision estrategica agrega un backend especializado `backend-facturacion-electronica/`. Ese servicio no reemplaza el modulo FE actual dentro de `api/`.

Decision:

- `api/` conserva `customers` y `suppliers` como tablas operativas canonicas.
- `api/` conserva POS, ventas, pedidos, compras, pagos, inventario y endpoints operativos.
- `backend-facturacion-electronica/` sera capa de consulta, normalizacion y sincronizacion fiscal de terceros.
- Backend FE podra consultar fuentes fiscales externas o mock/provider.
- Backend FE podra solicitar a `api/` crear o actualizar `customers` y `suppliers`.
- Backend FE no debe duplicar `customers` ni `suppliers` como fuente principal.
- Backend FE debe registrar logs seguros de lookup y sync.
- La primera version no guarda raw response completo; guarda resumen operativo seguro.
- Todo lookup/sync debe ser idempotente por `tenantId + partyType + documentTypeCode + documentNumberNormalized`.

`GetAcquirer` se considera fuente candidata para adquirientes/clientes. La guia DIAN de consumo de Web Services describe GetAcquirer como servicio para completar informacion de adquirientes y usa `identificationType` e `identificationNumber` como datos de request. Para proveedores, el diseno queda provider-agnostic porque la fuente puede ser proveedor tecnologico, RUT, captura manual validada u otra fuente aprobada.

Referencia: [DIAN - Guia Herramienta para el Consumo de Web Services](https://www.dian.gov.co/impuestos/factura-electronica/Documents/Guia-Herramienta-para-el-Consumo-de-Web-Services.pdf).

## Separacion de responsabilidades

| Componente | Responsabilidad |
| --- | --- |
| `electronic-invoicing/customers` | CRUD fiscal, validaciones, consumidor final, auditoria. |
| `electronic-invoicing/dian-acquirer` | Consultar adaptador configurado, normalizar respuesta, preview, aplicar con confirmacion. |
| `ElectronicInvoicingProviderAdapter` | Interfaz futura desacoplada para `MOCK_LOCAL`, DIAN directo o proveedor tecnologico. |
| `customers` | Identidad canonica del cliente/adquiriente. |
| `suppliers` | Identidad canonica del proveedor operativo para compras e inventario. |
| `backend-facturacion-electronica/customers-sync` | Consulta y normalizacion fiscal de adquirientes; solicita upsert en `api/` si existe o no existe customer. |
| `backend-facturacion-electronica/suppliers-sync` | Consulta fiscal provider-agnostic de proveedores; solicita upsert en `api/` si existe o no existe supplier. |
| `dian_document_types` | Catalogo versionado de tipos de documento. |
| `dian_acquirer_lookup_logs` | Trazabilidad resumida de consultas DIAN/proveedor/mock. |
| `fiscal_party_lookup_logs` futuro | Trazabilidad de lookup y sync de customers/suppliers sin raw response completo. |
| `auditoria_eventos` | Auditoria funcional de cambios y aplicacion de datos DIAN. |

## Decisiones funcionales cerradas FE-0.1

### Integracion DIAN/proveedor

El diseno sera provider-agnostic. No se amarra todavia a DIAN directo ni a proveedor tecnologico.

La fase futura debe preparar una capa `ElectronicInvoicingProviderAdapter`. Esa capa podra tener implementaciones como:

- `MOCK_LOCAL`: preview local y pruebas sin consumo externo.
- `DIAN_DIRECT`: consumo directo DIAN si se aprueba despues.
- `PROVIDER`: proveedor tecnologico si se aprueba despues.

La primera implementacion puede funcionar en modo `MOCK_LOCAL` o preview. Esto permite cerrar modelo y UX backend sin depender todavia de credenciales, certificados, SLA o contrato de proveedor.

### Consumidor final

Debe existir un consumidor final por tenant.

Reglas cerradas:

- No duplicar consumidor final por sucursal.
- La sucursal se toma del contexto de venta, pedido o POS.
- El cliente consumidor final usa la identidad canonica `customers.id`.
- Debe existir endpoint para asegurar el consumidor final default.
- El consumidor final es fallback cuando no hay cliente identificado.
- POS debe poder vender con consumidor final sin email fiscal.

### Email fiscal

`fiscalEmail` no sera obligatorio al crear cliente fiscal.

Sera requerido solo cuando el flujo de emision electronica nominada lo necesite. El backend podra guardar clientes incompletos fiscalmente, pero una fase de emision debera bloquear factura electronica nominada si falta el email requerido.

### Catalogos

`dian_document_types` debe ser catalogo versionable.

Reglas cerradas:

- No hardcodear tipos de documento DIAN en codigo funcional.
- No sembrar catalogo hasta confirmar fuente vigente.
- El catalogo debe conservar metadatos de version/fuente para permitir cambios DIAN o proveedor.

### Compatibilidad

La ruta actual `/api/customers` no debe romperse.

Reglas cerradas:

- Los campos fiscales nuevos son opcionales inicialmente.
- Ventas, pedidos, POS y reportes actuales siguen usando `customers.id`, `name`, `document_number` e `is_active`.
- El consumidor final funciona como fallback cuando no haya cliente identificado.
- No se cambia frontend ni `backend-reporteria` en esta fase.

### Customers sync desde backend FE

El backend especializado podra consultar fuente fiscal, normalizar respuesta y sincronizar hacia `customers` mediante `api/`.

Flujo si customer existe:

1. Backend FE recibe `tenantId`, `documentTypeCode` y `documentNumber`.
2. Calcula `documentNumberNormalized` e idempotency key.
3. Consulta fuente configurada: `MOCK_LOCAL`, GetAcquirer, proveedor tecnologico o manual validado.
4. Normaliza respuesta fiscal.
5. Solicita a `api/` actualizar campos permitidos.
6. `api/` valida tenant, duplicados y politica de sobrescritura.
7. Se registra auditoria funcional y log de sync.

Flujo si customer no existe:

1. Backend FE consulta y normaliza datos.
2. Solicita a `api/` crear customer en `customers`.
3. `api/` crea registro compatible con `/api/customers`, ventas y POS.
4. Backend FE registra `syncAction = CREATED` y referencia `customerId`.

### Suppliers sync desde backend FE

El backend especializado podra consultar fuente fiscal de proveedores y sincronizar hacia `suppliers` mediante `api/`.

Flujo si supplier existe:

1. Backend FE recibe `tenantId`, `documentTypeCode` y `documentNumber`.
2. Consulta fuente provider-agnostic aprobada.
3. Normaliza respuesta.
4. Solicita a `api/` actualizar campos permitidos del supplier.
5. `api/` conserva compatibilidad con compras e inventario.
6. Se registra auditoria funcional y log de sync.

Flujo si supplier no existe:

1. Backend FE consulta fuente fiscal o recibe datos manuales normalizados.
2. Solicita a `api/` crear supplier en `suppliers`.
3. `api/` crea proveedor operativo compatible con compras e inventario.
4. Backend FE registra `syncAction = CREATED` y referencia `supplierId`.

Decision: GetAcquirer no se asume como fuente de proveedores. Para suppliers se requiere adapter provider-agnostic y confirmacion de fuente en FE-2.3/FE-2.8.

### Diseno FE-2.4A: suppliers fiscales en `api/`

El analisis de `suppliers` confirma que la tabla actual es operativa y no fiscal. Tiene `id`, `tenant_id`, `name`, `document_number`, contacto, ubicacion, `is_active`, `created_at` y `updated_at`. No tiene tipo de documento, numero normalizado, DV, razon social fiscal, email fiscal, estado fiscal ni ultima consulta.

Decision:

- `suppliers` debe evolucionar de forma aditiva antes de sync fiscal real.
- No se crea tabla paralela de proveedores.
- Compras siguen usando `purchases.supplier_id`.
- `/api/suppliers` debe seguir funcionando.
- Los campos fiscales nuevos deben ser opcionales inicialmente.
- La fuente fiscal de suppliers debe ser provider-agnostic.

Campos candidatos para migracion futura:

| Campo | Regla |
| --- | --- |
| `document_type_code` | Opcional inicialmente. |
| `document_number_normalized` | Derivado de `document_number`. |
| `verification_digit` | Para NIT si aplica. |
| `legal_name` | Razon social fiscal. |
| `fiscal_email` | Email fiscal opcional. |
| `fiscal_last_lookup_at` | Ultima consulta fiscal provider-agnostic. |
| `fiscal_last_lookup_status` | `PENDING`, `FOUND`, `NOT_FOUND`, `ERROR`, `SKIPPED`. |
| `fiscal_status` | `PENDING`, `VALIDATED`, `FAILED`, `NOT_REQUIRED`. |

Endpoints futuros propuestos:

```http
GET /api/electronic-invoicing/suppliers
POST /api/electronic-invoicing/suppliers
PATCH /api/electronic-invoicing/suppliers/:id
```

Reglas futuras:

- No duplicar proveedor activo por tenant + tipo documento + numero normalizado.
- `fiscalEmail` opcional.
- `documentNumberNormalized` derivado de `documentNumber`.
- No exigir `documentTypeCode` a proveedores existentes.
- No bloquear compras por datos fiscales incompletos.
- Auditar before/after de cambios fiscales.
- No sobrescribir datos manuales sin politica aprobada.

Documento de detalle: `docs/diseno-suppliers-fiscales-fe-2-4A.md`.

### Migracion FE-2.4B: suppliers fiscales

Archivos creados:

- `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1.sql`
- `scripts/database/migrations/20260604_electronic_invoicing_suppliers_phase_1_rollback.sql`
- `docs/runbook-migracion-suppliers-fe-fase-fe-2-4B.md`

Alcance:

- Extension aditiva de `suppliers`.
- Campos fiscales opcionales inicialmente.
- Backfill seguro de `document_number` hacia `document_number_normalized`.
- Constraints para `fiscal_status` y `fiscal_last_lookup_status`.
- Indices para documento normalizado, estado fiscal y ultimo lookup.
- Rollback conservador que elimina datos fiscales nuevos sin tocar `purchases`.
- Sin cambios funcionales backend, frontend, `backend-reporteria`, endpoints ni ejecucion SQL.

Decision fisica:

- Se usa `tenant_id` existente en `suppliers`.
- No se crea unique fiscal en esta fase porque pueden existir duplicados historicos por `document_number`.
- La unicidad fuerte por `tenant_id + document_type_code + document_number_normalized` queda para una fase posterior con diagnostico y limpieza.

### Idempotencia de terceros fiscales

Clave recomendada:

```text
tenantId:partyType:documentTypeCode:documentNumberNormalized
```

Reglas:

- Reintentar el mismo lookup no debe crear duplicados.
- Reintentar el mismo sync debe devolver el mismo `customerId` o `supplierId`.
- Operaciones concurrentes para la misma clave deben bloquearse o responder `PENDING`.
- Conflictos por duplicados existentes deben resolverse antes de crear.
- `requestHash` y `correlationId` deben permitir trazabilidad sin exponer payload completo.

## Modelo de datos recomendado

Modelo fisico recomendado para FE-1:

### Migraciones FE-1 creadas

Archivos:

- `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1.sql`
- `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1_rollback.sql`

Alcance:

- Extension aditiva de `customers`.
- Catalogo versionable `dian_document_types` sin seed inicial.
- Logs resumidos `dian_acquirer_lookup_logs`.
- Indice unico parcial para un consumidor final activo por tenant.
- Rollback conservador que elimina datos fiscales nuevos, sin tocar ventas ni pedidos.
- Sin cambios funcionales backend, frontend, `backend-reporteria` ni endpoints.

### `customers` aditivo

FE-1 agrega columnas fiscales opcionales con defaults seguros:

| Campo | Tipo recomendado | Regla |
| --- | --- | --- |
| `document_type_code` | text null | FK logica futura a catalogo DIAN. No obligatorio para clientes existentes. |
| `document_number_normalized` | text null | Normalizado desde `document_number` cuando exista. |
| `verification_digit` | text null | Solo para NIT cuando aplique. |
| `legal_name` | text null | Razon social o nombre fiscal. |
| `fiscal_email` | text null | Email de recepcion FE. No obligatorio al crear cliente. |
| `is_final_consumer` | boolean not null default false | Alias fiscal de consumidor final. |
| `dian_last_lookup_at` | timestamptz null | Ultima consulta. |
| `dian_last_lookup_status` | text null | `PENDING`, `FOUND`, `NOT_FOUND`, `ERROR`, `SKIPPED`. |
| `fiscal_status` | text not null default `PENDING` | `PENDING`, `VALIDATED`, `FAILED`, `NOT_REQUIRED`. |

Campos como `trade_name`, regimen, responsabilidades, ubicacion fiscal granular, `created_by` y `updated_by` quedan para fases posteriores si la emision electronica los exige.

Indices recomendados:

```text
idx_customers_tenant_document_number_normalized
  on customers (tenant_id, document_number_normalized)
  where document_number_normalized is not null

ux_customers_tenant_active_final_consumer
  unique (tenant_id)
  where is_final_consumer = true
    and is_active = true
```

Nota: FE-1 no crea unicidad fiscal por documento porque `document_type_code` sigue opcional y el backfill puede ser ambiguo. Esa unicidad queda para cuando se confirme catalogo y estrategia de limpieza. Si se confirma compania fiscal multiple por tenant, esos indices deben cambiar a `company_id`.

### `dian_document_types`

Catalogo recomendado:

| Campo | Tipo |
| --- | --- |
| `id` | uuid primary key |
| `code` | text not null |
| `name` | text not null |
| `description` | text null |
| `country_code` | text not null default `CO` |
| `is_active` | boolean not null default true |
| `valid_from` | date null |
| `valid_to` | date null |
| `created_at` | timestamptz not null default `now()` |
| `updated_at` | timestamptz not null default `now()` |

Catalogo candidato a confirmar antes de migrar:

| Codigo | Nombre |
| --- | --- |
| `11` | Registro civil de nacimiento |
| `12` | Tarjeta de identidad |
| `13` | Cedula de ciudadania |
| `21` | Tarjeta de extranjeria |
| `22` | Cedula de extranjeria |
| `31` | NIT |
| `41` | Pasaporte |
| `42` | Tipo de documento extranjero |
| `43` | Sin identificacion del exterior o uso DIAN |
| `47` | Permiso Especial de Permanencia |
| `48` | Permiso por Proteccion Temporal |

Decision: El catalogo no se hardcodea en codigo. El seed idempotente solo se crea despues de confirmar fuente vigente DIAN o proveedor aprobado.

FE-1 crea `ux_dian_document_types_country_code_code` para evitar codigos duplicados por pais. No siembra datos.

SUPUESTO TECNICO PENDIENTE: `31` NIT requiere digito de verificacion. La formula de DV debe implementarse en backend antes de guardar o permitir DV manual validado.

### `dian_acquirer_lookup_logs`

Tabla recomendada para trazabilidad:

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | uuid pk | Identificador. |
| `tenant_id` | uuid not null | Scope obligatorio. |
| `customer_id` | uuid null | Si consulta cliente existente. |
| `provider` | text not null | `MOCK_LOCAL`, `DIAN_DIRECT`, `PROVIDER` u otro proveedor aprobado. |
| `document_type_code` | text null | Tipo consultado. |
| `document_number` | text null | Numero consultado. |
| `request_hash` | text null | Hash para trazabilidad sin exponer payload completo. |
| `lookup_status` | text not null | `FOUND`, `NOT_FOUND`, `ERROR`, `SKIPPED`. |
| `status_code` | text null | Codigo de proveedor, DIAN o mock. |
| `message` | text null | Mensaje operativo resumido. |
| `response_summary` | jsonb null | Datos normalizados resumidos. |
| `looked_up_by` | uuid null | Usuario actor. |
| `looked_up_at` | timestamptz not null default `now()` | Fecha/hora de consulta. |
| `created_at` | timestamptz not null default `now()` | Fecha de registro. |

No guardar certificados, passwords, XML crudo ni raw response DIAN/proveedor completo en esta tabla. Si una fase futura exige raw response, usar cifrado o almacenamiento seguro con referencia controlada.

## Variables de entorno DIAN propuestas

Estas variables son solo diseno. No se agregan todavia a `.env.example`.

| Variable | Default | Uso |
| --- | --- | --- |
| `DIAN_ACQUIRER_ENABLED` | `false` | Apaga consulta DIAN sin afectar registro manual. |
| `DIAN_ENV` | `sandbox` | `sandbox` o `production`. |
| `DIAN_ACQUIRER_WSDL_URL` | vacio | URL WSDL o endpoint configurado. |
| `DIAN_ACQUIRER_SOAP_ACTION` | `http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer` | SOAP action de GetAcquirer. |
| `DIAN_ACQUIRER_TIMEOUT_MS` | `8000` | Timeout por request. |
| `DIAN_ACQUIRER_CACHE_TTL_SECONDS` | `86400` | Cache de consulta exitosa si aplica. |
| `DIAN_CERT_PATH` | vacio | Certificado para consumo del servicio si aplica. |
| `DIAN_CERT_BASE64` | vacio | Alternativa para contenedor. |
| `DIAN_CERT_PASSWORD` | vacio | Password via secreto. |
| `DIAN_PROVIDER_NAME` | `DIAN_DIRECT` | Para gateway directo o proveedor. |
| `DIAN_LOG_RAW_RESPONSES` | `false` | Debe estar apagado por defecto. |

Estas variables no significan firma digital de facturas. Solo preparan consulta de adquiriente.

Decision FE-0.1: Estos nombres son candidatos, no contrato cerrado. La abstraccion final debe permitir `MOCK_LOCAL` sin credenciales externas y debe evitar una dependencia temprana con DIAN directo o proveedor tecnologico.

## Integracion provider-agnostic de adquiriente

Preparar interfaz futura:

```ts
export type DianAcquirerLookupInput = {
  tenantId: string;
  documentTypeCode: string;
  documentNumber: string;
  verificationDigit?: string | null;
};

export type DianAcquirerLookupResult = {
  status: "SUCCESS" | "NOT_FOUND" | "ERROR" | "DISABLED";
  statusCode?: string | null;
  message?: string | null;
  provider: "MOCK_LOCAL" | "DIAN_DIRECT" | "PROVIDER";
  lookupAt: string;
  normalized?: {
    documentTypeCode: string;
    documentNumber: string;
    verificationDigit?: string | null;
    legalName?: string | null;
    tradeName?: string | null;
    fiscalEmail?: string | null;
    taxRegime?: string | null;
    taxResponsibilities?: string[];
    address?: string | null;
    departmentCode?: string | null;
    municipalityCode?: string | null;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

export interface ElectronicInvoicingProviderAdapter {
  lookup(input: DianAcquirerLookupInput): Promise<DianAcquirerLookupResult>;
}
```

Reglas:

- Si la integracion externa esta apagada, responder `DISABLED`.
- Si el modo es `MOCK_LOCAL`, devolver preview controlado sin llamar servicios externos.
- Si DIAN no responde, permitir registro manual.
- Si DIAN/proveedor responde, no persistir cambios automaticamente.
- Mostrar preview normalizado.
- Aplicar cambios solo con confirmacion explicita y seleccion de campos.
- Registrar lookup en `dian_acquirer_lookup_logs`.
- Registrar aplicacion en `auditoria_eventos`.
- Guardar solo resumen operativo de respuesta, no raw response completo.

## Contratos API propuestos

Todos los endpoints deben usar `/api` por prefijo global.

### Catalogo de documentos

```http
GET /api/electronic-invoicing/document-types
```

Respuesta:

```json
[
  {
    "code": "31",
    "name": "NIT",
    "shortName": "NIT",
    "requiresVerificationDigit": true,
    "isActive": true
  }
]
```

### Clientes fiscales

```http
GET /api/electronic-invoicing/customers?search=&documentTypeCode=&isActive=&dianStatus=
GET /api/electronic-invoicing/customers/:id
POST /api/electronic-invoicing/customers
PATCH /api/electronic-invoicing/customers/:id
PATCH /api/electronic-invoicing/customers/:id/status
GET /api/electronic-invoicing/customers/default
POST /api/electronic-invoicing/customers/default/ensure
```

`POST /api/electronic-invoicing/customers` body propuesto:

```json
{
  "name": "ACME SAS",
  "legalName": "ACME SAS",
  "tradeName": "ACME",
  "documentTypeCode": "31",
  "documentNumber": "900123456",
  "verificationDigit": "7",
  "email": "contacto@acme.co",
  "fiscalEmail": "facturacion@acme.co",
  "phone": "+57 300 0000000",
  "address": "Cra 1 # 2-3",
  "fiscalAddress": "Cra 1 # 2-3",
  "countryCode": "CO",
  "departmentCode": "11",
  "municipalityCode": "11001",
  "taxRegime": "RESPONSABLE_IVA",
  "taxResponsibilities": ["R-99-PN"],
  "organizationType": "JURIDICA"
}
```

Respuesta propuesta:

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "name": "ACME SAS",
  "documentTypeCode": "31",
  "documentNumber": "900123456",
  "verificationDigit": "7",
  "documentNumberNormalized": "900123456",
  "fiscalEmail": "facturacion@acme.co",
  "isFinalConsumer": false,
  "isActive": true,
  "fiscalSource": "MANUAL",
  "dianLastLookupAt": null,
  "dianLastLookupStatus": null,
  "createdAt": "iso-date",
  "updatedAt": "iso-date"
}
```

### Consulta DIAN GetAcquirer

Preview sin persistir:

```http
POST /api/electronic-invoicing/dian-acquirer/lookup/preview
```

Body:

```json
{
  "documentTypeCode": "31",
  "documentNumber": "900123456",
  "verificationDigit": "7"
}
```

Respuesta:

```json
{
  "lookupId": "uuid",
  "status": "SUCCESS",
  "statusCode": "OK",
  "message": "Consulta exitosa",
  "provider": "MOCK_LOCAL",
  "lookupAt": "iso-date",
  "manualRegistrationAllowed": true,
  "normalized": {
    "documentTypeCode": "31",
    "documentNumber": "900123456",
    "verificationDigit": "7",
    "legalName": "ACME SAS",
    "fiscalEmail": "facturacion@acme.co"
  },
  "fieldDiffs": [
    {
      "field": "legalName",
      "currentValue": "ACME",
      "dianValue": "ACME SAS",
      "suggestedAction": "KEEP_MANUAL"
    }
  ]
}
```

Consultar para cliente existente:

```http
POST /api/electronic-invoicing/dian-acquirer/customers/:id/lookup
```

Aplicar resultado:

```http
POST /api/electronic-invoicing/dian-acquirer/customers/:id/apply
```

Body:

```json
{
  "lookupId": "uuid",
  "overwriteConfirmed": true,
  "fieldStrategy": {
    "legalName": "USE_DIAN",
    "fiscalEmail": "KEEP_MANUAL",
    "taxResponsibilities": "MERGE"
  }
}
```

Historial:

```http
GET /api/electronic-invoicing/dian-acquirer/lookups?customerId=&documentNumber=
```

## DTOs propuestos

### `CreateElectronicInvoicingCustomerDto`

Campos:

- `name`: requerido.
- `legalName`: opcional, requerido si `documentTypeCode=31` en etapa fiscal estricta.
- `tradeName`: opcional.
- `documentTypeCode`: requerido salvo consumidor final.
- `documentNumber`: requerido salvo consumidor final.
- `verificationDigit`: opcional; permitido y validable para NIT.
- `email`: opcional.
- `fiscalEmail`: opcional al crear cliente; requerido solo cuando el flujo de emision electronica nominada lo necesite.
- `phone`: opcional.
- `address`: opcional.
- `fiscalAddress`: opcional.
- `countryCode`: default `CO`.
- `departmentCode`: opcional.
- `municipalityCode`: opcional.
- `taxRegime`: opcional.
- `taxResponsibilities`: opcional array.
- `organizationType`: opcional.
- `isFinalConsumer`: opcional, default `false`.

### `UpdateElectronicInvoicingCustomerDto`

Partial de create, excepto:

- no permite cambiar `isFinalConsumer` si el cliente ya es consumidor final sin endpoint dedicado.
- no permite borrar documento fiscal si el cliente tiene facturas futuras asociadas.

### `DianAcquirerLookupDto`

- `documentTypeCode`: requerido.
- `documentNumber`: requerido.
- `verificationDigit`: opcional.
- `forceRefresh`: opcional boolean.

### `ApplyDianAcquirerResultDto`

- `lookupId`: requerido.
- `overwriteConfirmed`: requerido `true` si algun campo existente sera reemplazado.
- `fieldStrategy`: mapa de campo a `USE_DIAN`, `KEEP_MANUAL`, `MERGE`, `CLEAR`.

### `CustomerFiscalStatusDto`

- `isActive`: boolean.
- `reason`: requerido si se inactiva.

## Reglas funcionales

1. El sistema SHALL NOT duplicar cliente por `tenant_id`, tipo de documento y numero normalizado.
2. El sistema SHALL permitir digito de verificacion para NIT.
3. El sistema SHALL validar email de recepcion de factura electronica cuando venga informado.
4. El sistema SHALL exigir `fiscalEmail` solo para emision electronica nominada que lo requiera.
5. El sistema SHALL mantener un consumidor final por tenant.
6. El sistema SHALL NOT duplicar consumidor final por sucursal.
7. El sistema SHALL tomar la sucursal desde el contexto de venta, pedido o POS.
8. El sistema SHALL exponer o preparar endpoint para asegurar consumidor final default.
9. El consumidor final SHALL NOT eliminarse ni inactivarse.
10. La consulta DIAN/proveedor SHALL NOT sobrescribir datos existentes sin confirmacion explicita.
11. Si DIAN/proveedor devuelve datos, el sistema SHALL permitir previsualizar, crear, actualizar o conservar campos manuales.
12. Si DIAN/proveedor no responde, el sistema SHALL permitir registro manual.
13. El sistema SHALL registrar fecha y resultado de la ultima consulta.
14. El sistema SHALL permitir modo `MOCK_LOCAL` o integracion externa apagada sin afectar registro manual.
15. Los datos fiscales nuevos SHALL ser aditivos y no romper `customers` actual.
16. Todo endpoint SHALL filtrar por tenant efectivo desde JWT, salvo `SUPER_ADMIN` con regla explicita.
17. El sistema SHALL guardar solo resumen operativo de consultas externas en primera version.
18. El sistema SHALL usar `ELECTRONIC_INVOICING_CUSTOMERS` como menu key principal.
19. El sistema SHALL tratar `dian_document_types` como catalogo versionable, sin hardcodear tipos en codigo.

## Casos de uso principales

### Crear cliente fiscal manual

1. Usuario autenticado abre formulario futuro.
2. Backend recibe datos fiscales.
3. Valida tipo documento, numero, DV si aplica, email fiscal y duplicado.
4. Crea cliente en `customers`.
5. Audita `EI_CUSTOMER_CREATED`.

### Consultar DIAN antes de crear

1. Usuario envia tipo y numero.
2. `DianAcquirerService` consulta gateway.
3. Registra lookup.
4. Devuelve preview.
5. Usuario decide crear con campos DIAN, manuales o mezcla.

### Actualizar cliente con datos DIAN

1. Usuario consulta DIAN para cliente existente.
2. Backend calcula diff.
3. Usuario confirma estrategia por campo.
4. Backend actualiza solo campos aprobados.
5. Audita before/after y lookup aplicado.

### Registrar manual con DIAN caido

1. DIAN responde timeout/error o integracion esta apagada.
2. Backend devuelve `manualRegistrationAllowed=true`.
3. Usuario guarda datos manuales.
4. Estado DIAN queda `ERROR` o `DISABLED`.

### Consumidor final

1. Sistema garantiza consumidor final por tenant.
2. Consumidor final no tiene flujo DIAN obligatorio.
3. No se puede eliminar ni inactivar.
4. Puede usarse por POS y ventas mientras no se exija factura electronica nominal.
5. Sucursal de la venta sale del contexto POS/pedido, no del cliente.
6. Endpoint `POST /api/electronic-invoicing/customers/default/ensure` debe asegurar el registro default.

## Seguridad

- Proteger endpoints con `JwtAuthGuard`.
- Usar `RolesGuard` y `PermissionsGuard`.
- No aceptar `tenantId` en body para usuarios no globales.
- Enmascarar documento en logs tecnicos cuando sea posible.
- No loguear certificados, passwords, raw SOAP ni raw response DIAN/proveedor por defecto.
- Registrar auditoria de cambios fiscales.
- Registrar quien aplico datos DIAN y que campos cambio.
- Validar que `customer_id` pertenezca al tenant.
- Evitar que un tenant consulte historial de otro tenant.
- Rate limit futuro para consulta DIAN.

## Referencias externas verificadas

- DIAN publica documentacion tecnica de factura electronica y anexos tecnicos en su sitio oficial.
- El micrositio DIAN indica que Resolucion 000008 de 2024 adopta el Anexo Tecnico de Factura Electronica de Venta version 1.9.
- La Guia Herramienta para el Consumo de Web Services GetAcquirer confirma que GetAcquirer completa informacion de adquirientes/compradores.
- La guia GetAcquirer indica que el request usa `identificationType` e `identificationNumber`.
- La guia GetAcquirer relaciona la respuesta con `AccountingCustomerParty / PartyIdentification / ID @schemeName`, `TaxRepresentativeParty / PartyIdentification / ID`, `AccountingCustomerParty / Contact / Name` y `AccountingCustomerParty / Contact / ElectronicMail`.
- La guia GetAcquirer lista codigos `11`, `12`, `13`, `21`, `22`, `31`, `41`, `42`, `47`, `48`, `50` y `91`.
- La guia GetAcquirer indica que el WSDL se obtiene desde el catalogo de participante DIAN, que se configura keystore/certificado, WS-Security Signature, Timestamp en milisegundos, Authentication, WS-A addressing y action `http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer`.
- Normograma DIAN lista codigos de tipos de documento de tercero como `11`, `12`, `13`, `21`, `22`, `31`, `41`, `42`, `43`, `47`, `48`.

PREGUNTA ABIERTA: Antes de migrar, confirmar el catalogo contra el anexo tecnico DIAN vigente y/o proveedor tecnologico elegido.

## Riesgos vivos

RIESGO: El consumidor final fiscal para factura electronica puede tener valores obligatorios distintos a los del seed actual `0000000000`.

RIESGO: DIAN GetAcquirer puede requerir autenticacion, certificado o configuracion distinta segun ambiente.

RIESGO: El proyecto no tiene validation pipe global documentado; los DTOs podrian no ejecutarse si no se configura validacion.

RIESGO: `CustomerController` actual no usa permisos de menu. El modulo nuevo debe endurecer acceso sin romper ruta vieja.

RIESGO: Reporteria y funciones SQL actuales esperan `customers.document_number`; los campos nuevos no deben reemplazarlo abruptamente.

RIESGO: Guardar raw response DIAN puede crear exposicion innecesaria de datos personales.

RIESGO: Un adapter provider-agnostic puede ocultar diferencias reales entre DIAN directo y proveedor. La mitigacion es normalizar contratos minimos y registrar `provider`, `statusCode` y `message`.

RIESGO: Sin idempotencia por tercero fiscal, backend FE podria crear customers o suppliers duplicados.

RIESGO: Usar GetAcquirer para suppliers sin fuente confirmada podria mezclar alcances. La mitigacion es limitar GetAcquirer a customers/adquirientes y disenar suppliers provider-agnostic.

RIESGO: Sync fiscal podria sobrescribir datos manuales confiables. La mitigacion es politica de campos permitidos, auditoria before/after y confirmacion cuando aplique.

## Preguntas pendientes antes de implementar

1. Confirmar catalogo DIAN vigente y fuente oficial para tipos de documento antes de seed.
2. Confirmar formato y documento fiscal exacto del consumidor final antes de migracion.
3. Confirmar si cliente fiscal sera unico por tenant en FE-1 o si se anticipa `company_id` futuro.
4. Confirmar si se agrega validation pipe global o validacion manual por servicio.
5. Confirmar politica de retencion de logs de consulta.
6. Confirmar estrategia de backfill para clientes existentes con `document_number` sin tipo.
7. Confirmar criterio de avance de `MOCK_LOCAL` a DIAN directo o proveedor tecnologico.
8. Confirmar contrato interno de upsert customer desde backend FE hacia `api/`.
9. Confirmar contrato interno de upsert supplier desde backend FE hacia `api/`.
10. Confirmar si `suppliers` tendra columnas fiscales equivalentes a `customers`.
11. Confirmar fuente fiscal aprobada para proveedores.
12. Confirmar politica de sobrescritura cuando fuente externa difiere de dato manual.
