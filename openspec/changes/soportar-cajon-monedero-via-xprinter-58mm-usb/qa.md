## Technical QA

- `openspec validate soportar-cajon-monedero-via-xprinter-58mm-usb --type change --strict` = PASS
- `openspec validate --changes` = PASS
- `openspec validate --all --strict` = PASS
- Backend tests for the drawer path = PASS
- Backend build = PASS
- Web lint = PASS with existing warnings
- Web build = PASS
- Canonical cash classification shared with POS payment flow = PASS technical
- `local-terminal` sentinel now resolves through the canonical terminal lookup = PASS technical
- Printer-backed drawer persistence helper = PASS technical
- Sale flow resolves canonical terminal + printer-backed drawer payload = PASS technical
- `npm run package:windows-x64` = PASS in temp packaging copy
- `npm run validate:package:windows-x64` = BLOCKED by the live agent already holding port 4050, so the launcher smoke exits before creating stdout/stderr logs

## Local Hardware QA

- XP-58 USB discovery = PASS
- XP-58 printing = PASS
- XP-58 drawer capability = PASS
- `deviceId` = `usb-printer-45207a0cc744eb10` is local QA only
- Do not hardcode local QA identifiers

## Physical QA

- USB RAW PRINT = PASS
- PHYSICAL PRINT = PASS
- USB RAW CASH DRAWER PULSE = PASS
- MANUAL CASH DRAWER OPEN = PASS
- FIRST PHYSICAL OPEN = PASS
- SECOND PHYSICAL OPEN = PASS
- REPEATED PHYSICAL OPEN = PASS
- 1 REQUEST = 1 PHYSICAL OPEN = PASS
- NO DOUBLE PULSE OBSERVED = PASS
- CASH PAYMENT DETECTION = PASS
- SALE DRAWER REQUEST TRIGGER = PASS
- TERMINAL CANONICAL RESOLUTION = PASS
- DRAWER DEVICE RESOLUTION = PASS
- PRINTER-BACKED DRAWER ROUTING = PASS
- MANUS CASH SALE PRINT = PASS
- MANUS CASH SALE PHYSICAL TICKET = PASS
- MANUS CASH SALE DRAWER AUTO OPEN = PASS
- PHYSICAL DRAWER OPEN FROM SALE = PASS
- SINGLE OPEN PER CASH SALE = PASS
- NON-CASH SALE DOES NOT OPEN DRAWER = PASS technical
- FASE 2 E2E = PASS
- FINAL MANUAL QA = PASS

## Phase Gate

- Fase 2 is certified E2E.
- Physical cut stays out of scope for this change.
