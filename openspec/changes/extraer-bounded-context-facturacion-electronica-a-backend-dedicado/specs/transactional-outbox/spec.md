# Transactional Outbox

## ADDED Requirements

### Requirement: Same-transaction outbox write

The API SHALL persist the sale and the electronic billing outbox entry in the same PostgreSQL transaction.

The outbox entry SHALL be durable once the sale transaction commits.

The API SHALL store outbox events in a reusable integration outbox bounded context, not inside the inventory or billing modules.

The system SHALL NOT call the billing backend directly inside the sale transaction.

The delivery model SHALL be at-least-once.

The dispatcher SHALL claim rows with `FOR UPDATE SKIP LOCKED` and a lease window so multiple API instances can run safely.

The outbox entry SHALL track:

- `attempt_count`
- `next_attempt_at`
- `lease_until`
- `last_error`

The dispatcher SHALL NOT retry forever.

#### Scenario: Sale commit stores outbox event
- **WHEN** a sale that requires electronic billing is completed successfully
- **THEN** the API SHALL persist the sale and an integration event in the same transaction
- **AND** the event SHALL remain available for later dispatch

#### Scenario: Billing backend unavailable
- **WHEN** the billing backend is unavailable at dispatch time
- **THEN** the sale SHALL remain committed
- **AND** the outbox event SHALL remain pending for retry
