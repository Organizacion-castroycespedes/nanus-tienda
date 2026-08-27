## QA

### State

- IMPLEMENTATION TECHNICAL: PASS
- BACKWARD COMPATIBILITY: PASS
- NETWORK INTEGRATION: IMPLEMENTED
- BASIC PHYSICAL TEST PRINT: PASS
- FULL PHYSICAL QA: PENDING
- STATUS: PAUSED - PENDING DIG-E200I PHYSICAL HARDWARE

### Confirmed evidence

- `backend-perifericos` lives in `backend-perifericos`.
- `PeripheralAgent` is a NestJS 10 service on Node 18+.
- The network printer flow reuses `PeripheralDevice`, `DeviceProfile`, `PeripheralAdapterResolver`, `NetworkEscposPrinterAdapter`, and `thermal-escpos.renderer`.
- `manufacturer` and `model` remain optional in the web form.
- `host` and `port` are configurable.
- `9100` is the convenient default for `NETWORK`.
- The laboratory IP `192.168.89.22` is only a QA value.
- `Test-NetConnection 192.168.89.22 -Port 9100` returned `TcpTestSucceeded : True`.
- `POST /printer/test-print` against `dig-e200i-qa-001` returned `mode: REAL`, `adapterName: NetworkEscposPrinterAdapter`, and `bytesSent: 744`.
- Human physical evidence confirmed the test print came out on paper.
- `POST /printer/print-ticket` against `dig-e200i-qa-001` preserved Unicode in the backend preview and UTF-8 bytes in the adapter.
- The earlier `U+FFFD` observation came from PowerShell display decoding, not backend corruption.

### Current technical interpretation

- Unicode pipeline: PASS TECHNICAL.
- UTF-8 transport: PASS TECHNICAL.
- ASCII physical print: PASS.
- Spanish encoding physical validation: PENDING PHYSICAL QA.
- ESC/POS code page requirement: UNKNOWN.
- `Query port 4000`: NOT IMPLEMENTED.
- DIG-E200I USB: OUT OF SCOPE FOR THIS MVP.

### Backend / Web validation

- `backend-perifericos` tests: PASS.
- `backend-perifericos` build: PASS.
- `web` printer registration tests: PASS.
- `web` lint: PASS.
- `web` build: PASS.
- `openspec validate integrar-impresora-digitalpos-dig-e200i --strict`: PASS.
- `openspec validate --all --strict`: PASS.

### Physical checklist

#### Networking

- [x] Printer powered on.
- [x] Ethernet connected.
- [x] DHCP active.
- [x] IP discovered in the lab.
- [x] Ping checked when applicable.
- [x] TCP `9100` reachable.
- [x] Basic test print came out on paper.

#### Printing

- [x] ASCII text printed.
- [x] Line breaks printed.
- [x] Long text printed.
- [x] Ten consecutive test prints completed.
- [ ] Spanish characters physically verified on paper.
- [ ] `á é í ó ú` physically verified on paper.
- [ ] `Á É Í Ó Ú` physically verified on paper.
- [ ] `ñ Ñ` physically verified on paper.
- [ ] `¿ ?` physically verified on paper.
- [ ] `¡ !` physically verified on paper.
- [x] `$` printed in the sample.

#### ESC/POS

- [x] init present in payload.
- [x] alignment present in payload.
- [x] bold present in payload.
- [x] feed present in payload.
- [x] cut present in payload.
- [ ] Double height, font size, QR, barcode, images, logo: not physically verified.

#### Cash drawer

- [ ] Not tested for DIG-E200I.

#### Recovery

- [ ] Power recovery not tested.
- [ ] Network recovery not tested.

#### Performance

- [x] 1 ticket.
- [x] 10 tickets.
- [ ] Large payload not tested.
- [x] PeripheralAgent did not block.

### Resume checkpoint

When hardware returns, start here:

1. Reconfirm DIG-E200I IP and `NETWORK` config.
2. Re-run `POST /printer/test-print`.
3. Re-run `POST /printer/print-ticket` with the exact Spanish QA sample.
4. Inspect the paper.
5. Only then decide whether a code page investigation is needed.

### Evidence rule

- Do not mark `FULL PHYSICAL QA` as done without a human paper check and a sanitized evidence record.
