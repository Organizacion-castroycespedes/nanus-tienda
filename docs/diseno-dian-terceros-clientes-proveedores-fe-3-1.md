# Diseno DIAN terceros clientes/proveedores - FE-3.1

## Alcance

Esta fase disena como consultar, validar y guardar terceros fiscales para clientes/adquirientes y proveedores.

No implementa DIAN real. No implementa SOAP real nuevo. No cambia venta POS, pricing, Orders, SQL funcional, PRD, remoto ni commits.

El diseno se apoya en lo ya existente:

- `customers` sigue como entidad canonica de clientes para POS, ventas y pedidos.
- `suppliers` sigue como entidad canonica de proveedores para compras e inventario.
- `api/src/modules/electronic-invoicing` ya existe con endpoints fiscales basicos para customers, suppliers y tipos de documento.
- `backend-facturacion-electronica` ya existe como backend especializado con `MOCK_LOCAL`, sync mock y base `DIAN_DIRECT` con fixtures/mock local. Aun no esta autorizado para DIAN real productivo.

## Estado actual observado

### Customers operativo

El modulo operativo de clientes vive en:

- `api/src/modules/inventory/controllers/customer.controller.ts`
- `api/src/modules/inventory/services/customer.service.ts`
- `api/src/modules/inventory/repositories/customer.repository.ts`
- `api/src/modules/inventory/entities/customer.entity.ts`
- Frontend: `web/modules/inventory/services/customer.service.ts`
- Frontend UI: `web/app/[tenant]/customers/page.tsx` y `web/modules/inventory/components/CustomerForm.tsx`

Endpoints actuales legacy:

| Metodo | Ruta | Observacion |
| --- | --- | --- |
| `POST` | `/api/customers` | Crea cliente operativo con `tenantId` desde JWT. |
| `GET` | `/api/customers` | Lista clientes del tenant. |
| `GET` | `/api/customers/:id` | Obtiene cliente del tenant. |
| `PUT` | `/api/customers/:id` | Actualiza campos operativos. |
| `DELETE` | `/api/customers/:id` | Inactiva con `is_active = false`. |

Campos actuales legacy de customer:

| Campo | Estado |
| --- | --- |
| `id` | Existe. |
| `tenantId` | Existe. |
| `name` | Existe y es requerido. |
| `documentNumber` | Existe, generico. |
| `phone` | Existe. |
| `email` | Existe, email general. |
| `address` | Existe. |
| `departamentoId`, `municipioId` | Existen como UUID internos. |
| `ciudad`, `departamento` | Existen como nombres derivados o manuales. |
| `isActive` | Existe. |
| `createdAt`, `updatedAt` | Existen. |

Limitacion: el formulario web actual de customers solo maneja datos comerciales. No tiene tipo documento DIAN, DV, razon social fiscal, email fiscal, responsabilidades, estado DIAN ni fuente de datos.

### Suppliers operativo

El modulo operativo de proveedores vive en:

- `api/src/modules/inventory/controllers/supplier.controller.ts`
- `api/src/modules/inventory/services/supplier.service.ts`
- `api/src/modules/inventory/repositories/supplier.repository.ts`
- `api/src/modules/inventory/entities/supplier.entity.ts`
- Frontend: `web/modules/inventory/services/supplier.service.ts`
- Frontend UI: `web/app/[tenant]/suppliers/page.tsx`, `web/app/[tenant]/inventory/suppliers/page.tsx` y `web/modules/inventory/components/SupplierForm.tsx`

Endpoints actuales legacy:

| Metodo | Ruta | Observacion |
| --- | --- | --- |
| `POST` | `/api/suppliers` | Crea proveedor operativo con `tenantId` desde JWT. |
| `GET` | `/api/suppliers` | Lista proveedores del tenant. |
| `GET` | `/api/suppliers/:id` | Obtiene proveedor del tenant. |
| `PUT` | `/api/suppliers/:id` | Actualiza campos operativos. |
| `DELETE` | `/api/suppliers/:id` | Inactiva con `is_active = false`. |

El shape legacy de supplier es equivalente a customer: `id`, `tenantId`, `name`, `documentNumber`, contacto, ubicacion interna, estado y fechas.

### Modulo electronic-invoicing existente

Ya existe `api/src/modules/electronic-invoicing/electronic-invoicing.module.ts`, importado por `AppModule`.

Submodulos actuales:

| Submodulo | Rutas actuales | Estado |
| --- | --- | --- |
| Customers fiscales | `/api/electronic-invoicing/customers` | Listar, crear, actualizar, consumidor final. |
| Suppliers fiscales | `/api/electronic-invoicing/suppliers` | Listar, crear, actualizar. |
| Tipos documento DIAN | `/api/electronic-invoicing/document-types` | Listar catalogo activo. |

Endpoints fiscales customers actuales:

| Metodo | Ruta |
| --- | --- |
| `GET` | `/api/electronic-invoicing/customers` |
| `POST` | `/api/electronic-invoicing/customers` |
| `PATCH` | `/api/electronic-invoicing/customers/:id` |
| `GET` | `/api/electronic-invoicing/customers/default` |
| `POST` | `/api/electronic-invoicing/customers/default/ensure` |

Endpoints fiscales suppliers actuales:

| Metodo | Ruta |
| --- | --- |
| `GET` | `/api/electronic-invoicing/suppliers` |
| `POST` | `/api/electronic-invoicing/suppliers` |
| `PATCH` | `/api/electronic-invoicing/suppliers/:id` |

Guardas actuales de endpoints fiscales:

- `JwtAuthGuard`
- `RolesGuard`
- `PermissionsGuard`
- Roles: `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`, `USER`
- Menu keys: `ELECTRONIC_INVOICING_CUSTOMERS` y `ELECTRONIC_INVOICING_SUPPLIERS`

### Campos fiscales existentes y faltantes

| Campo fiscal | Customers | Suppliers | Observacion |
| --- | --- | --- | --- |
| Tipo documento DIAN | Existe en fiscal: `documentTypeCode` | Existe en fiscal: `documentTypeCode` | Legacy no lo expone. |
| Numero documento | Existe: `documentNumber` | Existe: `documentNumber` | Generico en legacy. |
| Numero normalizado | Existe en fiscal: `documentNumberNormalized` | Existe en fiscal: `documentNumberNormalized` | Normaliza removiendo separadores. |
| DV | Existe en fiscal: `verificationDigit` | Existe en fiscal: `verificationDigit` | Falta validacion real de formula DV. |
| Nombre comercial | Existe: `name` | Existe: `name` | Canonico operativo. |
| Razon social fiscal | Existe en fiscal: `legalName` | Existe en fiscal: `legalName` | No esta en formularios legacy. |
| Email factura electronica | Existe en fiscal: `fiscalEmail` | Existe en fiscal: `fiscalEmail` | Se valida formato si viene. |
| Telefono | Existe legacy | Existe legacy | No esta en tipos fiscales actuales. |
| Direccion | Existe legacy | Existe legacy | No hay direccion fiscal separada. |
| Pais | Falta persistencia directa | Falta persistencia directa | Frontend selecciona pais para cargar departamentos, pero no guarda `countryCode`. |
| Departamento/municipio | Existen como UUID y nombres | Existen como UUID y nombres | Falta mapping DIAN `departmentCode`/`municipalityCode`. |
| Tipo persona | Falta | Falta | Necesario para PN/PJ o natural/juridica. |
| Responsabilidades fiscales | Falta | Falta | Existe en `tenants_detalles`, no en terceros. |
| Validado DIAN | Parcial por `fiscalStatus` | Parcial por `fiscalStatus` | Falta regla de transicion con lookup. |
| Fecha ultima validacion | Columna `dianLastLookupAt` existe | Columna `fiscalLastLookupAt` existe | Falta service/repo para actualizar en lookup real. |
| Fuente de datos | Falta campo directo en customer | Parcial: `fiscalProvider` | Recomendar `fiscalDataSource` comun. |
| Metadata DIAN controlada | Tabla `dian_acquirer_lookup_logs` existe en SQL | Falta tabla comun para suppliers | Falta API/repository de logs y policy de retencion. |

### POS y customerId

POS actual vive en:

- `web/app/[tenant]/pos/page.tsx`
- `web/modules/pos/components/PosScreen.tsx`
- `web/modules/pos/services/pos.service.ts`
- `web/store/pos.ts`
- `web/store/posCart.ts`
- `web/domains/pos/components/PosContextSelector.tsx`

Comportamiento actual:

1. `PosScreen` carga clientes con `getPosCustomers()`.
2. `getPosCustomers()` llama `/api/customers`.
3. Filtra clientes activos en frontend.
4. Calcula `defaultCustomer` buscando nombre que contenga `consumidor final`.
5. Si no hay seleccion valida, usa ese default o el primer cliente.
6. Guarda `selectedCustomerId` en `posCart`.
7. Al cobrar, `validateBeforeSubmit()` exige `selectedCustomerId`.
8. `submitSale()` envia `customerId: selectedCustomerId!` a `/api/sales`.

Como muestra Consumidor Final:

- En UI, si no hay `selectedCustomer`, muestra texto `"Consumidor final"`.
- Como default real, intenta usar un customer cuyo nombre incluya `consumidor final`.
- No consume todavia `/api/electronic-invoicing/customers/default`.
- No crea customer fiscal rapido.
- No consulta DIAN desde POS.

### Tenant, branch y usuario autenticado

Backend:

- `JwtAuthGuard` valida Bearer JWT con `JWT_SECRET`.
- Exige `sub`, `tenant_id` y `session_id`.
- Valida sesion activa en `auth_sessions`.
- Adjunta `request.user.id`, `request.user.roles`, `request.user.tenantId` y `request.user.sessionId`.

Frontend:

- `session-manager.ts` rehidrata usuario desde JWT y `/auth/me`.
- El tenant efectivo queda en `auth.tenantId` y `auth.user.tenantId`.
- `apiClient` envia `Authorization: Bearer <token>`.
- En POS, `apiClient` tambien envia `x-pos-session-id` si hay sesion POS local.

POS:

- `PosContextSelector` obtiene contexto por `/auth/context`.
- El usuario selecciona sucursal y terminal.
- `POST /api/pos/session` crea sesion POS para `branchId` y `terminalId`.
- `posCart` se aisla por `tenantId`, `branchId`, `terminalId`, `userId` y `posSessionId`.
- `SaleService` resuelve `branchId`, `terminalId`, `userId` y `posSessionId` desde contexto POS actual si el request no trae todo.
- `SaleRepository.validateCustomer()` valida que `customerId` exista, sea del tenant y este activo.

Regla clave: POS venta actual no necesita conocer datos fiscales completos. Solo necesita un `customerId` activo del tenant.

## Integracion futura GetAcquirer

El backend especializado `backend-facturacion-electronica` ya tiene base para:

- `FISCAL_PROVIDER=MOCK_LOCAL` como default.
- `DIAN_DIRECT` apagado por defecto.
- Request builder GetAcquirer con `identificationType` e `identificationNumber`.
- Parser con fixtures SOAP/XML.
- WS-Security y WS-A conceptuales.
- Mock SOAP local.
- Bloqueo de llamadas externas con `DIAN_ALLOW_EXTERNAL_CALLS=false`.

Regla de diseno:

- GetAcquirer aplica inicialmente a `CUSTOMER` o adquiriente.
- Suppliers siguen provider-agnostic. No asumir GetAcquirer como fuente unica de proveedores.

Modos:

| Modo | Uso | Regla |
| --- | --- | --- |
| `MOCK_LOCAL` | Desarrollo, QA local, demo controlada | No llama DIAN real. |
| `HABILITACION` | Pruebas DIAN controladas | Requiere autorizacion, certificado y ventana de prueba. |
| `PRODUCCION` | Operacion real | Requiere aprobacion explicita, certificado, monitoreo, rollback y no raw SOAP. |

Variables candidatas ya alineadas:

- `FISCAL_PROVIDER`
- `DIAN_WSDL_URL`
- `DIAN_ENDPOINT_URL`
- `DIAN_ALLOW_EXTERNAL_CALLS`
- `DIAN_CERT_PATH`
- `DIAN_CERT_PASSWORD`
- `DIAN_ENVIRONMENT`
- `DIAN_TIMEOUT_MS`
- `DIAN_GET_ACQUIRER_ACTION`
- `DIAN_WS_SECURITY_TIMESTAMP_TTL_MS`

Seguridad:

- No loggear certificado ni password.
- No guardar raw SOAP por defecto.
- Guardar `requestHash`, `responseSummary`, `provider`, `statusCode`, `message`, `lookupAt`.
- Sanitizar documentos en logs tecnicos cuando aplique.
- Usar `correlationId` por lookup/sync.

## Flujos disenados

### POS

Objetivo: permitir venta rapida sin bloquear, y solo pedir datos fiscales cuando el usuario quiere factura electronica nominada.

Flujo base:

1. POS carga clientes activos desde `/api/customers`.
2. POS resuelve consumidor final usando customer default fiscal si existe, o fallback actual por nombre.
3. Cajero busca cliente por nombre, documento o telefono.
4. Si lo encuentra, selecciona customer y continua venta.
5. Si no lo encuentra, puede abrir "cliente rapido".
6. Cliente rapido permite crear minimo operativo: nombre o consumidor final.
7. Si el cajero marca "requiere factura electronica", se despliega formulario fiscal.
8. Formulario fiscal pide tipo documento DIAN, numero, DV si aplica, razon social/nombre, email fiscal y ubicacion minima.
9. Usuario puede ejecutar consulta DIAN si la integracion esta activa.
10. El sistema muestra preview/diff; no sobrescribe datos sin confirmacion.
11. Al guardar, retorna `customerId` canonico.
12. POS selecciona ese `customerId` y continua venta.
13. Si DIAN falla, POS permite guardar manual o volver a Consumidor Final.

Reglas POS:

- No bloquear ventas con Consumidor Final.
- No exigir email fiscal para Consumidor Final.
- No tocar calculo de precio/promocion ni Orders.
- Si `customerId` cambia, recalcular preview de precio solo por el flujo ya existente de pricing. Esta fase no lo modifica.
- El quick form no debe crear duplicados por documento normalizado.
- El customer creado por quick form debe ser visible en customers.

### Customers

Flujo de crear/editar cliente fiscal:

1. Usuario abre modulo customers o futuro tab fiscal.
2. El sistema carga tipos de documento desde `/api/electronic-invoicing/document-types`.
3. Usuario digita tipo documento y numero.
4. El sistema normaliza documento y busca duplicados en el tenant.
5. Usuario puede consultar DIAN en preview.
6. Backend FE o facade devuelve datos normalizados y `fieldDiffs`.
7. UI muestra diferencias campo por campo.
8. Usuario elige mantener manual, usar DIAN o mezclar.
9. Sistema guarda solo campos confirmados.
10. Se actualiza `fiscalStatus`, ultima consulta y fuente.

Reglas:

- No sobrescribir datos manuales sin confirmacion.
- Si DIAN no responde, se permite registro manual.
- `fiscalEmail` no es obligatorio al guardar, pero si al emitir factura electronica nominada cuando la fase de emision lo exija.
- `documentTypeCode` y `documentNumber` pasan a requeridos solo si se activa "factura electronica nominada".

### Suppliers

Flujo de crear/editar proveedor fiscal:

1. Usuario abre suppliers.
2. Puede crear proveedor operativo normal.
3. Si quiere datos fiscales, usa formulario fiscal equivalente a customer.
4. Consulta fiscal usa adapter provider-agnostic.
5. Si fuente elegida es GetAcquirer, el sistema debe rechazar o marcar `UNSUPPORTED_PARTY_TYPE` para supplier.
6. Si fuente aprobada responde, se muestra preview/diff.
7. Usuario confirma campos.
8. Sistema guarda en `suppliers` canonico.

Reglas:

- No bloquear compras por datos fiscales incompletos en esta fase.
- Evitar duplicado por `tenantId + documentTypeCode + documentNumberNormalized` cuando el dato exista.
- Si una misma identidad fiscal existe como customer y supplier, no fusionar automaticamente.
- Mostrar advertencia "este tercero ya existe como cliente/proveedor" y permitir asociar ambos roles.

## Modelo recomendado

### Decision actual

Mantener dos entidades operativas:

- `customers`: cliente/adquiriente canonico para POS, ventas, pedidos y factura futura.
- `suppliers`: proveedor canonico para compras e inventario.

Razon:

- `sales.customer_id` ya depende de `customers.id`.
- `orders.customer_id` ya depende de `customers.id`.
- `purchases.supplier_id` ya depende de `suppliers.id`.
- Fusionar ahora en una tabla comun implica impacto funcional grande.

### Campos recomendados para completar fases futuras

Para `customers`:

- `fiscal_data_source` o `fiscal_source`: `MANUAL`, `MOCK_LOCAL`, `DIAN_DIRECT`, `TECH_PROVIDER`, `RUT`, `UNKNOWN`.
- `fiscal_validated_at`.
- `fiscal_validated_by`.
- `fiscal_person_type`: `NATURAL`, `JURIDICA`, `UNKNOWN`.
- `tax_responsibilities` como jsonb o tabla detalle.
- `fiscal_country_code`.
- `fiscal_department_code`.
- `fiscal_municipality_code`.
- `fiscal_address`.

Para `suppliers`:

- Homologar nombres con customers donde aplique.
- Mantener `fiscal_provider` si se usa como fuente, pero definir tambien `fiscal_data_source` si se necesita separar proveedor tecnico de fuente de dato.
- Agregar log comun para lookup/sync fiscal si proveedores usan fuente distinta a DIAN.

### Opcion futura: tercero fiscal comun

Crear una tabla comun solo si el duplicado customer/supplier se vuelve doloroso:

```text
fiscal_parties
  id
  tenant_id
  document_type_code
  document_number_normalized
  verification_digit
  legal_name
  fiscal_email
  fiscal_person_type
  tax_responsibilities
  fiscal_status
  fiscal_data_source
  last_lookup_at

fiscal_party_links
  fiscal_party_id
  target_type: CUSTOMER | SUPPLIER
  target_id
```

Ventaja: una sola identidad fiscal para ambos roles.

Costo: migracion, ownership, joins y riesgo sobre POS/compras. No recomendado para FE-3.2. Mantener como decision futura.

## Endpoints propuestos

No se implementan en esta fase.

### Facade en `api/`

```http
GET /api/electronic-invoicing/document-types

GET /api/electronic-invoicing/customers
POST /api/electronic-invoicing/customers
PATCH /api/electronic-invoicing/customers/:id
GET /api/electronic-invoicing/customers/default
POST /api/electronic-invoicing/customers/default/ensure

GET /api/electronic-invoicing/suppliers
POST /api/electronic-invoicing/suppliers
PATCH /api/electronic-invoicing/suppliers/:id
```

Nuevos candidatos:

```http
POST /api/electronic-invoicing/third-party-lookups/preview
POST /api/electronic-invoicing/third-party-lookups/:lookupId/apply
GET /api/electronic-invoicing/third-party-lookups/:lookupId
GET /api/electronic-invoicing/third-parties/resolve?partyType=&documentTypeCode=&documentNumber=

POST /api/electronic-invoicing/customers/:id/fiscal-lookup
POST /api/electronic-invoicing/customers/:id/fiscal-lookup/apply
POST /api/electronic-invoicing/customers/quick-fiscal

POST /api/electronic-invoicing/suppliers/:id/fiscal-lookup
POST /api/electronic-invoicing/suppliers/:id/fiscal-lookup/apply
```

### Backend especializado

Mantener/usar contratos internos:

```http
POST /fiscal-lookup/preview
POST /fiscal-lookup/sync
```

Payload recomendado:

```json
{
  "partyType": "CUSTOMER",
  "documentTypeCode": "31",
  "documentNumber": "900123456",
  "mode": "MOCK_LOCAL",
  "forceRefresh": false
}
```

Respuesta normalizada:

```json
{
  "lookupId": "uuid",
  "partyType": "CUSTOMER",
  "provider": "MOCK_LOCAL",
  "lookupStatus": "FOUND",
  "statusCode": "MOCK_FOUND",
  "message": "Lookup successful",
  "lookupAt": "2026-06-02T00:00:00.000Z",
  "normalized": {
    "documentTypeCode": "31",
    "documentNumber": "900123456",
    "documentNumberNormalized": "900123456",
    "verificationDigit": "7",
    "legalName": "ACME SAS",
    "fiscalEmail": "facturacion@acme.test",
    "phone": null,
    "address": null,
    "countryCode": "CO",
    "departmentCode": null,
    "municipalityCode": null,
    "personType": "JURIDICA",
    "taxResponsibilities": []
  },
  "fieldDiffs": [
    {
      "field": "legalName",
      "currentValue": "ACME",
      "providerValue": "ACME SAS",
      "defaultAction": "KEEP_CURRENT"
    }
  ],
  "manualRegistrationAllowed": true
}
```

## Reglas funcionales

1. No sobrescribir datos manuales sin confirmacion explicita.
2. No bloquear venta POS con Consumidor Final.
3. Exigir datos fiscales solo si se requiere factura electronica nominada.
4. Permitir crear/editar terceros manualmente cuando DIAN este apagado.
5. Consulta DIAN desactivable por env.
6. `MOCK_LOCAL` debe ser default en desarrollo y CI.
7. `DIAN_DIRECT` solo para customers/adquirientes.
8. Suppliers usan fuente provider-agnostic hasta decision aprobada.
9. No guardar raw SOAP por defecto.
10. No loggear certificados, passwords ni tokens internos.
11. Idempotencia por `tenantId + partyType + documentTypeCode + documentNumberNormalized`.
12. No crear duplicados activos con la misma identidad fiscal dentro del mismo tenant y party type.
13. Si customer y supplier comparten identidad fiscal, mostrar relacion cruzada, no fusionar sin decision.
14. El consumidor final fiscal debe existir una vez por tenant y no por sucursal.
15. `branchId` pertenece al contexto de venta/POS, no al tercero fiscal.
16. `tenantId` efectivo viene de JWT o contexto validado, no del body para usuarios normales.

## Fases recomendadas

### FE-3.2 Backend fiscal fields customers/suppliers

Objetivo: cerrar gaps de campos y politicas, no DIAN real.

Incluye:

- Campo `fiscalDataSource` para customers y suppliers.
- Campos de persona fiscal y responsabilidades.
- Ubicacion fiscal con codigos DIAN o mapping documentado.
- Update controlado de `lastLookupAt`.
- Auditoria before/after.
- Tests de no duplicado y no overwrite.

### FE-3.3 DIAN mock para customers/suppliers

Objetivo: conectar UI/API con lookup mock.

Incluye:

- Preview mock de customer y supplier.
- `fieldDiffs`.
- Apply con estrategia por campo.
- Logs seguros.
- `manualRegistrationAllowed`.

### FE-3.4 POS quick customer fiscal form

Objetivo: POS crea/selecciona cliente fiscal sin tocar la venta core.

Incluye:

- Buscar por nombre/documento.
- Crear cliente rapido.
- Boton consultar mock DIAN.
- Guardar y seleccionar `customerId`.
- Consumidor Final permanece como fallback.

### FE-3.5 GetAcquirer real SOAP/WS-Security

Objetivo: DIAN real controlado para adquirientes.

Incluye:

- Firma WS-Security real o libreria aprobada.
- Certificado seguro fuera del repo.
- Ambiente `HABILITACION` primero.
- `DIAN_ALLOW_EXTERNAL_CALLS=true` solo con autorizacion.
- Sin raw SOAP por defecto.

### FE-3.6 QA habilitacion

Objetivo: pruebas DIAN controladas.

Incluye:

- Datos de prueba aprobados.
- Ventana de prueba.
- Monitoreo de logs seguros.
- Rollback operativo a `MOCK_LOCAL`.
- Evidencia sin secretos.

## Riesgos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Romper POS por exigir datos fiscales | Alto | Mantener Consumidor Final y `customerId` activo como minimo. |
| Duplicar terceros | Alto | Idempotencia y busqueda por documento normalizado. |
| Usar GetAcquirer para proveedores | Medio | Mantener suppliers provider-agnostic. |
| Sobrescribir datos manuales buenos | Alto | Preview, diff y confirmacion por campo. |
| Exponer datos personales o secretos | Alto | No raw SOAP, enmascarar logs, `requestHash`. |
| Catalogos DIAN desactualizados | Medio | Catalogo versionable y fuente aprobada antes de seed. |
| Mismatch ubicacion interna vs DIAN | Medio | Definir mapping UUID interno contra codigos DIAN. |
| Produccion activada por error | Alto | `DIAN_ALLOW_EXTERNAL_CALLS=false` default y bloqueo `PRODUCCION` sin aprobacion. |
| Branch confundido con identidad fiscal | Medio | Definir tercero por tenant, venta por branch. |

## Decisiones pendientes

1. Fuente oficial final para tipos documento DIAN y catalogo de responsabilidades.
2. Formula y politica de DV: rechazar, calcular o permitir manual validado.
3. Valores fiscales exactos de Consumidor Final para factura electronica.
4. Si se agrega `fiscalDataSource` en customers antes de mock lookup.
5. Politica de retencion de lookup logs.
6. Fuente aprobada para proveedores: proveedor tecnologico, RUT, manual validado u otra.
7. Mapping de pais/departamento/municipio internos contra codigos DIAN.
8. Libreria final para SOAP y XML signature.
9. Condiciones para activar `DIAN_ENVIRONMENT=PRODUCCION`.
10. Si se crea `fiscal_parties` comun en una fase posterior.

## Confirmaciones de guardrail

- No se disena cambio de pricing.
- No se disena cambio de Orders.
- No se disena cambio del core de venta POS.
- No se disena SQL a ejecutar en esta fase.
- No se toca PRD real.
- No se requiere remoto.
- No se requiere commit.
