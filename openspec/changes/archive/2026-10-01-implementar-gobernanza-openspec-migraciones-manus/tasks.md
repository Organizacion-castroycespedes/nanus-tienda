## 1. Policy and authority cleanup

- [x] 1.1 Define the final Manus OpenSpec Mandatory Governance policy and classify covered technical changes.
- [x] 1.2 Review and update stale governance references in `AGENTS.md` without deleting historical evidence.
- [x] 1.3 Define and validate the narrow exception taxonomy with explicit exemption evidence.
- [x] 1.4 Document ownership boundaries between Manus-owned orchestration and generated `.codex/skills/openspec-*` skills.

## 2. Diff-to-OpenSpec association

- [x] 2.1 Inspect OpenSpec 1.4.0 supported metadata and `.openspec.yaml` behavior before selecting an association contract.
- [x] 2.2 Implement a repository-only association checker for diff paths, change-id and declared scope.
- [x] 2.3 Reject ambiguous, missing or unsupported associations and report the exact covering change-id.
- [x] 2.4 Add regression cases for code, API, database, runtime configuration and executable infrastructure changes.

## 3. Repository-only OpenSpec gates

- [x] 3.1 Add strict validation for the selected OpenSpec change.
- [x] 3.2 Add global strict validation while distinguishing the known pre-existing unrelated failure from new regressions.
- [x] 3.3 Add CI/PR enforcement for OpenSpec association before merge.
- [x] 3.4 Add `git diff --check` and changed-file boundary validation to the governance gate.

## 4. Migration governance diagnostics

- [x] 4.1 Define the canonical migration classification and allowed repository paths.
- [x] 4.2 Implement diagnostic `status` for repository, target branch and authorized environment sources.
- [x] 4.3 Report numeric duplicates, filename conflicts, DB-only/repo-only versions, success failures and checksum drift.
- [x] 4.4 Ensure inaccessible required sources produce `UNVERIFIED` or `BLOCKED` without bypass.

## 5. Version validation and concurrency

- [x] 5.1 Implement `validate` for `V###__description.sql`, legacy separation and numeric uniqueness.
- [x] 5.2 Compare feature migrations with the current target branch at PR time.
- [x] 5.3 Add regression coverage for two feature branches creating the same V###.
- [x] 5.4 Evaluate reservation or serialization only after measuring actual branch concurrency.

## 6. Official migration runner and atomicity

- [x] 6.1 Select and document the single official post-cutover migration runner.
- [x] 6.2 Normalize SQL execution and `public.migrations_history` registration into one transaction where supported.
- [x] 6.3 Define failure behavior for SQL failure, history failure, checksum mismatch, `success=false`, already applied and rollback.
- [x] 6.4 Classify or block finance, products, sale, seed, fixture, backfill, repair and direct `psql` paths that bypass governance.

## 7. Checksum and applied immutability

- [x] 7.1 Implement SHA-256 checksum validation for post-cutover versioned migrations.
- [x] 7.2 Detect modifications to migrations with certified applied history.
- [x] 7.3 Define handling for historical NULL, manual, bundle and non-standard checksum records without rewriting them.
- [x] 7.4 Add tests for applied migration mutation and checksum mismatch.

## 8. Pre-governance baseline and cutover

- [x] 8.1 Create a separate, owner-approved `EXECUTED_LEGACY` baseline evidence record without inventing per-file history.
- [x] 8.2 Keep `HISTORY_CERTIFIED` separate from `EXECUTED_LEGACY` and define evidence transitions.
- [x] 8.3 Define and approve `GOVERNANCE_CUTOVER_APPROVED` criteria for repository, target branch, QA and PRD sources.
- [x] 8.4 Keep `NEXT_SAFE_VERSION=UNVERIFIED` until cutover and required reconciliation are certified.

## 9. Environment-aware reconciliation

- [x] 9.1 Implement read-only Local and QA metadata reconciliation using existing authorized configuration only.
- [x] 9.2 Add PRD read-only reconciliation only after explicit authorization and secret-safe execution is established.
- [x] 9.3 Enforce Local → QA → PRD promotion order and QA approval before PRD.
- [x] 9.4 Produce sanitized evidence for identity, history schema, versions, checksums and success status.

## 10. Progressive CI/PR rollout

- [x] 10.1 Activate diagnostic reporting without blocking existing development.
- [x] 10.2 Activate warning mode with owner-visible violations and no historical SQL replay.
- [x] 10.3 Activate strict repository-only gates after false-positive review.
- [x] 10.4 Activate environment-aware gates only for verified and authorized environments.
- [x] 10.5 Enable `next` only after `GOVERNANCE_CUTOVER_APPROVED`.
- [x] 10.5a Implement the allowlisted PRD Evidence Executor boundary without
  exposing credential material to the governance evaluator.
- [x] 10.5b Integrate the executor with the sanitized evidence contract and
  governance evaluator, preserving fail-closed operation and same-operation
  correlation semantics.
- [x] 10.5c Add deterministic contract, security, malformed-response and
  unavailable-executor tests without live credentials.
- [x] 10.5d Perform the explicitly authorized PRD read-only live validation,
  including host/database/schema/read-only/history checks and sanitized output.
- [x] 10.5e Re-run Task 10.5 candidate validation only after the executor
  boundary and same-operation live evidence are certified; do not reserve or
  create a migration file.

## 11. Separate historical drift remediation

- [x] 11.1 Create a separate OpenSpec for V082/V083, V089, repo-only/DB-only and checksum drift reconciliation.
- [x] 11.2 Create a separate OpenSpec for any `success=false` or manual bundle disposition.
- [x] 11.3 Prove that historical remediation does not reexecute SQL, rename applied files, reuse meanings or insert artificial history.
- [x] 11.4 Archive this governance change only after policy, gates, cutover evidence and rollback procedures are accepted.

## 12. Verification and handoff

- [x] 12.1 Validate all governance requirements with repository-only regression tests.
- [x] 12.2 Validate authorized environment-aware checks with sanitized read-only evidence.
- [x] 12.3 Confirm no credentials, tokens or complete connection strings appear in logs or reports.
- [x] 12.4 Record final acceptance decision, residual risks and rollback/adoption instructions.
