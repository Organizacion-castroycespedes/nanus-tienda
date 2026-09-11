## ADDED Requirements

### Requirement: Delivery is separate from fiscal acceptance
The system SHALL track document delivery independently from fiscal acceptance or rejection.

#### Scenario: Document is accepted but not emailed
- **WHEN** a provider accepts the document but email delivery has not happened
- **THEN** the document remains accepted and the delivery remains pending

#### Scenario: Email fails after acceptance
- **WHEN** email delivery fails after fiscal acceptance
- **THEN** the fiscal status remains unchanged
- **AND** the delivery record stores the failure

### Requirement: Delivery channels are extensible
The system SHALL support `EMAIL` initially and SHALL leave room for future `WHATSAPP` and `PORTAL` delivery types.

#### Scenario: Future channel is added
- **WHEN** a future delivery channel is introduced
- **THEN** the delivery model can expand without changing the document lifecycle model

