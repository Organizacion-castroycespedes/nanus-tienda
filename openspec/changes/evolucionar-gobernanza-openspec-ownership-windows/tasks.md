## 1. Manifest contract

- [x] 1.1 Extend manifest parsing to accept version 2 and validate `current_ownership`, owner IDs, path patterns, reasons, and contradictions.
- [x] 1.2 Add the governance HU and explicit current owners for this diff and the P1 shared files without removing historical `changes[].paths`.

## 2. Coverage evaluator

- [x] 2.1 Evaluate one current owner before historical matches and report current and historical IDs separately.
- [x] 2.2 Preserve strict `MULTIPLE_MATCH`, `INVALID`, `ZERO_MATCH`, and exemption behavior when current ownership is absent or invalid.

## 3. Windows evidence

- [x] 3.1 Classify child-process `WinError 5` and equivalent access-denied output as a fail-closed OpenSpec runtime error.
- [x] 3.2 Add bound external-evidence validation for `HEAD`, manifest, changed-path fingerprint, change ID, and runtime version without promoting unverified evidence to strict `PASS`.

## 4. Tests and documentation

- [x] 4.1 Add deterministic tests for historical overlap, unique current ownership, duplicate owners, invalid owners, uncovered files, stale evidence, and Windows access denial.
- [x] 4.2 Document manifest version 2, ownership precedence, evidence binding, and the remaining CI/runtime requirement.
- [x] 4.3 Run focused tests, OpenSpec validation, JSON validation, `git diff --check`, and review staging preservation.
