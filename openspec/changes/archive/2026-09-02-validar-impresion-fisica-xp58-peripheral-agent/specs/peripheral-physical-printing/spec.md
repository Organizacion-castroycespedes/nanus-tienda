## ADDED Requirements

### Requirement: AC1 Windows XP-58 discovery candidate
The system SHALL treat an installed Windows printer named `XP-58` with type
`Local` and port `USB001` as a valid physical discovery candidate.

#### Scenario: XP-58 uses USB001
- **WHEN** `Get-Printer` returns XP-58 with `Type=Local` and `PortName=USB001`
- **THEN** the Windows discovery provider includes XP-58 without expanding support to LPT, WSD, IP or COM ports

### Requirement: AC2 REAL Agent health
The QA PeripheralAgent SHALL run in explicit REAL mode and SHALL expose its
SemVer prerelease version through `/health`.

#### Scenario: QA runtime starts
- **WHEN** the `0.1.1-qa.2` runtime starts with local config `mode=REAL`
- **THEN** `/health` returns `status=ok`, `mode=REAL` and `version=0.1.1-qa.2`

### Scenario: discovery does not assume paper width

- **WHEN** Windows discovers a local USB printer
- **THEN** the device is returned without forcing `THERMAL_80MM`
- **AND** terminal configuration may persist `THERMAL_58MM` or `THERMAL_80MM`
- **AND** test print resolves the persisted device profile

### Scenario: USB drawer pulse remains fail-closed until device certification

- **WHEN** a USB printer lacks `metadata.usbRawCashDrawerPulseCertified=true`
- **THEN** `/cash-drawer/open` returns `400 printer drawer pulse is not certified for this device`
- **AND** no RAW write is attempted
- **WHEN** that metadata is explicitly persisted after physical QA
- **THEN** the configured profile pulse may be sent through the USB RAW adapter

### Scenario: slow LocalService discovery is observable

- **WHEN** Windows discovery runs as LocalService
- **THEN** the Agent allows the measured 6263 ms duration within a 10000 ms timeout
- **AND** logs started, completed, durationMs, timeoutMs, timeout, parse failure and found count
- **AND** print-ticket for a persisted USB device does not invoke discovery

### Requirement: AC3 REAL physical discovery
REAL discovery SHALL return physical devices without MOCK seed devices and
SHALL distinguish empty, found and failed outcomes.

#### Scenario: XP-58 is found
- **WHEN** `/devices/discover` executes and Windows reports XP-58 on USB001
- **THEN** the response includes XP-58 as `USB` and `CONNECTED` with `usb.printerName=XP-58` and contains no MOCK devices

#### Scenario: Windows discovery fails
- **WHEN** `Get-Printer` fails while the Agent is REAL
- **THEN** the Agent returns a controlled error and logs the physical failure instead of returning MOCK devices

### Requirement: AC4 Upgrade preserves workstation identity
The QA upgrade SHALL preserve `agentInstallationId` across deployment from
`0.1.0` to the QA version.

#### Scenario: Version upgrade completes
- **WHEN** the versioned QA installer upgrades an existing workstation
- **THEN** the post-upgrade `/health` returns the same `agentInstallationId` captured before installation

### Requirement: QA upgrade preserves local configuration
The versioned QA upgrade SHALL NOT overwrite an existing external
`agent.config.local.json`.

#### Scenario: Existing configuration is present
- **WHEN** the QA installer runs and ProgramData already contains local config
- **THEN** the original file remains unchanged until QA explicitly applies the reviewed REAL configuration

### Requirement: AC5 Production Web uses authorized loopback Agent
Manus Web production SHALL connect to the local Agent through loopback without
requiring operator-managed URLs and the Agent SHALL authorize only approved
origins, including controlled Private Network Access preflight.

#### Scenario: Production page connects to local Agent
- **WHEN** `https://apptiendamanus.space` loads without peripheral URL overrides
- **THEN** it uses `http://127.0.0.1:4050` and `ws://127.0.0.1:4050/peripherals`

#### Scenario: Authorized PNA preflight
- **WHEN** the Manus production origin requests private-network access
- **THEN** the Agent returns the explicit origin and `Access-Control-Allow-Private-Network: true`

#### Scenario: Unauthorized PNA preflight
- **WHEN** an origin outside the allow-list requests private-network access
- **THEN** the Agent returns neither an allowed origin nor private-network authorization

### Requirement: AC6 XP-58 terminal association
The Web configuration SHALL allow a discovered XP-58 to be associated with a
terminal using the `THERMAL_58MM` profile.

#### Scenario: Operator configures XP-58
- **WHEN** the operator selects discovered XP-58, chooses `THERMAL_58MM` and saves
- **THEN** the terminal configuration persists the physical `deviceId` and 58 mm profile

### Requirement: AC7 Direct physical test print
The direct test-print endpoint SHALL send an XP-58 print job through the REAL
USB RAW adapter, but physical acceptance SHALL require observed paper.

#### Scenario: Direct test produces paper
- **WHEN** QA posts the physical XP-58 `deviceId` to `/printer/test-print`
- **THEN** the response reports `success=true`, `mode=REAL`, `adapterName=UsbRawPrinterAdapter`, `bytesSent>0` and QA observes a physical ticket

#### Scenario: Bytes without observed paper
- **WHEN** the endpoint reports bytes sent but no tester observes printed paper
- **THEN** AC7 remains NOT TESTED or FAIL and SHALL NOT be marked PASS

### Requirement: AC8 UI physical test print
Manus Web SHALL expose an operator test action for the associated XP-58 and
physical acceptance SHALL require observed paper.

#### Scenario: UI test produces paper
- **WHEN** the operator invokes test print from Manus Web for the configured XP-58
- **THEN** the Agent sends a REAL job and QA observes a physical ticket

### Requirement: AC9 POS physical ticket is conditional
If a safe non-production-impacting POS QA flow exists, the POS SHALL use the
associated XP-58; otherwise POS physical validation SHALL remain NOT TESTED.

#### Scenario: Safe POS QA is available
- **WHEN** QA documents and executes a safe POS print flow without changing sale rules
- **THEN** the POS resolves the associated physical `deviceId` and QA observes a printed ticket

#### Scenario: Safe POS QA is unavailable
- **WHEN** validation would require an uncontrolled production sale
- **THEN** QA does not execute it and AC9 remains NOT TESTED
