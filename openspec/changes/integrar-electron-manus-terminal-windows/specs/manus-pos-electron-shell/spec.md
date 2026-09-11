## ADDED Requirements

### Requirement: Productive Electron shell
The installed POS SHALL launch a packaged Electron runtime without requiring Node.js or npm on the target machine.

#### Scenario: Launch packaged POS
- **WHEN** the operator starts the installed `Manus POS.exe`
- **THEN** Electron SHALL create the configured BrowserWindow and load the approved production frontend URL.

#### Scenario: Frontend unavailable
- **WHEN** the production frontend cannot be reached
- **THEN** the shell SHALL show an operational error and SHALL NOT claim that POS is ready.

### Requirement: Secure renderer boundary
The Electron shell SHALL run with `contextIsolation: true`, `nodeIntegration: false`, sandbox enabled, and a preload surface limited to approved APIs.

#### Scenario: Renderer requests privileged operation
- **WHEN** renderer code attempts an unallowlisted filesystem, shell, registry, or arbitrary network operation
- **THEN** the shell SHALL reject the operation.

#### Scenario: External navigation
- **WHEN** a page requests navigation outside the configured origin
- **THEN** the shell SHALL block it or open it only through the approved external-protocol policy.

### Requirement: Controlled first launch
The installer SHALL offer an explicit action to open POS after successful installation and SHALL avoid duplicate instances.

#### Scenario: Operator opens POS
- **WHEN** the operator selects `Abrir Manus POS`
- **THEN** Installer Core SHALL launch the packaged executable with controlled working directory and arguments.

#### Scenario: POS already running
- **WHEN** the operator requests a second launch while an instance exists
- **THEN** the integration SHALL focus or report the existing instance without creating an unintended duplicate.

### Requirement: Allowlisted Agent health bridge
The shell SHALL expose Agent health only through a typed preload/IPC API that performs a fixed loopback `GET /health` request with bounded timeout and sanitized responses.

#### Scenario: Agent available
- **WHEN** renderer code invokes `getAgentHealth()` and the local Agent returns valid JSON
- **THEN** the shell SHALL return normalized health fields without exposing the request URL or arbitrary transport controls.

#### Scenario: Agent unavailable or malformed
- **WHEN** the Agent times out, refuses the connection, or returns invalid/oversized data
- **THEN** the shell SHALL return a safe unavailable reason and SHALL NOT expose stack traces or raw response content.

### Requirement: Persistent terminal window lifecycle
The terminal shell SHALL use a frameless, display-sized, non-minimizable window, block normal close requests including Alt+F4, and allow only one active POS instance.

#### Scenario: Display metrics change
- **WHEN** resolution, DPI, or display topology changes
- **THEN** the shell SHALL recompute bounds from the display work area without hardcoded resolution.

#### Scenario: Second instance
- **WHEN** a second POS process starts
- **THEN** it SHALL exit without creating an independent window and the first window SHALL be focused or restored.

#### Scenario: Normal close request
- **WHEN** renderer code or Alt+F4 requests normal close
- **THEN** the shell SHALL keep the application running and SHALL expose no generic close authority to the renderer.

#### Scenario: Renderer crash
- **WHEN** the renderer process exits unexpectedly
- **THEN** the shell SHALL reload within a bounded recovery policy and show a terminal error after the limit.
### Requirement: Terminal window protection
The installed terminal shell SHALL remain persistent during normal operation, adapt to display work-area changes, and prevent accidental close, minimize, or duplicate instances.

#### Scenario: Normal operator use
- **WHEN** the operator presses Alt+F4 or a normal close request is raised
- **THEN** the POS window SHALL remain running and no renderer API SHALL terminate it.

#### Scenario: Display topology changes
- **WHEN** resolution, DPI, or monitor topology changes
- **THEN** the shell SHALL resize to the current primary display work area without a hardcoded resolution.

#### Scenario: Renderer failure
- **WHEN** the renderer crashes or becomes unresponsive
- **THEN** the shell SHALL apply bounded recovery and show an operational terminal error after the recovery limit.
