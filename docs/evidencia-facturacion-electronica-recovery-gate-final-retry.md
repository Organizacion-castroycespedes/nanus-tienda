# Evidencia: recovery gate hardening

Fecha: 2026-09-10

## Scope and guards

- Manus branch: `feat/develop/implementando-facturacion-electronica`.
- Manus HEAD: `7352ea7`.
- FactuCore branch: `main`.
- FactuCore HEAD: `ee1c132`.
- QA database: `manus_tienda_qa`.
- Database identity: `manus_tienda_qa`, `manus_user`, `public`.
- `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false` before and after.
- Historical documents were not processed.
- FactuCore repository was not modified.

## Root cause and fix

The previous gate required `last_error_code = FACTUCORE_VALIDATION` plus a text fragment from an older error message. The current persisted sanitized message used structured validation wording, so recovery was blocked before provider HTTP.

The gate now uses stable semantic signals: `REJECTED`, no `provider_document_id`, and `last_error_code = FACTUCORE_VALIDATION`. `last_error_message` is observability only. Provider identity and external-reference reconciliation remain the create-safety guards. A fiscal rejection with an existing provider identity remains blocked from pre-provider recovery.

The regression fixture now uses structured `lines.0.unitCode` validation wording and continues to allow pre-provider recovery. The final-rejection fixture has provider identity and remains denied.

## Controlled retry

- Document: `41f5c937-9219-4d70-9848-14b46a7aa820`.
- Recovery invocation: exactly `1`.
- External-reference lookup: HTTP `404`, not found.
- FactuCore create: exactly `1` request, HTTP `400`.
- Generate XML, sign, transmit: `0` each.
- FactuCore provider document count: `0`.
- Duplicate provider document: NO.
- Sanitized provider result: `La factura no tiene todos los datos requeridos para preparar el documento DIAN.`
- Manus state after: `REJECTED`, provider document ID `NULL`, provider status `NULL`.
- No second retry was attempted.

## Tests and checks

- Billing tests: `133 passed, 0 failed`.
- Billing build: PASS.
- FactuCore build/readiness: PASS from prior verified gate.
- OpenSpec relevant strict: PASS.
- OpenSpec all strict: `80 passed, 0 failed`.
- Git diff check: PASS.
- Secret error leak: NONE observed.
- Migrations: NO.
- PROD touched: NO.
