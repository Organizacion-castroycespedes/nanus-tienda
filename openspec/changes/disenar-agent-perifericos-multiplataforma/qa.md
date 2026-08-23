# QA Evidence

## Scope

Windows x64 Peripheral Agent resilience and autostart certification only.
No scanner, balanza, cajón, DB, migrations, Linux, macOS or ARM64.

## Hardware Certified Results

- `SCHEDULED TASK REGISTERED` = PASS
- `SCHEDULED TASK COLD START` = PASS
- `DIRECT NODE LAUNCHER` = PASS
- `QUOTED ENTRYPOINT` = PASS
- `ENV BOOTSTRAP` = PASS
- `HEALTH GATE` = PASS
- `STDOUT LOGGING` = PASS
- `STDERR` = CLEAN
- `LAST TASK RESULT` = 0
- `NETWORK DEVICE PERSISTENCE` = PASS
- `AGENT RESTART RECOVERY` = PASS
- `WINDOWS RESTART RECOVERY` = PASS
- `DEVICE STATE SURVIVES OS REBOOT` = PASS
- `AGENT INSTALLATION ID PERSISTENCE` = PASS
- `STATE FILE LOAD` = PASS
- `USB REDISCOVERY` = PASS
- `NO MANUAL DEVICE RECONFIGURATION` = PASS
- `WINDOWS AUTOSTART` = PASS
- `AT LOGON` = PASS
- `AGENT START WITHOUT MANUAL INTERVENTION` = PASS
- `HEALTH AFTER REBOOT` = PASS
- `DEVICE PERSISTENCE AFTER AUTOSTART` = PASS
- `NO MANUAL AGENT START` = PASS
- `NETWORK RUNTIME RECOVERY` = PASS
- `XP-80 LAN PRINT AFTER REBOOT` = PASS
- `XP-80 LAN PRINT AFTER AUTOSTART` = PASS
- `MANUS E2E PRINT AFTER REBOOT` = PASS
- `PHYSICAL PRINT AFTER REBOOT` = PASS
- `PHYSICAL CUT AFTER REBOOT` = PASS
- `PHYSICAL CUT AFTER AUTOSTART` = PASS
- `CORS ALLOWED ORIGIN` = PASS
- `OPTIONS PREFLIGHT` = PASS
- `REMOTE WEB -> LOCAL AGENT` = PASS
- `ALLOW-LIST CONFIGURATION` = PASS
- `NO CORS WILDCARD` = PASS
- `MANUS -> LOCAL AGENT AFTER CORS FIX` = PASS
- `XP-80 LAN PRINT AFTER CORS FIX` = PASS
- `PHYSICAL PRINT AFTER CORS FIX` = PASS
- `PHYSICAL CUT AFTER CORS FIX` = PASS

## Evidence

- Endpoint: `http://127.0.0.1:4050`
- `agentInstallationId`: `c1adf724-b04d-4a9f-b565-d79f1c27c93d`
- Platform: `win32`
- Architecture: `x64`
- Version: `0.1.0`
- `persistenceState.schemaVersion = 1`
- `persistenceState.status = loaded`
- `configuredDevices = 1`
- `discoveredDevices = 1`

### XP-80 LAN

- `deviceId`: `network-xp80-qa-001`
- `connectionType`: `NETWORK`
- Host: `192.168.123.100`
- Port: `9100`
- `timeoutMs = 3000`
- Adapter: `NetworkEscposPrinterAdapter`
- `bytesSent = 744`
- Physical print: PASS
- Physical cut: PASS

### Network

- POS workstation Ethernet: `192.168.123.10`
- XP-80: `192.168.123.100`
- TCP port: `9100`
- `Test-NetConnection`: `TcpTestSucceeded = True`

### CORS

- Local Agent endpoint: `http://127.0.0.1:4050`
- Browser origin for QA: `http://192.168.1.9:3000`
- Allow-list sources: `config/agent.config.local.json` and
  `PERIPHERALS_ALLOWED_ORIGINS`
- Preflight route: `OPTIONS /printer/print-ticket`
- Preflight response: `204 No Content`
- `Access-Control-Allow-Origin`: `http://192.168.1.9:3000`
- `Access-Control-Allow-Credentials`: `true`
- `Access-Control-Allow-Methods`: `GET,POST,PATCH,OPTIONS`

## Verified Flow

1. Register XP-80 LAN once.
2. Restart Agent.
3. Confirm XP-80 LAN remains in `GET /devices`.
4. Do not run `POST /devices` again.
5. Print successfully.
6. Restart Windows.
7. Confirm XP-80 LAN remains persisted.
8. Print successfully after reboot.
9. Runtime status recovers from `NOT_REACHABLE` to `CONNECTED` after successful operation.
10. No manual reconfiguration was needed.

## Autostart Notes

- Scheduled Task name: `Manus Peripheral Agent`
- Task path: `\`
- Launcher uses `runtime\node.exe` directly.
- Launcher uses `app\main.js`.
- Launcher does not use `cmd.exe`.
- Launcher sets `PERIPHERALS_CONFIG_PATH`.
- Launcher quotes the entry point.
- Launcher supports paths with spaces such as `C:\Program Files\Manus\PeripheralAgent`.
- Launcher writes stdout/stderr logs and performs a health gate before returning `0`.
- Launcher avoids duplicate instances on `4050`.

## CORS Notes

- The Agent stays bound to `127.0.0.1` only.
- Browser access is allowed only from explicit origins in local config or
  `PERIPHERALS_ALLOWED_ORIGINS`.
- No wildcard CORS is used.
- The old QA origin `http://192.168.1.14:3000` is not part of the current
  certified package.
