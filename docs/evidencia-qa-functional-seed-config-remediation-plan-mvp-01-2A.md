# Evidencia QA functional seed/config remediation plan MVP-01.2A

Fecha: 2026-06-10 America/Bogota.

Cambio OpenSpec: `mvp-web-hardening`

Fuente primaria: `docs/evidencia-qa-operativo-integral-mvp-01-2.md`

Resultado: `QA_FUNCTIONAL_SEED_CONFIG_REMEDIATION_PLANNED`

## Restricciones

- No se ejecutaron migraciones.
- No se toco AWS.
- No se modifico DB.
- No se hizo deploy.
- No se corrigio codigo.
- No se expusieron secretos.
- Solo se analizaron evidencias, codigo versionado, SQL versionado y configuracion documental.

## Bloqueos clasificados

| Bloqueo MVP-01.2 | Clasificacion | Causa probable | Remediacion propuesta |
| --- | --- | --- | --- |
| `GET /api/electronic-invoicing/customers/default` devuelve HTTP 404 | Seed/config de datos inconsistente | Existe seed legacy de consumidor final por `is_default`, pero el endpoint FE busca `is_final_consumer=true` e `is_active=true`. | Normalizar consumidor final FE por tenant con seed/migracion idempotente. |
| `POST /api/electronic-invoicing/customers/default/ensure` devuelve HTTP 409 | Constraint/seed mismatch | `ensure` intenta insertar consumidor final con `is_final_consumer=true` e `is_default=true`; si ya existe fila legacy `is_default=true`, choca con `ux_customers_tenant_default`. | Actualizar la fila legacy a consumidor final FE antes de intentar crear otra. |
| Lookup FE responde `provider=NONE`, `mode=disabled`, `lookupStatus=SKIPPED` | Config QA faltante | `DIAN_THIRD_PARTY_LOOKUP_ENABLED` no esta activo o `DIAN_THIRD_PARTY_LOOKUP_MODE` queda `disabled`. | Configurar modo mock en QA, sin activar proveedor real. |
| `GET /api/units` devuelve 0 activos | Seed minimo omitido | Existen seeds de unidades, pero `migrate_prd.sh` no los incluye en el flujo principal. | Incluir seed idempotente de unidades base en bootstrap. |
| `GET /api/taxes` devuelve 0 activos | Seed minimo omitido | Existen seeds de impuestos, pero `migrate_prd.sh` no los incluye en el flujo principal. | Incluir seed idempotente de impuestos base en bootstrap. |
| `GET /api/inventory/lot-balances` no muestra lotes | Fixture QA faltante | Estructura de lotes existe, pero no hay lote demo controlado. | Crear fixture QA opcional para producto, proveedor, ubicacion, lote y balance. |

## Analisis consumidor final

Evidencia MVP-01.2:

```text
GET /api/electronic-invoicing/customers/default -> HTTP 404
POST /api/electronic-invoicing/customers/default/ensure -> HTTP 409
```

Hallazgos versionados:

- `scripts/database/011_prd_default_customer.sql` crea un consumidor final legacy con `is_default=true`, `is_active=true`, `name='CONSUMIDOR FINAL'` y `document_number='0000000000'`.
- `scripts/database/migrations/20260603_electronic_invoicing_customers_phase_1.sql` agrega `is_final_consumer` y migra filas legacy `is_default=true` a `is_final_consumer=true`.
- `scripts/database/migrate_prd.sh` corre migraciones incrementales antes de `minimal_seed_files`.
- `minimal_seed_files` hoy solo contiene `011_prd_default_customer.sql`, y corre al final.
- Entonces, en DB limpia, la migracion FE puede correr antes de que exista la fila legacy. Luego el seed final crea una fila con `is_default=true`, pero sin `is_final_consumer=true`.
- `ElectronicInvoicingCustomersRepository.findActiveFinalConsumer()` busca `tenant_id`, `is_final_consumer=true` e `is_active=true`. No busca `is_default=true`.
- `ElectronicInvoicingCustomersRepository.create()` inserta `is_final_consumer` e `is_default` con el mismo valor para nuevo consumidor final.
- Si ya existe una fila legacy `is_default=true`, `ensureDefaultFinalConsumer()` no la encuentra como FE final consumer y luego el insert choca con `ux_customers_tenant_default`.

Conclusion:

No parece solo "falta seed". Es una incompatibilidad de orden y normalizacion entre seed legacy (`is_default`) y endpoint FE (`is_final_consumer`). El 404 + 409 cuadra con fila legacy existente pero no normalizada a consumidor final FE.

Confirmacion futura permitida solo con SELECT:

```sql
SELECT
  id,
  tenant_id,
  name,
  document_number,
  is_default,
  is_final_consumer,
  fiscal_status,
  is_active
FROM public.customers
WHERE tenant_id = :tenant_id
  AND (
    is_default = true
    OR is_final_consumer = true
    OR upper(name) LIKE '%CONSUMIDOR%'
  );
```

## Remediacion propuesta para consumidor final

Crear una migracion o seed versionado e idempotente, al final de la secuencia actual, para normalizar por tenant:

1. Si existe fila `is_default=true`, actualizarla:
   - `is_final_consumer=true`
   - `is_active=true`
   - `fiscal_status='NOT_REQUIRED'`
   - `fiscal_data_source='MANUAL'`
   - `is_dian_validated=false`
   - `tax_responsibilities='[]'::jsonb`
   - `dian_metadata='{}'::jsonb`
2. Si no existe ninguna fila final consumer activa, insertar una:
   - `name='Consumidor Final'`
   - `is_default=true`
   - `is_final_consumer=true`
   - `is_active=true`
   - `fiscal_status='NOT_REQUIRED'`
   - sin dependencia de lookup DIAN
3. Validar que queda maximo un consumidor final activo por tenant.
4. No borrar filas operativas.
5. Si existen duplicados reales, abortar con error claro en vez de elegir uno al azar.

Archivo propuesto:

```text
scripts/database/migrations/V058__normalize_fe_final_consumer_mvp_01_2a.sql
```

## Analisis lookup FE disabled

Evidencia MVP-01.2:

```text
provider=NONE
mode=disabled
lookupStatus=SKIPPED
```

Hallazgos versionados:

- `api/src/modules/electronic-invoicing/third-party-lookup/third-party-lookup.config.ts` deja el lookup disabled si `DIAN_THIRD_PARTY_LOOKUP_ENABLED` no es `true`.
- Si esta enabled, `DIAN_THIRD_PARTY_LOOKUP_MODE` debe ser `disabled`, `mock` o `real`.
- `mock` usa `ThirdPartyLookupMockAdapter` y no requiere WSDL, certificado ni HTTP externo.
- `ThirdPartyLookupMockAdapter` devuelve `NOT_FOUND` cuando el documento normalizado inicia por `000` o es `999999999`.
- Para otros documentos devuelve `FOUND` con datos mock.
- El mock versionado no tiene trigger de timeout/provider error.

Config QA minima propuesta:

```text
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true
DIAN_THIRD_PARTY_LOOKUP_MODE=mock
DIAN_GET_ACQUIRER_HTTP_ENABLED=false
```

No configurar `real` en QA sin aprobacion FE explicita.

Validacion futura esperada:

| Caso | Documento sugerido | Resultado esperado |
| --- | --- | --- |
| Documento valido mock | `900123456` | `provider=MOCK_LOCAL`, `lookupStatus=FOUND` |
| Documento inexistente mock | `000123456` o `999999999` | `provider=MOCK_LOCAL`, `lookupStatus=NOT_FOUND` |
| Timeout/provider error | N/A | No existe trigger mock versionado hoy. Requiere adapter/test fixture futuro si se necesita. |

## Analisis units=0 y taxes=0

Evidencia MVP-01.2:

```text
GET /api/units -> 0 unidades activas base
GET /api/taxes -> 0 impuestos activos base
```

Hallazgos versionados:

- `scripts/database/products/2026_04_25_seed_inventory_units.sql` existe y siembra `Unidad`, `Kilogramo`, `Litro` y `Caja`.
- `scripts/database/products/2026_04_25_seed_inventory_taxes.sql` existe y siembra `IVA 19%` y `Exento`.
- `scripts/database/bootstrap-manus-tienda-qa.manifest.md` ya documenta que ambos seeds no estan hoy en `migrate_prd.sh`.
- `scripts/database/migrate_prd.sh` incluye schema de productos y `products/2026_04_26_inventory_units_taxes_is_active.sql`, pero no incluye los seed files de unidades/impuestos.

Conclusion:

No parece bug de endpoint. Parece seed minimo omitido del bootstrap principal.

Remediacion propuesta:

1. Incluir `products/2026_04_25_seed_inventory_units.sql` en el flujo bootstrap luego de crear tablas y `is_active`.
2. Incluir `products/2026_04_25_seed_inventory_taxes.sql` justo despues de unidades.
3. Mantener idempotencia por `id`, `name`, `abbreviation`, `rate` e `is_included`.
4. Confirmar que ambos seeds dejan `is_active=true` por default o por update explicito.

## Seed QA minimo definido

### Bootstrap obligatorio

Estos datos son necesarios para que el sistema arranque funcionalmente y no para demostrar un caso aislado:

| Dato | Motivo | Fuente/propuesta |
| --- | --- | --- |
| Tenant/sucursal base | Contexto multi-tenant y sucursal | Ya existe en seeds actuales. |
| Roles, usuarios QA y permisos | Login/RBAC/menu | Ya existe en seeds actuales. |
| Terminal POS y settings MOCK | POS/terminal/perifericos | Ya existe en seeds actuales. |
| Consumidor final FE por tenant | POS/ventas/FE no deben romper en cliente generico | Normalizar con `V058__normalize_fe_final_consumer_mvp_01_2a.sql`. |
| Unidades base | Productos requieren `unit_id` | Agregar seed de unidades al bootstrap. |
| Impuestos base | Productos/pricing requieren `tax_id` o catalogo fiscal base | Agregar seed de impuestos al bootstrap. |
| Config lookup MOCK en QA | QA debe validar `FOUND`/`NOT_FOUND` sin proveedor real | Variables runtime QA, no seed DB. |

### Fixtures QA opcionales

Estos datos sirven para QA funcional, demos y pruebas repetibles. No deben correr por defecto en PRD.

| Dato | Propuesta | Regla |
| --- | --- | --- |
| Producto base | `QA-BASE-LOT-001`, activo, unidad `UND`, impuesto `IVA 19%`, `requires_lot=true`, `requires_expiration=true` | Fixture QA gated. |
| Barcode principal | `7700000000011`, `is_primary=true`, `is_active=true` | Fixture QA gated. |
| Barcode alterno | `QA-ALT-BASE-LOT-001`, `is_primary=false`, `is_active=true` | Fixture QA gated. |
| Proveedor base FE | NIT mock, `documentTypeCode=31`, `documentNumber=900123456`, `verificationDigit` calculado o fijo validado, `countryCode=CO`, `departmentCode=05`, `municipalityCode=05001`, `taxResponsibilities=['R-99-PN']` | Fixture QA gated. |
| Cliente FE base | NIT mock, `documentTypeCode=31`, `documentNumber=900654321`, `countryCode=CO`, `departmentCode=11`, `municipalityCode=11001`, `taxResponsibilities=['R-99-PN']` | Fixture QA gated. |
| Lote demo controlado | `QA-LOT-MVP-01-2A-001`, vencimiento futuro, cantidad disponible positiva | Fixture QA gated. |
| Ubicacion inventario | `QA-DEMO`, tipo `WAREHOUSE` u `OTHER`, por sucursal base | Fixture QA gated. |

## Propuesta de seeds versionados

### 1. Normalizacion obligatoria

Archivo propuesto:

```text
scripts/database/migrations/V058__normalize_fe_final_consumer_mvp_01_2a.sql
```

Propiedades:

- Idempotente.
- Corre despues de `V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql`.
- No depende de proveedor DIAN.
- No borra datos.
- No altera inventario.
- Bloquea si encuentra duplicados activos imposibles de resolver de forma segura.

### 2. Catalogo minimo obligatorio

Opcion A, preferida:

- Agregar al flujo principal los seeds existentes:
  - `products/2026_04_25_seed_inventory_units.sql`
  - `products/2026_04_25_seed_inventory_taxes.sql`
- Orden: despues de `products/2026_04_26_inventory_units_taxes_is_active.sql` y antes de cualquier seed de productos.

Opcion B:

- Crear un seed nuevo consolidado:

```text
scripts/database/012_seed_minimum_units_taxes.sql
```

Pero esta opcion duplica logica ya existente. Menos ideal.

### 3. Fixtures QA opcionales

Archivo propuesto:

```text
scripts/database/migrations/20260611_mvp_01_2a_functional_qa_fixtures.sql
```

O mejor, para separar datos demo del stream estructural:

```text
scripts/database/qa-fixtures/20260611_mvp_01_2a_functional_seed.sql
```

Gates requeridos:

```text
RUN_OPTIONAL_QA_FIXTURES=YES
APPLY_OPTIONAL_FIXTURES=YES
```

Reglas:

- Nunca correr por defecto en PRD.
- Idempotente por tenant, sku, barcode, document identity, lot code y location code.
- Usar nombres y codigos prefijados `QA-`.
- Soft-delete o desactivar solo fixtures `QA-` si hace falta rollback de fixture.
- No tocar productos, clientes, proveedores o lotes reales.

## Datos propuestos para fixture QA

| Entidad | Campos minimos |
| --- | --- |
| Unidad | `UND`, `KG`, `LT`, `CJ` desde seed existente. |
| Impuesto | `IVA 19%` rate `0.19`, `Exento` rate `0`. |
| Consumidor final | `name=Consumidor Final`, `is_final_consumer=true`, `is_default=true`, `fiscal_status=NOT_REQUIRED`, `fiscal_data_source=MANUAL`. |
| Producto base | `sku=QA-BASE-LOT-001`, `name=Producto QA loteado`, activo, unidad `UND`, impuesto `IVA 19%`, `requires_lot=true`, `requires_expiration=true`. |
| Proveedor base | `name=Proveedor QA FE Base`, `documentTypeCode=31`, `documentNumber=900123456`, `countryCode=CO`, `departmentCode=05`, `municipalityCode=05001`, email mock local, telefono mock, `taxResponsibilities=['R-99-PN']`. |
| Cliente FE base | `name=Cliente QA FE Base`, `documentTypeCode=31`, `documentNumber=900654321`, `countryCode=CO`, `departmentCode=11`, `municipalityCode=11001`, email mock local, telefono mock, `taxResponsibilities=['R-99-PN']`. |
| Lote demo | `lot_code=QA-LOT-MVP-01-2A-001`, `expiration_date=current_date + 180 days`, `quantity_on_hand=25`, `quantity_reserved=0`. |

## Plan de validacion futuro

Despues de implementar y desplegar en una ventana aprobada:

1. Validar consumidor final:

```text
GET /api/electronic-invoicing/customers/default -> 200
POST /api/electronic-invoicing/customers/default/ensure -> 200 o 201 idempotente
```

2. Validar lookup mock:

```text
POST /api/electronic-invoicing/customers/lookup -> provider=MOCK_LOCAL, lookupStatus=FOUND
POST /api/electronic-invoicing/customers/lookup -> provider=MOCK_LOCAL, lookupStatus=NOT_FOUND
POST /api/electronic-invoicing/suppliers/lookup -> provider=MOCK_LOCAL, lookupStatus=FOUND
POST /api/electronic-invoicing/suppliers/lookup -> provider=MOCK_LOCAL, lookupStatus=NOT_FOUND
```

3. Validar catalogos:

```text
GET /api/units -> al menos UND/KG/LT/CJ activos
GET /api/taxes -> al menos IVA 19% y Exento activos
```

4. Validar fixture QA opcional:

```text
GET /api/products?search=QA-BASE-LOT-001 -> producto activo visible
GET /api/inventory/lot-balances?onlyAvailable=true&onlyActiveLots=true -> lote QA visible con cantidad disponible
```

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Duplicados de consumidor final | Migracion debe detectar y abortar si hay mas de un candidato activo no resoluble. |
| Fixture QA en PRD | Usar gate `RUN_OPTIONAL_QA_FIXTURES=YES`; default `NO`. |
| Lookup real activado por error | Mantener `DIAN_GET_ACQUIRER_HTTP_ENABLED=false` y `DIAN_THIRD_PARTY_LOOKUP_MODE=mock` en QA. |
| Seeds de productos demo mezclados con bootstrap obligatorio | Separar catalogo minimo obligatorio de fixtures QA opcionales. |
| Datos FE mock confundidos con reales | Usar prefijo `QA-` y dominios/email mock local. |

## Decision

Se planifica correccion en tres lineas:

1. Normalizar consumidor final FE.
2. Incluir unidades/impuestos base en bootstrap.
3. Activar lookup MOCK en QA y crear fixture QA opcional para producto/proveedor/cliente/lote.

Estado emitido:

```text
QA_FUNCTIONAL_SEED_CONFIG_REMEDIATION_PLANNED
```
