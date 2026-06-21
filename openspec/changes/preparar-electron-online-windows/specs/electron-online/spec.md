## ADDED Requirements

### Requirement: Electron online shell

Manus POS SHALL provide an Electron desktop shell that loads the existing web frontend in online mode.

#### Scenario: Electron opens configured Manus web URL

- **WHEN** `MANUS_WEB_URL` is configured
- **THEN** Electron SHALL load that URL in the desktop window

#### Scenario: Electron defaults to local web URL in development

- **WHEN** `MANUS_WEB_URL` is not configured
- **THEN** Electron SHALL load `http://localhost:3000`

#### Scenario: Electron does not duplicate frontend routes or business logic

- **WHEN** the Electron shell starts
- **THEN** it SHALL load the existing web frontend and SHALL NOT define POS, caja, pedidos, clientes or business workflow routes

### Requirement: Electron security baseline

The Electron shell SHALL use a secure BrowserWindow baseline.

#### Scenario: Node integration is disabled in renderer

- **WHEN** BrowserWindow is created
- **THEN** `nodeIntegration` SHALL be disabled for renderer content

#### Scenario: Context isolation is enabled

- **WHEN** BrowserWindow is created
- **THEN** `contextIsolation` SHALL be enabled

#### Scenario: Preload script exposes no business APIs in this phase

- **WHEN** the preload script runs
- **THEN** it SHALL expose no POS, caja, inventory, customer, permission or backend business APIs to the renderer

#### Scenario: External navigation is restricted or explicitly handled

- **WHEN** renderer content attempts to navigate outside the configured Manus web origin
- **THEN** Electron SHALL block direct navigation or open the external URL with the operating system shell

### Requirement: Windows-first development

The Electron shell SHALL be documented as Windows-first for the initial implementation.

#### Scenario: Development instructions mention Windows as primary target

- **WHEN** developers read Electron documentation
- **THEN** Windows SHALL be named as the primary initial development target

#### Scenario: Linux and macOS remain future compatibility targets

- **WHEN** platform support is described
- **THEN** Linux and macOS SHALL remain future compatibility targets for later validation

#### Scenario: No installers are generated in this phase

- **WHEN** this change is complete
- **THEN** it SHALL NOT generate `.exe`, `.msi`, AppImage, `.deb`, `.rpm`, `.dmg` or `.pkg` installers

### Requirement: No offline behavior

The Electron shell SHALL remain online-only in this phase.

#### Scenario: Electron requires access to the configured web URL

- **WHEN** Electron starts
- **THEN** it SHALL require access to the configured web URL to operate Manus POS

#### Scenario: No sync queue is created

- **WHEN** this change is complete
- **THEN** no sync queue SHALL be introduced

#### Scenario: No local operational data persistence is introduced

- **WHEN** this change is complete
- **THEN** Electron SHALL NOT introduce IndexedDB, service worker, local database or local operational persistence

#### Scenario: Offline behavior is documented as out of scope

- **WHEN** documentation is updated
- **THEN** offline operation SHALL be explicitly documented as out of scope
