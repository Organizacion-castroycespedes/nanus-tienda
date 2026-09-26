## Purpose

Define a safe, on-demand commercial weighing capability between Manus POS and the authorized Peripheral Agent, reusing the existing product sale model and excluding metrological certification.

## ADDED Requirements

### Requirement: Product sale mode governs weighing

The system SHALL reuse the existing product `saleType` and `measurementUnit` values without creating a second product model.

#### Scenario: Unit product does not require a scale
- **WHEN** a product has `saleType=UNIT` and `measurementUnit=UND`
- **THEN** POS SHALL allow normal unit sales without requiring a configured or connected scale.

#### Scenario: Weight product requests weighing
- **WHEN** a product has `saleType=WEIGHT` and a valid weight measurement unit
- **THEN** POS SHALL require an approved weighing flow before accepting its physical quantity.

#### Scenario: Unit-and-weight product chooses a mode
- **WHEN** a product has `saleType=BOTH`
- **THEN** POS SHALL require an explicit choice between unit sale and weight sale before applying quantity.

#### Scenario: Invalid product model
- **WHEN** a product has an invalid sale type and measurement unit combination
- **THEN** the commercial weighing flow SHALL reject it and SHALL NOT infer a mode from legacy flags.

### Requirement: Terminal scale availability is explicit

The system SHALL resolve scale availability from the authorized tenant, branch and terminal configuration and SHALL distinguish configuration, enablement, device identity and connection state.

#### Scenario: Terminal has no scale assigned
- **WHEN** the active terminal has no assigned scale device
- **THEN** POS SHALL show `Sin balanza configurada`, disable or hide weight capture controls, and continue allowing unit sales.

#### Scenario: Scale is disabled
- **WHEN** the terminal has a scale assignment but scale use is disabled
- **THEN** POS SHALL show `Balanza deshabilitada` and SHALL NOT request a reading.

#### Scenario: Scale is configured and available
- **WHEN** the terminal has an enabled authorized scale and the Agent reports it available
- **THEN** POS SHALL show the scale as available and SHALL permit a single explicit capture request.

#### Scenario: Scale is disconnected or in error
- **WHEN** the assigned device is disconnected, occupied, or reports a transport/parser error
- **THEN** POS SHALL show a distinct unavailable state and SHALL NOT reuse a previous reading.

#### Scenario: Configuration is revoked during capture
- **WHEN** scale assignment or enablement is revoked before confirmation of a weight sale
- **THEN** the capture SHALL be invalidated and the sale SHALL be blocked until configuration is resolved.

### Requirement: Weight capture is real, fresh, and attributable

The weighing flow SHALL return a normalized kilogram value together with explicit source, configured source unit, capture time, freshness, terminal and device attribution; it SHALL NOT use the MOCK stability flag as metrological evidence.

#### Scenario: Verified KG capture
- **WHEN** the configured ROCHI unit is explicitly verified as KG and the Agent returns a fresh REAL reading
- **THEN** POS SHALL receive the normalized kilogram value and SHALL associate it with the active terminal, product and operation.

#### Scenario: Unit is not verified
- **WHEN** the physical unit is unknown, changed, or inconsistent with configuration
- **THEN** the Agent/POS flow SHALL show `Unidad no verificada` and SHALL reject commercial capture.

#### Scenario: Stale or invalid reading
- **WHEN** the reading is stale, missing, malformed, non-positive where the product policy rejects it, or invalidated by close/error/disconnect
- **THEN** the flow SHALL reject it and SHALL clear any prior usable reading.

#### Scenario: MOCK reading in a commercial flow
- **WHEN** the response source is MOCK or fallback simulation
- **THEN** it SHALL be visibly labeled as simulated and SHALL NOT satisfy a REAL commercial weighing requirement.

#### Scenario: No metrological stability flag
- **WHEN** ROCHI provides a valid frame without a stability indicator
- **THEN** the system SHALL NOT infer metrological stability from repeated values or from `stable=true` in the MOCK contract.

### Requirement: Capture lifecycle is controlled

The system SHALL use one explicit on-demand capture or bounded weighing session per terminal and device, with cancellation, freshness limits and cleanup on every exit path.

#### Scenario: Single capture succeeds
- **WHEN** POS requests a reading for the active weighing operation
- **THEN** the Agent SHALL open or use the authorized connection, obtain one fresh reading, return it, and release the connection according to the selected lifecycle.

#### Scenario: Concurrent capture is attempted
- **WHEN** a second capture starts while the same terminal/device capture is active
- **THEN** the second request SHALL be rejected or serialized according to the approved contract, and SHALL NOT create a second uncontrolled serial owner.

#### Scenario: Timeout or cancellation
- **WHEN** synchronization, reading, operator confirmation, or Agent response exceeds its limit or is cancelled
- **THEN** the operation SHALL close safely, invalidate the reading, and return a distinguishable timeout/cancelled result.

#### Scenario: USB or transport loss
- **WHEN** the physical connection is lost during capture
- **THEN** the Agent SHALL transition to a disconnected/error state, invalidate the current reading immediately, and SHALL require an explicit later recovery.

### Requirement: Commercial sale reuses authoritative pricing and inventory

The system SHALL reuse the existing pricing preview, sale, tax, discount and inventory flows, while backend validation remains authoritative for quantity and weighing evidence.

#### Scenario: Weight enters the existing cart flow
- **WHEN** a valid capture is accepted for a weight sale
- **THEN** POS SHALL apply the quantity through the existing cart and pricing-preview flow without duplicating price or tax calculation.

#### Scenario: Backend receives a weighted sale
- **WHEN** a weighted sale is submitted
- **THEN** backend SHALL revalidate tenant, branch, terminal, product sale mode, measurement unit, quantity, price rules and required capture evidence before confirming the sale.

#### Scenario: Capture evidence is missing or mismatched
- **WHEN** evidence is absent, duplicated, expired, belongs to another terminal/product/operation, or is MOCK where REAL is required
- **THEN** backend SHALL reject the weighted sale without partial inventory or fiscal persistence.

#### Scenario: Normal unit sale remains compatible
- **WHEN** a unit product is sold without a scale
- **THEN** the existing pricing, tax, discount, inventory and invoicing behavior SHALL continue unchanged.

### Requirement: Manual quantity is not a silent scale substitute

The system SHALL preserve existing manual quantity controls for approved unit operations and SHALL require an explicit approved policy for any manual override of a weight sale.

#### Scenario: Manual quantity for unit sale
- **WHEN** the operator edits quantity for a `UNIT` product
- **THEN** the existing unit quantity behavior SHALL remain available.

#### Scenario: Manual quantity for required weight sale
- **WHEN** the operator enters a quantity manually for a `WEIGHT` sale without an approved override
- **THEN** POS or backend SHALL reject the operation or require the approved override authorization, and SHALL NOT label it as a physical scale capture.

### Requirement: Tenant and terminal isolation is enforced

The system SHALL bind configuration and capture evidence to the authorized tenant, branch, active terminal, registered device and current POS operation.

#### Scenario: Cross-tenant device request
- **WHEN** a request references a device or terminal outside the authorized tenant or branch
- **THEN** the Agent/backend SHALL reject it.

#### Scenario: Terminal changes during capture
- **WHEN** the active POS terminal changes while a capture is pending
- **THEN** the pending capture SHALL be invalidated and SHALL NOT be reused by the new terminal.

#### Scenario: Untrusted client-supplied identity
- **WHEN** the only proof of device or capture ownership is an identifier supplied by the frontend
- **THEN** the backend/Agent SHALL reject it unless it is corroborated by the existing authorized configuration and local trust mechanism.

