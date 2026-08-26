## Context

`backend-perifericos` already models `DeviceType.PRINTER` separately from
`ConnectionType.NETWORK` and has a real Node TCP ESC/POS adapter. It also has
the `USB` connection enum, but device discovery is a MOCK reset and no USB
adapter exists. Devices are agent-memory configuration only. The web admin
page exposes a NETWORK-only registration form and communicates with the local
agent through configurable HTTP and WebSocket URLs.

The XP-80T is an 80 mm direct-thermal POS printer with 200 mm/s print speed,
partial auto-cut, USB/Ethernet variants, and ESC/POS-compatible emulation.
`THERMAL_80MM` is therefore the correct profile. The agent must discover and
operate USB hardware because browsers do not provide dependable production
access to OS printer drivers or local queues.

## Goals / Non-Goals

**Goals:**

- Keep `PRINTER` as device type and select `USB` or `NETWORK` independently.
- Keep raw TCP/IP ESC/POS for NETWORK with user-provided host, port and
  timeout; defaults remain validation behavior, never a device address.
- Discover compatible OS USB printer queues in the agent, associate their
  generated `deviceId`, and print a minimum test ticket through the OS driver.
- Keep the POS/browser print contract transport-independent: it sends a
  document/profile request to the agent, never ESC/POS byte arrays.
- Preserve local HTTP health/devices/printer routes and WebSocket events.

**Non-Goals:**

- Vendor-specific XP-80T commands, hardcoded USB IDs, hardware database
  persistence, automatic LAN scanning, or physical hardware certification.
- Scanner, scale, cash drawer, electronic invoicing, sales, inventory and
  payment changes.

## Decisions

### Device configuration uses connection-specific fields

`PeripheralDevice` keeps common identity: `id`, `type`, `name`, `status`,
`terminalId`, `profileId`, and `connectionType`. NETWORK uses `network` with
`host`, `port`, `timeoutMs`. USB uses `usb` with the agent-discovered
`deviceId` and queue `printerName`. This prevents `host` and `port` from being
required or stored for USB.

Alternative: put both shapes in untyped `metadata`. Rejected because endpoint
validation and UI visibility would be weak and error-prone.

### NETWORK remains raw TCP ESC/POS

`NetworkEscposPrinterAdapter` remains the NETWORK implementation. It validates
the config, uses the requested timeout, and sends ESC/POS formatted content
over TCP. Port 9100 is a user/UI convenience default only; the adapter never
assumes it for a printer configuration.

Alternative: print NETWORK queues through the OS. Rejected because it loses
the direct, portable raw ESC/POS path already implemented.

### USB uses OS printer queues through the Peripheral Agent

`UsbSystemPrinterAdapter` renders the agent-owned document and submits it to
the discovered operating-system printer queue. Discovery is behind a
`UsbPrinterDiscovery` boundary: Windows queries `Get-Printer`; Linux/macOS
query CUPS `lpstat`. An installed compatible driver is a deployment
prerequisite; Manus does not bundle Xprinter drivers. Adapter commands are
injected in tests so no hardware is needed.

Alternative: WebUSB/browser printing. Rejected because WebUSB is not a
production driver/print-queue solution and is inconsistent across POS hosts.

### Status and failures originate in the agent

Discovered queues start `CONNECTED` only after agent discovery reports them.
Missing configured USB queue raises a device-not-found error. Process,
connection and timeout failures become controlled HTTP errors, printer job
failure events and logs. The web maps agent unavailable, configuration,
device-not-found, timeout, connection-refused and print failure into distinct
messages.

### In-memory registration stays explicit

This MVP preserves current agent-memory device registration. It does not add a
database migration. Re-registering after agent restart is expected and is
documented as a limitation; durable terminal-device assignments need a future,
approved persistence design.

## Risks / Trade-offs

- [OS queue has no USB transport metadata] → discovery returns only queues the
  OS marks as local/USB where available; user selects the discovered queue.
- [Driver absent or queue removed] → surface controlled failure and document
  driver installation/manual QA.
- [Different operating systems] → use a small platform boundary, fake it in
  tests, and keep unsupported platforms explicit rather than pretending.
- [CUPS commands unavailable] → discovery/printing fail with a controlled
  agent error and deployment documentation.
- [Agent memory is lost on restart] → no false persistence claim; future DB
  work requires separate approval.

## Migration Plan

1. Deploy the agent and web together; existing NETWORK payloads remain valid.
2. Set `PERIPHERALS_ENABLE_REAL_ADAPTERS=true` only on an approved local agent
   host when real printing is desired.
3. Install/verify the OS printer driver, discover a USB queue, register it and
   run test print.
4. Roll back by disabling real adapters; MOCK and NETWORK registration
   contracts remain untouched.

## Open Questions

- Linux/macOS physical QA must confirm the target drivers expose a CUPS queue
  that accepts the agent document path.
- XP-80T firmware variants need physical QA for cut behavior; this MVP uses
  the existing profile capability but does not claim hardware PASS.
