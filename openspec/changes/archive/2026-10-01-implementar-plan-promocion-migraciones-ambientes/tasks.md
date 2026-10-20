## 1. Phase A - Contract and repository alignment

- [x] 1.1 Confirm the existing `next_safe_version_evaluation()` contract, V095 boundary and historical replay protections without changing their semantics.
- [x] 1.2 Define the typed, sanitized environment-state model for Repository, Target and destination evidence, including identity, freshness, correlation, versions, checksums, success, duplicates and provenance.
- [x] 1.3 Define deterministic planner result states and reason codes for verified plan, already-at-target, promotion lag, evidence failure, drift, gap, checksum mismatch, manual execution, failed history and unsupported downgrade.
- [x] 1.4 Define the planner input/output contract as pure and side-effect free, separate from authorization, runner invocation and database mutation.
- [x] 1.5 Define the exact relationship between this change, the main governance change and the two historical follow-up OpenSpecs; preserve Task11.4 and Task12.4 as external acceptance gates.

## 2. Phase B - Pure promotion-plan evaluator

- [x] 2.1 Implement the verified destination-state evaluator without network, SSH, database I/O or file mutation.
- [x] 2.2 Implement ordered pending-set derivation for every governed post-cutover migration from destination state to requested target.
- [x] 2.3 Implement fail-closed version-gap detection while excluding pre-governance anomalies at or below V095 from post-cutover contiguous repair.
- [x] 2.4 Implement predecessor/order validation and the smallest dependency metadata mechanism required by actual migration semantics.
- [x] 2.5 Implement promotion-lag versus blocked-drift classification, including unknown DB-only versions and repository-only pending versions.
- [x] 2.6 Implement exact-byte checksum and applied-immutability validation for every migration relevant to a plan.
- [x] 2.7 Implement blocked handling for `success=false`, manual execution without governed history, duplicate numeric versions and unverifiable evidence.
- [x] 2.8 Implement `ALREADY_AT_TARGET` and `UNSUPPORTED_DOWNGRADE` behavior without replay or reverse SQL.

## 3. Phase C - Ordered orchestration boundary

- [x] 3.1 Define an orchestration adapter that accepts only a verified promotion plan and never embeds arbitrary SQL or generic shell execution.
- [x] 3.2 Integrate one plan step at a time with `scripts/database/apply_single_migration.sh`, preserving SQL+history atomicity and exact checksum handling.
- [x] 3.3 Add precheck and post-application verification for every migration step with sanitized per-step evidence.
- [x] 3.4 Implement stop-on-first-failure semantics and explicit `NOT_ATTEMPTED` results for all later steps.
- [x] 3.5 Define resume/recovery behavior for partially committed plans without automatic rollback of successful database migrations.

## 4. Phase D - Freshness, authorization and strict enforcement

- [x] 4.1 Bind plans to target identity/SHA, environment evidence, correlation and freshness, then revalidate immediately before execution.
- [x] 4.2 Invalidate stale plans when target, destination state, checksum or required evidence changes.
- [x] 4.3 Add the selected concurrency strategy for stale candidates, documenting residual race behavior and any deferred reservation/lock mechanism.
- [x] 4.4 Enforce `LOCAL -> QA -> PRD` ordering and keep planning separate from QA approval and explicit PRD authorization.
- [x] 4.5 Define repository, CI and promotion-path strict gates for missing OpenSpec association, unsafe runner, unordered plan, gap, drift, stale evidence and missing authorization.
- [x] 4.6 Classify legacy and specialized runners so they cannot satisfy a governed post-cutover promotion path without deleting their permitted historical/specialized uses.
- [x] 4.7 Define configuration-only rollback of governance enforcement without mutation of migrations, schema or `migrations_history`.

### 4.1B Transactional concurrency closure

- [x] 4.8 Extend the official runner with a deterministic, transaction-scoped advisory lock for the database/schema/governance namespace; keep the lock fail-fast and reservation-free.
- [x] 4.9 Add trusted expected-state inputs and repeat database/schema, predecessor, checksum, target-absence and conflict assertions inside the same transaction as migration SQL and `migrations_history` insertion, preserving the V095 boundary contract.
- [x] 4.10 Add deterministic runner, planner and orchestrator contract tests for lock failure, expected-state failure, lock/transaction composition, propagation, sanitization and no retry/reservation behavior.
- [x] 4.11 Run controlled PostgreSQL integration tests for concurrent sessions, lock lifecycle, rollback and connection loss using the disposable local harness in `scripts/governance/test_postgres_concurrency.py`; no QA/PRD access substitutes for this evidence.
- [x] 4.12 Bind the governed execution descriptor to canonical migration identity, expected state and checksum; reject symlink/path substitution and execute only a validated exact-byte snapshot.
- [x] 4.13 Add deterministic path, stale-checksum, descriptor-binding and snapshot-boundary regression tests without changing planner or database concurrency semantics.
- [x] 4.14 Define `QA_WRITE_PATH_CERTIFICATION` as a separate always-rollback operation that cannot consume canonical migration versions or mutate `migrations_history`.
- [x] 4.15 Implement the fixed-fixture certification executor with QA-only identity checks, immutable snapshot/binding, advisory lock and post-lock assertions.
- [x] 4.16 Add deterministic certification security tests for environment, version, SQL, path, binding and cross-mode isolation.
- [x] 4.17 Add disposable local PostgreSQL certification tests for write visibility, unconditional rollback, history fingerprint preservation and lock release.
- [x] 4.18 Validate certification capability and existing migration/concurrency regressions without QA/PRD execution.

## 5. Phase E - Deterministic validation and controlled evidence

- [x] 5.1 Add unit tests for ordered pending sets, already-at-target, downgrade rejection, gaps and predecessor violations.
- [x] 5.2 Add unit tests for promotion lag, DB-only drift, repository-only pending state, duplicate versions and historical V095 isolation.
- [x] 5.3 Add unit tests for checksum mismatch, applied immutability, failed history and manual execution unverified states.
- [x] 5.4 Add unit tests for target changes, freshness/correlation failures, stale plans and concurrent branch candidates.
- [x] 5.5 Add orchestration tests for per-step atomic runner integration, stop-on-first-failure, post-step verification and later-step `NOT_ATTEMPTED`.
- [x] 5.6 Add authorization and strict-gate tests proving a verified plan cannot execute without required QA/PRD approvals.
- [x] 5.7 Run repository-only validation, OpenSpec strict validation and existing governance/executor tests; separate pre-existing failures from regressions.
- [x] 5.8 Perform a separately authorized QA validation of the planner/evidence contract without mutating QA; require separate authorization before any PRD validation.

## 6. Phase F - Activation readiness and handoff

- [x] 6.1 Audit that the normal LOCAL -> QA -> PRD path cannot skip, reorder or replay governed post-cutover migrations.
- [x] 6.2 Audit that legacy runners are rejected by the governed strict path while historical baseline handling remains unchanged.
- [x] 6.3 Document activation prerequisites, residual concurrency risk, per-step evidence and configuration-only rollback.
- [x] 6.4 Hand off the verified results to the main governance change for a new Task12.4 review; do not activate strict mode automatically.
- [x] 6.5 Obtain explicit owner acceptance before any cutover/strict activation or archival of the main governance change.
