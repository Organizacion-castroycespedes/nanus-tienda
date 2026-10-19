## 1. Contract and backend

- [x] 1.1 Add a scoped structured contract for definitive aggregate and FEFO stock rejection.
- [x] 1.2 Translate recognized `P0001` errors only after successful rollback and preserve the conservative fallback.
- [x] 1.3 Include authoritative aggregate and eligible-lot availability without exposing SQL internals.

## 2. POS recovery and availability

- [x] 2.1 Parse the structured response and keep `UNKNOWN` behavior for ambiguous errors.
- [x] 2.2 Restore safe draft editing after definitive stock rejection without changing quantities automatically.
- [x] 2.3 Refresh branch availability before payment and prevent known aggregate overstock.
- [x] 2.4 Preserve account, attempt, tenant, branch, terminal, and callback isolation.

## 3. Tests

- [ ] 3.1 Cover backend rollback, aggregate stock, FEFO stock, multiple products, repeated products, and no persisted sale/payment.
- [ ] 3.2 Cover desktop/tablet-compatible POS behavior for edit, remove, cancel, zero stock, stale cart, and refreshed stock.
- [ ] 3.3 Cover UNKNOWN, timeout, network, `NOT_FOUND`, idempotency conflict, callbacks tardíos, two accounts, and two terminals.

## 4. Verification and handoff

- [ ] 4.1 Run affected tests, lint, builds, strict OpenSpec validation, and governance checks.
- [x] 4.2 Record PASS/FAIL/PARTIAL/BLOCKED and preserve historical DIAN/Kardex evidence without rerunning real electronic documents.
