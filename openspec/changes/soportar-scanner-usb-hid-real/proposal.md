## Why

The current POS only supports scanner MOCK through `POST /scanner/simulate`.
The real scanner flow must work as a USB HID keyboard wedge in the browser,
without native USB APIs and without a scanner-specific model.

## What Changes

- Add a timing-based keyboard-wedge scan detector in the POS search field.
- Keep the scanner path on the frontend, not in the Agent.
- Preserve the existing mock scanner flow for QA and diagnostics.
- Represent the real scanner capability as `type = SCANNER` and
  `connectionType = USB_HID`.
- Do not add Electron, Capacitor, native HID, or USB RAW scanner APIs.

## Impact

- Affects POS keyboard handling, scanner matching, docs and tests.
- Does not change sales, inventory, pricing or agent printer flows.
- Does not require hardware access in the browser or agent.
