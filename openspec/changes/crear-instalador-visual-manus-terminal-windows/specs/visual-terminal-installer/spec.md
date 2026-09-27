## ADDED Requirements

### Requirement: Visual installation progress
The Windows installer UI SHALL show each installation step with an explicit state from `PENDING`, `RUNNING`, `SUCCESS`, `WARNING`, `ERROR` or `SKIPPED`.

#### Scenario: Installation progresses
- **WHEN** Installer Core emits step events
- **THEN** the UI renders the step name, icon, state and optional duration/message without exposing stack traces

### Requirement: Detected device cards
The UI SHALL show detected printers and other peripherals using real Agent responses.

#### Scenario: XP-58 is detected
- **WHEN** discovery returns XP-58 on USB001
- **THEN** the UI shows XP-58, USB, USB001, `THERMAL_58MM`, 58 mm and connected status

#### Scenario: Optional peripherals are absent
- **WHEN** scanner or scale discovery returns no device
- **THEN** the UI shows `No detectado` and does not mark installation as failed

### Requirement: Safe device configuration
The UI SHALL allow printer profile selection and SHALL enable drawer actions only when the real device capability and persisted certification are true.

#### Scenario: Configure XP-58
- **WHEN** operator selects `THERMAL_58MM`
- **THEN** UI sends the existing `PATCH /devices/:id` contract and displays persisted configuration

#### Scenario: Uncertified drawer
- **WHEN** drawer certification is absent
- **THEN** `Probar apertura` is disabled and no drawer request is sent

### Requirement: Technical details on demand
The UI SHALL hide implementation details from the primary flow and SHALL provide a technical details view with sanitized diagnostics.

#### Scenario: Open technical details
- **WHEN** operator selects `Ver detalles técnicos`
- **THEN** UI shows Agent version, mode, status, service account, installation identity, platform, architecture, device data and summarized logs without secrets

### Requirement: Terminal completion
The UI SHALL show a final terminal-ready screen only after required installation and Agent health gates succeed.

#### Scenario: Successful terminal
- **WHEN** service is active and required printer configuration is valid
- **THEN** UI shows `¡Terminal lista!` with service, printer, paper and POS readiness checklist

### Requirement: Responsive installer layout
The UI SHALL fit 1024x768, 1280x720, 1366x768 and 1920x1080 without horizontal overflow.

#### Scenario: Limited viewport height
- **WHEN** viewport height is limited
- **THEN** content scrolls internally while header and primary actions remain accessible

### Requirement: Agent port ownership preflight

The Installer Core SHALL verify ownership and availability of
`127.0.0.1:4050` before copying or activating an Agent payload.

#### Scenario: Unmanaged Agent blocks installation

- **WHEN** the Agent port is occupied and `ManusPeripheralAgent` is missing or stopped
- **THEN** installation stops before payload mutation with a sanitized diagnostic and does not terminate the occupying process

#### Scenario: Managed Agent releases the port

- **WHEN** the port is occupied by the running managed service
- **THEN** the Core stops that service, confirms `STOPPED`, waits for the port to become available, and only then copies or activates the replacement

#### Scenario: Health gate preserves identity

- **WHEN** a managed upgrade or rollback starts the Agent
- **THEN** health must match version, platform, architecture and the previous `agentInstallationId` when one was available; HTTP 200 alone is insufficient

#### Scenario: Rollback is not merely file restoration

- **WHEN** rollback reactivates the previous files but the service cannot start or health cannot match
- **THEN** the result is `ROLLBACK_FAILED` and the UI does not claim successful restoration

### Requirement: User-friendly errors and cancellation
The UI SHALL translate technical failures into actionable Spanish messages and SHALL require confirmation before cancellation can leave a partial installation.

#### Scenario: Discovery timeout
- **WHEN** discovery times out
- **THEN** UI shows `No pudimos detectar las impresoras`, offers `Reintentar` and keeps technical timeout only in details
