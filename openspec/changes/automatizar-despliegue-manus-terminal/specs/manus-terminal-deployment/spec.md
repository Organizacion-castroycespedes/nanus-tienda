## ADDED Requirements

### Requirement: Installable PeripheralAgent artifacts

The project SHALL produce installable artifacts for Windows x64 and Linux x64
that can be used on a fresh workstation without requiring global Node, npm or
Git on the target machine.

#### Scenario: Supported platform is detected

- **WHEN** the installer runs on Windows x64 or Linux x64
- **THEN** it SHALL accept the platform and continue with installation

#### Scenario: Unsupported platform is rejected

- **WHEN** the installer runs on an unsupported OS or architecture
- **THEN** it SHALL fail fast with a clear message

#### Scenario: Install uses local artifact only

- **WHEN** the installer runs in this change
- **THEN** it SHALL use only the supplied local bundle and SHALL NOT download
  releases from a remote version server

### Requirement: Windows installer bootstrapper

The project SHALL produce a transportable Windows x64 installer executable that
installs PeripheralAgent into the approved layout, registers the service and
finishes only after a successful health gate.

#### Scenario: Windows installer is transportable

- **WHEN** the Windows installer is built
- **THEN** it SHALL produce a single transportable `ManusTerminalSetup-<version>-win-x64.exe`
- **AND** it SHALL be reproducible from the repository with a documented build
  command

#### Scenario: Windows installer uses approved layout

- **WHEN** the Windows installer runs
- **THEN** immutable files SHALL be installed under `C:\\Program Files\\Manus\\PeripheralAgent`
- **AND** mutable config, state and logs SHALL live under
  `C:\\ProgramData\\Manus\\PeripheralAgent`

#### Scenario: Windows installer writes uninstall metadata

- **WHEN** the Windows installer completes
- **THEN** it SHALL create an Apps & Features entry for `Manus Peripheral Agent`
- **AND** it SHALL expose an uninstall action that removes the service and
  application files while preserving mutable data unless a full-data removal is
  explicitly requested

#### Scenario: Windows installer health gate succeeds

- **WHEN** the Windows installer starts the service
- **THEN** it SHALL wait for `GET /health`
- **AND** it SHALL report success only after a `200` response is observed

#### Scenario: Windows service uses least privilege

- **WHEN** the Windows service is registered
- **THEN** it SHALL use a minimal-privilege service account for the MVP
- **AND** it SHALL not run permanently as an interactive administrator user

### Requirement: Stable filesystem layout

The installer SHALL keep immutable application files separate from mutable
configuration, state and logs.

#### Scenario: Windows layout is stable

- **WHEN** the agent is installed on Windows
- **THEN** immutable files SHALL live under `C:\\Program Files\\Manus\\...`
- **AND** mutable config, state and logs SHALL live outside the application
  directory

#### Scenario: Linux layout is stable

- **WHEN** the agent is installed on Linux
- **THEN** immutable files SHALL live under `/opt/manus/...`
- **AND** mutable config, state and logs SHALL live under `/etc`, `/var/lib`
  and `/var/log`

#### Scenario: Layout supports future updates

- **WHEN** a future version is installed
- **THEN** the layout SHALL allow versioned bundles and a stable active pointer
- **AND** it SHALL NOT require in-place overwrite of the active version

### Requirement: Native service registration

The installer SHALL register the PeripheralAgent as an operating system service
with automatic startup.

#### Scenario: Windows service is registered

- **WHEN** the Windows installer completes
- **THEN** it SHALL register a single service named `ManusPeripheralAgent`
- **AND** it SHALL enable automatic startup

#### Scenario: Linux systemd unit is registered

- **WHEN** the Linux installer completes
- **THEN** it SHALL register a single `systemd` unit named
  `manus-peripheral-agent.service`
- **AND** it SHALL enable automatic startup

#### Scenario: Reinstall does not duplicate the service

- **WHEN** the installer is executed again for the same machine
- **THEN** it SHALL update or reuse the existing service
- **AND** it SHALL NOT create duplicate services

### Requirement: Health-gated installation result

The installer SHALL only report success after the Agent starts and its local
health check returns a successful response.

#### Scenario: Health check succeeds

- **WHEN** the service starts successfully
- **THEN** the installer SHALL call `GET /health`
- **AND** it SHALL report `SUCCESS` only if the response is `200`

#### Scenario: Health check fails

- **WHEN** the service does not respond healthy
- **THEN** the installer SHALL report `FAILED`
- **AND** it SHALL include enough technical detail for diagnosis without
  printing secrets

#### Scenario: Health response is stable

- **WHEN** `GET /health` succeeds
- **THEN** it SHALL include the active agent name, platform, architecture,
  version, uptime and persistence status

### Requirement: Idempotent install and repair

The installer SHALL be safe to run multiple times on the same machine.

#### Scenario: Fresh install

- **WHEN** no previous installation exists
- **THEN** the installer SHALL create the target layout, write local config,
  register the service and start it

#### Scenario: Same version reinstall

- **WHEN** the same version is installed again
- **THEN** the installer SHALL behave like repair or no-op
- **AND** it SHALL preserve local configuration unless an explicit reset is
  requested

#### Scenario: Upgrade from previous version

- **WHEN** a newer version is installed over an older one
- **THEN** the installer SHALL stage the new bundle, switch the active version
  atomically and restart the service

#### Scenario: Incomplete install is recovered

- **WHEN** a previous installation was interrupted
- **THEN** the installer SHALL detect the partial state
- **AND** it SHALL either resume safely or roll back to the last known good
  version

### Requirement: Least privilege and local config safety

The deployment SHALL run with the minimum privileges needed and SHALL keep
local configuration free of secrets.

#### Scenario: Windows privilege boundary

- **WHEN** the Windows service runs
- **THEN** it SHALL use a minimal-privilege service account
- **AND** it SHALL only write to the configured mutable directories

#### Scenario: Linux privilege boundary

- **WHEN** the Linux service runs
- **THEN** it SHALL use a dedicated system user or equivalent minimal-privilege
  account

#### Scenario: Local config contains no secrets

- **WHEN** the installer materializes local config
- **THEN** it SHALL not write tokens or secrets into the config file by default

#### Scenario: Logs are sanitized

- **WHEN** the installer or service emits logs
- **THEN** it SHALL not print secrets, tokens or full sensitive payloads

### Requirement: Observability and diagnostics

The deployment SHALL expose clear status and logs for installation and runtime
diagnosis.

#### Scenario: Install log exists

- **WHEN** the installer runs
- **THEN** it SHALL write an installation log in the documented logs directory

#### Scenario: Status can be queried

- **WHEN** an operator checks the installation status
- **THEN** the deployment SHALL report service presence, running state, version
  and last health result

#### Scenario: Runtime logs are separated

- **WHEN** the Agent writes runtime logs
- **THEN** they SHALL remain separate from install-time logs

### Requirement: Future updater ready layout

The deployment SHALL reserve metadata and layout needed for a future updater
without activating remote update behavior in this change.

#### Scenario: Manifest data is present

- **WHEN** a version is installed
- **THEN** the deployment SHALL record version metadata and a machine-readable
  manifest entry

#### Scenario: Checksums can be added later

- **WHEN** future distribution introduces checksums or signatures
- **THEN** the current layout SHALL be able to store and validate them without
  redesign

#### Scenario: Remote update remains out of scope

- **WHEN** this change is delivered
- **THEN** it SHALL NOT contact a remote update service
- **AND** it SHALL NOT implement rollout or update scheduling
