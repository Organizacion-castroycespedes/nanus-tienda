## Context

The agent already has network ESC/POS support. The XP-80 LAN work must prove
that the same ticket bytes can be sent through TCP RAW with controlled
timeouts, host validation and no regression for USB RAW.

## Decision

Preferred architecture:

```text
CanonicalTicket
  -> ThermalEscPosRenderer
  -> TcpRawTransport
  -> XP-80 LAN
```

The printer remains `type = PRINTER`, `profileId = THERMAL_80MM`, with a
transport selected by configuration: `USB` or `NETWORK`.

## Configuration

- Network config must keep `host`, `port` and configurable `timeoutMs`.
- The UI must support test connection and test print.
- The terminal must not lose the existing USB-certified printer.

## Error Model

The network path must distinguish host invalid, timeout, connection refused,
network unreachable, printer offline, socket closed and agent offline.

## Constraints

- No duplicate `XP80_USB` / `XP80_LAN` models.
- No fake success if the socket fails.
- No regression for USB RAW, TERM-001 or physical cut.
