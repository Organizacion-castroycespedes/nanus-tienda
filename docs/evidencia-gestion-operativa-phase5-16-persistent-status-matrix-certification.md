# Gestión Operativa — Phase 5.16

## Persistent status matrix

Added full-service PostgreSQL coverage using the Phase 5.12 aggregate fixture,
real repositories, recreated processing-service contexts, and the persistent
provider mock.

- `ACCEPTED`: terminal `ACCEPTED` and `COMPLETED`; repeated recovery does not
  issue or regress.
- `REJECTED`: terminal `REJECTED` and `COMPLETED`; repeated recovery does not
  issue or regress.
- `PROCESSING` / `PENDING`: reconciliation keeps the document nonterminal and
  does not issue a second provider document.
- `NOT_FOUND`: `RECONCILIATION_REQUIRED`, fail closed, no issue call.
- `UNAVAILABLE`: provider error remains fail closed, no issue call.
- `UNKNOWN`: `MANUAL_REVIEW`, no provider mutation.

Each matrix case ran five iterations. Recovery was invoked three times per
case. State was reloaded from PostgreSQL after recovery, and service context
was recreated during the matrix. Provider documents remain unique by
`externalReference`.

## Results

- Persistent matrix: `PASS`.
- New real PostgreSQL suite: `15/15 PASS`.
- PostgreSQL concurrency regression: `5/5 PASS`.
- Full Billing suite: `152 pass`, `15 skipped`, `0 fail`.
- Billing build: `PASS`.
- API build: `PASS`.
- Relevant OpenSpec strict: `PASS`.
- All OpenSpec strict: `90 passed`, `1 inherited failure`.
- `git diff --check`: `PASS`.

No retry API/UI was exposed. No QA, production, FactuCore, or DIAN call was
made. No migration was added or rerun. No commit, push, or deploy occurred.
