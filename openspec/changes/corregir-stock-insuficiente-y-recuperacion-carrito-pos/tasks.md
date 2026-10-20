## 1. Contract and backend

- [x] 1.1 Add a scoped structured contract for definitive aggregate and FEFO stock rejection.
- [x] 1.2 Translate recognized `P0001` errors only after successful rollback and preserve the conservative fallback.
- [x] 1.3 Include authoritative aggregate and eligible-lot availability without exposing SQL internals.

## 2. POS recovery and availability

- [x] 2.1 Parse the structured response and keep `UNKNOWN` behavior for ambiguous errors.
- [x] 2.2 Restore safe draft editing after definitive stock rejection without changing quantities automatically.
- [x] 2.3 Refresh branch availability before payment and prevent known aggregate overstock.
- [x] 2.4 Preserve account, attempt, tenant, branch, terminal, and callback isolation.
- [x] 2.5 Present `is_inventoryable=false` as `Servicio` in the catalog and
  cart, allow zero-stock service lines, and keep physical products on the
  existing stock path.
- [x] 2.6 Preserve legacy carts as inventoryable by default and avoid applying
  visual stock limits to service quantities.

## 3. Tests

- [ ] 3.1 Cover backend rollback, aggregate stock, FEFO stock, multiple products, repeated products, and no persisted sale/payment.
- [ ] 3.2 Cover desktop/tablet-compatible POS behavior for edit, remove, cancel, zero stock, stale cart, and refreshed stock.
- [ ] 3.3 Cover UNKNOWN, timeout, network, `NOT_FOUND`, idempotency conflict, callbacks tardíos, two accounts, and two terminals.

## 4. Verification and handoff

- [ ] 4.1 Run affected tests, lint, builds, strict OpenSpec validation, and governance checks.
- [x] 4.2 Record PASS/FAIL/PARTIAL/BLOCKED and preserve historical DIAN/Kardex evidence without rerunning real electronic documents.

## 5. Feedback and billing-phase correction

- [x] 5.1 Add verifiable feedback, notification isolation and fiscal-phase criteria; confirm ready, strict validity and file ownership before implementation.
- [x] 5.2 Reproduce the missing stock/FEFO feedback and premature fiscal modal with real PaymentDialog integration and mocked external services.
- [x] 5.3 Validate result ownership before attempt cleanup, retain visible stock feedback and reuse only the confirmed-sale fiscal workflow indicator.
- [x] 5.4 Cover local validation, ambiguous HTTP/transport failures, reconciliation and same-key retry, stale accounts/contexts/attempts, and confirmed-sale fiscal failures.
- [x] 5.5 Run focused tests, relevant regressions, lint, build, strict OpenSpec and repository-only governance; record outcomes and pending QA without remote writes.
