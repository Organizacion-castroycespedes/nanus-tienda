# Risks

| Risk | Signal | Mitigation | Stop condition |
| --- | --- | --- | --- |
| Runtime installed remains old | `/health.version` mismatch | Use `0.1.1-qa.2`; verify SHA256 and health version | Do not continue physical QA with old runtime |
| Same-version repair bug | `unlinkat ... Access is denied` | Never invoke repair or reuse `0.1.0` | Stop if installer classifies run as repair |
| Config overwritten | JSON hash/content changes during install | Backup first; installer seeds only absent config; automated preservation test | Stop before REAL config if backup/preservation differs |
| Identity changed | `agentInstallationId` differs | Preserve ProgramData state; compare before/after | Do not associate device until investigated |
| LocalService cannot see XP-58 | inventory lacks queue | Inspect service printer inventory and account scope | Do not broaden port filter without evidence |
| RAW not understood by printer | `bytesSent>0`, no paper | Keep Windows Test Page evidence separate; require observed paper | AC7 remains NOT PASS |
| Wrong paper profile | clipping or 80 mm layout | Use existing `THERMAL_58MM` (`32` chars, `58 mm`) | Do not certify POS with 80 mm profile |
| Browser PNA/CORS block | failed preflight in DevTools | Exact origin plus conditional PNA response | Do not use `*` or remote HTTP |
| Production sale side effects | POS test creates real sale | Document safe QA sale before execution | Leave AC9 NOT TESTED |
| Automatic cut damage/false claim | unexpected cut command | Keep certification false | Do not enable cut in this phase |

# Current physical status

```text
PHYSICAL WINDOWS TEST PAGE: PASS
PERIPHERAL AGENT REAL DISCOVERY: NOT TESTED
DIRECT MANUS TEST PRINT: NOT TESTED
WEB MANUS TEST PRINT: NOT TESTED
POS PHYSICAL PRINT: NOT TESTED
```
