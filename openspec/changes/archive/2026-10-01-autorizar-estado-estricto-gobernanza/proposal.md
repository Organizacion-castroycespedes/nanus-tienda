# Authoritative strict governance state

## Why

V095 cutover is now active, but strict enforcement still depends on a caller
flag or `MANUS_GOVERNANCE_MODE` and has no durable repository state. This can
make diagnostics, promotion gates and future runtime callers disagree.

## What changes

- Add a repository-owned enforcement state to the existing governance baseline.
- Resolve default enforcement through one fail-closed evaluator.
- Preserve explicit CI `STRICT` requests while preventing silent downgrades of
  a future durable `STRICT` state.
- Keep V095 cutover and strict enforcement independent.
- Synchronize current documentation with active V095 cutover and partial
  historical certification.

## Boundaries

This change does not activate strict mode, execute migrations, access QA/PRD,
modify V096, create V097, alter `migrations_history`, or complete Task 11.4.
