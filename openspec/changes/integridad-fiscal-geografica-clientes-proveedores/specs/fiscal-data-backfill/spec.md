## ADDED Requirements

### Requirement: Auditable backfill dry-run
The system SHALL provide a read-only dry-run report separating deterministic geographic resolutions from fiscal records requiring review.

#### Scenario: Deterministic geography
- **WHEN** a record has authoritative foreign keys to catalog rows
- **THEN** dry-run reports the canonical country, department, and municipality fields as resolvable

#### Scenario: Unresolved fiscal data
- **WHEN** fiscal values cannot be derived from an approved mapping
- **THEN** dry-run marks the record `REQUIRES_FISCAL_REVIEW` without assigning a responsibility

### Requirement: Idempotent guarded backfill
The QA backfill SHALL be non-destructive, tenant-safe, rerunnable, and limited to deterministic catalog-derived changes.

#### Scenario: Repeated execution
- **WHEN** the same backfill runs twice
- **THEN** the second run produces no additional changes and preserves the audit counts

#### Scenario: Billing isolation
- **WHEN** backfill runs
- **THEN** no outbox, inbox, electronic document, provider, or DIAN operation is executed
