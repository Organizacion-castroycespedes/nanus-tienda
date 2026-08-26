## ADDED Requirements

### Requirement: Operational terminal owns peripheral configuration
The system SHALL associate a POS peripheral configuration with zero or one
operational `terminals` row. A linked configuration SHALL reference an
operational terminal in the same tenant and branch.

#### Scenario: Link TERM-001 to a peripheral profile
- **WHEN** an administrator links the POS peripheral configuration for
  `TERM-001` to its operational terminal ID
- **THEN** the system SHALL persist one valid linked configuration without
  changing sales, cash registers or POS sessions

### Requirement: Resolve by operational terminal ID
When `resolve-current` receives a valid `terminals.id`, it SHALL resolve the
linked peripheral configuration before any legacy POS-terminal code or default
configuration.

#### Scenario: XP-80 configuration for TERM-001
- **WHEN** `resolve-current` receives the operational ID for `TERM-001`
- **THEN** it SHALL return its linked printer device configuration and SHALL
  not resolve `local-terminal`

#### Scenario: Unknown operational UUID
- **WHEN** `resolve-current` receives a UUID that is not an operational
  `terminals.id` in the requested tenant
- **THEN** it SHALL reject the request and SHALL NOT continue with legacy
  `pos_terminals` or `local-terminal` lookup

### Requirement: Controlled unconfigured operational terminal SHALL return an explicit result
The system SHALL report an explicit unconfigured result when a valid
operational terminal has no linked peripheral configuration. A physical-print
caller SHALL surface `PRINTER_NOT_CONFIGURED` and SHALL NOT use a mock printer.

#### Scenario: No peripheral configuration for terminal
- **WHEN** a user prints from an active operational terminal without a linked
  printer configuration
- **THEN** the request SHALL fail in a controlled way without modifying the
  sale, payment, inventory or cash state

### Requirement: Explicit legacy and MOCK compatibility
The system SHALL retain legacy `pos_terminals` lookup and `local-terminal`
fixtures only under explicit legacy or MOCK/development context during the
transition.

#### Scenario: Explicit MOCK fixture
- **WHEN** an explicit MOCK/development context requests `local-terminal`
- **THEN** the system SHALL continue to resolve its mock configuration

### Requirement: Identifier separation
The system SHALL distinguish operational terminal identity, Agent terminal
code and peripheral device identity in API contracts and internal resolution.

#### Scenario: Send print to configured XP-80
- **WHEN** an operational terminal resolves a linked USB printer
- **THEN** the Agent request SHALL use the configured peripheral `deviceId`
  and an Agent terminal code without treating either as `terminals.id`

### Requirement: Branch and tenant isolation
The system SHALL reject a configuration link or resolution that crosses tenant
or branch scope.

#### Scenario: Other branch terminal
- **WHEN** a user requests peripherals for an operational terminal in another
  branch
- **THEN** the system SHALL reject the request and SHALL not expose its device
  configuration

### Requirement: Explicit operational terminal mapping
The system SHALL identify peripheral configuration by `terminals.id` through
`pos_terminals.operational_terminal_id`. Tenant and branch scope SHALL NOT be
used to infer a peripheral profile because one branch can contain multiple
operational terminals.

#### Scenario: TERM-001 and TERM-002 share a branch
- **WHEN** TERM-001 and TERM-002 belong to the same tenant and branch
- **THEN** a profile linked to TERM-001 SHALL NOT be selected for TERM-002
  unless TERM-002 has its own explicit linked profile

### Requirement: Selected incremental migration safety
The database runner SHALL support selecting exactly one reviewed
`V###__description.sql` migration for QA without running schema files,
functions, seeds, fixtures, or other pending migrations. It SHALL reject path
traversal, non-V names, checksum mismatches, and a production-like database
when `ENVIRONMENT=qa`.

#### Scenario: Inspect V071 only
- **WHEN** `ONLY_INCREMENTAL_MIGRATION` selects
  `V071__link_pos_terminals_to_operational_terminals.sql` with dry run enabled
- **THEN** the runner SHALL report one selected migration, target QA database
  identity, and that other pending migrations are not executed

#### Scenario: Use the QA DDL identity without changing API runtime
- **WHEN** a selected QA migration provides `MIGRATION_DB_USER=manus_qa_user`
- **THEN** the runner SHALL verify that `current_user` is `manus_qa_user` and
  SHALL keep the application runtime configuration on `manus_user`
