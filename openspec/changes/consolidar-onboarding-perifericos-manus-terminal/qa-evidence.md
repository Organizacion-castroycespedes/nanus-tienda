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

## Local Web physical scanner smoke

- Branch: `feat/develop/despliegue-manus-terminal`.
- Frontend source: `web/modules/pos/components/PosScreen.tsx`.
- Local Web URL: `http://localhost:3000`.
- Panel operativo POS: CLOSED.
- Permanent main search: USED and focused.
- Physical USB HID scanner: USED; no manual Enter.
- Product: `Contra Muslo`.
- Barcode: `353962561087655`.
- Cart quantity: `8 -> 9` (delta `+1`).
- Single add: PASS; duplicate add: NO.
- Focus returned to the permanent main search: PASS.
- `/scanner/simulate`: not used.
- Agent scanner path: not used.

This is a LOCAL WEB PHYSICAL SMOKE PASS. It does not certify the final QA
frontend deployment or the packaged Electron physical flow.

## Final packaged Electron physical scanner QA

- QA frontend: `https://www.apptiendamanus.space`.
- Packaged Manus POS Electron: PASS.
- Panel operativo POS: CLOSED; permanent main search: VISIBLE.
- Physical USB HID scanner: PASS; manual Enter: NO.
- Product: `Contra Muslo`; barcode: `353962561087655`.
- Main-view product add: PASS; single add: PASS; duplicate add: NO.
- Panel operativo required: NO.
- Scanner-generated terminator and focus return: PASS.

This is the FINAL QA PHYSICAL PASS for the real HID scanner P7 block. It is
distinct from the preceding local Web physical smoke PASS.

## Final packaged Electron fullscreen QA

- Candidate: `ManusTerminalSetup-Integrated-7.2X-QA-display-bounds-fullscreen-qa9.exe`.
- Installer SHA256: `302ABA4DC518807A9A340A42F870E13B759291C7A935129F3CA92873993966A6`.
- POS reconciliation: PASS; installed Electron payload hashes matched the
  fresh embedded payload.
- Physical fullscreen: PASS; the terminal covered the full display.
- Taskbar visible: NO; desktop exposed: NO.
- Frameless: PASS; fullscreen remained enforced: PASS.
- Alt+F4: PASS; SSH HWND diagnostics were unavailable outside the interactive
  desktop session and did not block human physical acceptance.

This closes the P7 fullscreen physical QA block. Scanner remains PASS/FROZEN.

## Separate configuration finding

- QA WARNING: `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` must be a public HTTPS
  URL in production.
- Classification: OPEN / separate configuration finding.
- This warning does not block the real HID scanner result and is not fixed in
  this scanner closure.

## P7 authenticated local-to-cloud handoff blocker

The following gates remain CLOSED and frozen: fullscreen, real HID scanner,
POS reconciliation, cold-boot Agent persistence, installation ID persistence,
and primary/drawer persistence.

The authenticated local-to-cloud handoff is OPEN. Physical QA showed that the
packaged Electron Agent was healthy on `http://127.0.0.1:4050` with persisted
devices, but the peripheral configuration UI selected the browser transport
and rejected the local endpoint under production HTTPS validation. The fix is
tracked separately in
`corregir-handoff-agent-local-perifericos-electron`.

The required split is explicit: packaged Electron uses the existing typed
`window.manusTerminal` bridge and fixed Agent loopback; pure Web keeps its
existing configured HTTPS validation. No generic IPC/HTTP proxy is allowed.

## P7 gates still open

1. Installer completion to POS launch and same-configuration visibility in
   POS, including post-install edit without reinstall.
2. Final authenticated local-to-cloud handoff regression in the packaged
   workflow.
3. Final packaging/regression certification and the remaining fresh,
   repair, uninstall, and remove-data evidence tracked by P7/P8.
