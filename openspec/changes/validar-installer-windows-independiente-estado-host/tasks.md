## 1. Validation contract

- [x] 1.1 Extract pure inspect and status contract checks while preserving `serviceBinary` semantics; verify existing validator metadata assertions remain covered
- [x] 1.2 Remove host-clean service assertions and emit informational existing-service state; verify absent, installed-stopped, and installed-running mocked cases pass
- [x] 1.3 Reject malformed status and corrupt inspect metadata deterministically; verify focused negative tests pass

## 2. Guidance and verification

- [x] 2.1 Align README QA output-name guidance with internal `0.1.1-qa.13` versioning and verify custom filenames are documented as labels only
- [x] 2.2 Run strict OpenSpec validation, targeted tests, lint, TypeScript build, and safe non-mutating artifact validation; record unrelated failures separately
