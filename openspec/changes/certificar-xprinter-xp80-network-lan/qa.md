## QA

### Manual physical QA

1. Connect the XP-80 to the network.
2. Obtain the real IP.
3. Confirm the port is reachable.
4. Run a test connection.
5. Run a test print.
6. Verify the ticket prints and cuts.
7. Disconnect the LAN cable.
8. Confirm the error is controlled.
9. Reconnect the cable.
10. Retry and confirm recovery.

### Completed physical evidence

- `NetworkEscposPrinterAdapter`
- `connectionType = NETWORK`
- `deviceId = network-xp80-qa-001`
- `endpoint QA = 192.168.123.100:9100`
- `bytesSent = 744`
- `supportsPhysicalCut = true`
- `impresión física = PASS`
- `corte físico = PASS`

### Coexistence evidence

- USB device: `usb-printer-1f0028d1fa5243c2`
- NETWORK device: `network-xp80-qa-001`
- No automatic deduplication between USB and NETWORK during QA.

### Final terminal restore evidence

- `TERM-001` restored with persisted USB printer deviceId `usb-printer-1f0028d1fa5243c2`.
- `resolve-current` re-validated after rollback.
- `operationalTerminalId = 693921eb-d28d-4c1b-af17-087b589c6467`.
- `printerDeviceId = usb-printer-1f0028d1fa5243c2`.
- Scanner, balanza and drawer settings left unchanged.

### Manual E2E evidence

- `XP-80 LAN TCP CONNECTIVITY = PASS`
- `XP-80 LAN TCP RAW = HARDWARE CERTIFIED`
- `XP-80 LAN ESC/POS = HARDWARE CERTIFIED`
- `XP-80 LAN TEST PRINT = PASS`
- `XP-80 LAN SALE TICKET E2E = PASS`
- `LOCALHOST PERIPHERAL AGENT = PASS`
- `WEB REMOTE + LOCAL AGENT + LAN HARDWARE = PASS`
- `PHYSICAL PRINT = PASS`
- `PHYSICAL CUT = PASS`
- `TERM-001 CANONICAL RESOLUTION = PASS`
- `LEGACY FALLBACK = NOT USED`

### Evidence rule

Do not mark hardware PASS without physical proof.
