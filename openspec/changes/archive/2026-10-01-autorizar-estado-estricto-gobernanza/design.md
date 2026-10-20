# Design

## Source of truth

Extend `scripts/governance/migration-baseline.json` with a repository-owned
`enforcement_state` object. Its durable mode is `WARNING` before the separately
authorized activation transition. `STRICT` is valid only with an explicit owner
activation marker. `DIAGNOSTIC_ONLY` remains an invocation/rollback mode,
not a durable activation state.

## Shared evaluation

Add a pure evaluator in `migration_runner_policy.py`. It validates the object,
returns a sanitized state, and rejects missing, malformed or contradictory
values. Diagnostic mode resolution uses this evaluator. Explicit `STRICT` is a
stronger request and remains valid for CI while durable state is `WARNING`.
When durable state is `STRICT`, `WARNING` and `DIAGNOSTIC_ONLY` requests cannot
downgrade it. An explicit owner rollback marker is the only downgrade path.

Promotion gates consume the same resolved state, with an explicit request
treated as a stronger request. The migration runner remains responsible for
cutover, checksum, binding, locking and transaction checks; it does not gain a
duplicate strict-mode parser.

## Activation and rollback

V095 remains `ACTIVE`. The owner-authorized activation transition changes only
the repository enforcement state and its owner marker; the current manifest is
now `STRICT`/`ACTIVE` with `EXPLICIT_OWNER_ACTIVATION`.
Rollback returns that state to `WARNING` through an explicit authorized
configuration action. Neither action changes SQL, schema, migration history,
V096 or V097. Cutover remains active in both states.

## Validation

Tests cover default WARNING, explicit CI STRICT, future durable STRICT,
downgrade rejection, malformed state, cutover independence and configuration-
only rollback. OpenSpec and repository strict validation continue to run with
the direct Node OpenSpec launcher when Windows command discovery fails.
