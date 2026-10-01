## ADDED Requirements

### Requirement: Planner is distinct from next-safe version
The governance system SHALL keep `NEXT_SAFE_VERSION` and `ENVIRONMENT_PROMOTION_PLAN` as separate capabilities. `NEXT_SAFE_VERSION` SHALL propose a free numeric identity above the approved boundary, while the promotion planner SHALL determine the exact migrations required to move one verified environment to a requested target.

#### Scenario: Candidate does not imply promotion plan
- **WHEN** `V097` is the lowest free identity and a destination is verified at `V095` with target `V099`
- **THEN** the system SHALL require a separate ordered promotion plan for `V096`, `V097`, `V098` and `V099` and SHALL NOT treat `V097` as authorization to execute any migration

### Requirement: Planner consumes verified evidence and never mutates
The planner SHALL be deterministic and side-effect free. It SHALL consume sanitized repository, target and destination evidence, canonical migration metadata and policy, and SHALL return either a verified plan, `ALREADY_AT_TARGET` or deterministic blocking reasons.

#### Scenario: Unverified evidence
- **WHEN** identity, target SHA, correlation, freshness, history or checksum evidence is missing, stale or malformed
- **THEN** the planner SHALL return `EVIDENCE_UNVERIFIED` or an equivalent blocking state and SHALL perform no database or file mutation

### Requirement: Ordered pending set is exact
For governed post-cutover migrations, the planner SHALL produce the complete ordered pending set from the verified destination state through the requested target. It SHALL include canonical version, path or filename when applicable, exact-byte SHA-256, eligibility and evidence references for every step.

#### Scenario: Destination several versions behind
- **WHEN** Repository and QA contain canonical `V096`, `V097`, `V098`, `V099`, and PRD is verified through `V095` with requested target `V099`
- **THEN** the planner SHALL produce `[V096,V097,V098,V099]` and SHALL reject a plan containing only `V099`

### Requirement: Governed gaps and order fail closed
The planner SHALL reject a governed post-cutover destination with a missing predecessor or version gap. Historical anomalies at or below `V095` SHALL remain pre-governance baseline evidence and SHALL NOT trigger post-cutover contiguous repair.

#### Scenario: Missing middle version
- **WHEN** a destination contains `V096` and `V098` but lacks `V097`
- **THEN** the planner SHALL return `BLOCKED_VERSION_GAP` and SHALL not treat the versions as independent executable identities

### Requirement: Dependencies are enforced before execution
The promotion contract SHALL enforce validated predecessor and dependency order before execution. It SHALL NOT rely on eventual SQL failure or operator discipline.

#### Scenario: Dependent migration
- **WHEN** `V097` requires the schema established by `V096` and the destination is at `V095`
- **THEN** the plan SHALL include and validate `V096` before `V097`, or SHALL block with `DEPENDENCY_OR_ORDER_VIOLATION`

### Requirement: Lag and drift are distinct
The planner SHALL classify a coherent destination behind the requested target as `PROMOTION_LAG` or equivalent, and SHALL classify unknown post-cutover destination versions as blocked drift.

#### Scenario: Legitimate promotion lag
- **WHEN** QA is verified at `V098`, PRD at `V096`, and canonical `V097` and `V098` are pending for PRD
- **THEN** PRD SHALL be classified as `PROMOTION_LAG` and the planner SHALL produce the valid pending sequence

#### Scenario: Unknown DB-only version
- **WHEN** PRD contains post-cutover `V099` absent from authoritative Repository and Target evidence
- **THEN** the planner SHALL classify `DB_ONLY`/`BLOCKED_DRIFT` and SHALL block further promotion until explicit reconciliation

### Requirement: Applied immutability and history failures block
Every relevant applied governed migration SHALL satisfy the exact-byte checksum and successful-history contract available for the source. Checksum mismatch, applied immutability violation or `success=false` history SHALL block automatic promotion and replay.

#### Scenario: Applied checksum changed
- **WHEN** QA has successful `V097` with checksum A and the repository presents checksum B
- **THEN** the planner SHALL return `CHECKSUM_MISMATCH` or `APPLIED_IMMUTABILITY_VIOLATION` and SHALL require a new migration for corrective evolution

#### Scenario: Failed history row
- **WHEN** the destination has a post-cutover `V097` history row with `success=false`
- **THEN** the planner SHALL return `FAILED_HISTORY_PRESENT` and SHALL require explicit disposition rather than retrying automatically

### Requirement: Manual execution is not pending
The planner SHALL distinguish suspected or confirmed post-cutover manual execution without governed history from an unapplied migration. It SHALL return `MANUAL_EXECUTION_UNVERIFIED` or equivalent blocked reconciliation and SHALL not replay the migration automatically. `MANUAL_APPLICATION_BASELINE_ADOPTION` for V096 SHALL remain a narrow, explicit transition and SHALL NOT become a generic bypass.

#### Scenario: Manual post-cutover state
- **WHEN** physical post-cutover effects are reported but governed history evidence is absent
- **THEN** the planner SHALL block replay and require an authorized reconciliation/adoption process

### Requirement: Already-at-target and downgrade behavior are deterministic
The planner SHALL return an empty verified plan for a destination already at the requested target with compatible evidence. It SHALL reject unsupported downgrade requests.

#### Scenario: Destination already at target
- **WHEN** all requested target migrations are present with valid canonical evidence
- **THEN** the planner SHALL return `ALREADY_AT_TARGET` with zero executable steps

#### Scenario: Unsupported downgrade
- **WHEN** the requested target is below the verified destination state
- **THEN** the planner SHALL return `UNSUPPORTED_DOWNGRADE` and SHALL not generate reverse SQL

### Requirement: Execution is separate and sequential
The execution/orchestration layer SHALL consume only a verified plan and SHALL invoke `scripts/database/apply_single_migration.sh` once per step. Each step SHALL be prechecked, applied atomically, independently verified and recorded with sanitized evidence before the next step begins.

#### Scenario: Stop on first failure
- **WHEN** `V096` and `V097` pass but `V098` fails
- **THEN** the result SHALL record `V096 PASS`, `V097 PASS`, `V098 FAIL`, `V099 NOT_ATTEMPTED` and SHALL not automatically rollback previously committed migrations

### Requirement: Target and evidence freshness are mandatory
A plan SHALL be bound to target identity and verified environment evidence from the operation that produced it. Immediately before execution, the orchestrator SHALL revalidate those inputs and SHALL invalidate a changed plan as `PLAN_STALE`.

#### Scenario: Target changes
- **WHEN** origin/develop or the authorized target changes after planning and before execution
- **THEN** execution SHALL stop before applying a migration and require plan recomputation

### Requirement: Authorization remains separate from planning
The system SHALL preserve `LOCAL -> QA -> PRD` ordering. A verified plan SHALL NOT authorize execution. QA approval/evidence SHALL be required before PRD, and PRD execution SHALL require explicit PRD authorization.

#### Scenario: Plan without authorization
- **WHEN** a plan is verified but QA approval or explicit PRD authorization is absent
- **THEN** the promotion path SHALL remain blocked and SHALL not invoke the runner

### Requirement: Strict mode enforces the governed promotion path
When strict governance is activated, the repository, CI and promotion path SHALL block acceptance of missing OpenSpec association, unsafe runners, unordered plans, unresolved gaps, DB-only drift, checksum mismatch, failed history, stale evidence, missing QA verification or missing PRD authorization. Legacy runners SHALL remain explicitly classified and SHALL not satisfy a governed post-cutover promotion.

#### Scenario: Unsafe runner in strict mode
- **WHEN** a governed post-cutover promotion requests a legacy or specialized bypass instead of the official runner
- **THEN** strict validation SHALL reject the promotion with `UNSAFE_RUNNER`

### Requirement: Governance rollback preserves database state
Rollback of governance enforcement SHALL be configuration- or gate-level only. It SHALL preserve migration files, schema, `migrations_history`, evidence and committed step results.

#### Scenario: Disable strict enforcement
- **WHEN** an operator rolls governance from strict to warning/diagnostic mode
- **THEN** enforcement SHALL be disabled without deleting history, replaying SQL, undoing schema or changing migration artifacts

### Requirement: Promotion contracts are testable
The implementation SHALL provide deterministic tests for planner states, ordered pending sets, gaps, dependencies, lag/drift, DB-only versions, checksum mismatch, failed history, manual execution, already-at-target, downgrade rejection, target freshness, stale concurrent candidates, authorization boundaries, stop-on-first-failure and strict runner enforcement.

#### Scenario: Complete local contract suite
- **WHEN** the planner and orchestrator contract tests run without network, SSH or database access
- **THEN** they SHALL prove the required blocking and sequencing behavior and SHALL distinguish pre-governance baseline evidence from post-cutover governance

### Requirement: Governed runner serializes authoritative database state
The official governed runner SHALL acquire a deterministic transaction-scoped PostgreSQL advisory lock for the database/schema/governance namespace using a bounded fail-fast policy. Lock acquisition, authoritative state assertions, migration SQL and `migrations_history` insertion SHALL use the same connection and transaction. The runner SHALL NOT create a persistent reservation or alter `NEXT_SAFE_VERSION` semantics.

#### Scenario: Lock unavailable
- **WHEN** another cooperative governed operation holds the destination lock
- **THEN** the runner SHALL return sanitized `PROMOTION_LOCK_UNAVAILABLE`, execute zero migration SQL and insert zero history rows, without indefinite waiting or automatic retry

### Requirement: Expected state is asserted under serialization
Before applying a post-cutover migration, the official runner SHALL revalidate database/schema identity, target absence, expected predecessor state/checksum, duplicate or failed history conditions and conflicting post-cutover state after acquiring the advisory lock and before migration SQL. The first governed migration SHALL use the explicit `V095` pre-governance boundary contract without requiring fabricated historical checksum certification.

#### Scenario: State changed after planning
- **WHEN** the destination predecessor, checksum, target presence or conflicting post-cutover state differs from the supplied expected-state contract
- **THEN** the transaction SHALL abort with a sanitized expected-state failure, execute no migration SQL and require fresh evidence plus a new plan

### Requirement: Transactional concurrency does not certify out-of-band writers
The advisory lock SHALL coordinate cooperative governed runner paths only. Legacy runners or direct administrator database access SHALL remain outside this serialization guarantee and SHALL be rejected by the governed strict promotion path; the system SHALL document this residual operational bypass risk.

#### Scenario: Partial plan recovery
- **WHEN** a later migration fails after earlier per-migration commits
- **THEN** successful commits SHALL remain, the lock SHALL be released per transaction, and recovery SHALL require fresh evidence and plan recomputation rather than blind resume or automatic rollback

### Requirement: Governed execution binds identity and exact bytes
The governed runner SHALL receive one validated execution binding covering the
canonical migration version/path, exact expected checksum, expected predecessor
contract and official runner identity. Independent mutation of one of those
fields SHALL fail closed before database mutation. The runner SHALL resolve the
canonical migration root, reject symlink/path substitution and non-regular files,
snapshot the validated bytes, recompute the checksum from that snapshot and use
the same snapshot for the authoritative transaction and history checksum.

#### Scenario: Path or byte substitution
- **WHEN** a migration path resolves outside the canonical root, is symlinked,
  or the bytes do not match the bound checksum
- **THEN** the runner SHALL reject before migration SQL or history insertion

#### Scenario: Snapshot execution
- **WHEN** the repository pathname changes after the validated snapshot exists
- **THEN** the authoritative transaction SHALL execute only the validated snapshot
  bytes and SHALL record that snapshot checksum in `migrations_history`

### Requirement: QA write-path certification is not a migration
The system SHALL expose a separately named `QA_WRITE_PATH_CERTIFICATION`
operation for local certification of the governed write boundary. It SHALL use
only repository-controlled allowlisted certification SQL, SHALL require QA
identity, SHALL reject PRD identity, SHALL not allocate or consume a `V###`
version, and SHALL never mutate canonical `migrations_history`.

#### Scenario: Certification cannot be confused with migration promotion
- **WHEN** a governed migration descriptor is supplied to the certification
  executor, or a certification descriptor is supplied to the migration runner
- **THEN** the receiving boundary SHALL reject it before SQL execution

### Requirement: Certification uses an immutable fixture and always rolls back
The certification executor SHALL snapshot the fixed certification fixture,
compute its exact-byte SHA-256, bind that checksum to the certification
descriptor, and execute those snapshot bytes in one PostgreSQL transaction.
The successful path SHALL make the synthetic write visible inside the
transaction and SHALL unconditionally `ROLLBACK`; no successful certification
commit path SHALL exist.

#### Scenario: Synthetic write disappears after certification
- **WHEN** a disposable local PostgreSQL certification runs with valid identity,
  binding, lock and expected state
- **THEN** the synthetic object SHALL be visible inside the transaction,
  absent from a fresh connection after rollback, and the operation SHALL report
  `PASS` only when all three observations are true

### Requirement: Certification preserves lock and history invariants
Certification SHALL acquire the same deterministic transaction-scoped advisory
lock namespace, assert database/schema identity and expected history fingerprint
after lock acquisition, and release the lock by rollback. It SHALL produce
sanitized external evidence containing operation, binding, snapshot checksum,
lock, assertion, in-transaction visibility, rollback and post-rollback checks.

#### Scenario: Certification leaves canonical history unchanged
- **WHEN** certification completes on a disposable database
- **THEN** the exact pre-certification `migrations_history` fingerprint SHALL
  match afterward and the certification SHALL not create a canonical history row
