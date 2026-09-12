# Gestión Operativa — Phase 5.17

## Safe retry delivery

Implemented the narrow operational route `POST /api/operations/sales/:saleId/electronic-billing/retry`.
It requires `POS WRITE`, reuses `OperationalSaleScopeService`, and never exposes
legacy `retryDocument()`.

Billing remains the authority. `evaluateRetryability()` returns the certified
pre-provider decision, and `retryRecoverableDocument()` executes it under the
existing PostgreSQL advisory lock. Terminal, processing, ambiguous, and
reconciliation-only states remain non-actionable.

## Projection and audit

Operational detail now receives sanitized `electronicBilling.retryability` with
`canRetry`, `retryClass`, `decision`, `reasonCode`, `requiredAction`,
`requiresReconciliation`, `providerDocumentExists`, `processingStage`, and
`safeUserMessage`.

Retry uses existing `AuditService` and `auditoria_eventos`. Audit data contains
actor, tenant, sale/document identifiers, decision, reason, disposition, status,
and processing stage only. No provider payload, credentials, or fiscal snapshot
is stored.

## Frontend

`OperationalSaleDetailPage` renders `Reintentar procesamiento` only when the
backend projection says `canRetry=true`. It asks for confirmation, blocks a
second click while in flight, reloads the detail, and shows safe feedback. The
UI does not infer retryability or call Billing/provider directly. Reprint and
safe status refresh remain separate.

## Validation

- API tests: `587 passed`, `1 skipped`.
- Billing tests: `152 passed`, `15 skipped`.
- API build: passed.
- Billing build: passed.
- Web lint: passed with existing warnings.
- No QA mutation, V076 rerun, FactuCore mutation, or DIAN call occurred.

## Pending

Run manual QA with real role fixtures and responsive/shared Electron rendering.
The broad legacy retry contract remains out of the operational route.
