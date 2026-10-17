## Why

The QA Windows printer is visible and usable through Windows, but the LocalService Agent reports only a queue and marks the printer disconnected. The current provider hides PnP command, parsing, timeout, and filtering failures as an empty inventory, while the discovery request also returned a null-reference error after the discovery work completed. Sanitized stage evidence is needed before changing reconciliation behavior.

## What Changes

- Add structured, privacy-safe PnP discovery stage diagnostics for command start/completion, elapsed time, timeout, exit/error category, raw records, parsed records, Class_07 matches, and reconciliation inputs.
- Preserve the existing printer reconciliation, availability checks, device bindings, API routes, and queue selection behavior.
- Preserve matched Windows queue `portName` in the reconciled descriptor as additive diagnostic metadata; queue name remains the print transport authority.
- Classify execution, permission, timeout, empty, malformed, and filtered PnP outcomes explicitly; never represent an unknown failure as a successful empty inventory.
- Trace and classify the `/devices/discover` response error without exposing command output, identifiers, paths, secrets, or configuration.
- Add deterministic tests for all diagnostic classifications and incomplete discovery responses.

## Capabilities

### New Capabilities

- `windows-pnp-discovery-observability`: Sanitized, stage-specific diagnostics for Windows PnP printer discovery and its API outcome.

### Modified Capabilities

None.

## Impact

- Affected code: Windows printer discovery provider, device discovery orchestration, Agent structured logging, and Electron discovery client error handling.
- Affected tests: backend discovery/provider tests and Electron client tests.
- No live Windows configuration, printer queue, service, registry, or installed BUILD-04 changes are required.
- No endpoint or reconciliation contract changes are intended.
Matched Windows queue `portName` is preserved as additive descriptor metadata. Queue name remains the print transport authority.
