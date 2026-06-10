# Diseno: dian-terceros-clientes-proveedores-fe-3

## Estado actual

### Customers

`customers` operativo existe bajo `InventoryModule`:

- `POST /api/customers`
- `GET /api/customers`
- `GET /api/customers/:id`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`

Campos legacy: `id`, `tenantId`, `name`, `documentNumber`, `phone`, `email`, `address`, `departamentoId`, `municipioId`, `ciudad`, `departamento`, `isActive`, fechas.

El modulo fiscal actual agrega endpoints bajo `/api/electronic-invoicing/customers` y campos: `documentTypeCode`, `documentNumberNormalized`, `verificationDigit`, `legalName`, `fiscalEmail`, `isFinalConsumer`, `dianLastLookupAt`, `dianLastLookupStatus` y `fiscalStatus`.

### Suppliers

`suppliers` operativo existe bajo `InventoryModule`:

- `POST /api/suppliers`
- `GET /api/suppliers`
- `GET /api/suppliers/:id`
- `PUT /api/suppliers/:id`
- `DELETE /api/suppliers/:id`

El modulo fiscal actual agrega endpoints bajo `/api/electronic-invoicing/suppliers` y campos: `documentTypeCode`, `documentNumberNormalized`, `verificationDigit`, `legalName`, `fiscalEmail`, `fiscalStatus`, `fiscalProvider`, `fiscalLastLookupAt` y `fiscalLastLookupStatus`.

### POS

POS actual:

- Carga clientes con `GET /api/customers`.
- Filtra activos.
- Selecciona default por nombre que contenga `consumidor final`, o primer cliente.
- Guarda `selectedCustomerId` en `posCart`.
- Exige `selectedCustomerId` para vender.
- Envia solo `customerId` a `POST /api/sales`.
- Backend valida customer activo por tenant.

POS no consulta DIAN y no crea cliente fiscal rapido todavia.

### Auth y contexto

`JwtAuthGuard` valida JWT y sesion activa. `tenantId` sale del token. POS usa `x-pos-session-id` desde frontend. `SaleService` resuelve branch, terminal, user y session desde la sesion POS actual.

## Decisiones de arquitectura

1. `customers` sigue como entidad canonica para POS, ventas, pedidos y adquiriente fiscal.
2. `suppliers` sigue como entidad canonica para compras e inventario.
3. No se crea tabla comun `fiscal_parties` en esta fase.
4. Se permite opcion futura de `fiscal_parties` si hay duplicidad fuerte customer/supplier.
5. GetAcquirer aplica inicialmente a `CUSTOMER`.
6. Suppliers usan adapter provider-agnostic.
7. `MOCK_LOCAL` sigue como modo default.
8. `DIAN_DIRECT` requiere autorizacion, certificado y bloqueo de llamadas externas desactivado manualmente.
9. No raw SOAP por defecto.
10. No overwrite automatico.

## Flujos

### POS

1. Buscar cliente en catalogo actual.
2. Si existe, seleccionar `customerId`.
3. Si no existe, abrir quick customer.
4. Quick customer crea cliente operativo minimo o cliente fiscal si se marca factura electronica.
5. Si se marca factura electronica, pedir tipo documento, numero, DV si aplica, razon social, email fiscal y ubicacion minima.
6. Permitir consultar `MOCK_LOCAL` o fuente activa.
7. Mostrar preview/diff.
8. Guardar solo campos confirmados.
9. Seleccionar `customerId` creado o actualizado.
10. Si DIAN falla, permitir manual o Consumidor Final.

### Customers

1. Crear/editar cliente fiscal.
2. Consultar documento ante fuente fiscal en preview.
3. Mostrar diferencias.
4. Confirmar campos a aplicar.
5. Actualizar datos fiscales, status, fuente y ultima consulta.
6. Registrar auditoria.

### Suppliers

1. Crear/editar proveedor fiscal.
2. Consultar fuente provider-agnostic si aplica.
3. Rechazar GetAcquirer para supplier hasta decision aprobada.
4. Mostrar diferencias.
5. Confirmar campos a aplicar.
6. Guardar sobre `suppliers`, no tabla paralela.
7. Mostrar advertencia si la misma identidad fiscal existe como customer.

## Endpoints propuestos

Endpoints existentes a conservar:

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

Endpoints candidatos para lookup:

```http
POST /api/electronic-invoicing/third-party-lookups/preview
POST /api/electronic-invoicing/third-party-lookups/:lookupId/apply
GET /api/electronic-invoicing/third-party-lookups/:lookupId
GET /api/electronic-invoicing/third-parties/resolve?partyType=&documentTypeCode=&documentNumber=
POST /api/electronic-invoicing/customers/quick-fiscal
POST /api/electronic-invoicing/customers/:id/fiscal-lookup
POST /api/electronic-invoicing/customers/:id/fiscal-lookup/apply
POST /api/electronic-invoicing/suppliers/:id/fiscal-lookup
POST /api/electronic-invoicing/suppliers/:id/fiscal-lookup/apply
```

Backend especializado:

```http
POST /fiscal-lookup/preview
POST /fiscal-lookup/sync
```

## Datos y logs

Lookup debe guardar resumen operativo:

- `tenantId`
- `partyType`
- `targetId`
- `provider`
- `lookupStatus`
- `statusCode`
- `message`
- `lookupAt`
- `requestHash`
- `responseSummary`
- `correlationId`
- `lookedUpBy`

No guardar:

- certificado;
- password;
- token interno;
- raw SOAP request;
- raw SOAP response.

## Fases

### FE-3.2 Backend fiscal fields customers/suppliers

Completar campos fiscales faltantes, fuente de datos, persona fiscal, responsabilidades, ubicacion fiscal, auditoria y update de ultima consulta.

### FE-3.3 DIAN mock para customers/suppliers

Agregar preview/apply con `MOCK_LOCAL`, `fieldDiffs`, logs seguros y no overwrite.

### FE-3.4 POS quick customer fiscal form

Agregar busqueda/creacion fiscal rapida en POS sin tocar core de venta.

### FE-3.5 GetAcquirer real SOAP/WS-Security

Implementar firma real o libreria aprobada y prueba controlada en `HABILITACION`.

### FE-3.6 QA habilitacion

Ejecutar pruebas DIAN con datos aprobados, ventana controlada, logs seguros y rollback a `MOCK_LOCAL`.

## Riesgos

- POS se bloquea si se exige fiscal completo antes de vender.
- Terceros duplicados por documento.
- GetAcquirer usado incorrectamente en suppliers.
- Datos manuales sobrescritos por fuente externa.
- Raw SOAP o secretos en logs.
- Catalogos DIAN desactualizados.
- Produccion DIAN activada por error.
- Ubicacion interna sin mapping DIAN.

## Decisiones pendientes

- Fuente oficial de catalogos DIAN.
- Valores exactos de Consumidor Final.
- Politica de DV.
- Retencion de lookup logs.
- Fuente fiscal para suppliers.
- Libreria SOAP/XML signature.
- Condiciones para `PRODUCCION`.
- Si crear `fiscal_parties` futuro.
