## Why

P9.1 identifies runtime contract support, but the platform still lacks a cloud-owned relationship between the installed Agent identity, a registered physical terminal installation, and a logical POS terminal. Without this relationship, replacement and tenant-safe reassignment cannot be explicit or auditable.

## What Changes

- Add tenant-scoped cloud device registration keyed by the existing local `installationId`.
- Add historical terminal-device bindings with at most one active binding per terminal and device.
- Add authenticated APIs for register/resolve, bind, unbind/revoke and relevant state listing.
- Add a small terminal administration surface that distinguishes logical terminal, physical device and binding state.
- Preserve P9.1 runtime negotiation and current peripheral device identifiers.
- Document credential issuance as a later security step; `installationId` is not proof of possession.

## Capabilities

### New Capabilities

- `terminal-device-binding`: Cloud-owned device registration, tenant-safe binding lifecycle and operator visibility.

### Modified Capabilities

None.

## Impact

NestJS API, additive PostgreSQL migration, Web terminal administration services/UI, tests and roadmap/OpenSpec documentation. Electron and Peripheral Agent source remain unchanged. No installer, updater, pairing credential, startup, cache, offline or Linux work. Baseline: `f6ef0eaa4ce3934cfa599cc829994a3c6fc3cf80`.
