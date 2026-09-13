## Why

P9.2 gives the cloud an authoritative Device-to-Terminal binding, and P9.1 gives the installed runtime a versioned capability contract. The platform still needs one deterministic answer to whether a physical Electron terminal may enter operational POS. Without a composed readiness model, Web, Electron, Agent and cloud failures can be misclassified or silently bypassed.

## What Changes

- Define separate `WEB` and `ELECTRON_TERMINAL` execution modes.
- Compose the existing P9.1 runtime and Agent health information with authenticated cloud Device/Terminal resolution.
- Add a small, read-only authenticated cloud resolution contract: `POST /terminal-runtime/resolve`.
- Freeze a bounded readiness state and reason model for the future Web orchestrator and POS entry gate.
- Define retry, re-evaluation, security boundaries, tests and the minimal readiness UX.

This change freezes architecture and implementation tasks. It does not implement production source, a migration, or a new bridge contract.

## Capabilities

### New Capabilities

- `terminal-startup-readiness`: deterministic local and cloud readiness composition for Electron terminals while preserving browser Web operation.

### Modified Capabilities

None. P9.1 Bridge Contract V1 remains frozen.

## Impact

Future work will touch the authenticated API, Web readiness orchestration and Electron POS entry gate. The Agent, Installer and database remain unchanged in the initial P9.3 slice. P9.4 diagnostics, P9.5 updates, P9.6 Linux portability and offline POS are out of scope.
