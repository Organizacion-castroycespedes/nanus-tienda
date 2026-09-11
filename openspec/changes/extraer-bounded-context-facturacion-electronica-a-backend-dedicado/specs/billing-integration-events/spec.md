# Billing Integration Events

## ADDED Requirements

### Requirement: Versioned sale billing event envelope

The API SHALL emit a versioned integration event for sales that require electronic billing.

The event SHALL include:

- `eventId`
- `eventType`
- `schemaVersion`
- `tenantId`
- `correlationId`
- `occurredAt`
- `source.type`
- `source.id`
- `payload`

The payload SHALL contain enough sale snapshot data to allow the billing backend to build canonical billing commands without rereading API sale tables.

The payload SHALL include at least:

- sale snapshot
- customer snapshot
- lines snapshot
- taxes snapshot
- payments snapshot
- totals
- currency

Decimal values in the wire payload SHALL be serialized in a precision-safe representation.

The API producer contract SHALL remain compatible with the billing backend consumer contract for schema version 1 without importing billing backend code at compile time.

#### Scenario: Sale completed event is versioned
- **WHEN** the API publishes a billing event
- **THEN** it SHALL set a schema version
- **AND** the consumer SHALL be able to reject unsupported versions safely
