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
6. Web UI/terminal integration is deferred to a follow-up change.
7. SALE print is certified through `/printer/print-ticket`; POS UI flow is deferred.
8. Cash drawer API and physical opening are certified; autocut remains out of scope.

## Evidence rule

HTTP success, adapter name and `bytesSent` are technical evidence only. Direct
Agent and SALE API acceptance are complete after physical observation. Web UI
and POS UI acceptance are deferred to a follow-up change. Results are recorded in
`docs/evidencia-qa-xp58-peripheral-agent-e2e.md`.

## Final QA4 evidence

```text
Agent: 0.1.1-qa.4 / REAL / LocalService
XP-58: USB001 / discovery PASS / THERMAL_58MM
Direct physical print: PASS
SALE /printer/print-ticket: PASS (2 consecutive, bytesSent=892)
Discovery invocations during print-ticket: 0
Cash drawer API and physical open: PASS
Autocut: OUT OF SCOPE (usbRawPhysicalCutCertified=false)
Web UI and POS UI: DEFERRED TO FOLLOW-UP
```
