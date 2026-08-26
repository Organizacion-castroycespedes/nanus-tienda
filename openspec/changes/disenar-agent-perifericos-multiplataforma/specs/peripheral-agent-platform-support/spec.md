## ADDED Requirements

### Requirement: Support certification matrix
The project SHALL distinguish IMPLEMENTED, TECHNICALLY TESTED, HARDWARE
CERTIFIED and UNSUPPORTED for every OS, architecture, peripheral and transport
combination.

#### Scenario: Certified XP-80
- **WHEN** support status is published for Windows x64 XP-80 USB RAW
- **THEN** it SHALL report HARDWARE CERTIFIED only after physical print and CUT
evidence exists

#### Scenario: Certified portable localhost topology
- **WHEN** a Windows x64 portable Agent is certified with remote Manus Web
  services and local USB hardware
- **THEN** Browser requests SHALL target the workstation Agent loopback URL,
  canonical terminal resolution SHALL retain its configured device identity,
  and the certification record SHALL distinguish it from a remote Agent

### Requirement: Future platform adapter boundaries
The design SHALL reserve adapters for Windows ARM64, Linux x64/ARM64 and macOS
x64/ARM64 without placing platform branches in Browser, Electron or core.

#### Scenario: Future CUPS transport
- **WHEN** a Linux or macOS RAW printer transport is implemented
- **THEN** it SHALL consume common ESC/POS bytes through a CUPS-specific
adapter and require separate physical certification

### Requirement: Future serial protocol separation
The design SHALL keep serial transport separate from model-specific scale
protocol parsers, including BBG Market 30.

#### Scenario: BBG Market 30
- **WHEN** BBG Market 30 support is implemented later
- **THEN** it SHALL use a SerialTransport and a separate BBG parser without
embedding Windows COM or Unix device paths in the parser

### Requirement: Future printer-mediated cash drawer
The design SHALL support `PRINTER_ESC_POS` and send `DRAWER_KICK` through a
configured RAW printer transport.

#### Scenario: RJ11 drawer
- **WHEN** a drawer is connected through a printer RJ11 port
- **THEN** the Agent SHALL use the configured printer transport and SHALL NOT
model the drawer as an independent USB device

### Requirement: Native artifact matrix
The build design SHALL produce separately identifiable artifacts per OS and CPU
architecture and SHALL not claim one universal artifact.

#### Scenario: Build publication
- **WHEN** a future platform artifact is published
- **THEN** its manifest SHALL record version, platform, architecture, checksum
and signature status
