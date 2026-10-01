## ADDED Requirements

### Requirement: Repository owns the cutover state
The governance policy SHALL derive V095 cutover state from the repository
`cutover_boundary` manifest and SHALL distinguish `NOT_APPROVED`,
`APPROVED_NOT_ACTIVE` and `ACTIVE` without using runtime environment variables
to redefine the repository fact.

#### Scenario: Current approved inactive baseline
- **WHEN** the manifest contains version `V095`, `approved=true`,
  `activated=false` and status `APPROVED_NOT_ACTIVE`
- **THEN** the evaluator SHALL return `APPROVED_NOT_ACTIVE` and SHALL not
  authorize post-cutover execution

#### Scenario: Future active cutover
- **WHEN** the manifest contains the approved V095 boundary, `activated=true`,
  status `ACTIVE` and an explicit owner activation marker
- **THEN** the evaluator SHALL return `ACTIVE` and SHALL allow the caller to
  continue to its separate runtime/environment authorization checks

#### Scenario: Not approved boundary
- **WHEN** approval is false or the required approval evidence is absent
- **THEN** the evaluator SHALL return `NOT_APPROVED` and SHALL deny
  post-cutover execution

### Requirement: Malformed state fails closed
The evaluator SHALL reject a missing, malformed or contradictory V095 state,
including an activated boundary without approval, an `ACTIVE` status without
explicit activation, a non-V095 boundary or invalid boolean/value types.

#### Scenario: Contradictory approval and activation
- **WHEN** the manifest says `approved=false` and `activated=true`
- **THEN** the evaluator SHALL return a sanitized policy failure and SHALL not
  authorize a runner

#### Scenario: Invalid boundary identity
- **WHEN** the manifest boundary version is absent or is not exactly `V095`
- **THEN** the evaluator SHALL return a sanitized policy failure and SHALL not
  infer a replacement boundary

### Requirement: Diagnostics consume authoritative activation
Repository diagnostics SHALL report the state returned by the shared evaluator
and SHALL preserve `HISTORY_CERTIFICATION_STATUS=PARTIAL`, historical replay
prohibition and `NEXT_SAFE_VERSION=UNVERIFIED` while the current baseline is
inactive.

#### Scenario: Diagnostic agrees with baseline
- **WHEN** the current manifest is evaluated
- **THEN** the diagnostic SHALL report V095 as approved but inactive and strict
  mode SHALL remain independent

### Requirement: Governed runner requires active repository cutover
The official runner SHALL refuse `POST_CUTOVER` execution unless the shared
repository evaluator returns `ACTIVE`. Runtime era and approval variables MAY
remain required as additional authorization, but SHALL NOT override an
inactive or invalid repository state.

#### Scenario: Runtime requests post-cutover too early
- **WHEN** runtime variables request `POST_CUTOVER` with
  `GOVERNANCE_CUTOVER_APPROVED=YES` while repository state is
  `APPROVED_NOT_ACTIVE`
- **THEN** the runner SHALL fail before database access with a sanitized
  cutover-not-active result

#### Scenario: Historical pre-governance path
- **WHEN** a caller requests `PRE_GOVERNANCE`
- **THEN** the runner SHALL preserve `HISTORICAL_REPLAY_PROHIBITED` and SHALL
  not execute historical SQL

### Requirement: Cutover activation remains separate from strict mode
Changing the repository cutover state SHALL NOT change the default
`MANUS_GOVERNANCE_MODE`, and setting repository strict evaluation SHALL NOT
activate the migration cutover.

#### Scenario: Strict mode remains independent
- **WHEN** repository governance is evaluated with explicit `STRICT`
- **THEN** strict evaluation SHALL run according to its existing contract while
  cutover state remains independently reported

### Requirement: Configuration rollback preserves database state
The documented rollback SHALL be configuration/gate-level only and SHALL not
replay, delete, rename, renumber or rewrite migration SQL or
`migrations_history`.

#### Scenario: Future activation rollback
- **WHEN** an owner disables an activated cutover
- **THEN** the manifest/runtime policy SHALL return to a safe inactive state
  and no database rollback operation SHALL be required
