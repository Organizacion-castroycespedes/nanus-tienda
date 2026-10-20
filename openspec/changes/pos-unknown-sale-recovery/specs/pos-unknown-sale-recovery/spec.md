## ADDED Requirements

### Requirement: Reconcile-first recovery for an ambiguous sale

The POS SHALL preserve `saleStatus=UNKNOWN` and the exact `saleAttempt.attemptId` until the operator obtains an explicit recovery result or deliberately completes a controlled retry. The POS MUST NOT generate a new `Idempotency-Key` for an ambiguous attempt.

#### Scenario: Visible recovery action
- **WHEN** the active account has `saleStatus=UNKNOWN` and a `saleAttempt`
- **THEN** the POS shows a clear action to verify the sale and uses `GET /sales/idempotency/:key` with the stored `attemptId`

#### Scenario: Reconciliation confirms the sale
- **WHEN** reconciliation returns `200` with the created sale
- **THEN** the active account becomes confirmed, the sale cart is cleared, and no new POST or idempotency key is created

#### Scenario: Reconciliation finds a pending reservation
- **WHEN** reconciliation returns `409` for the stored key
- **THEN** the POS keeps `UNKNOWN` and the same `attemptId`, shows a pending message, and blocks retry with another key

#### Scenario: Reconciliation cannot find the reservation
- **WHEN** reconciliation returns `404` for the stored key
- **THEN** the POS keeps the `attemptId`, explains that the result is not yet proven, and offers only a controlled retry using that same key

#### Scenario: Reconciliation has a transport or server failure
- **WHEN** reconciliation times out, fails due to network, or returns `5xx`
- **THEN** the POS keeps `UNKNOWN` and the same `attemptId` and does not submit a new sale

### Requirement: UNKNOWN protects the sale attempt from cart and account actions

The POS SHALL treat an account with `UNKNOWN` or `SUBMITTING` as protected. Product additions, scanner input, quantity changes, cart cancellation, and account deletion MUST NOT silently clear its attempt or move it to a state that permits a new key.

#### Scenario: Add product or scanner input during UNKNOWN
- **WHEN** the operator adds a product, scans a product, or changes quantity while the account is `UNKNOWN`
- **THEN** the cart mutation is rejected or visibly deferred, `saleAttempt` remains unchanged, and no new POST is enabled

#### Scenario: Cancel current sale during UNKNOWN
- **WHEN** the operator tries to cancel an account whose sale is `UNKNOWN`
- **THEN** the POS refuses silent discard and directs the operator to verify the sale first

#### Scenario: Delete account during UNKNOWN
- **WHEN** the operator tries to remove an account whose sale is `UNKNOWN`
- **THEN** the account and its `saleAttempt` remain available for reconciliation

#### Scenario: Switch between accounts
- **WHEN** the operator switches from an UNKNOWN account to another account
- **THEN** the second account keeps its own status and attempt, and the UNKNOWN attempt is not copied or cleared

### Requirement: Definitive and ambiguous create errors are classified separately

The POS SHALL classify only proven definitive rejection from `createSale` as retryable with a new attempt. An idempotency conflict, pending result, timeout, network failure, or `5xx` MUST retain the original attempt. A successful `createSale` response MUST be separated from later printing, electronic billing, cash drawer, and product refresh work.

#### Scenario: Idempotency conflict from createSale
- **WHEN** `createSale` returns an idempotency `409`
- **THEN** the POS keeps `UNKNOWN` and the original `saleAttempt` and does not call `allowSaleSubmissionRetry`

#### Scenario: Proven definitive client rejection
- **WHEN** `createSale` returns a contract-defined definitive rejection that is not an idempotency conflict
- **THEN** the POS may return to a draft retry state according to the existing contract

#### Scenario: Error after createSale success
- **WHEN** `createSale` succeeds and printing, electronic billing, drawer, or product refresh later fails
- **THEN** the sale remains confirmed and the later failure does not mark it `UNKNOWN` or create another sale attempt

### Requirement: Recovery preserves backend idempotency and tenant boundaries

Recovery SHALL reuse the existing backend contracts. The backend SHALL continue to scope idempotency by tenant and preserve same-key replay, same-key different-payload conflict, and transactional reservation semantics.

#### Scenario: Controlled retry after a 404
- **WHEN** the operator explicitly retries after a reconciliation `404`
- **THEN** the POST uses the original `Idempotency-Key` and matching payload, with no generated replacement key

#### Scenario: Same key with a different payload
- **WHEN** a retry uses the original key with a different request fingerprint
- **THEN** the backend rejects it as an idempotency conflict and the POS keeps the original attempt protected

#### Scenario: Two independent accounts
- **WHEN** two accounts submit concurrently or one account is UNKNOWN while the other is draft
- **THEN** each account uses its own attempt and tenant/session context without cross-account recovery or duplicate creation

### Requirement: Submission is single-flight and protected transitions are monotonic

The POS SHALL allow only one `submitSale` operation for the current component and account operation at a time. The guard MUST run before generating an attempt id or issuing `createSale`, and MUST release after every terminal success or failure. While `SUBMITTING` or `UNKNOWN`, generic cart/status/reset actions MUST NOT clear `saleAttempt` or transition to `DRAFT`.

#### Scenario: Two confirmation callbacks before rerender
- **WHEN** two click or Enter callbacks run before React rerenders
- **THEN** only one attempt id and one POST are created, and the second callback returns without creating a key

#### Scenario: Old quantity event during SUBMITTING
- **WHEN** a quantity or remove-item callback from an older render runs while the store is `SUBMITTING`
- **THEN** the store remains `SUBMITTING`, the attempt remains unchanged, and no new attempt is enabled

#### Scenario: Operation finishes and next account submits
- **WHEN** the first account finishes with success or a recorded failure and the operator submits another account
- **THEN** the local guard is released and the second account can submit normally with its own attempt

#### Scenario: Ambiguous HTTP 4xx from createSale
- **WHEN** `createSale` returns a `4xx` without a contract proof that the request was rejected before COMMIT
- **THEN** the POS keeps `UNKNOWN` and the original attempt and requires reconciliation before any retry

### Requirement: Asynchronous sale results are owned by the origin account

The POS SHALL bind every asynchronous `createSale` and reconciliation operation to its originating `accountId`, `attemptId`, and POS `contextKey`. A late result MUST NOT mutate the currently active account when it differs from the origin account, and MUST be ignored when the origin account was removed, the attempt changed, or the context changed.

#### Scenario: Delayed POST after switching accounts
- **WHEN** Cuenta 1 starts a sale POST, the operator switches to Cuenta 2 or Cuenta 3, and the POST later resolves
- **THEN** only Cuenta 1 receives `CONFIRMED` or `UNKNOWN` and any cart cleanup; the active account keeps its products, customer, payments, status, and attempt unchanged

#### Scenario: Delayed reconciliation after switching accounts
- **WHEN** Cuenta 1 starts reconciliation and the operator switches to another account before the GET resolves with `200`
- **THEN** only Cuenta 1 is confirmed and cleared, the other account remains unchanged, and no new POST or key is created

#### Scenario: Stale callback after attempt or context change
- **WHEN** an asynchronous result returns after the origin account was removed, its attempt changed, or its POS context changed
- **THEN** the result is ignored and cannot clear a cart, mark another account, create a key, or display an error for the active account

#### Scenario: Independent account processing
- **WHEN** Cuenta 1 has a pending operation and Cuenta 2 or Cuenta 3 is active
- **THEN** the pending operation remains scoped to its origin account and independent accounts can continue their normal flow without a terminal-wide mutex
