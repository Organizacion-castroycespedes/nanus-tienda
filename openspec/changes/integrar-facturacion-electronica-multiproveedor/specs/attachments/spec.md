## ADDED Requirements

### Requirement: Document attachments are tracked separately
The system SHALL track XML, signed XML, PDF, and provider response artifacts as attachments linked to the electronic document.

#### Scenario: XML is generated
- **WHEN** XML is generated for a document
- **THEN** an XML attachment record can be created

#### Scenario: Signed XML is generated later
- **WHEN** the signed XML differs from the generated XML
- **THEN** the system stores a separate signed XML attachment reference

#### Scenario: Document has no PDF yet
- **WHEN** the PDF is not available yet
- **THEN** the document can still exist without a PDF attachment

### Requirement: Attachment storage is implementation neutral
The system SHALL store attachment metadata and storage references instead of forcing binary storage in PostgreSQL during this phase.

#### Scenario: Storage backend changes
- **WHEN** the storage backend changes later
- **THEN** the document attachment model remains valid

