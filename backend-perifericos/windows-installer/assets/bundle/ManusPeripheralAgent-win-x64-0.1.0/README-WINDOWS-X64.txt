MANUS PERIPHERAL AGENT - Windows x64 portable

1. Copy this directory to C:\Program Files\Manus\PeripheralAgent (administrator) or another local path.
2. Edit config\agent.config.local.json only for local workstation values. It accepts no secrets.
3. Double-click start-agent.cmd.
4. Check http://127.0.0.1:4050/health.
5. Call POST http://127.0.0.1:4050/devices/discover.
6. Install autostart with install-agent-autostart.ps1.
7. Inspect autostart with status-agent-autostart.ps1.
8. Remove autostart with remove-agent-autostart.ps1.

The agent is loopback-only by default. Its Node runtime is embedded; npm and Git are not required on the POS workstation.
PowerShell 5.1 compatibility: the autostart launcher sets PERIPHERALS_CONFIG_PATH in the launcher environment before process start, and passes the main entry point as a quoted argument so paths with spaces like C:\Program Files\Manus\PeripheralAgent work.
Logs/state are under %LOCALAPPDATA%\Manus\PeripheralAgent.
Autostart uses a Scheduled Task in the current user session and launches the portable installation from its own folder.
