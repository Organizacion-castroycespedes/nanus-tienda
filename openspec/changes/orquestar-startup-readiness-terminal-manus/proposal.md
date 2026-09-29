## Why

P9.1 defines the local runtime contract. P9.2 defines the cloud Device-to-Terminal binding. P9.3 composes both signals so an Electron terminal can make a bounded operational readiness decision without treating `installationId` as authentication.

## Scope implemented

- Add authenticated, read-only `POST /terminal-runtime/resolve`.
- Add Web readiness orchestration for browser and Electron modes.
- Gate Electron POS entry when the bound Terminal differs from the active POS context.
- Preserve browser Web operation without a local Agent.
- Preserve all existing API modules, routes, `.gitignore` rules, P9.1 and P9.2 behavior.

## Explicit non-goals

No pairing, proof of possession, Device credential, DPAPI, rotation, attestation, Installer change, Agent change, migration or server-side physical-device authentication.
