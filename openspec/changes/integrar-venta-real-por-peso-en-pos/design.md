## Context

The current POS sale path is `POST /sales` → `SaleService.createSale` → `PricingService.calculateLinePrice` → `SaleRepository.createSaleWithFunction` → `inventory_create_sale_v2`, then payment creation and sale finalization, all on one `PoolClient` transaction. The same transaction includes sale items, stock movements and lot effects produced by the SQL function. The client currently sends quantity and price fields; `SaleService` recalculates commercial prices on the server.

The scale foundation provides `weight-capture.domain`, `WeightedSaleCaptureReference`, V103 persistence, and `WeightCapturePersistence.createPending`, `markReady` and `consume`. V103 stores raw `weight_kg NUMERIC(18,6)` and `consumed_sale_id`. The inventory runtime now registers `WeightCapturePersistence`, and `SaleService.createSale` locks a READY capture, validates nonce/context and current AUTHORIZED/KG_VERIFIED binding, and uses the caller's transaction client for association and consumption. POS capture creation and Agent observation endpoints, Web/Electron/Agent handoff, and ticket integration remain outside the backend slice certified here.

The active API function name is `inventory_create_sale_v2`; V104 replaces its implementation from the V078 definition. Before V104, it cast and rounded line quantity to two decimals. `PricingService` previously rounded all quantities through its currency-rounding helper. The approved read-only QA evidence confirmed scale 2 for the affected quantity columns, scale 6 for raw captures, no sale subtotal constraint to change, and `order_items` quantities used by sale fulfillment. V104 changes only applicable sale/inventory/order quantities to scale 3, keeps UNIT function rounding at scale 2, and keeps monetary precision unchanged. Product inventory thresholds and fiscal columns remain out of scope.

The integrated authorization OpenSpec already requires an authenticated, context-bound, single-use REAL KG capture and explicitly defers connecting it to sales. This change adds that sale lifecycle without changing pairing, binding, identity, unit verification or readiness policy.

## Goals / Non-Goals

**Goals:**

- Use a server-issued capture as the only weight authority for a WEIGHT sale line.
- Preserve raw capture evidence at up to six decimals and derive one commercial quantity at exactly three decimal places in kg.
- Use that same commercial quantity for pricing, promotions, tax calculation, sale item, stock movement, lot decrement, and ticket data.
- Make capture claim, sale, inventory, capture-to-sale-item association, payment, finalization and idempotency completion atomic.
- Preserve UNIT behavior and require an explicit mode for BOTH.
- Preserve Web → Electron → local Peripheral Agent hardware access; let only the authenticated Agent submit physical evidence to the cloud API.
- Define testable implementation and QA tasks while leaving production readiness false.

**Non-Goals:**

- Reimplement secure pairing, Agent credential lifecycle, scale authorization, KG operator confirmation, logical scale identity, or REAL availability.
- Open a serial port from the cloud API.
- Change fiscal rules, price inclusion semantics, tax tables, promotion policy, or product price source.
- Enable scale MOCK reads for commercial sale.
- Certify Windows LocalService or production hardware readiness.
- Execute a migration, modify V103, access PRD, or choose/reserve a migration number during this change-planning phase.
- Apply kg-to-lb/g/oz conversion. A scale-backed WEIGHT sale requires product `measurement_unit = 'KG'`; other unit configurations fail closed until a separately approved conversion contract exists.

## Decisions

### 1. Discriminated sale-line input

The sale request uses a line-level discriminant:

```ts
type SaleLineInput =
  | { productId: string; saleMode: "UNIT"; quantity: number; price: number; orderItemId?: string | null }
  | { productId: string; saleMode: "WEIGHT"; weightCapture: { captureId: string; nonce: string }; orderItemId?: string | null };
```

`BOTH` is a product catalog mode, not a sale-line mode: its line must explicitly choose `UNIT` or `WEIGHT`. For compatibility, a missing `saleMode` may be treated as `UNIT` only for products configured as `UNIT`; it is invalid for `WEIGHT` and `BOTH`. Unknown weight/quantity/price/source/unit fields on a WEIGHT line are rejected. The frontend may display captured weight, but the sale request contains no authoritative client quantity, weight, unit, source or price for that line.

The backend loads active product configuration and verifies `saleType` permits the requested mode. For a scale-backed WEIGHT mode, `measurement_unit` must be `KG`, because the approved commercial quantity is kg and current pricing/inventory values use the product's unit. No automatic conversion is inferred.

### 2. One deterministic three-decimal commercial quantity

V103 remains the raw evidence store: `weight_kg NUMERIC(18,6)`. In the sale transaction, the backend derives `commercialQuantityKg = ROUND(rawWeightKg, 3)` using decimal arithmetic with PostgreSQL `numeric` half-away-from-zero semantics (for non-negative weight, half-up). It rejects negative, non-finite, zero or out-of-range readings according to the existing capture policy and product/sale constraints. Example: `0.245 kg` remains `0.245`; `0.2455 kg` becomes `0.246`.

Do not pass weight through `PricingService`'s currency rounding helper. Add a quantity-specific precision path for weight lines. The three-decimal value is used unchanged by pricing, promotions, taxes, `sale_items`, inventory ledger, lot balances/links, applicable order fulfillment quantities, response and ticket. Monetary values keep their current currency precision and fiscal treatment.

Change applicable quantity columns and casts to three-decimal scale in a forward-only migration. V104 targets `sale_items`, `stock_movements`, `inventory_lot_balances`, `stock_movement_lots`, `order_items`, and the active sale function's weighted quantity arithmetic and lot allocation. QA read-only evidence confirmed there is no sale subtotal constraint to change; do not add one. Preserve existing stored values. UNIT keeps its previous two-decimal quantity behavior in the function. Product `min_stock`/`max_stock`, fiscal columns, currency precision, and unrelated purchase behavior remain unchanged.

`inventory_create_sale_v2` currently computes availability from `stock_movements` and creates an OUT movement for each POS sale line; it also uses lot flags for FEFO. WEIGHT and BOTH/WEIGHT SHALL preserve that existing behavior and use `commercialQuantityKg` for the movement and lot allocation. `saleType` describes sale mode and SHALL NOT imply inventory eligibility. The product model has no explicit inventory eligibility policy. Non-inventariable products and any new product-level inventory tracking policy are OUT OF SCOPE and deferred to a separate HU; this change adds no flag and does not infer eligibility from category, saleType, measurementUnit, requiresLot, minStock or maxStock.

### 3. Capture creation, physical read and evidence handoff

1. Authenticated POS Web requests a capture for a product. The API derives tenant, branch, POS terminal, operational terminal, POS session and user from trusted request/session state; validates product/mode and the current authorized KG binding; and creates the V103 pending capture with a 60-second TTL. It returns `captureId` and the opaque nonce to the POS.
2. Web calls Electron through its narrow typed IPC bridge. It supplies the capture ID and requested context, but no Agent secret. Electron calls the local Peripheral Agent.
3. Agent verifies it is enrolled, reads only the configured logical scale through the existing ScaleService/ROCHI path, and posts the observation to the API over its configured HTTPS endpoint using the existing Agent credential held in DPAPI. The Agent does not accept a renderer-supplied URL, scale identity override or arbitrary measurement source.
4. API authenticates the Agent with the existing credential verifier, loads the pending capture, and requires its terminal device, logical scale, POS context and binding to match the authenticated Agent and current AUTHORIZED/KG_VERIFIED binding. It marks READY only for a finite REAL kg observation with verified unit and an `observedAt` no more than 15 seconds old, not in the future, and not earlier than the capture creation time. MOCK, unknown/non-kg unit, unverified unit, stale/expired capture, revoked/disabled binding or any context mismatch is rejected. The 15-second bound matches the existing backend REAL-readiness freshness policy.
5. The Agent/Electron/Web may return the displayed reading for cashier feedback. That display is advisory. Checkout uses the persisted capture row and nonce; renderer values never replace it.

The POS capture creation endpoint emits exactly one `weight_capture.create.received` event per request that enters its controller, one `weight_capture.create.succeeded` event after the creation transaction commits, or one `weight_capture.create.failed` event when the handler throws. Success may include the generated capture ID; failure records contain only a safe stage, error class/status/code, and PostgreSQL SQLSTATE/constraint metadata when available. Creation telemetry omits the request body, product/session context, Authorization, nonce, verifier, weight and credential secrets. It rethrows the original exception and does not change response, persistence, retry or idempotency semantics.

The API observation endpoint emits structured, capture-correlated stages for receipt, Agent authentication, capture loading, state/context validation and READY persistence. Failure records contain only safe error class/status/code and PostgreSQL SQLSTATE/constraint metadata. They omit weight, request payload, Authorization, nonce, verifier and credential secrets. READY persistence remains awaited inside its failure boundary. Telemetry serialization and logger output are best-effort and cannot replace an operation exception or change response status or transaction semantics.

The one-time nonce is a checkout capability, not the Agent credential. Keep it in volatile POS state only; exclude `weightCapture` from the existing `localStorage` cart serialization. Removing/changing a weighted line, changing BOTH mode, expiring capture, or reloading a draft invalidates the reference and requires a fresh capture. An uncertain submit recovers through the existing idempotency lookup, which returns the already-created sale without needing to replay the nonce.

### 4. Same-transaction capture claim and sale

Use the `PoolClient` already opened by `SaleService.createSale`:

1. Validate POS session and reserve/check the existing sale idempotency key. If it resolves to an already-created sale, return that sale before touching any capture.
2. Validate products and explicit modes. For each WEIGHT line, lock its capture row `FOR UPDATE`, validate READY/TTL/nonce/context, current binding state, device and logical scale, then read raw persisted weight. Add a persistence operation for this read/lock; it must not transition state.
3. Derive the three-decimal commercial quantity and run `PricingService` using that value. The server resolves current product price, promotion and existing tax snapshots. Client line price is never authoritative.
4. Call `inventory_create_sale_v2` with backend-priced lines and backend-generated sale-item UUIDs. Extend the function input recordset compatibly so legacy callers without a supplied internal line UUID keep the existing generated-ID behavior. The supplied UUID is generated by the API and used only to correlate the inserted row.
5. For each weighted line, use the known inserted sale-item UUID to create a durable capture-to-sale-item association, then call `WeightCapturePersistence.consume` on the same client to set CONSUMED and `consumed_sale_id`. The association has one capture per sale item and one sale item per capture, with tenant/sale/item referential integrity. V103 stays immutable.
6. Create payment records with `PaymentsService.createInTransaction`, finalize the sale, enqueue transactional outbox records, and complete sale idempotency on the same client. Commit only after all steps succeed.

Any failure rolls back the sale row, sale items, stock/lot effects, association, capture consumption, payment writes and idempotency reservation. Therefore the capture remains READY after rollback. A concurrent second checkout waits on the capture row lock; after the first commits it observes CONSUMED and fails. If the first rolls back, a waiting request may proceed. Exactly one committed sale can consume a capture.

Current V103 has `consumed_sale_id` but no sale-item link, so the new migration adds a dedicated association relation with unique capture and sale-item keys plus tenant/sale/item FKs. Use the actual existing `sales`, `sale_items` and capture tables; do not alter V103. Determine the next migration identity only with the approved migration governance workflow and fresh repository/target/DEV_TO_QA evidence when implementation begins. Do not infer production safety from that selection.

### 5. Pricing, taxes, payments and ticket

`PricingService` remains the source of price and promotion decisions. For a KG product, the returned unit price is the price per kg. Existing tax profiles, included/excluded handling and pricing snapshots remain authoritative; only their quantity input changes to the same `commercialQuantityKg`. Payment totals are checked against the backend-computed sale total as they are today.

The confirmed sale response and print input expose line quantity in kg at three decimals, price per kg, and computed subtotal. The receipt layout remains owned by existing ticket generation; this change adds semantic data and does not prescribe final visual layout. Local print continues through Web/Electron/Agent after API commit.

### 6. Product mode and cart behavior

`UNIT` follows its existing quantity and checkout path. `WEIGHT` cannot be added or submitted without a READY capture. `BOTH` opens an explicit UNIT/WEIGHT choice every time; the chosen mode is stored on the line. Weight lines cannot be manually quantity-edited or merged with a different capture. A replacement reading creates a new capture. Client totals remain previews; checkout always recalculates from backend product/pricing and capture data.

### 7. Migration and rollout

- The governed migration identity is V104, selected after repository and authorized read-only DEV_TO_QA predecessor evidence. V104 is forward-only; do not infer production safety from selection.
- V104 alters applicable WEIGHT quantity precision from scale 2 to scale 3 without changing UNIT rounding or price/tax money scale, adds the capture-to-sale-item association, and updates the active sale SQL function. It does not modify or re-run V103, historical SQL, `migrations_history`, fiscal schema, product stock thresholds, or PRD.
- Implement API and DB behavior behind fail-closed weighted-sale validation. Enable WEIGHT UI only after backend, transaction, precision and UI contract tests pass. UNIT remains available throughout.
- QA includes mocked DB transaction/concurrency tests, migration static checks, Web mode and local-storage tests, Electron/Agent handoff tests, ticket contract tests, and physical DEV E2E with ROCHI reading `0.245 kg`. QA DB writes require a separately authorized test fixture/environment; no exploratory QA writes.
- Rollback is application rollback plus the governed migration rollback policy only if the migration is certified reversible and no weighted sales have been recorded. Once such sales exist, a down migration that truncates quantity precision or drops capture associations is not safe; use a forward corrective migration.
- `READY_FOR_PRODUCTION=NO`. Windows LocalService remains deferred/blocked and outside this change.

## Risks / Trade-offs

- [Scale weight differs from chargeable weight after quantization] → Keep raw six-decimal evidence and document deterministic three-decimal rounding; show commercial quantity on ticket.
- [Unit configuration differs from kg] → Reject capture-backed sale unless product unit is KG; require a separately approved conversion contract for LB/G/OZ.
- [A two-decimal reader remains downstream] → Audit all sale, stock, lot, cancellation, report and ticket readers; add static and integration assertions that 0.245 remains 0.245 end to end.
- [Concurrent checkout or network timeout] → Row-lock capture, transact claim with sale, retain idempotency recovery, and test commit/rollback and two-client races.
- [Cart persistence leaks/replays a nonce] → Strip capture reference from localStorage and require recapture after reload; preserve idempotency recovery for unknown submissions.
- [Product model has no inventory eligibility contract] → Preserve current POS stock behavior for UNIT and WEIGHT; defer non-inventariable products and any tracking policy to a separate HU.
- [Migration identity conflicts with concurrent work] → Select it only from fresh governed DEV_TO_QA evidence; do not guess or overwrite.
- [LocalService DPAPI differs from DEV process identity] → Do not claim LocalService certification; keep it out of scope and production readiness false.

## Migration Plan

1. The change passed OpenSpec strict validation. The predecessor and migration identity evidence selected V104; do not repeat QA discovery or access PRD for this certification task.
2. Validate V104 with static checks and, only if an existing isolated disposable PostgreSQL target is available, execute it and its behavior fixture there. Never execute it in `manus_tienda_qa` or production for this certification.
3. Deploy compatible database changes before enabling the API/UX weighted path. API rejects weighted lines until the capture relation and three-decimal schema/function contract are available.
4. Roll back the API/UX if needed. Do not down-migrate once weighted sales exist; use a forward fix to preserve sale and capture evidence.

## Open Questions

- Confirm whether KG-only scale-backed sales are acceptable for products configured as LB/G/OZ. This design rejects those modes until conversion is explicitly specified.
- PostgreSQL execution remains blocked until an existing safe disposable target is available; no QA or production write is authorized by this design.
- Product-level inventory eligibility and non-inventariable product behavior are deferred to a separate HU. This change SHALL NOT introduce or infer that policy.
