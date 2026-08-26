## Why

The XP-80 USB RAW flow is already certified. The next independent capability is
the same physical printer over LAN/TCP RAW, without duplicating the ticket
renderer or inventing a second printer model.

## What Changes

- Certify the existing `NetworkEscposPrinterAdapter` path for XP-80 over LAN.
- Keep the canonical renderer: `ThermalEscPosRenderer -> TcpRawTransport`.
- Keep `profileId = THERMAL_80MM`.
- Keep one printer model with `transport = USB | NETWORK`.
- Do not assume IP, port 9100 or a specific device model.

## Impact

- Affects printer config, network error handling, tests and QA docs.
- Does not change the ticket renderer or USB RAW bytes.
- Does not add a second XP-80 model.
