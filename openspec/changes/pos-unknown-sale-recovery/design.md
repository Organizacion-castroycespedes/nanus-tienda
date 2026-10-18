## Context

The current POS stores `saleStatus` and `saleAttempt` per persisted account. `UNKNOWN` is rehydrated after reload, and the backend already provides transactional idempotency plus `GET /sales/idempotency/:key`. The unsafe paths are in the frontend: a cart quantity helper calls `allowSaleSubmissionRetry`, cancellation and account removal can discard an UNKNOWN account, reconciliation has no normal UI entry point, and the broad `4xx` catch treats idempotency `409` as a definitive rejection.

The incident is multi-account and financially sensitive. The implementation must preserve the existing backend contract, avoid database changes, and never create a replacement key for an unresolved attempt.

## Goals / Non-Goals

**Goals:**

- Make UNKNOWN a protected, account-local state.
- Expose reconcile-first recovery with explicit `200`, `404`, `409`, transport, and `5xx` outcomes.
- Permit only an explicit same-key retry after the existing reconciliation `404` contract.
- Keep successful `createSale` separate from post-sale printing, electronic billing, drawer, and refresh work.
- Add isolated unit and contract regressions using mocks and fixtures.

**Non-Goals:**

- No backend endpoint, repository, migration, transaction, or idempotency persistence change.
- No changes to payments, cash sessions, inventory, electronic billing, Electron, peripherals, or production data.
- No automatic retry, new key generation, or removal of the UNKNOWN guard.
- No broad UI refactor or visual redesign.

## Decisions

1. **Protect the attempt at the cart boundary.** Remove the implicit retry transition from product quantity mutation and reject protected mutations with the existing status/error mechanisms. This fixes add-to-cart and scanner paths at their shared boundary; quantity update, cancel, and account removal receive explicit guards. An alternative was to make `allowSaleSubmissionRetry` smarter, but that would keep an unsafe implicit caller and hide intent.

2. **Use the existing reconciliation endpoint.** Add a visible action that calls `reconcileUnknownSale` and maps `200` to confirmation, `404` to retained UNKNOWN plus an explicit same-key retry action, `409` to retained pending UNKNOWN, and other failures to retained UNKNOWN. No new endpoint is needed. A new endpoint would expand contract and deployment risk without adding a required guarantee.

3. **Make same-key retry explicit.** The retry action is enabled only after reconciliation returns `404`, requires the stored `saleAttempt`, and passes an explicit internal approval to `submitSale`. It reuses the captured attempt id. The ordinary submit path remains blocked while UNKNOWN, so a normal payment click cannot bypass recovery.

4. **Classify idempotency conflicts by contract.** The frontend identifies the existing idempotency conflict response rather than treating every `409` or every `4xx` alike. Ambiguous and idempotency responses preserve the attempt. Definitive validation or business rejection keeps the existing draft behavior only when the real API error contract proves it is safe.

5. **Bound UNKNOWN classification to createSale.** The `try/catch` that marks UNKNOWN covers the `createSale` request only. Confirmed-sale follow-up work runs after that boundary, with its current isolated handling, so printer, billing, drawer, and product-refresh failures cannot reinterpret a confirmed sale.

6. **Keep account and context isolation.** Existing account state and storage keys remain authoritative. Protected account removal is rejected. Logout, session change, tenant/branch/terminal change, and reload may clear or rehydrate local state according to current session rules, but they must never trigger a new sale or silently reuse an attempt in another context.

7. **Use a synchronous local submit guard.** `submitSale` will acquire a ref immediately before creating an attempt and issuing `createSale`. A second callback from the same render returns before generating an attempt id. The ref is released in every terminal path. This guard is scoped to the current POS component and operation; it is not a terminal-wide mutex and does not delay the next account after completion.

8. **Treat createSale HTTP failures conservatively.** The current backend response does not carry a commit-phase marker. Therefore no HTTP `4xx` from `createSale` is sufficient by itself to clear the attempt. All request failures retain `UNKNOWN`; the operator can reconcile and, only after `404`, explicitly retry with the same key. Frontend validation still prevents known invalid submissions before the POST.

9. **Make protected store transitions monotonic.** `SUBMITTING` and `UNKNOWN` cannot transition to `DRAFT` through generic status, retry, cart, or reset actions. Only a proven definitive local pre-submit validation path may remain draft; an explicit same-key retry goes directly from the protected state to `SUBMITTING`.

10. **Bind asynchronous sale results to their origin account.** Every `createSale` and reconciliation operation captures `accountId`, `attemptId`, and the active POS `contextKey` before its first `await`. Completion, UNKNOWN classification, cart cleanup, retry metadata, modal changes, and user feedback are applied only when that target still exists with the same attempt and context. Account-targeted store reducers update the root active-account projection only when the origin account is active; otherwise they update only the stored origin account. This prevents a late Account 1 callback from changing Account 2 or Account 3 and does not create a terminal-wide mutex.

## Risks / Trade-offs

- **[A 404 may be temporary while the original transaction is in flight]** → Keep the same attempt id, require explicit operator action, and never generate a new key.
- **[An operator may expect cancel to empty the cart]** → Show a recovery-first message; require confirmation of sale state before discard is considered in a later change.
- **[The exact API marker for idempotency 409 may differ by deployment]** → Verify the current `ApiError` payload and backend controller/service contract before coding; block implementation if it cannot be distinguished safely.
- **[Logout can discard browser-local UNKNOWN state]** → Do not add unsafe retry behavior; document this operational limitation and cover it in QA.
- **[A synchronous guard can remain set after an unexpected exception]** → Release it in both create request failure and post-success `finally` paths; add a test for recovery after failure.
- **[Conservative 4xx handling may require reconciliation for a real validation rejection]** → Prefer safe same-key recovery over generating a replacement key while the backend does not prove pre-commit rejection.

## Migration Plan

No migration. Implement on `fix/develop/pos-unknown-sale-recovery`, run isolated tests, lint, build, and strict OpenSpec validation. Deploy only after QA verifies the manual matrix. Rollback is a frontend artifact rollback; backend idempotency remains unchanged.

## Open Questions

- Confirm the exact `ApiError` fields/message or code that identifies an idempotency conflict in all supported backend responses.
- Confirm the existing UI location that can host the recovery action without changing payment or peripheral flows.
- Decide whether product edits after a `404` are forbidden until same-key retry, or whether the controlled retry must capture an unchanged payload hash. Default design is to keep the account protected until explicit same-key retry.
