## Why

The repository records V095 as an approved governance boundary, but the
`activated` state is not consumed by the diagnostic and runner policy. This
leaves approval and activation vulnerable to contradictory configuration.

## What Changes

- Define one fail-closed, repository-authoritative V095 cutover state.
- Make diagnostics distinguish `NOT_APPROVED`, `APPROVED_NOT_ACTIVE` and
  `ACTIVE` from the same baseline state.
- Require authoritative activation before any `POST_CUTOVER` runner path,
  while preserving environment authorization as an additional control.
- Keep activation separate from `STRICT` mode and preserve the current
  inactive baseline during implementation.
- Add deterministic tests for activation, malformed state, rollback semantics,
  historical replay protection and strict-mode independence.

## Capabilities

### New Capabilities

- `authoritative-cutover-state`: Defines and evaluates the repository-owned
  approval/activation state for the V095 governance boundary.

### Modified Capabilities

- None. Existing migration-governance requirements are preserved; this change
  supplies the missing authoritative state wiring.

## Impact

- `scripts/governance/migration-baseline.json`
- `scripts/governance/migration_runner_policy.py`
- `scripts/governance/openspec_governance_diagnostic.py`
- `scripts/database/apply_single_migration.sh`
- Focused governance and runner contract tests and governance documentation.
- No database, QA, PRD, migration SQL or deployment environment changes.
