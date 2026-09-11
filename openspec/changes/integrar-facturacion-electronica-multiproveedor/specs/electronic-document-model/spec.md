## ADDED Requirements

### Requirement: Electronic documents are provider neutral
The system SHALL persist a provider-neutral electronic document header with tenant, provider, provider config, document type, source type, source id, external reference, provider document id, numbering data, currency, amounts, status, provider status, dates, and metadata.

#### Scenario: Invoice is created from sale
- **WHEN** a sale is transformed into an electronic invoice
- **THEN** the document stores `document_type = INVOICE` and `source_type = SALE`
- **AND** the local record exists before the provider assigns `provider_document_id`

#### Scenario: Credit note is created from return
- **WHEN** a return becomes a credit note
- **THEN** the document stores `document_type = CREDIT_NOTE` and `source_type = RETURN`

#### Scenario: Manual document is created
- **WHEN** an operator creates a manual electronic document
- **THEN** the document stores `source_type = MANUAL`
- **AND** the domain does not require a direct sale foreign key

### Requirement: Document state stays separate from provider state
The system SHALL keep internal document status separate from provider status.

#### Scenario: Provider status changes
- **WHEN** the provider moves from technical processing to accepted
- **THEN** the local document updates both fields independently
- **AND** the internal lifecycle remains stable for Manus consumers

