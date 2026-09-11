# Billing Event Consumption

## ADDED Requirements

### Requirement: Idempotent billing event consumer

The billing backend SHALL consume sale billing events with at-least-once semantics.

The consumer SHALL be idempotent by:

- `eventId`
- `source.type` + `source.id`
- business external reference generated from the sale snapshot

The consumer SHALL persist durable inbox state so duplicate deliveries can be recognized after process restart.

The consumer SHALL not require the API to stay online after the event is published.

#### Scenario: Duplicate delivery
- **WHEN** the same sale billing event is delivered twice
- **THEN** the billing backend SHALL process it once
- **AND** the second delivery SHALL be treated as duplicate or no-op
