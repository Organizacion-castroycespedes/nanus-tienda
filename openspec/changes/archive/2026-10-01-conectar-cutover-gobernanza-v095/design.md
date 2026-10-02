## Context

V095 is the approved numeric boundary between the pre-governance historical
baseline and governed post-cutover migrations. The baseline manifest already
stores approval and activation fields, but diagnostic reporting does not read
the activation field and the shell runner currently trusts runtime era and
approval variables independently. This change wires one repository-owned
state evaluator into both paths while keeping activation disabled.

## Goals / Non-Goals

**Goals:**

- Parse and validate the existing `cutover_boundary` object once in
  `migration_runner_policy.py`.
- Produce deterministic states: `NOT_APPROVED`, `APPROVED_NOT_ACTIVE` and
  `ACTIVE`.
- Make diagnostics and the governed runner consume that same state.
- Require both repository state `ACTIVE` and the existing runtime/environment
  authorization for future `POST_CUTOVER` execution.
- Fail closed on missing, malformed or contradictory state.
- Keep the current manifest approved but inactive.

**Non-Goals:**

- Activating V095 in this change.
- Enabling `MANUS_GOVERNANCE_MODE=STRICT` by default.
- Connecting to QA/PRD, executing migrations or changing `migrations_history`.
- Modifying V096, creating V097 or adding a reservation store.
- Changing the advisory lock, snapshot, checksum or transaction architecture.

## Decisions

1. **Shared evaluator in `migration_runner_policy.py`.** Add a pure loader and
   state evaluator for `migration-baseline.json`. It validates V095, approval,
   activation and the owner activation marker, and returns a sanitized state
   object. Diagnostics import it directly. The runner invokes a narrow CLI
   entrypoint from the same module so shell code does not duplicate JSON policy.

2. **Approval and activation stay separate.** `approved=true` with
   `activated=false` is `APPROVED_NOT_ACTIVE`. `ACTIVE` requires explicit
   owner activation metadata in addition to approval. Runtime variables remain
   additional authorization and cannot promote repository state.

3. **Runner fail-closed boundary.** A `POST_CUTOVER` runner request first asks
   the repository policy CLI for `ACTIVE`. Any non-zero result or non-active
   state blocks execution before database access. `PRE_GOVERNANCE` continues to
   reject historical replay. Existing environment identity, checksum, binding,
   advisory-lock and transaction checks remain unchanged.

4. **Strict independence.** `MANUS_GOVERNANCE_MODE` remains a separate mode
   resolver with default `WARNING`. CI may request repository `STRICT`; cutover
   activation does not change that default.

5. **Configuration-only rollback.** Future activation rollback sets the
   manifest back to the approved/inactive state and disables runtime
   `POST_CUTOVER` authorization. It does not reverse SQL, alter history or
   change database state. This change only tests the contract; it does not
   perform rollback or activation.

## Risks / Trade-offs

- [Runtime process cannot locate the repository manifest] → fail closed before
  database access; report a sanitized policy error.
- [Manifest fields disagree] → reject the state instead of selecting a
  permissive interpretation.
- [A privileged host administrator replaces the whole repository/process] →
  remains outside the software trust model and requires operational controls.
- [Shell-to-Python boundary adds a local dependency] → use the existing Python
  governance tooling and a fixed command/arguments, with no caller SQL or
  secret output.

## Migration Plan

1. Add the evaluator and CLI contract, with the existing manifest unchanged.
2. Wire diagnostic reporting and runner preflight to the evaluator.
3. Add deterministic tests for all state combinations, malformed state,
   rollback semantics and strict independence.
4. Validate OpenSpec, repository gate, runner contract, syntax and diff.
5. A later separately authorized activation may change only the authoritative
   activation state and runtime authorization after required evidence review.

## Open Questions

- The future activation owner must decide the exact controlled deployment
  mechanism for changing the manifest activation marker and runtime
  authorization together. This change defines the guard, not that operation.
