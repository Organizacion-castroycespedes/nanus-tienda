## ADDED Requirements

### Requirement: Single QA Agent version source
The QA Agent and installer version SHALL come only from `QA_AGENT_VERSION` in `backend-perifericos/scripts/agent-version.mjs`. In the QA environment a different requested version SHALL be rejected. Production SHALL keep resolving from the package version and SHALL reject an override.

#### Scenario: QA resolves the approved version
- **WHEN** the version is resolved for the QA environment without an override
- **THEN** the result is `QA_AGENT_VERSION`.

#### Scenario: QA override with another version
- **WHEN** a QA build requests a version different from `QA_AGENT_VERSION`
- **THEN** version resolution fails and names the approved version.

#### Scenario: Production override
- **WHEN** a production build requests a version different from the package version
- **THEN** version resolution fails and production keeps the package version.

### Requirement: QA candidate identity is never reused
A QA candidate with different bytes SHALL use a QA version that no earlier built or installed candidate used. `0.1.1-qa.18` SHALL follow the installed Build 07 identity `0.1.1-qa.16` and the built Build 08 identity `0.1.1-qa.17`, and both earlier identities SHALL be rejected as QA overrides.

#### Scenario: Reuse of an earlier identity
- **WHEN** a QA build requests `0.1.1-qa.16` or `0.1.1-qa.17`
- **THEN** version resolution fails and the candidate keeps `0.1.1-qa.18`.

### Requirement: Static QA build never executes generated artifacts
The QA static build entrypoint SHALL use Node and Go executables given by verified absolute paths, SHALL run only the existing packaging stages plus static validation, and SHALL NOT start the generated installer, Agent, Electron shell or any device operation. It SHALL refuse a build environment that injects enrollment trust material.

#### Scenario: Build plan contents
- **WHEN** the QA build plan is produced
- **THEN** it contains only packaging stages and the static validator, and no step executes a generated executable.

### Requirement: Static validation of the QA artifact fails closed
Static validation SHALL check the packaged QA configuration (`mode=REAL`, real adapters enabled, startup discovery disabled, trust material absent), manifests, the PE x64 identity, exact embedded markers and the output hash, and SHALL write only a sanitized sidecar report. An artifact that fails a check, or that contains the QA UAC observer, SHALL be rejected without a report of success.

#### Scenario: Unsafe QA configuration
- **WHEN** the packaged QA configuration enables startup discovery or contains trust material
- **THEN** validation fails before any report is produced.

#### Scenario: Valid synthetic artifact
- **WHEN** a synthetic unsigned AMD64 artifact with the expected configuration, manifests and markers is validated
- **THEN** validation passes without executing it and writes only the sidecar report.

### Requirement: Packaged POS includes the Electron close-policy module
Static validation SHALL open the packaged POS `app.asar` and SHALL reject the artifact when `dist/main.js` cannot resolve the compiled close-policy module.

#### Scenario: Missing close-policy module
- **WHEN** the packaged `app.asar` main module cannot resolve `window-close-policy`
- **THEN** static validation rejects the artifact.
