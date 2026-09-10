## ADDED Requirements

### Requirement: Self-contained Windows package
The Windows package SHALL include the Electron executable, runtime resources, `resources/app.asar`, DLLs, locales, icons, and required configuration.

#### Scenario: Machine without Node
- **WHEN** the package is installed on Windows without Node.js or npm
- **THEN** `Manus POS.exe` SHALL start without downloading or invoking a developer runtime.

#### Scenario: Package validation
- **WHEN** packaging validation inspects the output
- **THEN** it SHALL verify required files, version metadata, executable target, and absence of development-only localhost dependency.

### Requirement: Versioned POS payload
The POS payload SHALL be staged and validated before activation, with a version and required executable/resources present.

#### Scenario: Invalid staging
- **WHEN** the staged POS payload lacks its executable, `app.asar`, or version metadata
- **THEN** activation SHALL stop and the previously active payload SHALL remain unchanged.

#### Scenario: Valid staging
- **WHEN** all package validations pass
- **THEN** the installer SHALL activate the versioned POS payload atomically through Installer Core.
