# Diseno suppliers fiscales - FE-2.4A

## Resumen

El modulo actual de proveedores sirve para compras e inventario, pero no tiene estructura fiscal suficiente para sincronizacion desde `backend-facturacion-electronica/`.

Decision: `suppliers` necesita una migracion aditiva futura, similar a `customers`, antes de implementar endpoints fiscales o sync real desde backend FE.

Esta fase no crea migraciones, endpoints ni codigo funcional. Solo deja el diseno.

## Analisis del estado actual

### Tabla `suppliers`

Definida en `scripts/database/products/2026_04_26_inventory_suppliers.sql`:

| Campo | Tipo | Uso actual |
| --- | --- | --- |
| `id` | uuid | PK. |
| `tenant_id` | uuid | Scope multi-tenant. |
| `name` | varchar(255) | Nombre operativo del proveedor. |
| `document_number` | varchar(100) null | Documento operativo libre. |
| `phone` | varchar(50) null | Contacto. |
| `email` | varchar(255) null | Email general. |
| `address` | text null | Direccion general. |
| `departamento_id` | uuid null | Ubicacion. |
| `municipio_id` | uuid null | Ubicacion. |
| `ciudad` | varchar(150) null | Nombre ciudad cacheado. |
| `departamento` | varchar(150) null | Nombre departamento cacheado. |
| `is_active` | boolean | Soft delete operativo. |
| `created_at` | timestamptz | Auditoria tecnica. |
| `updated_at` | timestamptz | Auditoria tecnica. |

Indices actuales:

- `idx_suppliers_tenant_name` en `(tenant_id, name)`.
- `idx_suppliers_tenant_active` en `(tenant_id, is_active)`.

No hay indice por documento normalizado. No hay unicidad fiscal.

### Entidad/modelo

`api/src/modules/inventory/entities/supplier.entity.ts` valida:

- `id` UUID.
- `tenantId` UUID.
- `name` requerido.
- `departamentoId` UUID opcional.
- `municipioId` UUID opcional.
- `email` con formato basico cuando viene.

Normaliza:

- `name` con `trim`.
- `documentNumber` con `trim`.
- `email` a minusculas.
- `phone`, `address`, `ciudad`, `departamento` con `trim`.

No valida:

- `documentTypeCode`.
- `documentNumberNormalized`.
- digito de verificacion.
- `legalName`.
- `fiscalEmail`.
- `fiscalStatus`.
- ultimo lookup DIAN/proveedor.
- duplicado por documento.

### Controller/service/repository

Endpoint actual:

| Metodo | Ruta | Uso |
| --- | --- | --- |
| `POST` | `/api/suppliers` | Crear proveedor operativo. |
| `GET` | `/api/suppliers` | Listar proveedores del tenant. |
| `GET` | `/api/suppliers/:id` | Obtener proveedor. |
| `PUT` | `/api/suppliers/:id` | Actualizar proveedor. |
| `DELETE` | `/api/suppliers/:id` | Inactivar con `is_active=false`. |

El controller usa `JwtAuthGuard` y tenant desde `request.user.tenantId`.

El service:

- exige `name`.
- crea UUID.
- delega persistencia al repository.
- no valida duplicados por documento.
- no tiene auditoria fiscal before/after.

El repository:

- hace SQL directo contra `suppliers`.
- filtra por `tenant_id`.
- crea, lista, obtiene, actualiza e inactiva.
- no consulta por documento normalizado.

### Relacion con compras

Compras usa `supplierId` como dato obligatorio. `purchase.entity.ts` valida UUID de `supplierId`. `purchase.service.ts` persiste `supplier_id` y hace joins con `suppliers` para mostrar `supplier_name`.

Contrato que no se debe romper:

- `suppliers.id`.
- `suppliers.name`.
- `suppliers.document_number`.
- `suppliers.is_active`.
- `purchases.supplier_id`.
- endpoints actuales `/api/suppliers`.
- reportes y consultas que hacen join contra `suppliers`.

## Comparacion contra customers fiscales

| Campo fiscal | `customers` FE-1 | `suppliers` actual | Decision |
| --- | --- | --- | --- |
| `document_type_code` | Existe | No existe | Agregar futuro. |
| `document_number_normalized` | Existe | No existe | Agregar futuro. |
| `verification_digit` | Existe | No existe | Agregar futuro. |
| `legal_name` | Existe | No existe | Agregar futuro. |
| `fiscal_email` | Existe | No existe | Agregar futuro. |
| `is_final_consumer` | Existe | No aplica | No agregar. |
| `dian_last_lookup_at` | Existe | No existe | Agregar como lookup fiscal generico o DIAN/proveedor. |
| `dian_last_lookup_status` | Existe | No existe | Agregar, pero nombre puede ser `fiscal_last_lookup_status` si se quiere no amarrar suppliers a DIAN. |
| `fiscal_status` | Existe | No existe | Agregar futuro. |

Decision recomendada: usar nombres equivalentes a `customers` para consistencia, excepto evaluar si en suppliers conviene `fiscal_last_lookup_at/status` en vez de `dian_last_lookup_at/status`, porque proveedores no dependen necesariamente de GetAcquirer.

## Decision sobre migracion

`suppliers` necesita migracion aditiva futura.

Campos recomendados:

| Campo | Tipo recomendado | Regla |
| --- | --- | --- |
| `document_type_code` | text null | Opcional inicialmente. |
| `document_number_normalized` | text null | Derivado de `document_number`. |
| `verification_digit` | text null | Para NIT cuando aplique. |
| `legal_name` | text null | Razon social fiscal. |
| `fiscal_email` | text null | Email recepcion/relacion fiscal, opcional. |
| `fiscal_last_lookup_at` | timestamptz null | Ultima consulta fiscal provider-agnostic. |
| `fiscal_last_lookup_status` | text null | `PENDING`, `FOUND`, `NOT_FOUND`, `ERROR`, `SKIPPED`. |
| `fiscal_status` | text not null default `PENDING` | `PENDING`, `VALIDATED`, `FAILED`, `NOT_REQUIRED`. |

Indices futuros:

```text
idx_suppliers_tenant_document_number_normalized
  on suppliers (tenant_id, document_number_normalized)
  where document_number_normalized is not null

idx_suppliers_tenant_fiscal_status
  on suppliers (tenant_id, fiscal_status)
```

Unicidad:

- No crear unique duro inmediatamente si hay datos existentes duplicados.
- Disenar primero query de diagnostico.
- Despues de limpieza, evaluar unique parcial por `tenant_id + document_type_code + document_number_normalized` donde ambos existan e `is_active=true`.

## Endpoints fiscales propuestos

Estos endpoints se disenan para fase futura. No se implementan ahora.

### `GET /api/electronic-invoicing/suppliers`

Filtros:

- `search`
- `documentTypeCode`
- `documentNumber`
- `fiscalStatus`
- `isActive`

Respuesta:

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "name": "Proveedor SAS",
  "documentNumber": "900123456",
  "documentTypeCode": "31",
  "documentNumberNormalized": "900123456",
  "verificationDigit": "7",
  "legalName": "Proveedor SAS",
  "fiscalEmail": "facturacion@proveedor.co",
  "fiscalLastLookupAt": null,
  "fiscalLastLookupStatus": null,
  "fiscalStatus": "PENDING",
  "isActive": true
}
```

### `POST /api/electronic-invoicing/suppliers`

Campos:

- `name` requerido.
- `documentNumber` opcional inicialmente, pero recomendado para sync.
- `documentTypeCode` opcional inicialmente.
- `verificationDigit` opcional.
- `legalName` opcional.
- `fiscalEmail` opcional.
- `phone`, `email`, `address` opcionales.

Reglas:

- `tenantId` desde JWT/contexto, no desde body para usuarios normales.
- `documentNumberNormalized` se deriva de `documentNumber`.
- si viene `fiscalEmail`, validar formato basico.
- si viene documento normalizado, validar duplicado por tenant.
- si `documentTypeCode = 31`, validar DV en fase de validacion fiscal estricta.

### `PATCH /api/electronic-invoicing/suppliers/:id`

Permite actualizar:

- `name`
- `documentTypeCode`
- `documentNumber`
- `verificationDigit`
- `legalName`
- `fiscalEmail`
- contacto y direccion operativa si se aprueba.
- `fiscalStatus` solo por flujo controlado.

Reglas:

- validar que supplier pertenece al tenant.
- no sobrescribir datos manuales con datos externos sin politica aprobada.
- auditar before/after de campos fiscales.
- no romper compras existentes.

## Reglas fiscales

1. No duplicar proveedor activo por tenant + tipo documento + numero normalizado cuando esos campos existan.
2. `fiscalEmail` es opcional al crear proveedor.
3. `email` sigue siendo email operativo; `fiscalEmail` es email fiscal.
4. `documentNumberNormalized` se deriva de `documentNumber`.
5. NIT debe permitir `verificationDigit`.
6. No exigir `documentTypeCode` a proveedores existentes durante la primera migracion.
7. No bloquear compras existentes por falta de datos fiscales.
8. La sincronizacion desde backend FE debe ser idempotente.
9. La fuente de proveedores debe ser provider-agnostic; no asumir GetAcquirer.
10. Guardar solo resumen seguro de lookup/sync, no raw response completo.

## Sync desde backend FE

Flujo si supplier existe:

1. Backend FE recibe `partyType=SUPPLIER`, `documentTypeCode` y `documentNumber`.
2. Normaliza documento.
3. Consulta fuente fiscal mock/provider/manual/RUT.
4. Solicita a `api/` actualizar supplier existente.
5. `api/` valida tenant, duplicados y campos permitidos.
6. `api/` audita before/after.
7. Backend FE registra log seguro con `syncAction=UPDATE` o `SKIP`.

Flujo si supplier no existe:

1. Backend FE obtiene datos fiscales normalizados.
2. Solicita a `api/` crear supplier.
3. `api/` crea proveedor compatible con compras.
4. Backend FE registra `syncAction=CREATE` y `supplierId`.

## Seguridad y privacidad

- Proteger endpoints fiscales con `JwtAuthGuard`, `RolesGuard` y `PermissionsGuard`.
- Usar menu key futura sugerida `ELECTRONIC_INVOICING_SETTINGS` o una key especifica `ELECTRONIC_INVOICING_SUPPLIERS`; decision pendiente.
- Enmascarar documento en logs tecnicos si no se necesita completo.
- No guardar raw response fiscal completo.
- Registrar `provider`, `statusCode`, `message`, `requestHash`, `responseSummary`, `lookupAt`, `syncAction`.
- Evitar que backend FE escriba directo en base principal saltando reglas de `api/`.

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Duplicados existentes por documento | Diagnostico antes de unique. |
| Romper compras | Cambio aditivo, campos opcionales y no tocar `supplier_id`. |
| Confundir email operativo con fiscal | Separar `email` y `fiscal_email`. |
| Usar GetAcquirer para suppliers sin soporte confirmado | Mantener adapter provider-agnostic. |
| Sobrescribir datos manuales buenos | Politica de campos permitidos y auditoria before/after. |
| Falta de DV o tipo documento en datos historicos | Backfill gradual, sin bloquear compras. |

## Preguntas abiertas

1. La columna de ultimo lookup debe llamarse `dian_last_lookup_*` para simetria con customers o `fiscal_last_lookup_*` para no acoplar suppliers a DIAN?
2. Cual sera la fuente fiscal aprobada para suppliers: proveedor tecnologico, RUT, manual validado u otra?
3. Se agregara menu key `ELECTRONIC_INVOICING_SUPPLIERS` o se usara `ELECTRONIC_INVOICING_SETTINGS`?
4. Que campos puede sobrescribir backend FE sin confirmacion humana?
5. Se permitira crear suppliers desde backend FE con solo `legalName` y documento?
6. Como se resolveran duplicados historicos antes de activar unique?

## Criterios para pasar a migracion suppliers FE futura

1. Aprobar nombres finales de columnas.
2. Ejecutar diagnostico de duplicados por `tenant_id + document_number` normalizado.
3. Confirmar fuente fiscal provider-agnostic para suppliers.
4. Confirmar politica de sobrescritura de campos.
5. Confirmar menu key/permisos.
6. Aprobar rollback conservador.
7. Confirmar que compras existentes no se bloquean por campos fiscales nulos.
