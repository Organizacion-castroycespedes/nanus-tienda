## ADDED Requirements

### Requirement: Historical execution baseline is distinct from history certification
The governance SHALL preserve a `PRE-GOVERNANCE EXECUTION BASELINE` stating that all SQL files existing at the cut date were reported by the responsible project owner as executed in their corresponding environments, with some executed by runners and some manually. It SHALL distinguish `EXECUTED_LEGACY` from `HISTORY_CERTIFIED`.

#### Scenario: Legacy SQL absent from history
- **WHEN** a historical SQL file is absent from `public.migrations_history`
- **THEN** the governance SHALL classify it as unresolved legacy evidence and SHALL NOT infer that it was never executed

#### Scenario: Legacy SQL reported executed
- **WHEN** the owner baseline reports a historical SQL file as executed but history/checksum evidence is incomplete
- **THEN** the governance SHALL record `EXECUTED_LEGACY` and SHALL NOT label it `HISTORY_CERTIFIED`

### Requirement: Historical SQL is immutable during cutover
The cutover SHALL NOT reexecute historical SQL, rename applied migrations, reuse a historical number for a different meaning, modify existing SQL, or insert artificial history rows to fill evidence gaps. An explicit `MANUAL_APPLICATION_BASELINE_ADOPTION` is permitted only under the dedicated requirement below.

#### Scenario: Cutover sees V082/V083 drift
- **WHEN** historical duplicate numbers or filename/checksum drift are discovered
- **THEN** the governance SHALL create a separate reconciliation work item and SHALL not execute or rewrite those files

#### Scenario: Legacy SQL replay requested
- **WHEN** a cutover procedure would replay a historical manual SQL file
- **THEN** the procedure SHALL stop and report a historical-drift blocker

### Requirement: Manual application baseline adoption is explicit and atomic
When the owner confirms that a post-cutover migration's changes were applied manually before governed history was recorded, governance MAY adopt the already-applied state as `MANUAL_APPLICATION_BASELINE_ADOPTION`. Adoption SHALL require verified structural equivalence, deterministic seed reconciliation limited to the migration's declared contract, the canonical artifact checksum, and the real `migrations_history` schema. Adoption SHALL NOT claim governed-runner execution or historical byte-for-byte checksum provenance.

#### Scenario: Manual state is reconciled before adoption
- **WHEN** the owner confirms manual application, the required structure is equivalent, all declared deterministic keys are present, and divergences are limited to fields defined by the migration's seed/upsert contract
- **THEN** governance SHALL reconcile only those declared seed fields and SHALL prepare one adoption history row with explicit manual provenance

#### Scenario: Adoption and history are atomic
- **WHEN** seed reconciliation or the adoption history insert fails
- **THEN** the complete transaction SHALL roll back and SHALL leave neither a partial seed correction nor an adoption history row

#### Scenario: Adoption metadata is not execution evidence
- **WHEN** an adoption row is recorded with the canonical artifact checksum
- **THEN** its details SHALL identify `MANUAL_APPLICATION_BASELINE_ADOPTION`, distinguish owner assertion from technical provenance, and state that the row does not represent historical governed-runner byte-for-byte execution

#### Scenario: Unexpected state blocks adoption
- **WHEN** history already contains the version, structure diverges, a declared key is missing or unexpected, a functional seed field differs, or required write privileges are unavailable
- **THEN** adoption SHALL fail closed without DDL, replay, repair or history insertion

### Requirement: V096 owner-authorized canonical baseline identity is bounded
The governance record SHALL preserve the owner-authorized provenance for
`V096__electronic_billing_failure_detail.sql`: the original committed
transaction-wrapped bytes had exact SHA-256
`77d3a91a98d4904d71716e0c54fcd7978fdf6901601e443427912ea671d300a4`, and the
one-time pre-strict normalization removed only `BEGIN` and `COMMIT`, without
functional DDL change. The canonical adopted baseline identity SHALL be the
normalized exact-byte SHA-256
`a4cb2d5dd300e98f671deeb4f25a323c3dd0a783209149fb50f5fced195b75c7`.

#### Scenario: V096 adoption does not replay SQL
- **WHEN** V096 was already executed and recorded in QA during development/testing
  and the owner authorizes adoption of the normalized identity
- **THEN** `MANUAL_APPLICATION_BASELINE_ADOPTION` SHALL reconcile the existing
  applied state and SHALL NOT execute V096 again or claim governed-runner execution

#### Scenario: V096 normalization is a one-time boundary decision
- **WHEN** the normalized V096 identity is used for the pre-strict baseline
- **THEN** the decision SHALL NOT authorize additional V096 DDL changes, replay,
  renumbering, replacement, fabricated history or a generic manual-adoption bypass;
  future applied migrations SHALL remain exact-byte immutable

### Requirement: Governance cutover requires authorized reconciliation
The system SHALL not declare `GOVERNANCE_CUTOVER_APPROVED` until repository, target branch, and all required authorized environments have a documented reconciliation result, runner policy, gate policy and evidence decision for unresolved drift.

#### Scenario: Required environment unavailable
- **WHEN** Local, QA or PRD is required by policy but cannot be verified with authorized access
- **THEN** cutover SHALL remain unapproved and `NEXT_SAFE_VERSION` SHALL be `UNVERIFIED`

#### Scenario: Cutover approved
- **WHEN** all required sources are verified and blockers have an approved disposition
- **THEN** governance MAY declare `GOVERNANCE_CUTOVER_APPROVED`

### Requirement: Migration versions are unique across repository and integration target
Post-cutover migration filenames SHALL match `V###__description.sql`, numeric prefixes SHALL be unique across the repository and target branch, and legacy date filenames SHALL remain a separately classified compatibility path.

#### Scenario: Duplicate in one branch
- **WHEN** two SQL files use the same V### numeric prefix
- **THEN** repository validation SHALL reject the change

#### Scenario: Duplicate introduced by target branch
- **WHEN** another change adds the same V### to the target branch after a feature was created
- **THEN** the PR gate SHALL detect the union conflict and reject merge

### Requirement: Safe next version requires complete source verification
`migration-governance next` SHALL emit a V### candidate only after all policy-required sources are verified, no numeric or filename conflicts exist, cutover is approved, and the candidate is absent from repository, target branch and authorized environment histories. Otherwise it SHALL emit `NEXT_SAFE_VERSION=UNVERIFIED` with reasons.

#### Scenario: Repository-only maximum
- **WHEN** only local repository filenames are available
- **THEN** `next` SHALL return `NEXT_SAFE_VERSION=UNVERIFIED` and SHALL not use local maximum plus one as authority

#### Scenario: Verified candidate
- **WHEN** all required sources are verified and the candidate is absent everywhere checked
- **THEN** `next` SHALL report the candidate as a proposal with source evidence, not create a file

#### Scenario: First free version above the cutover
- **WHEN** `next` selects a candidate after an approved cutover
- **THEN** it SHALL select the numerically smallest `V###` strictly greater than
  `CUTOVER_BOUNDARY_VERSION` that is absent from the authoritative union of
  Repository, the current integration target and every policy-required authorized
  environment verified in the same controlled operation

#### Scenario: Authoritative union contains an occupied identity
- **WHEN** any required source reports a numeric migration identity, including a
  `DB_ONLY` identity
- **THEN** that identity SHALL be treated as occupied; historical identities at or
  below the boundary remain baseline evidence and SHALL NOT be replayed, renamed or
  renumbered

#### Scenario: Same-operation evidence is required
- **WHEN** a candidate is proposed using environment histories
- **THEN** the required live environment evidence SHALL be obtained in the same
  controlled calculation/revalidation operation; evidence from an earlier run may
  remain diagnostic but SHALL NOT certify the current candidate

#### Scenario: Candidate loses validity during integration
- **WHEN** Repository, the target branch or a required environment changes after a
  candidate proposal and before the relevant integration or execution checkpoint
- **THEN** the proposal SHALL be invalidated and the candidate SHALL be recalculated
  from a newly verified authoritative union; no reservation or placeholder SHALL be
  created

#### Scenario: Concurrent branches select the same candidate
- **WHEN** two branches independently observe the same free numeric identity
- **THEN** mandatory target revalidation at the integration point SHALL detect the
  resulting union conflict and reject or mark the proposal `UNVERIFIED`/`BLOCKED`
  according to the gate contract; this optimistic check SHALL NOT claim to eliminate
  all distributed races

#### Scenario: Safe selection prerequisites are incomplete
- **WHEN** the selection algorithm is not available, a required source is
  `UNVERIFIED`/`BLOCKED`, target revalidation fails, evidence is not current-operation
  live evidence, cutover is not approved, or a numeric/filename conflict exists
- **THEN** `next` SHALL return `NEXT_SAFE_VERSION=UNVERIFIED` or `BLOCKED` with
  reasons and SHALL not emit a safe proposal

### Requirement: PRD evidence collection SHALL cross an explicit executor boundary
PRD read-only evidence collection SHALL be separated from the governance
evaluator by an allowlisted `PRD_EVIDENCE_EXECUTOR` boundary. The evaluator SHALL
consume only sanitized structured evidence and SHALL NOT access private-key
contents or credential material.

#### Scenario: Authorized PRD evidence request
- **WHEN** governance requests PRD read-only evidence
- **THEN** the executor SHALL accept only the approved operation type, target
  environment, expected host/database/schema identities, operation correlation
  identifier and non-secret control metadata; arbitrary commands, arbitrary SQL,
  credentials and private-key contents SHALL be rejected

#### Scenario: Sanitized PRD evidence response
- **WHEN** the executor completes the approved read-only operation
- **THEN** it SHALL return structured sanitized evidence containing executor and
  operation status, environment, transport/host verification, database/schema
  identity, read-only verification, history availability/schema, approved
  version/checksum/success evidence, query/write counts and operation context,
  without credentials, key material, raw DSNs or unredacted runtime output

#### Scenario: PRD executor failure
- **WHEN** the executor is unavailable, transport/authentication fails, host or
  database identity mismatches, read-only state is not verified, history schema
  is unexpected, evidence is incomplete or malformed, redaction fails, or the
  operation correlation identifier does not match
- **THEN** governance SHALL return `UNVERIFIED` or `BLOCKED` with sanitized
  reasons and SHALL never infer a verified environment, QA approval, PRD
  promotion authorization, migration execution, cutover activation, reservation
  or safe next version

#### Scenario: Same-operation PRD evidence
- **WHEN** Task 10.5 uses PRD evidence to certify a candidate
- **THEN** the executor response SHALL carry the same controlled operation
  correlation identity as the calculation/revalidation, and evidence from
  another operation SHALL remain diagnostic-only and `UNVERIFIED`; no freshness
  TTL SHALL be invented

#### Scenario: Executor is not a deployment runner
- **WHEN** a caller requests migration execution, deployment, file mutation,
  permission change, package/service management, database write or arbitrary
  remote shell through the PRD evidence boundary
- **THEN** the request SHALL be rejected and the executor SHALL perform no
  mutation

#### Scenario: Contract-only executor integration
- **WHEN** the evaluator requests PRD evidence without an available authorized
  executor
- **THEN** the evaluator SHALL fail closed with `UNVERIFIED` and SHALL not use
  a direct credential-bearing SSH fallback; the contract boundary SHALL remain
  testable with injected deterministic fixtures only

#### Scenario: Operational process framing
- **WHEN** the specialized executor process is launched for a future authorized
  operation
- **THEN** it SHALL consume exactly one UTF-8 JSON request from stdin and emit
  exactly one UTF-8 JSON response on stdout, keep diagnostics separate on
  stderr, use a fixed entrypoint without `shell=True`, and fail closed on
  timeout, nonzero exit, malformed output or protocol mismatch

#### Scenario: Test fixture is not live evidence
- **WHEN** a local process fixture returns evidence for transport testing
- **THEN** its fixture provenance SHALL remain non-live and the evaluator SHALL
  reject it for PRD live certification

#### Scenario: Specialized read-only backend plan
- **WHEN** the authorized executor prepares the allowlisted PRD evidence
  operation
- **THEN** trusted runtime configuration SHALL provide the transport reference,
  while the backend SHALL build fixed SSH arguments and fixed read-only SQL;
  request fields SHALL NOT override host, executable, argv, remote command,
  key reference or SQL semantics

#### Scenario: Live provenance assignment
- **WHEN** the fixed transport returns one valid UTF-8 evidence payload after
  host, database, schema and read-only checks
- **THEN** only the backend code path SHALL assign
  `EXECUTOR_LIVE_READ_ONLY_EVIDENCE`; fixtures, requests and malformed output
  SHALL never be able to assign live provenance

#### Scenario: Migration evidence is preserved end to end
- **WHEN** a live response is marked `VERIFIED`
- **THEN** its sanitized migration rows SHALL survive process stdout, response
  parsing and evaluator consumption with version, checksum and success fields
  sufficient to derive occupied identities, duplicates, highest version,
  V095/V096 presence and post-V095 occupancy; status-only capture SHALL fail
  the Task 10.5d evidence contract

### Requirement: Central validation covers migration integrity
`migration-governance validate` SHALL verify OpenSpec database association, filename pattern, numeric uniqueness, target-branch conflicts, SHA-256 checksum policy, applied migration immutability, history compatibility and explicit SQL classification.

#### Scenario: Database migration without OpenSpec
- **WHEN** a diff adds or changes versioned database behavior without a covering database OpenSpec
- **THEN** validation SHALL reject the diff

#### Scenario: Applied migration changed
- **WHEN** a known applied migration has a different repository checksum after cutover
- **THEN** validation SHALL block the change and require a new migration or separate approved reconciliation

### Requirement: Versioned migrations use one official atomic path
Post-cutover versioned SQL SHALL use `scripts/database/apply_single_migration.sh`. The official runner SHALL own the sole PostgreSQL transaction boundary: SQL execution and insertion of `success=true` with the exact-byte SHA-256 checksum in `public.migrations_history` SHALL occur in that same transaction. A post-cutover migration SHALL NOT own an inner transaction boundary.

#### Scenario: SQL succeeds and history succeeds
- **WHEN** the official runner applies a valid migration
- **THEN** the same atomic operation SHALL leave the SQL applied and a matching successful history row

#### Scenario: SQL succeeds and history fails
- **WHEN** history registration fails after SQL execution begins
- **THEN** the transaction SHALL roll back where supported and the runner SHALL report failure without claiming the migration applied

### Requirement: Post-cutover transaction controls and runner configuration are fail-closed
The governed runner SHALL reject a post-cutover migration before database execution when its SQL contains transaction-control statements `BEGIN`, `START TRANSACTION`, `COMMIT`, `END`, `ROLLBACK`, `ABORT`, `SAVEPOINT` or `RELEASE`, after ignoring comments and quoted SQL content. The runner SHALL accept the standard `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` configuration contract, with optional `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` aliases taking explicit precedence when present. Configuration-name resolution SHALL NOT imply database privilege verification, and secrets SHALL NOT be emitted.

#### Scenario: Nested transaction control is rejected before database access
- **WHEN** a post-cutover migration contains a prohibited transaction-control statement outside comments or quoted content
- **THEN** the runner SHALL fail before invoking the database client and SHALL not create or update a history row

#### Scenario: SQL or history failure is atomic
- **WHEN** migration SQL fails or the successful history insertion fails within the runner transaction
- **THEN** the transaction SHALL roll back and the runner SHALL report failure without claiming `success=true` was committed

#### Scenario: Standard runtime configuration is accepted
- **WHEN** only the standard `DB_*` variables are supplied and no admin aliases are supplied
- **THEN** the runner SHALL resolve its connection configuration without printing secret values, while leaving privilege verification to the database operation

### Requirement: Migration classes are explicit
The governance SHALL classify versioned migration, seed, QA fixture, backfill, repair, rollback and read-only SQL. Only versioned migration execution SHALL require the post-cutover migration history contract.

#### Scenario: Seed or fixture
- **WHEN** SQL is classified as seed or QA fixture
- **THEN** it SHALL use its explicit controlled path and SHALL not be silently treated as a versioned migration

#### Scenario: Unclassified SQL runner
- **WHEN** a runner can execute schema or data SQL without a declared class
- **THEN** governance SHALL reject the runner for post-cutover use

### Requirement: Environment promotion is ordered and authorized
Migration promotion SHALL follow Local, then QA, then PRD. QA approval SHALL precede PRD. PRD execution SHALL require explicit authorization. An inaccessible mandatory environment SHALL produce `UNVERIFIED` or `BLOCKED`, never a silent bypass.

#### Scenario: QA not approved
- **WHEN** a PRD migration is requested without approved QA evidence
- **THEN** governance SHALL reject the PRD operation

#### Scenario: PRD unauthorized
- **WHEN** PRD access or approval is absent
- **THEN** governance SHALL not connect or execute and SHALL report the authorization blocker

### Requirement: Environment-aware evidence is safe
Environment-aware gates SHALL query only authorized metadata and `public.migrations_history`, SHALL not expose secrets, and SHALL report database identity, schema, version, checksum and success status in sanitized evidence.

#### Scenario: QA history drift
- **WHEN** QA contains DB-only versions, repo-only versions, duplicate numeric prefixes, failed rows or checksum drift
- **THEN** the gate SHALL report the drift and SHALL block operations that require a clean certified baseline

#### Scenario: Credential logging
- **WHEN** a command or gate produces diagnostic output
- **THEN** passwords, tokens and complete credential-bearing connection strings SHALL be redacted

### Requirement: Governance rollout is progressive
Governance SHALL support diagnostic mode, warning mode and strict enforcement. Historical drift remediation SHALL be performed only by separate OpenSpec work.

#### Scenario: Pre-cutover diagnostic mode
- **WHEN** cutover is not approved
- **THEN** status and validation MAY report findings but `next` SHALL remain `UNVERIFIED`

#### Scenario: Post-cutover strict mode
- **WHEN** cutover is approved
- **THEN** repository and authorized environment gates SHALL reject new violations
