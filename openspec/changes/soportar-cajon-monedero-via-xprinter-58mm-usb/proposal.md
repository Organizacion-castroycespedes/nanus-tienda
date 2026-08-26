## Why

Manus POS already certifies a real XP-58 USB printer path on Windows x64. The next step is to certify the physical cash drawer connected to that printer, without making the drawer a separate USB device or duplicating printer configuration.

## What Changes

- Add a cash drawer path that reuses the XP-58 USB printer as the physical transport.
- Keep `POST /cash-drawer/open` as the logical drawer endpoint.
- Resolve the drawer through `printerDeviceId` and the canonical terminal printer.
- Send exactly one ESC/POS drawer pulse per request.
- Persist device-scoped drawer certification in printer metadata.
- Return QA-friendly real hardware data such as `mode`, `adapterName`, `printerDeviceId`, `connectionType`, `pulse`, and `bytesSent`.
- Keep the drawer independent from cutter behavior. Manual cut support does not imply drawer support.
- Keep the drawer disabled unless the XP-58 hardware path is explicitly certified.

## Capabilities

### New Capabilities
- `cash-drawer-via-xprinter-58mm-usb`: logical cash drawer opening through a certified XP-58 USB printer transport, including discovery, adapter routing, pulse sending, and QA response shape.

### Modified Capabilities
- None.

## Impact

- Affects `backend-perifericos` cash drawer flow, printer adapter routing, and response metadata.
- Affects `web/domains/peripherals` admin UI so QA can open the drawer through the selected printer.
- Affects tests for drawer pulse bytes, one-request-one-pulse behavior, USB failure handling, and XP-80 regressions.
- No database, migration, scanner, balanza, secrets, `.env`, or deploy work in this phase.
