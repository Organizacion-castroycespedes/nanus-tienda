# Evidencia backend terceros fiscales - FE-3.2

## Alcance

Se implemento base fiscal minima para `customers` y `suppliers`.

No se implemento DIAN real. No se implemento SOAP. No se tocaron frontend, POS quick form, pricing, Orders, PRD real, remoto ni commits.

## Archivos modificados

SQL:

- `scripts/database/migrations/V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql`
- `scripts/database/rollbacks/V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2_rollback.sql`

Backend:

- `api/src/modules/electronic-invoicing/customers/*`
- `api/src/modules/electronic-invoicing/suppliers/*`
- `api/src/modules/inventory/entities/customer.entity.ts`
- `api/src/modules/inventory/repositories/customer.repository.ts`
- `api/src/modules/inventory/services/customer.service.ts`

Tests:

- `api/src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.spec.ts`
- `api/src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.service.spec.ts`
- `api/src/modules/inventory/services/customer.service.spec.ts`

OpenSpec:

- `openspec/changes/dian-terceros-clientes-proveedores-fe-3/tasks.md`

## Migracion

La migracion `V052` es aditiva e idempotente.

Agrega a `customers` y `suppliers`:

- `dian_identification_type`
- `identification_number`
- `trade_name`
- `invoice_email`
- `country_code`
- `department_code`
- `municipality_code`
- `person_type`
- `tax_regime`
- `tax_responsibilities`
- `is_dian_validated`
- `dian_metadata`
- `fiscal_data_source`

Tambien crea indices unicos parciales:

- `ux_customers_tenant_fiscal_identity_fe_3_2`
- `ux_suppliers_tenant_fiscal_identity_fe_3_2`

La llave fiscal usa `tenant_id + tipo documento + numero`, con compatibilidad entre campos nuevos y legacy:

- tipo: `dian_identification_type` o `document_type_code`
- numero: `identification_number` o `document_number_normalized`

## Reglas implementadas

- `tenantId` sigue saliendo del contexto autenticado.
- `customers` sigue siendo canonico para POS.
- `suppliers` sigue separado.
- `suppliers` rechaza `DIAN_DIRECT`.
- No se llama DIAN.
- No se usa SOAP.
- `fiscalEmail` e `invoiceEmail` se sincronizan por compatibilidad.
- `documentTypeCode` y `dianIdentificationType` se sincronizan por compatibilidad.
- `documentNumberNormalized` e `identificationNumber` se sincronizan por compatibilidad.
- Se evita duplicado por tenant, tipo documento y numero.
- `Consumidor Final` no se puede desactivar ni borrar por legacy `/api/customers`.

## Endpoints backend

Se mantienen:

- `GET /api/electronic-invoicing/customers`
- `POST /api/electronic-invoicing/customers`
- `PATCH /api/electronic-invoicing/customers/:id`
- `GET /api/electronic-invoicing/customers/default`
- `POST /api/electronic-invoicing/customers/default/ensure`
- `GET /api/electronic-invoicing/suppliers`
- `POST /api/electronic-invoicing/suppliers`
- `PATCH /api/electronic-invoicing/suppliers/:id`

Se agregan:

- `GET /api/electronic-invoicing/customers/:id`
- `GET /api/electronic-invoicing/suppliers/:id`

## Pruebas ejecutadas

Tests especificos:

```bash
cd api && npx.cmd tsx --test src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.spec.ts src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.service.spec.ts src/modules/inventory/services/customer.service.spec.ts
```

Resultado especifico:

```text
tests 26
pass 26
fail 0
```

Tambien se ejecuto suite ampliada de facturacion electronica y guard de cliente legacy:

```bash
cd api && npx.cmd tsx --test src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.spec.ts src/modules/electronic-invoicing/customers/electronic-invoicing-customers.controller.spec.ts src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.service.spec.ts src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.controller.spec.ts src/modules/electronic-invoicing/document-types/dian-document-types.service.spec.ts src/modules/electronic-invoicing/document-types/dian-document-types.controller.spec.ts src/modules/inventory/services/customer.service.spec.ts
```

Resultado ampliado:

```text
tests 35
pass 35
fail 0
```

Build:

```bash
cd api && npm.cmd run build
```

Resultado: pass.

OpenSpec:

```bash
openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict
```

Resultado: pass.

Diff check:

```bash
git diff --check
```

Resultado: pass, con warnings esperados de LF/CRLF en Windows.

## Riesgos vivos

- Si ya existen duplicados por tenant, tipo documento y numero, la migracion falla con error explicito.
- `tax_responsibilities` se modela como arreglo JSONB de codigos; falta catalogo oficial.
- `person_type` acepta `NATURAL`, `JURIDICA`, `UNKNOWN`; falta decision de UI/catalogo.
- `invoice_email` y `fiscal_email` conviven por compatibilidad.
- `suppliers` queda manual/provider-agnostic; fuente oficial de validacion sigue pendiente.
