## 1. Discovery and model

- [x] 1.1 Record current peripheral architecture, simulation boundaries, XP-80T capabilities and scope constraints.
- [x] 1.2 Add connection-specific USB device configuration without changing database persistence.
- [x] 1.3 Preserve NETWORK validation and `THERMAL_80MM` compatibility.

## 2. Peripheral Agent contract

- [x] 2.1 Add an injected USB printer queue discovery boundary for Windows and CUPS hosts.
- [x] 2.2 Extend device discovery and registration to associate only agent-discovered USB printer descriptors.
- [x] 2.3 Add a USB system-printer adapter and resolve printer adapters by connection type.
- [x] 2.4 Emit controlled job/log/WebSocket failures for unavailable USB queues and preserve NETWORK behavior.

## 3. Web contract and UI

- [x] 3.1 Extend shared web peripheral types for USB configuration and agent error classification.
- [x] 3.2 Refactor printer registration UI to select NETWORK or USB and show only connection-relevant fields.
- [x] 3.3 Keep agent HTTP/WS configuration and transport-independent test print calls intact.

## 4. Tests and evidence

- [x] 4.1 Add model, discovery and USB adapter tests using fakes; cover NETWORK timeout and refusal behavior.
- [x] 4.2 Add UI model/validation tests for connection field visibility and common-field retention where the web test stack permits.
- [x] 4.3 Create QA evidence with commands, technical results, hardware limitations and manual USB/LAN checklist.
- [x] 4.4 Run strict OpenSpec validation, affected tests, lint/build and `git diff --check`; record results.
