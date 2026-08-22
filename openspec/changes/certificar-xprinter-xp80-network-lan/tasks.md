## 1. Discovery and validation

- [x] 1.1 Review the current NETWORK printer config, adapter and UI.
- [x] 1.2 Confirm the canonical renderer and CUT sequence remain shared.
- [x] 1.3 Verify the current error mapping for network printer failures.

## 2. Certification work

- [x] 2.1 Keep the printer model as `PRINTER` with `THERMAL_80MM`.
- [x] 2.2 Keep `USB` and `NETWORK` as transports for the same printer family.
- [x] 2.3 Preserve USB RAW support and TERM-001 canonical resolution.
- [x] 2.4 Keep `host`, `port` and `timeoutMs` configurable.
- [x] 2.5 Keep test connection and test print flows available.

## 3. Tests and docs

- [x] 3.1 Validate TCP RAW success and timeout behavior.
- [x] 3.2 Validate refused, invalid host and offline cases.
- [x] 3.3 Validate renderer bytes and CUT match USB RAW.
- [x] 3.4 Document a reversible QA path that does not remove TERM-001 USB.
- [x] 3.5 Prepare physical LAN QA steps and mark hardware PASS only after
  physical evidence.
