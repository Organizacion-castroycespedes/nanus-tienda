## Why

Manus POS needs a real 58 mm USB thermal printer path on Windows x64 through Peripheral Agent. The repo already has USB discovery, ESC/POS rendering, and a `THERMAL_58MM` profile stub, but the current flow still defaults USB printers to `THERMAL_80MM` and does not yet certify real 58 mm printing end to end.

## What Changes

- Add a real 58 mm USB printer capability for Windows x64 via Peripheral Agent.
- Discover USB printers under `POST /devices/discover` with stable metadata and dedupe behavior.
- Allow `POST /printer/test-print` and `POST /printer/print-ticket` to produce real output for a certified 58 mm USB printer.
- Expose the 58 mm profile in admin peripherals so a terminal can select it and run test print.
- Keep 80 mm printer behavior unchanged.
- Defer cash drawer work to Fase 2. No drawer transport change in this change.

## Capabilities

### New Capabilities
- `thermal-58mm-usb-printer`: real USB thermal printer support for Xprinter 58 mm, including discovery, profile handling, print/test-print, and admin selection.

### Modified Capabilities
- None.

## Impact

- Affects `backend-perifericos` device discovery, printer adapter resolution, thermal rendering, and cash-drawer guardrails that already branch on printer profile.
- Affects `web` admin peripherals UI so the new USB printer can be selected and tested.
- Affects tests for discovery, printer responses, profile width, and 80 mm regression coverage.
- No database, migration, scanner, balanza, push, or deploy work in this phase.
