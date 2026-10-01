## ADDED Requirements

### Requirement: Technical changes require an OpenSpec before code modification
Manus SHALL require an active, apply-ready and strict-valid OpenSpec before modifying code or executable behavior for features, bugfixes, UI, frontend, backend, APIs, contracts, DTOs, database, migrations, functional seeds, security, RBAC, Electron, Peripheral Agent, electronic billing, runtime executable configuration, integrations, executable infrastructure and code refactors.

#### Scenario: Code change without OpenSpec
- **WHEN** a proposed diff changes a covered technical path without an active covering OpenSpec
- **THEN** the repository gate SHALL reject the change before merge

#### Scenario: Valid OpenSpec before implementation
- **WHEN** a covered change has a matching active OpenSpec whose required artifacts are complete and strict-valid
- **THEN** the change SHALL be eligible for implementation checks

### Requirement: Limited exceptions are explicit and verifiable
The governance SHALL allow only narrowly classified typo-only, non-executable documentation, QA evidence, non-executable artifacts and administrative changes without technical impact. Every exception SHALL be declared and validated by the gate.

#### Scenario: Documentation-only change
- **WHEN** a diff changes only non-executable documentation and contains no technical behavior or contract impact
- **THEN** the gate MAY classify it as exempt and SHALL record the exemption reason

#### Scenario: Exception hides code behavior
- **WHEN** an allegedly exempt diff changes executable code, runtime configuration, contract, database or integration behavior
- **THEN** the gate SHALL require an OpenSpec and SHALL reject the exemption

### Requirement: Diff coverage is verifiable
The governance SHALL associate a covered diff with an OpenSpec by a supported metadata, manifest, change-id or Manus-owned compatible mechanism. Branch naming alone SHALL NOT be sufficient evidence.

#### Scenario: Exact scope association
- **WHEN** a diff path and declared change scope match the supported association mechanism
- **THEN** the gate SHALL report the covering change-id

#### Scenario: Ambiguous association
- **WHEN** multiple changes, no change, or unsupported metadata could cover the diff
- **THEN** the gate SHALL reject the diff or return an explicit review-required result

### Requirement: OpenSpec artifacts are validated before implementation
The governance SHALL require change validation with the installed OpenSpec CLI and SHALL distinguish pre-existing unrelated validation failures from new regressions.

#### Scenario: Invalid new change
- **WHEN** the covering change fails `openspec validate <change> --type change --strict`
- **THEN** implementation SHALL be blocked

#### Scenario: Pre-existing unrelated failure
- **WHEN** `openspec validate --all --strict` reports a known unrelated baseline failure and the new change introduces no new failure
- **THEN** the gate SHALL report the baseline failure separately and SHALL not silently convert it into a new pass

### Requirement: Manus orchestration uses generated OpenSpec workflow without modifying generated skills
Manus-owned orchestration SHALL classify requests, reuse an exact active change when possible, require apply-ready artifacts, and delegate to the installed OpenSpec workflow. It SHALL NOT modify generated `openspec-*` skills.

#### Scenario: Exact active change exists
- **WHEN** an active change covers the complete requested scope
- **THEN** orchestration SHALL reuse or explicitly select that change instead of creating a duplicate

#### Scenario: No exact active change exists
- **WHEN** no active change covers the complete scope
- **THEN** orchestration SHALL require a new proposal before implementation

### Requirement: OpenSpec policy is documented as future repository authority
The future Manus policy SHALL define the covered change classes, limited exceptions, association evidence, validation commands, gate behavior and ownership without treating stale historical paths as current authority.

#### Scenario: Stale path appears in instructions
- **WHEN** repository instructions reference an obsolete application or migration path
- **THEN** the policy cleanup SHALL classify the text as historical or update it before relying on it as governance authority

#### Scenario: Governance implementation remains separate
- **WHEN** this proposal is created
- **THEN** no `AGENTS.md`, generated skill, CI workflow or application file SHALL be modified by this change
