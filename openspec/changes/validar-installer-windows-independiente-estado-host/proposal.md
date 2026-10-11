## Why

The Windows installer artifact validator currently assumes the validation host has no `ManusPeripheralAgent` service. That makes a read-only artifact check fail on a valid workstation with an existing stopped or running installation, even though the installer artifact itself is correct.

## What Changes

- Make installer artifact validation independent of pre-existing Windows service presence and running state.
- Validate stable status field types, installer metadata, expected paths, and coherent state invariants.
- Report an existing service as informational rather than failing validation.
- Preserve the existing `serviceBinary` meaning and all installer, manifest, integrity, and security behavior.
- Add deterministic mocked coverage for absent, stopped, running, malformed, and corrupt-artifact cases.
- Align README examples so the QA output filename does not imply a different internal Agent version.

## Capabilities

### New Capabilities

- `windows-installer-artifact-validation`: Host-independent validation contract for Windows installer artifacts and observational service status.

### Modified Capabilities

None.

## Impact

- `backend-perifericos/scripts/validate-windows-installer.mjs` and focused validation tests.
- Existing installer status/inspect contracts remain backward compatible.
- `backend-perifericos/README.md` version/output-name guidance.
- No Windows service, registry, deployed configuration, credential, or installer lifecycle changes.
