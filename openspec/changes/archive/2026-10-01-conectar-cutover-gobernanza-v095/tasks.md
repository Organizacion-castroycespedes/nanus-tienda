## 1. Authoritative state

- [x] 1.1 Implement shared fail-closed V095 cutover-state loading and validation from `migration-baseline.json`.
- [x] 1.2 Add the narrow policy CLI contract for callers that must require `ACTIVE` without exposing secrets or arbitrary input.

## 2. Policy integration

- [x] 2.1 Wire diagnostic reporting and `cutover_evaluation()` to the shared state while preserving the inactive baseline.
- [x] 2.2 Require authoritative `ACTIVE` state in the official runner before any `POST_CUTOVER` database access.
- [x] 2.3 Preserve separate strict-mode behavior, historical replay prohibition, environment authorization and rollback semantics.

## 3. Deterministic validation

- [x] 3.1 Add tests for approved/inactive, active, not-approved and malformed/contradictory manifest states.
- [x] 3.2 Add runner-policy tests proving runtime variables cannot bypass inactive repository state.
- [x] 3.3 Add tests for strict-mode independence, rollback configuration and V096/V097 invariants.
- [x] 3.4 Run OpenSpec strict, repository strict gate, governance tests, runner contract, syntax checks and diff validation with cutover still inactive.
