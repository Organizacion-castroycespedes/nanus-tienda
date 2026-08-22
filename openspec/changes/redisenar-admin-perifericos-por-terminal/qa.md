## QA

### Preconditions

- Use `TERM-001` as the canonical terminal.
- Confirm the workstation is on the local Agent topology.
- Keep the persisted printer association for `TERM-001` pointing to `usb-printer-1f0028d1fa5243c2` before starting.
- Do not change scanner, scale or drawer settings.

### Manual QA: TERM-001 + XP-80 USB

1. Open `/[tenant]/config/terminals`.
2. Find `TERM-001  Terminal 1  Sucursal Principal`.
3. Click `Configurar periféricos`.
4. Confirm the app opens `/[tenant]/admin/peripherals?terminalId=<TERM-001 terminals.id>`.
5. Confirm the selected terminal is `TERM-001`.
6. Confirm the summary shows code, name, branch, active state and peripheral configuration status.
7. Confirm the printer block shows the XP-80 USB association.
8. Confirm the printer is shown as connected or detected if hardware is present.
9. Click `Probar impresión`.
10. Confirm the test print reaches the physical XP-80 USB and no false success is shown on failure.
11. Refresh the page.
12. Confirm `TERM-001` still resolves the USB printer association.

### Manual QA: XP-80 LAN appears as alternative without replacing USB

1. Keep `TERM-001` selected.
2. Open the discovery action in the printer block or agent block.
3. Confirm XP-80 LAN appears as a separate option from XP-80 USB.
4. Confirm XP-80 LAN displays `192.168.123.100:9100`.
5. Confirm XP-80 LAN is not automatically persisted as the selected printer.
6. Confirm XP-80 USB remains the current persisted association for `TERM-001`.
7. If you temporarily select XP-80 LAN, save it only as a deliberate manual test.
8. Immediately restore `TERM-001` to `usb-printer-1f0028d1fa5243c2`.
9. Reopen or resolve the terminal configuration.
10. Confirm the persisted printer returns to XP-80 USB.

### Expected outcomes

- `TERM-001` remains the canonical terminal.
- XP-80 USB stays the persisted printer by default.
- XP-80 LAN is visible as an alternative, not as an automatic replacement.
- No scanner HID, balanza or cajon behavior is required for this QA.

### Evidence

- CONFIG TERMINALS -> PERIPHERALS = PASS
- TERMINAL CANONICAL SELECTOR = PASS
- XP-80 USB ASSOCIATION = PASS
- XP-80 LAN ALTERNATIVE = PASS
- DISCOVERY DOES NOT AUTO-SAVE = PASS
- TEST PRINT = PASS
- CHANGE PRINTER = PASS
- UNASSOCIATE = PASS
- NO FALLBACK TO MOCK = PASS
- VISUAL = PASS
