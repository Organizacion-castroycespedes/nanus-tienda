# Manus governance diagnostics

`openspec_governance_diagnostic.py` is the first diagnostic-only Manus-owned
repository utility.

## Scope manifest

`openspec-scope.json` is a Manus-owned sidecar. It does not modify or extend
OpenSpec `.openspec.yaml` schema. Version `1` has only:

- `changes`: active change declarations;
- `change_id`: existing kebab-case OpenSpec directory;
- `paths`: exact paths or directory descendants ending in `/**`;
- `exemptions`: optional `{path, reason}` records.

Patterns are relative and portable. They cannot contain `..`, broad wildcards,
or implicit exclusions. A technical file with zero matches is `ZERO_MATCH`;
one usable strict-valid change is `SINGLE_MATCH`; multiple matches are
`MULTIPLE_MATCH`; an exemption covering technical content is
`INVALID_EXEMPTION`.

It reports:

- selected OpenSpec status and strict validation;
- the known global OpenSpec baseline failure separately from new failures;
- observed `.openspec.yaml` metadata and the absence of native scope metadata;
- a future external association contract at `scripts/governance/openspec-scope.json`;
- `git diff --check` and changed-file boundary findings;
- repository-only SQL classification.
- repository, target branch and authorized-source status. `VERIFIED` means
  verified evidence of the stated kind; `DOCUMENTARY_ONLY` never means live
  database verification; `UNVERIFIED` and `NOT_REQUIRED` never become PASS by
  accident.

It does not connect to a database, execute SQL, run migration runners, assign a
V### or modify files. Durable repository enforcement is stored in
`migration-baseline.json` and is currently `STRICT` by explicit owner activation;
CI also requests explicit `STRICT`. `DIAGNOSTIC_ONLY` remains an
invocation/rollback mode.

Migration checks compare the feature evidence against a locally available target
ref. Re-running against an updated target detects concurrent-branch collisions.
Reservation or distributed serialization is intentionally
`DEFERRED_UNTIL_MEASURED`.

## Official migration path

`scripts/database/apply_single_migration.sh` is the official path for a
future `VERSIONED_MIGRATION`. It accepts only a file below
`scripts/database/migrations/` with `V###__description.sql` format, validates
the target guard and refuses an already recorded, failed or checksum-mismatched
row. It invokes PostgreSQL with `--single-transaction` so SQL and the
`success=true` history insert commit or roll back together when PostgreSQL
supports the operation. `MIGRATION_DRY_RUN=YES` validates and reports without
executing SQL.

`migrate.sh`, `run_migrations.sh` and `migrate_prd.sh` remain legacy/bootstrap
compatibility paths until later rollout work. Finance, products and sale
runners are legacy non-versioned paths. `seed.sh`, fixture, backfill, repair,
rollback and read-only SQL keep their explicit classes. None of these classes
may masquerade as a post-cutover versioned migration.

The repository-only contract is exposed by
`scripts/governance/migration_runner_policy.py`. It does not connect to a
database and does not activate cutover.

## Checksum contract

Governed versioned migrations use lowercase hexadecimal SHA-256 over the exact
file bytes. No line-ending, encoding, whitespace or comment normalization is
performed. The calculated value is distinct from history certification:
`VERIFIED_MATCH` requires an authoritative `success=true` history value;
missing, NULL, malformed or legacy values are `HISTORICAL_UNVERIFIED`.
Different certified values are `CHECKSUM_MISMATCH` and an immutability
violation. The runner never overwrites history and never replays a file to
repair evidence.

## Baseline and cutover

`migration-baseline.json` is the owner-reported pre-governance evidence
record. It says `EXECUTED_LEGACY_REPORTED`; it does not contain per-file
checksums, applied timestamps, users or fabricated history rows. Missing
history is unresolved evidence, not proof of non-execution.

The current owner-directed historical boundary is `V095`. It is a numeric
boundary for the pre-governance era, not a canonical `V095` file. All
historical duplicate identities at or below that boundary remain
`PREEXISTING_BASELINE` and are not renamed, replayed or certified retroactively.
The manifest records owner approval separately from activation. The current
record is `CUTOVER_BOUNDARY=V095`, `CUTOVER_APPROVED=YES`,
`CUTOVER_ACTIVATED=YES` and `CUTOVER_STATE=ACTIVE`; it stores only the exact
owner statement `APRUEBO EL CUTOVER V095` and does not store a person, email
or fabricated timestamp. A PRD snapshot is evidence only and is not live PRD
verification.

For the initial V095 boundary, the required source set is repository, target,
QA and the operator-accepted PRD snapshot. Local is explicitly
`NOT_REQUIRED` for this cutover because the repository has no persistent Local
instance or authorized Local configuration. This does not remove Local from
the future promotion model; it only avoids inventing Local evidence for this
baseline boundary.

Repository, QA and PRD-snapshot historical anomalies are each classified as
`PREEXISTING_HISTORICAL_BASELINE`, with `HISTORY_CERTIFICATION_STATUS=PARTIAL`.
Their remediation remains a separate OpenSpec change.

## Environment evidence contract

`build_environment_evidence` in `openspec_governance_diagnostic.py` is the
shared Manus-owned evidence shape for authorized environment reconciliation.
It keeps only sanitized identity (`environment`, `current_database`,
`schema`), public history schema metadata, and migration fields needed for
governance: raw `version`, optional `filename`/`path`, `success`, and
`checksum`. It deliberately drops `applied_by`, `details`, connection strings,
passwords and tokens.

Checksum classifications are diagnostic only: `MISSING`,
`LEGACY_UNVERIFIED`, `MALFORMED_UNVERIFIED`, `SHA256_FORMAT_CANDIDATE`,
`VERIFIED_MATCH_CANDIDATE` and `CHECKSUM_MISMATCH`. A candidate is not
`HISTORY_CERTIFIED` without authoritative history verification. Missing rows
never mean `NOT_EXECUTED`; `success=false` remains review evidence.

The repository has an existing QA runtime source at
`backend-reporteria/.env`; the contract accepts injected read-only rows for
tests and uses that file only at runtime. It does not copy or version secrets
and does not invent a DSN. Local remains
`NOT_REQUIRED` for the approved V095 boundary, and the PRD snapshot remains
`DOCUMENTARY_ONLY`.

The optional `--qa-read-only` diagnostic now uses the existing
`backend-reporteria/.env` at runtime. It requires `DB_NAME=manus_tienda_qa`,
opens two PostgreSQL `READ ONLY` transactions, verifies database/schema and
`public.migrations_history`, and selects only `version`, `checksum` and
`success`. It stores the password only in the subprocess environment as
`PGPASSWORD`; it never prints or persists the value. A normalized-basename
repository/QA comparison is diagnostic only. It reports repo-only, DB-only,
duplicates and checksum drift without certifying or repairing historical data.

When QA evidence is supplied to `diagnostic_report`, the main machine-readable
report exposes `environment_reconciliation` with numeric duplicates,
`filename_path_conflicts`, `identity_not_comparable`, repo-only and DB-only
identities, failed rows and checksum drift. Missing filename/path data is
reported as not comparable; it is never invented from a numeric version.
Historical findings remain `PREEXISTING_HISTORICAL_BASELINE`.

PRD reconciliation is a separate explicitly authorized operation. The
`prd_read_only_reconcile` function now consumes the explicit boundary in
`prd_evidence_executor.py`. Its request is versioned and allowlisted, and its
response is sanitized, correlated and fail-closed. The evaluator does not
construct SSH commands, read private-key contents or receive credential
material. The current 10.5a-10.5c implementation accepts only an injected
executor for deterministic tests; an authorized OS credential-bearing executor
and live PRD evidence remain deferred to 10.5d. There is no fallback to the old
direct Python SSH path. The operator snapshot remains
`OPERATOR_ACCEPTED_SNAPSHOT_NOT_LIVE`.

The future executor may load the remote reporteria `.env` only on PRD, verify
host/user and DB identity, establish `READ ONLY` state, read only the approved
history contract and return sanitized evidence. It must preserve host-key
verification and never expose the key or runtime secrets.

The specialized process entrypoint is `prd_evidence_executor.py --process`.
It accepts one UTF-8 JSON request on stdin and emits one UTF-8 JSON response on
stdout. The launcher uses a fixed argv, `shell=False`, separate stderr capture
and timeout handling. The request cannot select an executable, argv, command,
SQL or credential. The current backend returns `UNVERIFIED` because no live OS
credential-bearing backend is installed in this slice. Local fixture output is
marked non-live and cannot satisfy PRD evidence validation.

The specialized backend plan uses trusted runtime names `PRD_SSH_EXECUTABLE`,
`PRD_SSH_TARGET_HOST`, `PRD_SSH_PORT`, `PRD_SSH_USER`, `PRD_SSH_KEY_PATH`,
`PRD_REMOTE_ENV_PATH`, `PRD_EXPECTED_HOSTNAME`, `PRD_EXPECTED_DATABASE` and
`PRD_EXPECTED_SCHEMA`. The key path is opaque and is never opened by the
evaluator. The backend builds fixed SSH argv and a fixed `bash -s` read-only
collector. It loads the remote `.env` only inside that fixed collector, runs
only the internal PostgreSQL evidence query, and emits one marked UTF-8 JSON
payload. These names are trusted runtime configuration, not request fields.

Live transport is opt-in with `PRD_EVIDENCE_EXECUTOR_ENABLE_LIVE=YES` and is
not executed by local tests. Missing runtime configuration or any transport,
identity, schema, marker, read-only or exit failure returns `UNVERIFIED`.

The response allowlist preserves only migration evidence needed by governance:
`version`, `checksum`, `success` and optional filename/path metadata. The
evaluator derives row count, failed rows, occupied versions, duplicates,
highest version, V095/V096 presence and post-V095 versions. A `VERIFIED`
response carrying only status and correlation is incomplete and cannot certify
Task 10.5d.

`promotion_evaluation` is the pure policy evaluator for the future
`LOCAL -> QA -> PRD` flow. It requires verified source status, explicit
`qa_approved` before PRD, and separate `explicit_prd_authorization`. The
`PRD_READ_ONLY_RECONCILIATION` operation is never treated as migration
promotion. Missing or unverified sources return `UNVERIFIED` or `BLOCKED`.
The evaluator is diagnostic-only here: it never executes SQL, activates
cutover, or authorizes a runner call.

The policy keeps these states separate:

- `PRE_GOVERNANCE_EXECUTED_LEGACY` with `HISTORICAL_REPLAY_PROHIBITED`;
- `HISTORY_CERTIFIED` only when an authoritative successful history checksum
  matches;
- `POST_CUTOVER_STRICT` only after boundary definition, required source
  reconciliation, explicit approval and activation.

Cutover approval is recorded separately from activation. The current V095
state is `ACTIVE`; the official runner still defaults to `PRE_GOVERNANCE` and
refuses an executor call unless explicit post-cutover authorization is supplied.
`NEXT_SAFE_VERSION` remains `UNVERIFIED`. No database or history data is
changed by this policy.

The OpenSpec executable is resolved from `OPENSPEC_COMMAND` when provided, or
from `openspec.cmd` on Windows and `openspec` elsewhere. If the executable is
not visible to the process, the report emits `TOOL_UNAVAILABLE`; it never
pretends validation passed.

## Current governance handoff

Final governance handoff is owner-accepted. This section records repository
evidence for the authorized archival bookkeeping.

## Local QA write-path certification

`QA_WRITE_PATH_CERTIFICATION` is a separate, fail-closed capability in
`scripts/governance/qa_certification.py`. It is not a migration runner and it
does not use `ENVIRONMENT_PROMOTION_PLAN` to invent a pending migration.

The operation accepts no SQL, migration version, fixture path or runner name
from the caller. Its repository-controlled fixture creates only
`public.governance_certification_probe_v1` inside one PostgreSQL transaction.
It acquires the same deterministic advisory transaction lock, checks database,
schema and the pre-operation `migrations_history` fingerprint, proves the
synthetic write is visible, then executes an unconditional `ROLLBACK`.

The private snapshot checksum and certification binding cover the operation,
fixture identity, database/schema, history fingerprint, executor and
correlation. A fresh connection must observe the synthetic object absent, the
history fingerprint unchanged and the advisory lock available again.

The local harness only allows loopback disposable databases named with the
`manus_governance_qa_` prefix. The future real-QA interface requires explicit
operator authorization, `ENVIRONMENT=QA`, `DB_NAME=manus_tienda_qa` and
`public`; PROD is rejected. Certification never inserts, updates, deletes or
truncates `migrations_history`, never allocates `V###`, and never proves
`HISTORY_CERTIFIED`. It is not QA promotion and does not replace owner
authorization or PRD validation.

- Historical boundary: `V095`, `CUTOVER_STATE=ACTIVE`.
- Historical status: `EXECUTED_LEGACY_REPORTED`; `HISTORY_CERTIFICATION_STATUS=PARTIAL`.
- Historical replay, renumbering, overwrite and synthetic history remain prohibited.
- `V096` is occupied in Repository, Target and QA. QA uses
  `MANUAL_APPLICATION_BASELINE_ADOPTION`; PRD remains promoted through `V095`.
- V096 provenance is owner-authorized and bounded: the original committed
  transaction-wrapped bytes were SHA-256
  `77d3a91a98d4904d71716e0c54fcd7978fdf6901601e443427912ea671d300a4`, while
  the current canonical adopted baseline removes only `BEGIN`/`COMMIT` and has
  exact SHA-256
  `a4cb2d5dd300e98f671deeb4f25a323c3dd0a783209149fb50f5fced195b75c7`.
  QA had already executed and recorded V096; the later
  `MANUAL_APPLICATION_BASELINE_ADOPTION` reconciled that existing state and did
  not replay V096. This is not a general migration-immutability exception.
- `V097` is a verified next-version candidate only. It is not reserved, created or
  executable.
- Official post-cutover runner: `scripts/database/apply_single_migration.sh`.
- New migrations require an active strict-valid OpenSpec, target revalidation,
  exact-byte SHA-256 and the atomic SQL/history runner contract.
- Promotion remains `LOCAL -> QA -> PRD`; QA approval and explicit PRD
  authorization are separate requirements.
- PRD evidence requires the allowlisted `PRD Evidence Executor`, sanitized
  correlated response, verified identity and READ ONLY state. The evaluator
  never reads credential material.
- Follow-up historical work is separate:
  `reconciliar-drift-historico-pre-gobernanza` and
  `disponer-historial-fallido-y-bundles-manuales`.

Rollback is configuration-only: return enforcement from `STRICT` to `WARNING`
or `DIAGNOSTIC_ONLY`. Rollback does not replay SQL, delete migrations, mutate
`migrations_history` or undo database state. Stop on identity mismatch, missing
evidence, checksum drift, unsafe runner, unauthorized promotion or any request
to repair historical baseline automatically.

Final governance handoff and archival are separate lifecycle actions. Owner
acceptance and strict activation are complete. Current state is
`CUTOVER_ACTIVATED=YES` and `STRICT_MODE_ACTIVE=YES`.

The repository-owned cutover state is evaluated by
`migration_runner_policy.py` from `migration-baseline.json`. It distinguishes
`NOT_APPROVED`, `APPROVED_NOT_ACTIVE` and `ACTIVE`; runtime variables cannot
promote an inactive repository state. The official runner requires the shared
evaluator to return `ACTIVE` before accepting `MIGRATION_GOVERNANCE_ERA=POST_CUTOVER`
and `GOVERNANCE_CUTOVER_APPROVED=YES`. The current baseline is `ACTIVE`; this
state does not replace the runner's separate environment, checksum, binding,
lock or authorization gates.

Future cutover changes require an explicit owner activation or rollback marker
in the same manifest state and the separate runtime/environment authorization.
Cutover rollback returns the manifest and runtime policy to the
inactive/pre-governance state; it never replays SQL or changes schema/history.
This cutover state is separate
from `MANUS_GOVERNANCE_MODE`; strict mode remains independently controlled and
is currently active through the repository-authoritative state.

The durable enforcement state is the `enforcement_state` object in the same
baseline manifest. Current values are `mode=STRICT`, `status=ACTIVE`,
`owner_activation=EXPLICIT_OWNER_ACTIVATION` and `rollback=NOT_REQUESTED`.
An explicit CI `STRICT` request remains compatible with the durable state. If a
durable state is `STRICT`, ordinary WARNING or
DIAGNOSTIC_ONLY requests fail closed; only an explicit owner rollback marker
may return enforcement to WARNING. This state does not change active V095.

## Repository-only strict gate

Task 10.3 adds an explicit, reversible `STRICT` evaluator. It checks only
repository and target evidence: OpenSpec coverage/strict validation, governed
filenames, numeric uniqueness, target collisions, migration classification and
authoritative post-cutover immutability findings. It does not connect to Local,
QA or PRD, and it does not replace `promotion_evaluation`.

The result is machine-readable: `PASS`, `STRICT_REJECTED` or
`TECHNICAL_FAILURE`, with deterministic `reasons`, blocking findings and
non-blocking findings. CLI exit codes are `0` for pass, `2` for a strict
governance rejection and `1` for technical failure or invalid configuration.
Environment evidence is explicitly outside this gate and remains
`UNVERIFIED` until Task 10.4.

The durable mode is `STRICT`. An explicit `STRICT` request remains valid for CI
and controlled evaluation. A durable `STRICT` state cannot be silently
downgraded by `MANUS_GOVERNANCE_MODE=WARNING` or `DIAGNOSTIC_ONLY`; rollback
requires the explicit owner rollback state. All rollback is configuration-only.
Strict evaluation never enables migration execution, historical SQL replay,
promotion bypass or `NEXT_SAFE_VERSION`.

Findings already classified as `PREEXISTING_HISTORICAL_BASELINE` remain visible
but non-blocking. This includes the approved V095 baseline anomalies. A new
repository regression is still blocking even when its numeric version is at or
below V095 if authoritative repository evidence identifies it as new.

## Environment-aware gate policy (Task 10.4 Phase A)

`environment_gate_evaluation` and `combined_environment_gate_evaluation` are
pure evaluators. They consume sanitized evidence and never connect to a
database, read an `.env`, execute SQL or authorize a runner call.

Environment results are `VERIFIED`, `UNVERIFIED` or `BLOCKED`. Documentary PRD
snapshot evidence cannot satisfy a PRD live requirement. Identity mismatch,
missing authorization and blocked schema evidence fail closed. Missing or
unverified required sources remain non-certifying. `promotion_evaluation`
remains the authority for promotion order, QA approval and explicit PRD
authorization; the combined result cannot authorize migration execution.

The OpenSpec does not define a freshness TTL or timestamp window. The policy
therefore records `UNSPECIFIED_BY_OPENSPEC`; supplied `STALE`, `UNKNOWN` or
`UNVERIFIED` freshness remains non-certifying. No timestamp or TTL is invented.

The V095 historical boundary keeps `Local=NOT_REQUIRED`. Future promotion
flows may require Local evidence. Environment-aware enforcement remains
separate from durable strict state: `STRICT` is current, and
`NEXT_SAFE_VERSION` remains `UNVERIFIED`.

## Next-version policy (Task 10.5B)

`next_safe_version_evaluation` is a pure, no-I/O policy evaluator. It uses
`FIRST_FREE_VERSION_ABOVE_CUTOVER_FROM_AUTHORITATIVE_UNION`: the smallest
`V###` strictly above the approved boundary and absent from Repository, the
current Target and every required verified environment. `DB_ONLY` identities
also occupy the numeric namespace; repository-only `MAX+1` is not authority.

Required live environment evidence must be marked `LIVE` and
`same_operation=true` when current-operation evidence is required. Target
revalidation is also explicit. Missing, stale, previous-run or unverified
evidence returns `UNVERIFIED`; blocked governance or an unapproved cutover
returns `BLOCKED`.

The result is only a proposal. It creates no reservation or file, and it never
authorizes promotion or migration execution. A changed authoritative union
invalidates the proposal and requires recalculation. `V095` remains a numeric
historical boundary, not a canonical file, and `NEXT_SAFE_VERSION` remains
`UNVERIFIED` until the later same-operation live validation phase.
