## 1. Authoritative state

- [x] 1.1 Add and validate repository-owned enforcement state in the existing baseline manifest.
- [x] 1.2 Implement shared fail-closed resolution with explicit stronger-request and downgrade rules.

## 2. Consumer integration

- [x] 2.1 Wire diagnostics and promotion gates to the shared enforcement evaluation.
- [x] 2.2 Preserve runner ownership boundaries and explicit CI strict behavior.
- [x] 2.3 Synchronize current V095-active documentation without changing historical evidence semantics.

## 3. Validation

- [x] 3.1 Add tests for WARNING, explicit STRICT, durable STRICT, malformed state and downgrade rejection.
- [x] 3.2 Add tests for cutover/strict independence, rollback and V096/V097 invariants.
- [x] 3.3 Run OpenSpec strict, repository strict gate, governance tests, syntax checks and runner compatibility validation.
