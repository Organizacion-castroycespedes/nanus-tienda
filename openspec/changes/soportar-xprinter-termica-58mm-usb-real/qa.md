## Technical QA

- `openspec validate soportar-xprinter-termica-58mm-usb-real --type change --strict` = PASS
- `openspec validate --changes` = PASS
- `openspec validate --all --strict` = PASS
- `git diff --check` = PASS
- `backend-perifericos` tests = PASS
  - `THERMAL_58MM` profile
  - renderer width
  - USB discovery
  - stable device id
  - USB dedupe
  - real `test-print`
  - real `print-ticket`
  - unsupported CUT path
  - USB failure
  - printer not found
  - persistence
  - autostart
  - CORS
  - XP-80 LAN regression
  - XP-80 USB 80mm regression
  - cash drawer XP-80 LAN regression
- `web` lint = PASS
- `web` build = PASS

## Local Hardware QA

- XP-58 USB discovery = PASS
- Stable device ID = PASS
- `deviceId` = `usb-printer-45207a0cc744eb10`
- `printerName` = `XP-58`
- `Windows queue` = `XP-58`
- `Driver` = `XP-58`
- `Port` = `USB001`
- `connectionType` = `USB`
- `discoverySource` = `USB_SYSTEM`
- USB RAW real adapter = PASS
- adapter real = `UsbRawPrinterAdapter`
- `THERMAL_58MM` profile = PASS
- profile persistence = PASS
- rediscovery = PASS
- `test-print` REAL = PASS
- `bytesSent > 0` = PASS

## Physical QA

- PHYSICAL PRINT = PASS
- 58 mm width = PASS
- 32 char layout = PASS
- Ticket content fits paper = PASS
- TERMINAL PRINTER ASSOCIATION = PASS
- MANUS SALE -> XP-58 USB = PASS
- PHYSICAL SALE TICKET = PASS
- 58MM SALE TICKET LAYOUT = PASS
- PERIPHERALS UI UTF-8 TEXT = PASS
- PHYSICAL CUT = NOT SUPPORTED / NOT CERTIFIED
- PHYSICAL CUT REQUIRED FOR FASE 1 = NO
- Do not certify cutter.

## Phase Gate

- PHASE 1 = PASS
- Do not start Fase 2 until it is explicitly opened.
- Do not treat simulated output as hardware PASS.
