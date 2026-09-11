## ADDED Requirements

### Requirement: Electronic billing events are audited
The system SHALL record document lifecycle events such as creation, processing, XML generation, signing, transmission, status changes, acceptance, rejection, technical errors, and retry requests.

#### Scenario: Document is created
- **WHEN** a document is created
- **THEN** an event is recorded with the document id and event type

#### Scenario: Retry is requested
- **WHEN** the system requests a retry for a failed document
- **THEN** the event history records the retry attempt and error context

### Requirement: Secrets are never written to events
The system SHALL not store client secrets, passwords, or private certificate data in document event records.

#### Scenario: Provider error is logged
- **WHEN** a provider error is recorded
- **THEN** the event stores safe metadata only
- **AND** it omits secret material

