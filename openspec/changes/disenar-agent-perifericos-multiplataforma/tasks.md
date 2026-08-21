## 1. P0 portable boundaries

- [x] 1.1 Inventory the current Agent OS-specific imports and preserve XP-80
  Windows x64 byte/cut behavior as the compatibility baseline.
- [x] 1.2 Add portable `PrinterTransport`, `DeviceDiscoveryProvider` and
  `PlatformPaths` contracts without changing Browser/Electron contracts.
- [x] 1.3 Extract `WindowsRawSpoolerTransport` from the USB adapter.
- [x] 1.4 Extract `WindowsPrinterDiscoveryProvider` from USB discovery.
- [x] 1.5 Keep `ThermalEscPosRenderer` and TCP RAW in portable core.

## 2. P0 portable identity

- [x] 2.1 Add `agentInstallationId` and platform paths local-state provider.
- [x] 2.2 Add portable descriptor fields: `nativeIdentifier`, `fingerprint`,
  `platform` and `architecture`.
- [x] 2.3 Preserve legacy `deviceId` resolution for existing TERM-001 XP-80
  configuration during the transition.

## 3. P0 tests and validation

- [x] 3.1 Test Windows XP-80 RAW bytes and CUT are unchanged.
- [x] 3.2 Test TCP RAW behavior remains unchanged.
- [x] 3.3 Test portable core has no Windows API imports and Windows adapters
  own PowerShell/Winspool behavior.
- [x] 3.4 Test portable descriptor serialization and legacy `deviceId`.
- [x] 3.5 Run Agent tests, Agent build, OpenSpec strict and `git diff --check`.
- [x] 3.6 Add allow-listed non-secret local configuration, loopback bind and
  clean shutdown behavior for a workstation Agent.
- [x] 3.7 Build a reproducible Windows x64 portable artifact with embedded
  Node runtime and production-only dependencies.
- [x] 3.8 Add portable package health, discovery and shutdown validation.
- [x] 3.9 Document the Windows x64 QA config, installation path and explicit
  remote Web origin allow-list.
- [x] 3.10 Certify Windows x64 portable localhost topology with XP-80 USB RAW,
  canonical TERM-001 resolution and observed physical CUT.

## 4. Future platform spikes - not implemented in P0

- [ ] 4.1 Spike `CupsRawPrinterTransport` on Linux x64 and certify with
  physical XP-80 hardware.
- [ ] 4.2 Repeat CUPS RAW certification on Linux ARM64 hardware.
- [ ] 4.3 Validate Windows ARM64 Agent plus native printer driver.
- [ ] 4.4 Evaluate macOS ARM64/x64 CUPS queues and LaunchAgent lifecycle.
- [ ] 4.5 Evaluate serial native dependencies and implement a portable
  `SerialTransport` before BBG Market 30 protocol work.
- [ ] 4.6 Define `PRINTER_ESC_POS` drawer capability before RJ11 drawer work.

## 5. Future distribution and certification - not implemented in P0

- [ ] 5.1 Decide packaging only after native dependency matrix spike.
- [ ] 5.2 Build native CI matrix for Windows/Linux/macOS and x64/ARM64.
- [ ] 5.3 Publish artifact version, checksum, signature and platform metadata.
- [ ] 5.4 Maintain support/certification matrix by OS, architecture, device
  and transport.
