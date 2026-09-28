## ADDED Requirements

### Requirement: Atomic login branding configuration

The Web login MUST use `LOGIN_BG_IMAGE` and `LOGIN_BRAND_NAME` as one public visual configuration. When both values are non-empty, the login MUST use both configured values. When either value is absent or blank, the login MUST use the complete EMAUS POS fallback: `/logo-login-tablet.png` and `EMAUS POS`.

#### Scenario: DEV or QA Manus branding

- **WHEN** the Web deployment receives `LOGIN_BG_IMAGE=/login-bg.png` and `LOGIN_BRAND_NAME=MANUS POS`
- **THEN** the login uses the Manus image and Manus brand name together

#### Scenario: No branding variables

- **WHEN** neither branding variable is configured
- **THEN** the login uses `/logo-login-tablet.png` and `EMAUS POS`

#### Scenario: Partial branding variables

- **WHEN** only one branding variable is configured
- **THEN** the login uses the complete EMAUS fallback and does not mix brands

### Requirement: Remote shell environment separation

The Electron shell MUST keep using the existing environment profile to select its remote Web URL. Login branding MUST be supplied by that Web deployment and MUST NOT change the Agent loopback origin, authentication contract, or Electron navigation policy.

#### Scenario: QA shell selection

- **WHEN** the QA packaging profile is selected
- **THEN** the shell targets `https://www.apptiendamanus.space/login` and keeps Agent access at `http://127.0.0.1:4050`

#### Scenario: Production shell selection

- **WHEN** the production packaging profile is selected
- **THEN** the shell targets `https://portal.emaus.centrivosoft.com/login` and does not inherit QA branding configuration automatically

### Requirement: Profile-aware Agent version

The Windows QA packaging profile MUST emit Agent metadata and bundle paths for `0.1.1-qa.13`. The production profile MUST keep the package source version `0.1.1-prd.2`. `MANUS_INSTALLER_OUTPUT_NAME` MUST only select the artifact filename and MUST NOT override internal version metadata.

#### Scenario: QA Agent package

- **WHEN** `installer:windows-x64:qa` runs with the approved profile
- **THEN** `VERSION`, `VERSION.json`, bundle directory, manifest, and installer metadata use `0.1.1-qa.13`

#### Scenario: Production Agent package

- **WHEN** `installer:windows-x64:production` runs
- **THEN** Agent metadata remains `0.1.1-prd.2` and the production URL remains unchanged

#### Scenario: Output filename override

- **WHEN** `MANUS_INSTALLER_OUTPUT_NAME=ManusTerminalSetup-0.1.1-qa.13-win-x64.exe` is set
- **THEN** only the output filename changes and internal metadata still comes from the QA version resolver
