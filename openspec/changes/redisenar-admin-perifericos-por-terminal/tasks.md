## 1. Routing and canonical terminal entry

- [x] 1.1 Add the `Configurar periféricos` action from `/[tenant]/config/terminals` to deep-link into `/[tenant]/admin/peripherals?terminalId=<terminals.id>`.
- [x] 1.2 Ensure the deep-link uses `terminals.id` only and never sends `posTerminalId` or `local-terminal`.
- [x] 1.3 Keep `/admin/peripherals` route permission behavior stable while preserving the current authorized flow.

## 2. Terminal-centric admin screen

- [x] 2.1 Replace the current mock-first landing state with a canonical terminal selector sourced from `/config/terminals`.
- [x] 2.2 Update terminal switching to rewrite the query param, reload the resolved configuration and clear transient state from the previous terminal.
- [x] 2.3 Show terminal summary fields for code, name, branch, active state and peripheral configuration status.
- [x] 2.4 Move `posTerminalId`, `agentTerminalCode` and other bridge identifiers into a technical details section.

## 3. Agent status and operational peripheral blocks

- [x] 3.1 Simplify the Agent block to availability, version, local connection, detected device count, reconnect and discover actions.
- [x] 3.2 Reorganize the main content into printer, scanner, scale and cash drawer blocks.
- [x] 3.3 Keep scanner, scale and cash drawer settings visible without adding new physical behavior.
- [x] 3.4 Hide or collapse technical QA tools by default.

## 4. Printer workflow and discovery

- [x] 4.1 Make printer association explicit with associate, change, test print and disassociate actions.
- [x] 4.2 Ensure discovery only refreshes runtime inventory and does not persist settings automatically.
- [x] 4.3 Show XP-80 USB and XP-80 LAN as separate options, including the network endpoint for LAN.
- [x] 4.4 Keep `deviceId` in advanced/copyable details instead of primary labels.
- [x] 4.5 Preserve the separation between Agent runtime registry and terminal peripheral persistence.

## 5. States, permissions and compatibility

- [x] 5.1 Implement explicit UX states for agent offline, terminal without profile, printer not configured, configured but not detected, device available but not associated, USB disconnected, NETWORK timeout, connection refused, invalid NETWORK config and failed test print.
- [x] 5.2 Preserve current permission rules and document any minimum necessary adjustment only if required for the authorized flow.
- [x] 5.3 Preserve TERM-001 canonical resolution, XP-80 USB, XP-80 LAN, localhost Agent topology, mock fixtures and existing scanner/scale/drawer settings.
- [x] 5.4 Prevent automatic replacement of TERM-001 persisted `printerDeviceId`.

## 6. Tests and QA documentation

- [x] 6.1 Add tests for deep-link routing, canonical terminal selection, terminal change, XP-80 USB/LAN as separate options and discovery not mutating persistence.
- [x] 6.2 Add tests for explicit association, disassociation, configured-but-not-detected, agent offline and absence of fallback to `local-terminal`.
- [x] 6.3 Add QA documentation for manual validation with `TERM-001` + XP-80 USB and for verifying XP-80 LAN appears as an alternative without replacing USB.
