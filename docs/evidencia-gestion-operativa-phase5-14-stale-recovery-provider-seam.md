# Gestión Operativa — Phase 5.14

## Decisión de arquitectura

The current FactuCore adapter exposes `issueInvoice()` and
`issueCreditNote()` as combined provider operations. Each operation performs
provider creation, XML generation, signing, and transmission internally. The
provider interface has no separate create/transmit contract. No fictional
transmission seam was added.

## Implemented entry point

`ElectronicBillingProcessingService.recoverStaleDocument()` is now a shared
domain entry point. It acquires the existing PostgreSQL tenant/document
advisory lock, reloads the aggregate, checks terminal status and lease
expiry, then applies stage-aware recovery:

- `PRE_PROVIDER_CREATE`: safely returns the document to `PENDING` and uses
  the normal processing path.
- `PROVIDER_CREATE_INTENT`, `PROVIDER_LINKED`, `PRE_TRANSMIT`,
  `TRANSMISSION_INTENT`, and `RECONCILIATION_REQUIRED`: reconcile provider
  state first; no blind external mutation.
- `UNKNOWN`: returns `MANUAL_REVIEW`.
- terminal statuses: return `TERMINAL` without mutation.

The method is not exposed through HTTP. Retry API and UI remain deferred.

## Validation

- Real local PostgreSQL fixture and repositories: `PASS`.
- Real processing service smoke: `PASS`.
- Stale `PRE_PROVIDER_CREATE` recovery, five iterations: `PASS`.
- Concurrent stale recovery/status reconciliation, five iterations: `PASS`.
- Existing PostgreSQL concurrency tests: `5/5 PASS`.
- Focused integration run: `9/9 PASS`.
- Full Billing suite: `152 pass`, `9 skipped`, `0 fail`.
- Billing build: `PASS`.
- API build: `PASS`.
- Relevant OpenSpec strict: `PASS`.
- All OpenSpec strict: `90 passed`, `1 inherited failure`.
- `git diff --check`: `PASS`.

## Remaining boundary

Full PRE_TRANSMIT crash certification remains blocked because FactuCore's
current `issueInvoice()` operation combines create/XML/sign/transmit and the
production service has no distinct transmit method or durable external-call
callback. No production semantics were weakened to make that test pass.

No QA or production database was touched. No live FactuCore or DIAN call was
made. No commit, push, or deploy was performed.
