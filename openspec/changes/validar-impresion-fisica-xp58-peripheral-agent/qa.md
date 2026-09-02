# XP-58 E2E QA plan

## Preconditions

- Windows queue `XP-58`, driver `XP-58`, type `Local`, port `USB001`.
- Windows Test Page physically printed.
- Installer SHA256 recorded and source version equals artifact version.
- Existing health identity and config backup captured.

## Automated gates

1. Backend tests and build.
2. Windows packaging tests and package validation.
3. Installer tests/validation if generated.
4. Web peripheral tests, lint and production build.
5. OpenSpec strict validation and `git diff --check`.

## Physical gates

1. Upgrade to the higher QA version. Never use repair.
2. Verify `/health`: REAL, exact QA version, stable identity.
3. Discover XP-58; verify USB/CONNECTED and no mocks.
4. Associate with `THERMAL_58MM`.
5. Direct test print and observe paper.
6. Web test print and observe paper.
7. POS print only after safe QA flow is documented.

## Evidence rule

HTTP success, adapter name and `bytesSent` are technical evidence only. Direct,
Web and POS acceptance stay NOT TESTED until a tester observes the physical
ticket and records the outcome in
`docs/evidencia-qa-xp58-peripheral-agent-e2e.md`.
