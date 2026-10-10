## 1. API sale contract and trusted capture flow

- [ ] Add discriminated line DTOs for UNIT and WEIGHT; permit omitted `saleMode` only for legacy UNIT products.
- [ ] Require explicit UNIT/WEIGHT choice for BOTH; reject unsupported product mode and non-KG scale-backed weight products.
- [ ] Reject weight, unit, source, quantity and price authority fields on WEIGHT request lines.
- [x] Register/reuse existing `WeightCapturePersistence` and Agent credential authentication without changing pairing, credential storage or scale authorization policy. (Evidence: runtime module reuses the persistence provider; API tests verify nonce verifier storage and Agent authentication.)
- [x] Add authenticated POS capture creation using tenant/branch/POS/operational terminal/session/product context derived by the API; set 60-second expiry. (Evidence: `POST /sales/weight-captures` uses POS session guards; `SaleService` validates active session/product/binding and the 60-second PENDING transaction; focal service test passes.)
- [x] Add safe API creation telemetry for one controller receipt, success after commit or sanitized failure; preserve original HTTP/persistence behavior and exclude request/session/secrets. (Evidence: `SaleController` emits the three `weight_capture.create.*` events and focused controller tests assert one event per outcome, safe fields and exception identity.)
- [x] Add Agent-authenticated observation submission that binds Agent device, configured logical scale and capture context; accept only REAL kg, verified unit and `observedAt` within 15 seconds, not future and not before capture creation. (Evidence: Agent credential/device/logical-scale/context checks and READY tests in `scale-authorization.runtime.service.spec.ts`.)
- [x] Reject an exact REAL `0 kg` capture in the Agent before observation submission and map its stable safe error code to actionable POS guidance without changing other rejection messages. (Evidence: Electron returns an allowlisted `SCALE_WEIGHT_ZERO` result envelope across IPC; Web restores the semantic error and maps it to “Coloca el producto en la balanza para continuar.” Tests verify unavailable/unknown fallbacks, zero is rejected before cart/pricing mutation, and positive `0.245` remains unchanged.)
- [ ] Wire Web → Electron → local Agent capture request and Agent → API evidence submission. Keep Agent secret in Agent DPAPI storage; never send it to renderer.
- [ ] Return a short-lived capture reference to POS and exclude nonce/reference from localStorage serialization.

## 2. Three-decimal quantity and server pricing

- [x] Add deterministic decimal derivation `commercialQuantityKg = ROUND(rawWeightKg, 3)` with half-up behavior for non-negative values; retain raw capture at up to six decimals. (Evidence: fixed-scale BigInt helper and tests for `0.245000`, `0.2455`, invalid and over-scale values.)
- [x] Add a non-consuming, transaction-scoped capture lock/read operation that validates nonce, TTL, READY state, context, REAL/KG evidence and live AUTHORIZED/KG_VERIFIED binding. (Evidence: `lockReadyForSale` query and repository test assert READY/expiry/evidence/context checks and lock-without-consume behavior.)
- [x] Give `PricingService` a weight quantity precision path separate from currency rounding; use the same commercial quantity for pricing, promotion and tax snapshots. (Evidence: weighted path preserves the canonical `0.245` quantity through pricing; monetary rounding remains unchanged.)
- [x] Route POS pricing previews by the explicitly selected `saleMode`; preserve three-decimal WEIGHT quantity and legacy two-decimal UNIT behavior, including callers that omit the mode. (Evidence: preview controller dispatches WEIGHT to three-decimal pricing and UNIT/omitted mode to the legacy path; API tests cover 0.245/3920, 0.001, 0.2455 half-up, 1.000 and legacy 0.245→0.25; POS regression covers mode propagation and preview quantity application.)
- [x] Keep monetary/tax currency precision and existing fiscal treatment unchanged; resolve price per kg from the existing product/pricing source. (Evidence: weighted line uses the existing pricing service; monetary precision and fiscal snapshots remain unchanged in the reviewed diff and V104 static test.)
- [x] Generate sale-item correlation UUIDs on the API and pass them compatibly to the sale SQL function. (Evidence: weighted repository payload carries API UUID; V104 accepts it and preserves generated-ID fallback for legacy callers.)

## 3. Governed database and sale SQL migration

- [x] Confirm the authorized read-only predecessor evidence and governed migration identity before creating V104; do not access PRD. (Evidence: user-provided QA read-only result confirmed successful V103 predecessor and absence of V104+.)
- [x] Implement a forward-only V104 migration; preserve V103 and existing rows. (Evidence: V104 is new; V078, V103 and other historical migrations are absent from the diff.)
- [x] Alter applicable sale, movement, stock balance, stock lot/link and order-item quantity precision to scale 3 where each is used by weighted POS sales. Keep UNIT function rounding at scale 2. Do not alter product stock thresholds. (Evidence: V104 and static migration assertions.)
- [x] Update the current `inventory_create_sale_v2` function's quantity handling, FEFO lot allocation, movement writes and sale-item correlation to preserve scale 3 for WEIGHT while retaining UNIT scale 2. (Evidence: V104 static migration test.)
- [x] Confirm that no sale subtotal constraint exists; do not add or modify one. Keep monetary precision unchanged. (Evidence: authorized QA read-only schema evidence and V104 static scope test.)
- [x] Add a durable capture-to-sale-item association with unique capture and unique sale-item constraints plus tenant/sale/item referential integrity; do not modify V103. (Evidence: V104 relation and static FK/unique assertions.)
- [ ] Audit and update dependent cancellation/reversal, API response, reporting and ticket readers that would otherwise round a sale quantity to 2 decimals.
- [x] Add static migration tests for schema types, constraints, active function, precision and uniqueness; verify V103 remains unchanged in the repository diff. (Evidence: `weighted-sale-migration.spec.ts` and migration diff check.)

## 4. Atomic sale transaction, payments and idempotency

- [x] In `SaleService.createSale`, preserve the current one-`PoolClient` transaction and idempotency-first recovery behavior. (Evidence: service flow and committed idempotency retry tests.)
- [x] For weighted lines, lock/validate capture and read raw weight before pricing; derive commercial quantity only from persistence. (Evidence: persistence lock query and service quantity/pricing path tests.)
- [x] Create sale, sale item and inventory effects; associate capture to exact sale item; consume capture; create payment records; finalize sale; enqueue transactional effects; complete idempotency; then COMMIT. (Evidence: service sequence; DB execution remains unverified.)
- [ ] Ensure any failure before COMMIT rolls back sale, stock/lots, association, capture consumption, payment and idempotency writes.
- [x] Verify retry after a committed sale returns the prior result without a second capture claim or duplicate payment/inventory effects. (Evidence: idempotency replay test and reservation-before-capture service order.)
- [ ] Verify two concurrent transactions using one capture yield exactly one committed sale; rollback allows the waiting transaction to proceed.

## 5. POS cart, ticket and regression protection

- [x] Add explicit line sale mode to POS cart; keep UNIT quantity editing and checkout unchanged. (Evidence: cart stores `saleMode`; WEIGHT quantity controls are read-only and UNIT checkout sends the legacy fields.)
- [x] Keep BOTH choice explicit and never infer sale mode from scale presence. (Evidence: existing BOTH selector remains the only entry; POS contract regression passes.)
- [x] Enable WEIGHT action only after authorized capture is READY; remove/edit/mode change/reload drops the capture reference and requires a fresh capture. (Evidence: POS adds the item only after Agent returns matching READY; capture references are transient and expired/missing references fail checkout.)
- [ ] Keep capture reference out of localStorage while preserving existing cart, payment and idempotency persistence behavior.
- [ ] Treat cart weight/price/total as display preview; submit capture reference only and display server-confirmed sale quantity/pricing after commit.
- [ ] Extend confirmed sale/ticket input with commercial kg quantity, price per kg and subtotal; preserve local printing through Electron/Agent.
- [ ] Add Web tests for UNIT compatibility, BOTH explicit selection, fail-closed WEIGHT, quantity display and transient capture reference.

## 6. Verification and QA

- [x] Add capture-correlated API observation-stage logging with sanitized failures and no weight or credential material; make telemetry best-effort so logger failures cannot mask the original READY persistence error. (Evidence: runtime controller/service tests cover success, synchronous throw, rejected Promise, PostgreSQL metadata, and a throwing logger while preserving exception identity.)
- [ ] Add API tests for mode validation, exact capture context, nonce, TTL, REAL/KG evidence, binding state, product and session mismatch, and no client quantity/price authority.
- [ ] Add precision tests including raw `0.245000 kg` → commercial `0.245 kg` and a half-up boundary such as `0.2455 kg` → `0.246 kg` through pricing, taxes, sale item, inventory and response.
- [ ] Add transaction rollback tests for SQL sale, insufficient stock/lots, association, payment and finalization failures; assert capture remains READY.
- [ ] Add PostgreSQL two-connection concurrency test: one capture has one committed winner; the loser is rejected; a rollback releases the capture.
- [ ] Add idempotency tests for same-key committed retry, changed capture conflict and unknown-outcome recovery.
- [ ] Add inventory regression tests for existing UNIT movement behavior and weighted three-decimal movement, lot allocation, movement-lot equality and reversal; preserve current POS inventory behavior without deriving eligibility from sale mode.
- [x] Defer non-inventariable product behavior and any product-level inventory tracking policy to a separate HU; add no inventory eligibility flag in this change. (Evidence: OpenSpec scope and V104 contains no inventory-eligibility or threshold changes.)
- [ ] Add Electron/Agent tests proving local Agent performs hardware read, Agent credential authenticates API evidence, and renderer cannot set endpoint/identity/secret/source authority.
- [ ] Add ticket contract tests for confirmed kg quantity, price per kg and subtotal.
- [ ] Run targeted API, Web, Electron, Peripheral Agent, migration-static and OpenSpec/governance checks; do not run migrations or write to QA during discovery/planning.
- [ ] Perform physical DEV E2E with ROCHI A01E and verify the reported `0.245 kg` is displayed and sold as `0.245 kg` through pricing, inventory, payment and ticket.
- [x] Record LocalService certification as DEFERRED/BLOCKED and `READY_FOR_PRODUCTION=NO`. (Evidence: design rollout section.)
