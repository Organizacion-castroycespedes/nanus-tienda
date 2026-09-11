## Why

Remote Web deploys independently of installed Electron and Agent binaries. The current Web assumes every bridge method exists and has no explicit contract generation to check.

## What Changes

- Add minimal typed runtime metadata and integer contract generations.
- Negotiate capabilities before fixed peripheral calls, preserving legacy and browser sessions.
- Document the complete ordered terminal roadmap; implement only P9.1.

## Capabilities

### New Capabilities

- `terminal-runtime-contract`: Runtime metadata, capability negotiation and graceful compatibility handling.

### Modified Capabilities

None. P7/P8 remain CLOSED / PASS / FROZEN.

## Impact

Electron main/preload/contracts, Web peripheral transport, additive Agent health metadata, relevant tests and documentation. No new dependencies, installer, database, updater, device binding or offline sales work. Baseline: `5a393b475c5e96716f7d196cb0dd913b58c0e9f4`.
