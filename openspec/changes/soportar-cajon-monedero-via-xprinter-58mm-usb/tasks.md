## 1. Discovery and certification gate

- [x] 1.1 Confirm the current USB RAW drawer gap in `UsbSystemPrinterAdapter`.
- [x] 1.2 Confirm the existing XP-80 LAN drawer path and reuse its request/response shape as reference only.
- [x] 1.3 Define how device-scoped drawer certification is stored without adding DB or a new device type.
- [x] 1.4 Keep drawer capability separate from `supportsCut`.

## 2. Backend drawer path

- [x] 2.1 Route XP-58 USB drawer requests through the canonical `printerDeviceId`.
- [x] 2.2 Send exactly one ESC/POS drawer pulse per successful request.
- [x] 2.3 Return real QA metadata with `mode`, `adapterName`, `printerDeviceId`, `connectionType`, `profile`, `pulse`, and `bytesSent`.
- [x] 2.4 Fail cleanly when the printer is missing, not certified, or transport fails.

## 3. Admin peripherals UI

- [x] 3.1 Show drawer as dependent on the selected XP-58 USB printer.
- [x] 3.2 Keep the drawer test action minimal and operational.
- [x] 3.3 Keep XP-80 LAN UI and print flows unchanged.

## 4. Tests

- [x] 4.1 Add coverage for drawer pulse bytes and one-request-one-pulse behavior.
- [x] 4.2 Add coverage for USB transport success and failure.
- [x] 4.3 Add coverage for printer not found and unsupported capability.
- [x] 4.4 Add regressions for XP-58 print, XP-80 LAN drawer, and XP-80 LAN print.
- [x] 4.5 Add persistence, autostart, and CORS regression coverage if touched.

## 5. QA and validation

- [x] 5.1 Validate the OpenSpec change strictly.
- [x] 5.2 Run backend and web validation relevant to the drawer change.
- [x] 5.3 Prepare local hardware QA commands for XP-58 drawer certification.
- [x] 5.4 Stop before physical certification and wait for human QA.
