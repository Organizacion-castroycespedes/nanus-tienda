## ADDED Requirements

### Requirement: Document references preserve fiscal lineage
The system SHALL persist references between electronic documents and their origin documents, including invoice-to-credit-note and future document chains.

#### Scenario: Credit note references invoice
- **WHEN** a credit note is created from an invoice
- **THEN** the system stores both the referenced electronic document and the external reference values

#### Scenario: Future document chain is needed
- **WHEN** a later provider feature requires a new document relation type
- **THEN** the reference model can store the new relation without changing the sales domain

#### Scenario: Reference belongs to another tenant
- **WHEN** a request tries to point at a document from a different tenant
- **THEN** the system rejects the reference as invalid

