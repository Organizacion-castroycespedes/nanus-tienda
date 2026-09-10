# QA evidence

## 7.2Q focused physical QA

Candidate: `ManusTerminalSetup-Integrated-7.2Q-QA-drawer-result-ux-qa9.exe`

- SHA256: `F4058EB316753702B5F3DC1FC0122277079271CC293898650103C5CD844568B5`
- Embedded Agent: `0.1.1-qa.9`
- XP-58 physical print: PASS.
- Cash drawer physical open through XP-58: PASS.
- Drawer parent: `usb-printer-0eb3fdb5ae50675c`.
- Explicit drawer certification: PASS.
- Drawer result semantics: PASS (`PULSE_SENT`).
- Ambiguous-result model and no automatic retry: PASS.
- Drawer layout: PASS.
- Bridge timeout: 17000 ms for the 15000 ms raw operation budget.
- PRIMARY_PRINTER state was unchanged; POS-80 remained primary and XP-58
  remained the explicit drawer parent.

This closes the XP-58 print and VIA_PRINTER cash-drawer physical QA block.
It does not complete the full P7 gate.

## 7.2U XP-80 cash-drawer physical QA

Candidate: `ManusTerminalSetup-Integrated-7.2U-QA-drawer-certification-state-qa9.exe`

- SHA256: `0FE807BBB683FE286205D54CDD578D659F4BDA2A31C14C8C13C517769DE8E109`
- Embedded Agent: `0.1.1-qa.9`.
- POS-80 physical device: `usb-printer-804a1994045911fd`.
- POS-80 queue/port: `XP-80` / `USB001`.
- POS-80 physical print and cutter: PASS.
- Drawer parent: POS-80 (`usb-printer-804a1994045911fd`).
- Certification transition: `false -> true` from the live DOM checkbox snapshot.
- Certification PATCH: `enabled=true`, HTTP 2xx.
- Canonical GET/verification: PASS; parent, queue, certification, and primary
  assignment were preserved without discovery.
- Drawer bridge: request `1`, timeout `17000 ms`, duration `5983 ms`, SUCCESS.
- UI result: `TESTING -> PULSE_SENT`; no automatic retry.
- Cash drawer physically opened through XP-80: PASS.
- XP-58 queue, drawer state, and transport remained preserved.

This closes the XP-80 print/cutter and VIA_PRINTER cash-drawer physical QA
block. It does not complete the full P7 gate.

## Primary/default printer switching physical QA

Using the certified 7.2U environment:

- POS-80 -> XP-58 primary: PASS.
- XP-58 -> POS-80 primary: PASS.
- Exactly one `PRIMARY_PRINTER` assignment was present after each switch.
- POS-80 -> `XP-80` and XP-58 -> `XP-58` queue associations were preserved.
- Drawer parent stayed POS-80 and POS-80 drawer certification stayed true.
- No discovery, reinstall, restart, print, or drawer operation was needed.
- Queue-only XP-80 API identity remained present internally, with
  `physicalDetected=false`/`OFFLINE`; the productive device controller filters
  it when the associated physical POS-80 owns `XP-80`, so it is not actionable
  in the user-facing inventory.

The Installer persists primary status as the local Agent metadata field
`manusAssignmentRole=PRIMARY_PRINTER`. `assignDevice()` clears that role from
the previous physical printer before setting it on the selected printer. POS
cloud synchronization reads that logical role in
`web/domains/peripherals/local-config-sync.ts`; Windows default-printer state
is not used.

## Controlled Agent restart persistence

- Agent `0.1.1-qa.9` recovered after exactly one service restart.
- Installation ID `64e835b5-5a09-4865-817a-55cd10931a7e` was preserved.
- Health returned `ok`, `REAL`, and `0.1.1-qa.9`; the 4050 listener returned.
- POS-80 `XP-80` association, `PRIMARY_PRINTER`, drawer parent, and drawer
  certification remained unchanged.
- XP-58 `XP-58` association remained unchanged.
- One post-restart `/devices/discover` also preserved all logical state.

This closes the controlled multi-printer restart-persistence gate. Scanner
barcode capture remains open.

## P7 gates still open

1. Physical/default-printer acceptance, including POS-80/XP-80 behavior and
   one-primary assignment switching.
2. Real scanner barcode capture and the no-scanner/scale-absent non-blocking
   path.
3. Installer completion to POS launch and same-configuration visibility in
   POS, including post-install edit without reinstall.
4. Fullscreen/single-instance/operator-window regression.
5. Final authenticated local-to-cloud handoff regression in the packaged
   workflow.
6. Final packaging/regression certification and the remaining fresh,
   repair, uninstall, and remove-data evidence tracked by P7/P8.
