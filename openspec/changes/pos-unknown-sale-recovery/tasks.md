## 1. Contract and state protection

- [x] 1.0 Add and validate concurrency, monotonic-state, and ambiguous-4xx acceptance criteria before code changes.
- [x] 1.1 Verify current frontend and backend idempotency error contracts and stop if idempotency `409` cannot be distinguished safely.
- [x] 1.2 Remove implicit UNKNOWN-to-DRAFT transitions from cart product and quantity paths while preserving normal draft behavior.
- [x] 1.3 Protect cancel and account removal for `UNKNOWN` and `SUBMITTING` without changing logout/session cleanup contracts.

- [x] 1.4 Add synchronous single-flight guard before attempt/key generation and prove it releases after all terminal paths.
- [x] 1.5 Block `SUBMITTING -> DRAFT` and protected reset/retry transitions that can clear `saleAttempt`.

## 2. Recovery UI and submission boundary

- [x] 2.1 Expose a visible reconcile action using `reconcileUnknownSale` with explicit `200`, `404`, `409`, transport, and `5xx` states.
- [x] 2.2 Add controlled same-key retry only after reconciliation `404`; preserve `attemptId` and block replacement keys.
- [x] 2.3 Separate `createSale` error classification from post-create print, billing, drawer, and product-refresh work, with conservative ambiguous-4xx handling.
- [x] 2.4 Verify account switching and session context cannot copy or submit another account's UNKNOWN attempt.

## 3. Regression coverage

- [x] 3.1 Add isolated cart/state tests for protected account removal and error classification, plus existing cart/reload/two-account coverage.
- [x] 3.2 Re-run existing submission/idempotency tests for `200`, `409`, payload conflict, and tenant isolation; add isolated frontend classification tests.
- [x] 3.3 Add regression coverage for post-create print, electronic billing, drawer, and product refresh errors, plus single-flight and protected transition races.
- [x] 3.4 Add account-owned async regression coverage for delayed POST and reconciliation results across three accounts, plus stale attempt/context rejection.

## 4. Verification and handoff

- [x] 4.1 Run affected web and API tests, lint, build, OpenSpec strict validation, and governance checks.
- [x] 4.2 Record PASS/FAIL/BLOCKED results, remaining risks, and the QA manual matrix without calling QA/PRD sale endpoints.
