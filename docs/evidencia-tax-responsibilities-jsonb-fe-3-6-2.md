# Evidencia FE-3.6.2 - Fix taxResponsibilities JSONB customers

## Objetivo

Corregir persistencia de `taxResponsibilities` para que `customers` guarde JSONB array valido:

```json
["R-99-PN"]
```

## Causa raiz

`node-postgres` trata los arrays JavaScript como arrays PostgreSQL. El repository enviaba:

```ts
["R-99-PN"]
```

como literal PostgreSQL:

```text
{"R-99-PN"}
```

Eso no es JSON valido para columnas `jsonb`, y por eso fallaba:

```text
chk_customers_tax_responsibilities_array
sintaxis de entrada no valida para tipo json
```

El mismo patron existia en suppliers.

## Fix

- `customers` repository serializa `taxResponsibilities` con `JSON.stringify(...)`.
- `suppliers` repository aplica el mismo fix.
- `create` guarda `["R-99-PN"]` como JSONB array.
- `update/apply-lookup` guarda `["R-99-PN"]` como JSONB array.
- `null/undefined` mantiene el patron existente de `[]`.
- No se toca SOAP, certificados, POS venta, frontend, pricing, Orders ni SQL.

## Tests

Comando:

```powershell
cd api
npx.cmd tsx --test src/modules/electronic-invoicing/customers/electronic-invoicing-customers.repository.spec.ts src/modules/electronic-invoicing/customers/electronic-invoicing-customers.service.spec.ts src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.repository.spec.ts src/modules/electronic-invoicing/suppliers/electronic-invoicing-suppliers.service.spec.ts
```

Resultado:

```text
34 tests
34 pass
0 fail
```

## Smoke API local

API local `4020` reiniciada con mock para verificar el fix:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true
DIAN_THIRD_PARTY_LOOKUP_MODE=mock
```

Resultado sanitizado:

```json
{
  "steps": [
    "fiscal-create:ok",
    "apply-taxResponsibilities:ok"
  ],
  "errors": [],
  "createFiscalCustomer": "ok",
  "createdTaxResponsibilities": ["R-99-PN"],
  "applyLookupStatus": "FOUND",
  "appliedFields": [
    "legalName",
    "fiscalEmail",
    "phone",
    "address",
    "taxResponsibilities"
  ],
  "updatedTaxResponsibilities": ["R-99-PN"],
  "customerIsDianValidated": true,
  "customerFiscalStatus": "VALIDATED",
  "cleanup": "soft-deleted"
}
```

No se registro access token, refresh token, password, certificado, raw SOAP ni token en evidencia.

## Validaciones

- `cd api && npm.cmd run build`: pass.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: pass.
- `git diff --check`: pass.

## Fuera de alcance confirmado

- No SOAP real.
- No certificados.
- No SQL nuevo.
- No POS venta.
- No frontend.
- No pricing.
- No Orders.
- No PRD.
- No remoto.
- No commit.
