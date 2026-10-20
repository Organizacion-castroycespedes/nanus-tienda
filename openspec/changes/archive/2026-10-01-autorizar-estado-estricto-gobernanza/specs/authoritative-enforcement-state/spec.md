## ADDED Requirements

### Requirement: Repository owns durable enforcement state

Governance SHALL resolve its durable enforcement mode from the repository-owned
baseline manifest. The state SHALL be independent from the V095 cutover state.
The pre-activation default is `WARNING`; the current owner-authorized state is
`STRICT` with explicit activation metadata.

#### Scenario: Warning default fixture
- **WHEN** the manifest contains a valid durable `WARNING` state and no stronger
  request is supplied
- **THEN** diagnostics and promotion policy SHALL resolve `WARNING` and strict
  mode SHALL remain inactive

#### Scenario: Explicit CI strict request
- **WHEN** a caller explicitly requests `STRICT` while durable state is
  `WARNING`
- **THEN** the evaluator SHALL resolve `STRICT` for that invocation without
  changing the durable state or activating migration cutover

### Requirement: Strict state fails closed and cannot be silently downgraded

The evaluator SHALL reject missing, malformed or contradictory enforcement
state. A durable `STRICT` state SHALL reject ordinary `WARNING` or
`DIAGNOSTIC_ONLY` requests unless an explicit authorized rollback marker is
present.

#### Scenario: Future durable strict state
- **WHEN** the manifest contains valid durable `STRICT` state
- **THEN** ordinary resolution SHALL be `STRICT` and a weaker caller request
  SHALL not downgrade it

#### Scenario: Invalid enforcement state
- **WHEN** enforcement state has an unknown mode, invalid types or invalid
  activation metadata
- **THEN** evaluation SHALL fail closed with sanitized output

### Requirement: Cutover and strict remain independent

Changing durable enforcement state SHALL NOT change V095 cutover state, and
activating V095 SHALL NOT activate strict mode.

#### Scenario: Active cutover with warning enforcement
- **WHEN** V095 is `ACTIVE` and durable enforcement is `WARNING`
- **THEN** cutover SHALL remain active while strict mode remains inactive

### Requirement: Rollback is configuration-only

An explicit authorized rollback SHALL return durable enforcement to `WARNING`
without database access, migration execution, historical replay or changes to
`migrations_history`.

#### Scenario: Strict rollback
- **WHEN** an owner supplies the authorized rollback marker for durable
  `STRICT`
- **THEN** the evaluator SHALL allow `WARNING` state and preserve active V095
  cutover
