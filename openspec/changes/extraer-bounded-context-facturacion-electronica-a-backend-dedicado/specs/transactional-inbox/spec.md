# Transactional Inbox

## ADDED Requirements

### Requirement: Durable inbox for sale billing events

The billing backend SHALL persist each consumed sale billing event in a transactional inbox.

The inbox SHALL be unique by:

- `eventId`
- `tenantId` + `source.type` + `source.id`
- `tenantId` + `externalReference`

The inbox SHALL store:

- event identity
- source identity
- payload hash
- processing status
- linked electronic document id when available

#### Scenario: Duplicate sale billing event
- **WHEN** the same sale billing event is delivered more than once
- **THEN** the billing backend SHALL return the existing consumption result
- **AND** it SHALL not create a second electronic document

#### Scenario: Same sale, different event id
- **WHEN** a second event with a different `eventId` but same `tenantId` and `source.id` arrives
- **THEN** the billing backend SHALL treat it as the same business source
- **AND** it SHALL not create a second electronic document
