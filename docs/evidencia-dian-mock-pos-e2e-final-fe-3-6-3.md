# Evidencia FE-3.6.3 - QA final mock customers POS

## Objetivo

Validar que el flujo mock DIAN pasa completo despues del fix `taxResponsibilities`:

lookup mock -> apply `taxResponsibilities` -> customer validado -> POS usa `customerId`.

## Entorno

- API local: `http://localhost:4020/api`
- API version: `{"version":"0.0.1"}`
- Lookup mock esperado:
  - `DIAN_THIRD_PARTY_LOOKUP_ENABLED=true`
  - `DIAN_THIRD_PARTY_LOOKUP_MODE=mock`
- Evidencia de modo mock: lookup retorno `provider=MOCK_LOCAL`.

## Resultado

Smoke sanitizado:

```json
{
  "steps": [
    "fiscal-create:ok",
    "lookup:ok",
    "apply-taxResponsibilities:ok",
    "db-jsonb-check:ok",
    "pos-customers-list:ok",
    "pos-session:ok",
    "sale-create:ok",
    "sale-cancel:ok"
  ],
  "errors": [],
  "lookupStatus": "FOUND",
  "lookupProvider": "MOCK_LOCAL",
  "lookupStatusCode": "MOCK_FOUND",
  "lookupHasRaw": false,
  "lookupHasSoap": false,
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
  "dbTaxResponsibilitiesType": "array",
  "dbTaxResponsibilitiesText": "[\"R-99-PN\"]",
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

## Validaciones funcionales

| Validacion | Estado |
| --- | --- |
| API local disponible | PASS |
| Lookup enabled/mode mock | PASS via `provider=MOCK_LOCAL` |
| Crear customer fiscal con `taxResponsibilities` | PASS |
| Lookup mock `FOUND` | PASS |
| apply-lookup seleccionando `taxResponsibilities` | PASS |
| API devuelve `taxResponsibilities` como array | PASS |
| DB guarda JSONB array valido | PASS: `jsonb_typeof=array`, valor `["R-99-PN"]` |
| POS puede usar `customerId` | PASS via `/customers`, `/pos/session`, `/sales` |
| Consumidor Final fallback | PASS |
| Cleanup fixture | PASS |
| No raw sensible | PASS |

## Nota POS web

La validacion de POS se hizo por endpoints reales que usa POS:

- `GET /customers`
- `POST /pos/session`
- `POST /sales`

Chequeo directo de `http://localhost:3000/default/pos` en dev server devolvio 500 por chunk stale:

```text
Cannot find module './1682.js'
```

No se modifico frontend. Se valida con `npm run build` como gate solicitado.

## Cleanup

- Venta QA creada y cancelada.
- Customer fiscal QA soft-deleted por `DELETE /customers/:id`.
- Evidencia no registra access token, refresh token, password, certificado, raw SOAP ni tokens.

## Validaciones de build/OpenSpec

- `cd api && npm.cmd run build`: PASS.
- `cd web && npm.cmd run build`: PASS con warnings existentes de hooks/`<img>`.
- `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict`: PASS.
- `git diff --check`: PASS con warning CRLF de `tasks.md`.

## Fuera de alcance confirmado

- No codigo funcional.
- No SOAP real.
- No certificados.
- No SQL nuevo.
- No PRD.
- No remoto.
- No commit.
