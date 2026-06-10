# Evidencia FE-3.6.1 - Reintento QA DIAN mock POS con V052 local

## Objetivo

Aplicar `V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql` solo en DB local/copia QA y repetir QA mock:

POS/customer fiscal -> lookup mock -> crear customer -> apply-lookup -> usar `customerId` en POS.

## DB local confirmada

Conexion verificada antes de aplicar SQL:

```json
{
  "database": "manus_tienda_prd",
  "address": "::1/128",
  "port": "5432"
}
```

`::1/128` es loopback IPv6 local. No remoto.

## Migracion aplicada

Archivo aplicado:

```text
scripts/database/migrations/V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql
```

Resultado:

```json
{
  "migration": "V052__electronic_invoicing_third_party_fiscal_fields_fe_3_2.sql",
  "status": "applied",
  "outputTail": [
    "UPDATE 5",
    "ALTER TABLE",
    "ALTER TABLE",
    "DO",
    "DO",
    "CREATE INDEX",
    "CREATE INDEX",
    "COMMIT"
  ]
}
```

Columnas FE-3.2 en `customers`:

```json
{
  "afterColumnCount": 13,
  "missing": [],
  "columns": [
    "country_code",
    "department_code",
    "dian_identification_type",
    "dian_metadata",
    "fiscal_data_source",
    "identification_number",
    "invoice_email",
    "is_dian_validated",
    "municipality_code",
    "person_type",
    "tax_regime",
    "tax_responsibilities",
    "trade_name"
  ]
}
```

## API principal mock

API principal local reiniciada en `4020` con:

```env
DIAN_THIRD_PARTY_LOOKUP_ENABLED=true
DIAN_THIRD_PARTY_LOOKUP_MODE=mock
```

`GET http://localhost:4020/api/system/version`:

```json
{"version":"0.0.1"}
```

## Resultado QA

### Flujo con fiscal create directo

`POST /api/electronic-invoicing/customers` sigue bloqueado.

Error confirmado:

```text
chk_customers_tax_responsibilities_array
```

Intento con `taxResponsibilities=["R-99-PN"]` tambien fallo:

```text
sintaxis de entrada no valida para tipo json
Datos JSON, linea 1: {"R-99-PN"}
```

Esto bloquea el flujo exacto de "quick fiscal create" si POS usa el endpoint fiscal directo.

### Flujo POS/customer existente + apply-lookup

Se valido el resto del E2E usando un customer operativo creado por `/api/customers`, equivalente a fixture seleccionable por POS, y luego `apply-lookup` fiscal.

Resultado sanitizado:

```json
{
  "steps": [
    "login:ok",
    "legacy-customer-create:ok",
    "lookup:ok",
    "apply-lookup:ok",
    "customers-list:ok",
    "pos-session:ok",
    "sale-create:ok",
    "sale-cancel:ok"
  ],
  "errors": [],
  "lookupStatus": "FOUND",
  "lookupProvider": "MOCK_LOCAL",
  "lookupStatusCode": "MOCK_FOUND",
  "applyLookupStatus": "FOUND",
  "applyLookupProvider": "MOCK_LOCAL",
  "appliedFields": ["legalName", "fiscalEmail", "phone", "address"],
  "customerLookupStatus": "FOUND",
  "customerDataSource": "MOCK_LOCAL",
  "customerIsDianValidated": true,
  "customerFiscalStatus": "VALIDATED",
  "posCustomerListHasFixture": true,
  "finalConsumerAvailable": true,
  "posSessionCreated": true,
  "productsCount": 6,
  "saleCreated": true,
  "saleCustomerIdUsed": true,
  "saleCleanup": "CANCELLED",
  "customerCleanup": "soft-deleted via DELETE /customers/:id"
}
```

## Validaciones solicitadas

| Validacion | Estado |
| --- | --- |
| Columnas FE-3.2 existen en `customers` | PASS |
| API principal corre en mock | PASS |
| Crear cliente rapido fiscal directo | FAIL: bug `tax_responsibilities` |
| Crear customer operativo seleccionable por POS | PASS |
| Lookup mock customer responde `FOUND` | PASS |
| apply-lookup aplica campos seleccionados | PASS |
| Customer queda validado | PASS: `isDianValidated=true`, `fiscalStatus=VALIDATED` |
| POS puede seleccionar `customerId` | PASS via `/customers` |
| Venta POS usa `customerId` | PASS via `/sales`, luego cancelada |
| Consumidor Final fallback | PASS |
| Cleanup fixture | PASS |
| No guardar tokens/secretos | PASS |

## Browser POS

Click-smoke visual POS no fue viable por sandbox:

```text
windows sandbox failed: spawn setup refresh
```

La validacion POS se hizo por endpoints que usa POS: `/customers`, `/pos/session`, `/sales`.

## Validaciones de build/OpenSpec

- `cd api && npm.cmd run build`: pass.
- `cd web && npm.cmd run build`: pass, con warnings existentes de hooks e imagenes.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: pass.
- `git diff --check`: pass.

## Bugs

1. `POST /api/electronic-invoicing/customers` falla contra DB local tras V052 por `chk_customers_tax_responsibilities_array`.
2. `taxResponsibilities=["R-99-PN"]` llega a DB como forma JSON invalida para `jsonb`.
3. `apply-lookup` falla si se selecciona `taxResponsibilities`; pasa si se aplican `legalName`, `fiscalEmail`, `phone`, `address`.

## Fuera de alcance confirmado

- No PRD real.
- No remoto.
- No guardar credenciales.
- No modificar codigo funcional.
- No SQL nuevo.
- No SOAP real.
- No certificados.
- No commit.
