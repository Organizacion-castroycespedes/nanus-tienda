## ADDED Requirements

### Requirement: POS sale lines declare unit or weight mode
The sale API SHALL preserve quantity behavior for `UNIT` lines. `WEIGHT` lines SHALL use only product identity, `saleMode: "WEIGHT"`, and `weightCapture: { captureId, nonce }` as weight authority. `BOTH` SHALL require an explicit `UNIT` or `WEIGHT` mode. Scale-backed `WEIGHT` SHALL require product `measurement_unit = 'KG'`.

#### Scenario: Unit product uses existing quantity flow
- **WHEN** an active `UNIT` product is submitted as a UNIT line with a positive quantity
- **THEN** the API SHALL preserve the existing unit sale, pricing, payment and inventory behavior
- **AND** the backend SHALL continue to resolve commercial price through `PricingService`.

#### Scenario: BOTH product rejects a line without mode
- **WHEN** a product is configured as `BOTH` and the sale line omits `saleMode`
- **THEN** the API SHALL reject the line.

#### Scenario: BOTH product uses the explicit UNIT path
- **WHEN** the product is configured as `BOTH` and the cashier chooses UNIT
- **THEN** the API SHALL process the line through the UNIT quantity path.

#### Scenario: BOTH product uses the explicit WEIGHT path
- **WHEN** the product is configured as `BOTH` and the cashier chooses WEIGHT
- **THEN** the API SHALL require a valid weight capture reference.

#### Scenario: Weighted request contains client authority fields
- **WHEN** a WEIGHT line includes client-supplied quantity, weight, unit, source or price fields
- **THEN** the API SHALL reject the line and SHALL NOT use those fields to price or record the sale.

#### Scenario: Scale capture unit differs from product unit
- **WHEN** a capture-backed WEIGHT line references a product configured in LB, G, OZ or another non-KG unit
- **THEN** the API SHALL reject the line until an approved unit-conversion contract exists.

### Requirement: Capture is created and completed through trusted Agent flow
The API SHALL create a short-lived pending capture from authenticated POS context and an active authorized KG binding. The local Peripheral Agent SHALL perform the physical read through the Electron bridge and SHALL submit observation evidence to the API using its existing Agent credential. The renderer SHALL NOT receive or persist the Agent credential. Only the authenticated Agent path may transition a pending capture to READY.

#### Scenario: POS starts capture
- **WHEN** an authenticated POS requests a capture for an active weight-capable KG product and valid POS session
- **THEN** the API SHALL derive tenant, branch, POS terminal, operational terminal, session, device, binding and logical scale from trusted server context
- **AND** it SHALL return a capture ID and one-time nonce with a 60-second expiry.

#### Scenario: Capture creation is safely diagnosable
- **WHEN** a request enters the POS capture creation controller
- **THEN** the API SHALL emit exactly one structured `weight_capture.create.received` event
- **AND** successful creation SHALL emit exactly one `weight_capture.create.succeeded` event correlated by capture ID
- **AND** failed creation SHALL emit `weight_capture.create.failed` with a sanitized stage and error metadata while rethrowing the original exception
- **AND** creation telemetry SHALL NOT include request body, product/session context, Authorization, nonce, verifier, weight or credential secrets
- **AND** telemetry SHALL NOT change the response, persistence, retry or idempotency behavior.

#### Scenario: Agent submits REAL verified kg reading
- **WHEN** the enrolled Agent submits a finite REAL kg reading with verified unit for the exact pending capture and matching active binding
- **AND** `observedAt` is no more than 15 seconds old, is not in the future, and is not earlier than capture creation
- **THEN** the API SHALL persist the raw observation and transition the capture to READY.

#### Scenario: Uncommercial or mismatched reading
- **WHEN** the reading is MOCK, unit is not kg, unit is unverified, capture is expired, Agent/device/binding/logical scale/context differs, or binding is not AUTHORIZED and KG_VERIFIED
- **THEN** the API SHALL reject the observation and SHALL NOT mark the capture READY.

#### Scenario: Exact zero REAL kg reading is rejected before observation
- **WHEN** the local Agent reads exactly `0 kg` from a REAL scale for a pending commercial capture
- **THEN** the Agent SHALL reject the reading with the semantic code `SCALE_WEIGHT_ZERO` before submitting an observation
- **AND** the capture SHALL NOT transition to READY or be consumed
- **AND** the POS SHALL NOT add the product or request commercial pricing
- **AND** the cashier SHALL see an instruction to place the product on the scale to continue
- **AND** connection, authorization, context and other reading failures SHALL keep their existing error behavior.

#### Scenario: Observation processing is safely diagnosable
- **WHEN** the Agent submits an observation for a commercial capture
- **THEN** the API SHALL emit structured stages correlated by capture ID from receipt through authentication, capture/state/context validation and READY persistence
- **AND** failures SHALL record only a sanitized stage, error class, HTTP status, safe error code, PostgreSQL SQLSTATE and constraint name when available
- **AND** logs SHALL NOT contain the observation weight, request body, Authorization, nonce, verifier or credential secret
- **AND** telemetry SHALL rethrow the original exception without changing its HTTP semantics or persistence behavior.
- **AND** telemetry serialization and logger output SHALL be best-effort; a logging failure SHALL NOT replace the original operation exception
- **AND** the READY persistence call SHALL remain awaited within the observation failure boundary so synchronous throws and rejected promises reach the same failure stage

#### Scenario: Cloud API and renderer stay outside hardware authority
- **WHEN** a capture is requested or completed
- **THEN** the cloud API SHALL NOT open a serial port
- **AND** Web/Electron renderer data SHALL NOT be treated as Agent credentials or authoritative physical evidence.

### Requirement: Commercial weight uses one three-decimal kilogram quantity
The sale lifecycle SHALL preserve raw capture evidence at up to six decimal places and derive one non-negative `commercialQuantityKg` rounded to three decimal places using deterministic decimal half-up behavior for non-negative values. The same commercial quantity SHALL be used for backend pricing, promotion and tax calculation, sale item, inventory movement, lot allocation, linked order fulfillment quantities, sale response and ticket. Currency and fiscal rounding rules SHALL remain unchanged.

#### Scenario: 0.245 kg capture remains exact commercially
- **WHEN** persisted raw weight is `0.245 kg`
- **THEN** `commercialQuantityKg` SHALL be `0.245`
- **AND** pricing, sale item, inventory and ticket SHALL all use `0.245`.

#### Scenario: Tie rounds deterministically to three decimals
- **WHEN** persisted raw weight is `0.2455 kg`
- **THEN** the backend SHALL derive `commercialQuantityKg = 0.246` using decimal half-up behavior.

#### Scenario: No downstream two-decimal quantity rounding
- **WHEN** a weighted line moves through pricing, tax/promotion snapshots, sale persistence, stock movements, lot balances/links, reversal, response or ticket generation
- **THEN** each layer SHALL preserve the same three-decimal commercial quantity
- **AND** the system SHALL NOT use a different quantity for charge and inventory.

### Requirement: POS pricing preview uses the explicitly selected sale mode
Pricing preview SHALL accept explicit `UNIT` or `WEIGHT`. `WEIGHT` SHALL use three-decimal quantity; `UNIT` and legacy requests omitting `saleMode` SHALL retain two-decimal UNIT behavior. POS SHALL send the cart line's selected mode, including the operator's choice for `BOTH`. The API SHALL NOT infer `WEIGHT` from product metadata or scale availability.

#### Scenario: Preview a 0.245 kg WEIGHT line
- **WHEN** the POS requests a WEIGHT preview with quantity `0.245` and unit price `16000` per kg
- **THEN** the preview SHALL return quantity `0.245` and line total `3920` under the existing monetary rounding rules

#### Scenario: Preview a BOTH product in either explicit mode
- **WHEN** a product configured as `BOTH` is previewed with the operator-selected `WEIGHT` or `UNIT` mode
- **THEN** WEIGHT SHALL use three-decimal quantity precision and UNIT SHALL use the existing two-decimal quantity precision
- **AND** omitting the mode SHALL use the legacy UNIT preview behavior

#### Scenario: Monetary treatment remains unchanged
- **WHEN** the weighted line is priced and taxed
- **THEN** the server SHALL use existing product price, promotion, tax inclusion, tax profile and monetary rounding rules with `commercialQuantityKg`
- **AND** this capability SHALL NOT alter fiscal tables or fiscal rules.

#### Scenario: Fractional kg line keeps currency rounding
- **WHEN** a three-decimal commercial quantity multiplied by a cent-priced per-kg amount produces a fractional cent
- **THEN** the sale item subtotal SHALL use the existing two-decimal currency rounding
- **AND** the sale item quantity SHALL remain at three decimals.

### Requirement: Weighted capture and sale commit atomically
The API SHALL validate and lock the capture, derive its commercial quantity, calculate backend pricing, create the sale and sale item, persist inventory effects, associate the capture with the exact sale item, consume the capture, create payment effects, finalize the sale and complete idempotency using one `PoolClient` transaction. Any failure before commit SHALL roll back all those writes and leave the capture READY.

#### Scenario: Successful weighted sale
- **WHEN** a WEIGHT line has a valid READY capture and all pricing, stock, payment and finalization steps succeed
- **THEN** the transaction SHALL persist the sale, sale item, inventory effects, capture-to-sale-item association and capture consumption before COMMIT.

#### Scenario: Sale or payment fails after capture validation
- **WHEN** sale creation, inventory, association, payment or finalization fails before COMMIT
- **THEN** the transaction SHALL roll back all sale effects and capture consumption
- **AND** the capture SHALL remain READY and reusable until expiry.

#### Scenario: Same capture submitted concurrently
- **WHEN** two transactions attempt to confirm sales using the same capture
- **THEN** capture row locking and conditional consumption SHALL allow exactly one committed consumer
- **AND** the other transaction SHALL reject the capture as already consumed or non-consumable.

#### Scenario: Sale item association is one-to-one
- **WHEN** a capture is consumed for a weighted sale line
- **THEN** persistence SHALL link that capture to the exact sale item and its sale/tenant
- **AND** database uniqueness and referential integrity SHALL prevent a capture or sale item from being associated more than once.

### Requirement: Weighted sale validates every capture context field
Before accepting a weighted line, the API SHALL match the capture to the authenticated tenant, branch, POS terminal, operational terminal, POS session, product, authenticated Agent device, logical scale and currently authorized KG binding. It SHALL validate the nonce, READY state, expiry and REAL/KG/unit-verified evidence from persistence.

#### Scenario: Capture context matches active sale
- **WHEN** all persisted capture context fields match the active sale and Agent, and the binding remains authorized
- **THEN** the API MAY use the persisted raw weight to derive commercial quantity.

#### Scenario: Capture replay or invalid nonce
- **WHEN** a capture is already consumed, expired, not READY or its nonce is incorrect
- **THEN** the API SHALL reject the sale without accepting renderer-supplied quantity or weight.

#### Scenario: Tenant, session, product, device or scale mismatch
- **WHEN** any required capture context field differs from the active sale/Agent context
- **THEN** the API SHALL reject the weighted line and SHALL leave sale and inventory unchanged.

#### Scenario: Binding revoked between read and checkout
- **WHEN** the capture's binding is revoked, disabled or no longer KG_VERIFIED before consumption
- **THEN** the API SHALL reject the sale and SHALL NOT consume the capture.

### Requirement: Inventory uses the weighted commercial quantity under existing policy

The system SHALL preserve current POS inventory policy for `UNIT` and `WEIGHT`; sale mode SHALL NOT determine inventory eligibility. New product eligibility policy is out of scope. Weighted sale and inventory paths SHALL use the same three-decimal commercial quantity. Lot-controlled products SHALL retain FEFO allocation and reconcile movement, balance and link quantities.

#### Scenario: Non-lot weighted product
- **WHEN** a valid weighted product follows the existing POS inventory path
- **THEN** stock availability and the sale OUT movement SHALL use `commercialQuantityKg` at three decimals.

#### Scenario: Lot-controlled weighted product
- **WHEN** a weighted product requires lots and multiple FEFO balances are available
- **THEN** the system SHALL allocate the full commercial quantity across eligible lots
- **AND** movement, lot balance and lot-link totals SHALL agree to three decimals.

#### Scenario: Insufficient inventory
- **WHEN** aggregate stock or eligible lot balances are less than `commercialQuantityKg`
- **THEN** the sale SHALL fail and the transaction SHALL leave the capture READY.

#### Scenario: Weight mode does not change inventory policy
- **WHEN** sale mode is WEIGHT
- **THEN** the system SHALL apply the same inventory eligibility policy as the corresponding UNIT path
- **AND** SHALL NOT create or suppress a stock movement solely because of sale mode.

### Requirement: Sale idempotency does not consume another capture
The existing sale idempotency contract SHALL include the weighted sale mode and capture reference in request identity without storing the clear nonce unnecessarily. A retry resolving to an already-created sale SHALL return the existing sale before attempting to lock or consume any capture.

#### Scenario: Retry after successful commit
- **WHEN** the same idempotency key and request are retried after the first sale committed
- **THEN** the API SHALL return the original sale and SHALL NOT consume a second capture or create duplicate payments/inventory effects.

#### Scenario: Idempotency key reused for another weighted request
- **WHEN** an idempotency key is reused with a different product, sale mode or capture reference
- **THEN** the API SHALL reject the retry as a conflicting request.

#### Scenario: Unknown network outcome
- **WHEN** the client cannot determine whether checkout committed
- **THEN** the client SHALL use the existing idempotency recovery path
- **AND** a recovered committed sale SHALL be returned without requiring replay of its capture nonce.

### Requirement: POS cart keeps modes explicit and capture references transient
The POS SHALL keep UNIT checkout behavior available. WEIGHT lines SHALL be added only after the capture is READY and SHALL display server-confirmed commercial quantity as a preview. A WEIGHT line SHALL not allow manual quantity edits or merging with another capture. The one-time capture nonce SHALL remain in volatile state and SHALL be excluded from localStorage cart persistence. BOTH SHALL require a deliberate UNIT or WEIGHT choice.

#### Scenario: WEIGHT capture is unavailable
- **WHEN** scale authorization, Agent authentication, capture creation or REAL KG observation fails
- **THEN** POS SHALL keep WEIGHT checkout disabled and SHALL keep eligible UNIT sales available.

#### Scenario: Cashier edits or removes a weighted line
- **WHEN** the cashier removes a weighted line, changes its product/mode, or requests another reading
- **THEN** POS SHALL discard the prior capture reference and require a new capture for any new WEIGHT line.

#### Scenario: Cart reloads before checkout
- **WHEN** a saved cart is restored from localStorage
- **THEN** it SHALL NOT restore the one-time capture nonce
- **AND** any unsubmitted WEIGHT line SHALL require a fresh capture.

#### Scenario: BOTH selection
- **WHEN** the cashier selects a BOTH product
- **THEN** POS SHALL ask for UNIT or WEIGHT explicitly
- **AND** SHALL apply only the selected mode to the line.

### Requirement: Confirmed sale and ticket expose weighted line data
The confirmed sale response and existing ticket input SHALL expose commercial quantity in kg, backend-resolved price per kg and computed line subtotal for a weighted sale item. Ticket printing SHALL use confirmed sale data and SHALL continue through the local Web/Electron/Agent path after sale commit.

#### Scenario: Weighted sale response
- **WHEN** a weighted sale commits successfully
- **THEN** its sale item response SHALL expose the three-decimal kg quantity, price per kg and subtotal derived by backend pricing.

#### Scenario: Ticket for weighted sale
- **WHEN** the existing POS ticket workflow prints a confirmed weighted sale
- **THEN** the ticket input SHALL contain the confirmed kg quantity, price per kg and subtotal
- **AND** the cloud API SHALL NOT attempt to access a local printer or serial port.
