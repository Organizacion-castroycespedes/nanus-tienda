## Why

Manus currently has a useful POS peripheral agent, but its real printer path is
only NETWORK ESC/POS and USB is only an enum. The Xprinter XP-80T needs one
official, transport-independent printer path for USB and LAN without making
the browser own physical hardware access.

## What Changes

- Add an official `PRINTER` registration contract that separates printer type
  from `USB` and `NETWORK` connection data.
- Preserve configurable raw TCP/IP ESC/POS printing for `NETWORK` printers,
  including host, port, timeout and `THERMAL_80MM`.
- Add USB printer discovery, association and test printing through the local
  Peripheral Agent, using installed operating-system printer drivers.
- Refactor the peripherals admin UI from "Registrar impresora NETWORK" to
  "Registrar impresora", with connection-specific inputs and test print.
- Make print errors distinguish agent configuration/availability, missing USB
  device, TCP timeout/refusal and printer failures.
- Document technical QA and defer physical-hardware PASS until later manual
  testing.

## Capabilities

### New Capabilities

- `xprinter-xp80t-printer`: Register, configure, discover and test-print a
  `THERMAL_80MM` printer using USB or NETWORK through the Peripheral Agent.

### Modified Capabilities

- None.

## Impact

- Affected code: `backend-perifericos` device contracts, printer adapter
  resolution and discovery; `web/domains/peripherals` contracts/API/admin UI.
- Existing `NETWORK` adapter endpoints remain compatible.
- USB support uses OS print queues and requires a compatible driver installed
  on the machine hosting the local agent; no vendor IDs, IPs or device IDs are
  hardcoded.
- No database migration or POS sales, inventory, payments, scanner, scale or
  cash-drawer change is required.
