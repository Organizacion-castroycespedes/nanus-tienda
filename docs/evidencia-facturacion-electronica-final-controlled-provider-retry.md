# Evidencia: final controlled provider retry

Fecha: 2026-09-10

## Alcance

- Documento permitido: `41f5c937-9219-4d70-9848-14b46a7aa820`.
- No se creó venta nueva.
- No se procesó ningún otro documento.
- No se ejecutó ningún POST contra FactuCore.

## Guards

- Manus branch: `feat/develop/implementando-facturacion-electronica`.
- Manus HEAD: `7352ea7`.
- FactuCore branch: `main`.
- FactuCore HEAD: `ee1c132`.
- Runtime local billing: `qa`.
- Database config: `54.242.102.178:5432`, database `manus_tienda_qa`, user `manus_user`, schema `public`.
- Database hard guard: PASS.
- `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`; worker remained disabled.
- FactuCore `GET /api/health`: HTTP 200.
- FactuCore authentication and rotated credential were previously validated PASS; no credential values were printed.

## Payload validation

- Mapper input source unit: `UND`.
- Unit sent after normalization: `EA`.
- `UND -> EA`: PASS.
- Local FactuCore DTO validation: PASS; errors: `0`.
- Customer, tax, excluded-tax, monetary, payment, and date checks: PASS from existing regression suite.

## Recovery result

- Recovery method attempted: `ElectronicBillingProcessingService.recoverPreProviderDocument(tenantId, documentId)`.
- Manual recovery invocations: `1`.
- The application rejected the invocation before provider HTTP because the persisted error message did not match the narrow eligibility message gate.
- Persisted state before and after: `REJECTED`, provider document ID `NULL`, provider status `NULL`.
- Persisted error code: `FACTUCORE_VALIDATION`.
- Persisted sanitized error path: `lines.0.unitCode`.
- External provider document count: `0`.
- FactuCore create/generate XML/sign/transmit calls: `0`.
- No additional retry was attempted.

## Finding

The `UND -> EA` payload fix is validated locally, but the recovery gate still only recognizes the older generic 400 message form. It does not recognize the structured persisted validation detail for this already-`REJECTED`, pre-provider document. Therefore this phase did not reach provider processing and must be followed by a production-quality recovery eligibility fix before another retry.

## Validation

- Billing tests: `133` passed.
- Billing build: PASS.
- FactuCore code modified: NO.
- FactuCore build/readiness: PASS from prior gate.
- OpenSpec relevant strict: PASS.
- OpenSpec all strict: `80` passed, `0` failed.
- Git diff check: PASS.
- Migrations: NO.
- Secret error leak: NONE observed.
- Historical documents: unchanged.
- PROD: untouched.
- Commit/push/deploy: none.
