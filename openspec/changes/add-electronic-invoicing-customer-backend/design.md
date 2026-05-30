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

SUPUESTO: La menu key final se confirmara antes de implementar seeds de menu/permisos.

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

- Esta fase no crea migraciones.
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
- Las consultas DIAN deben registrar evento de consulta y resultado, sin guardar datos sensibles innecesarios.

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

## Separacion de responsabilidades

| Componente | Responsabilidad |
| --- | --- |
| `electronic-invoicing/customers` | CRUD fiscal, validaciones, consumidor final, auditoria. |
| `electronic-invoicing/dian-acquirer` | Consultar DIAN, normalizar respuesta, preview, aplicar con confirmacion. |
| `DianAcquirerGateway` | Interfaz desacoplada para DIAN directo o proveedor tecnologico. |
| `customers` | Identidad canonica del cliente/adquiriente. |
| `dian_document_types` | Catalogo versionado de tipos de documento. |
| `dian_acquirer_lookup_logs` | Trazabilidad de consultas DIAN. |
| `auditoria_eventos` | Auditoria funcional de cambios y aplicacion de datos DIAN. |

## Modelo de datos recomendado

No crear migraciones en esta fase. Modelo fisico recomendado para fase futura:

### `customers` aditivo

Agregar columnas fiscales opcionales con defaults seguros:

| Campo | Tipo recomendado | Regla |
| --- | --- | --- |
| `document_type_code` | varchar(10) null | FK logica a catalogo DIAN. |
| `document_number_normalized` | varchar(50) null | Solo digitos/letras permitidas segun tipo. |
| `verification_digit` | varchar(2) null | Solo para NIT cuando aplique. |
| `legal_name` | varchar(255) null | Razon social o nombre fiscal. |
| `trade_name` | varchar(255) null | Nombre comercial opcional. |
| `fiscal_email` | varchar(255) null | Email de recepcion FE. |
| `tax_regime` | varchar(80) null | Regimen fiscal. |
| `tax_responsibilities` | jsonb null | Responsabilidades DIAN versionables. |
| `organization_type` | varchar(40) null | Persona natural/juridica. |
| `country_code` | varchar(2) not null default `CO` | Pais ISO. |
| `department_code` | varchar(10) null | Codigo DANE o DIAN aprobado. |
| `municipality_code` | varchar(10) null | Codigo DANE o DIAN aprobado. |
| `fiscal_address` | text null | Direccion fiscal. |
| `is_final_consumer` | boolean not null default false | Alias fiscal de consumidor final. |
| `fiscal_source` | varchar(20) not null default `MANUAL` | `MANUAL`, `DIAN`, `MIXED`. |
| `manual_fields` | jsonb not null default `{}` | Campos protegidos contra overwrite. |
| `dian_last_lookup_at` | timestamptz null | Ultima consulta. |
| `dian_last_lookup_status` | varchar(30) null | `SUCCESS`, `NOT_FOUND`, `ERROR`, `DISABLED`. |
| `dian_last_lookup_message` | text null | Mensaje resumido, sin PII sensible innecesaria. |
| `created_by` | uuid null | Usuario creador futuro. |
| `updated_by` | uuid null | Usuario editor futuro. |

Indices recomendados:

```text
idx_customers_tenant_document_type_number
  on customers (tenant_id, document_type_code, document_number_normalized)

ux_customers_tenant_fiscal_identity
  unique (tenant_id, document_type_code, document_number_normalized)
  where document_type_code is not null
    and document_number_normalized is not null
    and is_final_consumer = false

ux_customers_tenant_final_consumer
  unique (tenant_id)
  where is_final_consumer = true
```

Nota: Si se confirma compania fiscal multiple por tenant, esos indices deben cambiar a `company_id`.

### `dian_document_types`

Catalogo recomendado:

| Campo | Tipo |
| --- | --- |
| `code` | varchar(10) primary key |
| `name` | varchar(120) |
| `short_name` | varchar(30) |
| `requires_verification_digit` | boolean |
| `is_active` | boolean |
| `source_version` | varchar(50) |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

Catalogo minimo inicial a confirmar antes de migrar:

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

SUPUESTO: `31` NIT requiere digito de verificacion. La formula de DV debe implementarse en backend antes de guardar o permitir DV manual validado.

### `dian_acquirer_lookup_logs`

Tabla recomendada para trazabilidad:

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | uuid pk | Identificador. |
| `tenant_id` | uuid not null | Scope obligatorio. |
| `customer_id` | uuid null | Si consulta cliente existente. |
| `document_type_code` | varchar(10) not null | Tipo consultado. |
| `document_number_normalized` | varchar(50) not null | Numero consultado. |
| `verification_digit` | varchar(2) null | DV si aplica. |
| `status` | varchar(30) not null | `SUCCESS`, `NOT_FOUND`, `ERROR`, `DISABLED`. |
| `request_hash` | varchar(128) null | Hash para trazabilidad sin exponer payload completo. |
| `response_summary` | jsonb null | Datos normalizados resumidos. |
| `raw_response_ref` | text null | Referencia externa si se guarda raw cifrado. |
| `error_code` | varchar(80) null | Error tecnico/DIAN. |
| `error_message` | text null | Mensaje resumido. |
| `source` | varchar(30) not null | `DIAN_DIRECT`, `PROVIDER`, `MOCK`. |
| `created_by` | uuid null | Usuario actor. |
| `created_at` | timestamptz not null | Fecha consulta. |

No guardar certificados, passwords ni XML crudo en esta tabla.

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

## Integracion DIAN GetAcquirer desacoplada

Crear interfaz:

```ts
export type DianAcquirerLookupInput = {
  tenantId: string;
  documentTypeCode: string;
  documentNumber: string;
  verificationDigit?: string | null;
};

export type DianAcquirerLookupResult = {
  status: "SUCCESS" | "NOT_FOUND" | "ERROR" | "DISABLED";
  provider: "DIAN_DIRECT" | "PROVIDER" | "MOCK";
  checkedAt: string;
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

export interface DianAcquirerGateway {
  lookup(input: DianAcquirerLookupInput): Promise<DianAcquirerLookupResult>;
}
```

Reglas:

- Si `DIAN_ACQUIRER_ENABLED=false`, responder `DISABLED`.
- Si DIAN no responde, permitir registro manual.
- Si DIAN responde, no persistir cambios automaticamente.
- Mostrar preview normalizado.
- Aplicar cambios solo con confirmacion explicita y seleccion de campos.
- Registrar lookup en `dian_acquirer_lookup_logs`.
- Registrar aplicacion en `auditoria_eventos`.

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
  "checkedAt": "iso-date",
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
- `fiscalEmail`: requerido para clientes que recibiran factura electronica.
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
3. El sistema SHALL validar email de recepcion de factura electronica.
4. El sistema SHALL mantener un consumidor final por tenant o compania.
5. El consumidor final SHALL NOT eliminarse ni inactivarse.
6. La consulta DIAN SHALL NOT sobrescribir datos existentes sin confirmacion explicita.
7. Si DIAN devuelve datos, el sistema SHALL permitir previsualizar, crear, actualizar o conservar campos manuales.
8. Si DIAN no responde, el sistema SHALL permitir registro manual.
9. El sistema SHALL registrar fecha y resultado de la ultima consulta DIAN.
10. El sistema SHALL permitir desactivar DIAN sin afectar registro manual.
11. Los datos fiscales nuevos SHALL ser aditivos y no romper `customers` actual.
12. Todo endpoint SHALL filtrar por tenant efectivo desde JWT, salvo `SUPER_ADMIN` con regla explicita.

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

## Seguridad

- Proteger endpoints con `JwtAuthGuard`.
- Usar `RolesGuard` y `PermissionsGuard`.
- No aceptar `tenantId` en body para usuarios no globales.
- Enmascarar documento en logs tecnicos cuando sea posible.
- No loguear certificados, passwords ni raw SOAP por defecto.
- Registrar auditoria de cambios fiscales.
- Registrar quien aplico datos DIAN y que campos cambio.
- Validar que `customer_id` pertenezca al tenant.
- Evitar que un tenant consulte historial de otro tenant.
- Rate limit futuro para consulta DIAN.

## Referencias externas verificadas

- DIAN publica documentacion tecnica de factura electronica y anexos tecnicos en su sitio oficial.
- El micrositio DIAN indica que Resolucion 000008 de 2024 adopta el Anexo Tecnico de Factura Electronica de Venta version 1.9.
- La guia DIAN de consumo de Web Services menciona GetAcquirer para completar informacion de adquirientes.
- Normograma DIAN lista codigos de tipos de documento de tercero como `11`, `12`, `13`, `21`, `22`, `31`, `41`, `42`, `43`, `47`, `48`.

PREGUNTA ABIERTA: Antes de migrar, confirmar el catalogo contra el anexo tecnico DIAN vigente y/o proveedor tecnologico elegido.

## Riesgos vivos

RIESGO: El consumidor final fiscal para factura electronica puede tener valores obligatorios distintos a los del seed actual `0000000000`.

RIESGO: DIAN GetAcquirer puede requerir autenticacion, certificado o configuracion distinta segun ambiente.

RIESGO: El proyecto no tiene validation pipe global documentado; los DTOs podrian no ejecutarse si no se configura validacion.

RIESGO: `CustomerController` actual no usa permisos de menu. El modulo nuevo debe endurecer acceso sin romper ruta vieja.

RIESGO: Reporteria y funciones SQL actuales esperan `customers.document_number`; los campos nuevos no deben reemplazarlo abruptamente.

RIESGO: Guardar raw response DIAN puede crear exposicion innecesaria de datos personales.

## Preguntas pendientes antes de implementar

1. Confirmar proveedor: DIAN directo, proveedor tecnologico o ambos.
2. Confirmar catalogo DIAN vigente y fuente oficial para tipos de documento.
3. Confirmar formato y documento del consumidor final.
4. Confirmar si cliente fiscal sera unico por tenant o por compania futura.
5. Confirmar si `fiscalEmail` sera obligatorio para todo cliente fiscal o solo al emitir factura electronica.
6. Confirmar permisos y menu key.
7. Confirmar si se agrega validation pipe global o validacion manual por servicio.
8. Confirmar politica de retencion de logs DIAN.
9. Confirmar si se cifra `raw_response_ref` o no se guarda raw response.
10. Confirmar estrategia de backfill para clientes existentes con `document_number` sin tipo.
