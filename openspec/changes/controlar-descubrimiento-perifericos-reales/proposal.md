# Proposal

## Why

MANUS POS currently uses `enableRealAdapters` both to permit physical adapters and to start device discovery automatically. QA needs real adapter code available for deliberate tests while startup stays quiet; the same contract must preserve the explicit production profile and pairing safeguards.

## What Changes

- Add a separate `discoverOnStartup` configuration setting for the Agent and packaged installer UI.
- Make startup discovery require both real adapters and an explicit boolean `discoverOnStartup: true`; missing or invalid values fail closed.
- Package QA with real adapters enabled but startup discovery disabled. Package dev and production with their existing adapter profile and explicit discovery policy.
- Embed a verified package profile; QA forces startup discovery off despite stale JSON or inherited environment values. Unverified profiles fail closed.
- Block the default Windows native discovery runner under `node:test`; tests must inject fakes.
- Keep manual discovery behind an explicit user action and require the operator to select a discovered device before configuring or testing it. This change does not add new physical protocols or adapters.
- Keep health independent from device availability and preserve Agent enrollment, scale binding, and operator KG confirmation requirements.
- Add fake-based QA coverage for the Agent, installer UI, configuration precedence, and the QA/production behavior matrix.

## Capabilities

### New Capabilities

- `real-peripheral-discovery-policy`: Controls when real peripherals may be discovered at startup and preserves explicit manual discovery and existing trust gates.

### Modified Capabilities

None. Existing ROCHI, printer, drawer, scanner, and scale authorization contracts remain the authority for each device operation.

## Impact

Affected areas are the Agent local config loader and startup, Windows package profile generation, the productive installer WebView discovery gate, and focused tests. No database, host installation, hardware, enrollment secret, or production runtime is changed by this proposal.
