## 1. Discovery and profile contract

- [x] 1.1 Confirm the 58 mm profile contract, width, and capability values against the current code paths.
- [x] 1.2 Lock stable USB discovery identity and dedupe behavior for the certified printer.
- [x] 1.3 Keep the 80 mm default path unchanged while preparing the 58 mm path.

## 2. Real 58 mm printing path

- [x] 2.1 Make the 58 mm USB printer eligible for real `test-print` and `print-ticket` responses.
- [x] 2.2 Ensure real responses report `mode`, `adapterName`, `deviceId`, `terminalId`, `connectionType`, `profile`, `capabilities`, `bytesSent`, and `message`.
- [x] 2.3 Keep CUT capability explicit and non-blocking for 58 mm printing.

## 3. Admin peripherals UI

- [x] 3.1 Surface the new 58 mm USB printer in `/[tenant]/admin/peripherals`.
- [x] 3.2 Keep printer selection and test print copy focused and minimal.
- [x] 3.3 Preserve the current 80 mm and cash-drawer UI behavior.

## 4. Tests and validation

- [x] 4.1 Add tests for the `THERMAL_58MM` profile and renderer width.
- [x] 4.2 Add USB discovery and dedupe tests for stable identity.
- [x] 4.3 Add real print and failure-path tests for `test-print` and `print-ticket`.
- [x] 4.4 Add regression coverage for `THERMAL_80MM` and existing cash-drawer behavior.
- [x] 4.5 Run the required build, lint, and OpenSpec validation checks before QA handoff.
