## ADDED Requirements

### Requirement: Coordinated Agent and POS installation
Installer Core SHALL remain the sole authority for installing, activating, repairing, rolling back, and uninstalling Agent and POS payloads.

#### Scenario: Fresh installation
- **WHEN** a clean Windows machine runs the integrated installer
- **THEN** the Core SHALL stage and validate both payloads before registering the Agent service and offering POS launch.

#### Scenario: Core failure
- **WHEN** a required Agent or POS step fails
- **THEN** the Core SHALL expose the failure and restore the previous valid state without a second parallel installer.

### Requirement: Standard uninstall and remove-data
Standard uninstall SHALL remove installed Agent/POS payloads, service integration, and Manus-created shortcuts while preserving contracted ProgramData; `--remove-data` SHALL additionally remove applicable Manus ProgramData.

#### Scenario: Standard uninstall
- **WHEN** the operator runs standard uninstall
- **THEN** payloads and shortcuts SHALL be removed, service and registry integration SHALL be absent, and preserved configuration SHALL remain byte-identical.

#### Scenario: Remove-data uninstall
- **WHEN** the operator explicitly selects `--remove-data`
- **THEN** payloads, shortcuts, applicable ProgramData, registry integration, and temporary cleanup artifacts SHALL be removed with bounded cleanup and no residual helper process.

### Requirement: Repair preserves user state
Repair SHALL use independent staging and backup paths and SHALL preserve approved POS configuration/session data unless the operator explicitly requests data removal.

#### Scenario: Failed repair
- **WHEN** POS activation or service verification fails during repair
- **THEN** the previous Agent/POS payloads, current pointers, service state, and preserved user data SHALL be restored or reported as requiring manual attention.
