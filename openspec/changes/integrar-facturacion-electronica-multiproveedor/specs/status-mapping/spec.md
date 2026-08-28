## ADDED Requirements

### Requirement: Internal status is distinct from provider status
The system SHALL keep a provider-neutral internal status model and SHALL not expose raw provider lifecycle codes as the only business state.

#### Scenario: Provider has many technical states
- **WHEN** a provider exposes several technical states such as XML generated, signed, sent, or pending response
- **THEN** Manus still shows a stable internal status

#### Scenario: Provider returns accepted
- **WHEN** the provider confirms acceptance
- **THEN** the internal status can move to `ACCEPTED`

### Requirement: Provider statuses are normalized
The system SHALL normalize provider-specific states into a documented internal mapping for `PENDING`, `PROCESSING`, `ACCEPTED`, `REJECTED`, `TECHNICAL_ERROR`, and `CANCELLED`.

#### Scenario: Technical provider failure
- **WHEN** the provider reports a transport or signing failure
- **THEN** the internal status maps to `TECHNICAL_ERROR`

#### Scenario: Document rejected
- **WHEN** the provider rejects the document for fiscal reasons
- **THEN** the internal status maps to `REJECTED`

