## Why

Packaged Electron QA reaches the local Agent, but the Perifericos POS screen
currently falls back to the browser Agent configuration and rejects the local
HTTP endpoint under production HTTPS validation. This blocks authenticated
local-to-cloud handoff even though the Agent and persisted devices are healthy.

## What Changes

- Make Agent transport selection explicit for the Electron runtime.
- Route health, devices, discovery, configuration, print, drawer, scale, and
  log operations through the existing typed `window.manusTerminal` bridge when
  it is available.
- Keep direct browser transport and its production HTTPS validation unchanged.
- Keep cloud terminal resolution and authenticated peripheral synchronization
  tenant-, branch-, and operational-terminal-scoped.
- Add regression coverage proving no generic IPC or HTTP proxy is introduced.
- Record the cold-boot QA finding without reopening certified fullscreen,
  scanner, printer, or drawer work.

## Capabilities

### New Capabilities

- `electron-agent-handoff`: secure, explicit Electron-to-local-Agent transport
  and authenticated cloud handoff for peripheral configuration.

### Modified Capabilities

- None.

## Impact

- Web peripheral transport selection and tests in `web/domains/peripherals`.
- Electron preload/API boundary only if the existing typed bridge needs a
  narrow capability marker or operation.
- No Agent protocol, printer, drawer, scanner, fullscreen, or cloud auth
  semantics change.
