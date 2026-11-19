## Purpose

Provide a controlled, auditable, and reversible way to release only the MANUS POS web frontend to its independent Contabo production environment without affecting Emaús or other MANUS POS services.

## ADDED Requirements

### Requirement: Deployment is manual and master-bound
The release system SHALL start only through an explicit manual action and SHALL deploy only a full commit that is verified as the selected `master` revision. A repository push alone MUST NOT start the MANUS POS production deployment.

#### Scenario: Authorized manual release from master
- **WHEN** an operator starts the workflow manually for the current full `master` commit and supplies the required target confirmation
- **THEN** the system permits the build to proceed toward the protected production approval gate

#### Scenario: Non-master or ambiguous revision
- **WHEN** the workflow runs from a ref other than `master`, receives a shortened or mismatched commit, or lacks the target confirmation
- **THEN** the system stops before opening an SSH connection or changing production

### Requirement: Production deployment requires protected approval
The deployment job SHALL use a dedicated MANUS POS production GitHub Environment whose protection rules require an authorized reviewer before environment secrets become available or any production connection begins. Workflow permissions SHALL be read-only and limited to the capabilities required by the jobs.

#### Scenario: Approval has not been granted
- **WHEN** a build finishes but an authorized reviewer has not approved the production Environment
- **THEN** GitHub Actions holds the deployment job and does not expose deployment secrets

### Requirement: Build is reproducible and branded for MANUS POS
The release system SHALL install web dependencies from the committed lockfile using the repository-pinned Node version, run tests, strict TypeScript validation, lint, and the production Next.js build without suppressing failures. The MANUS build SHALL use `NEXT_PUBLIC_LOGIN_BRAND_NAME=MANUS POS`, `NEXT_PUBLIC_GIN_BG_IMAGE=/login-bg.png`, `NEXT_PUBLIC_API_BASE_URL=/api`, `NEXT_PUBLIC_REPORTS_API_BASE_URL=/api`, and `API_PROXY_TARGET=http://127.0.0.1:4020`. It SHALL require the independently approved SHA-256 for `login-bg.png`, compare the repository asset to that value before build and packaging, and stop if the value is missing or mismatched. Presence, filename, or visual resemblance alone MUST NOT authorize the asset. The shared resolver default, Emaús workflow, and Emaús `/logo-login-tablet.png` asset SHALL remain unchanged.

#### Scenario: Valid production build
- **WHEN** the lockfile, Node version, branding asset, tests, type checking, lint, and Next.js build all validate
- **THEN** the system produces a frontend runtime artifact containing the expected MANUS POS configuration

#### Scenario: Build control fails
- **WHEN** any required test, type check, lint check, branding validation, or build fails
- **THEN** no deployable release is produced and production remains unchanged

#### Scenario: Branding asset is unapproved or belongs to Emaus
- **WHEN** the repository login asset does not match the protected approved MANUS POS SHA-256
- **THEN** the build stops before creating a deployable artifact and the existing production asset remains unchanged

### Requirement: Release integrity and provenance are verifiable
The release artifact SHALL contain only the web runtime and unprivileged deployment tooling, a manifest identifying the repository, full source commit, build identity, approved MANUS branding path and asset SHA-256, runner image, Node version, and framework version, and integrity metadata covering every regular file and symbolic-link target. The MANUS artifact SHALL contain `login-bg.png` and MUST NOT contain the known Emaús `logo-login-tablet.png`; the repository and Emaús artifact remain unchanged. Integrity and provenance SHALL be checked before upload and again in the server staging area.

#### Scenario: Artifact is intact
- **WHEN** local and staged checksum verification match and the manifest commit equals the approved release commit
- **THEN** the staged release is eligible for deployment

#### Scenario: Artifact or manifest differs
- **WHEN** a checksum fails, a required file is missing, or the manifest does not identify the approved full commit
- **THEN** deployment stops before the active web directory is replaced

### Requirement: SSH target is pinned and isolated from Emaús
The deployment SHALL use MANUS POS-specific credentials, strict host-key verification from a protected known-hosts secret, and a target-host guard for `109.123.251.8`. The workflow and deployment tooling MUST NOT connect to or modify the Emaús server and MUST NOT consume Emaús-specific paths, process names, or credentials.

#### Scenario: Host identity matches MANUS POS
- **WHEN** the configured host is `109.123.251.8` and its presented key matches the protected known-hosts value
- **THEN** the workflow may authenticate with the dedicated MANUS POS SSH identity

#### Scenario: Host or key does not match
- **WHEN** the configured host differs from `109.123.251.8` or SSH host-key validation fails
- **THEN** the workflow stops without accepting a new host key or transferring files

### Requirement: Deployment changes only the authorized frontend
The release SHALL be transferred only into the configured MANUS POS staging root. The SSH account and PM2 owner SHALL both be `ubuntu`. Root-owned filesystem mutation SHALL occur only through a preinstalled, root-owned, non-group/world-writable helper at a fixed path whose SHA-256 is approved independently. The helper MUST NOT execute code from the release payload and the workflow MUST NOT run an uploaded or staged script as root. Deployment SHALL preserve destination `.env` files, replace only `/var/www/manuspos-web`, restart only the PM2 process `manuspos-web` as `ubuntu`, and retain the existing runtime configuration. It MUST NOT deploy or restart the API, reporting, FactuCore, electronic-billing, database, Electron, or peripheral components.

#### Scenario: Frontend deployment succeeds
- **WHEN** staging, integrity, backup, path guards, and runtime preconditions pass
- **THEN** only the frontend files are released and only `manuspos-web` is restarted

#### Scenario: Unexpected target configuration
- **WHEN** the configured web path, PM2 process, API proxy target, port, repository sentinel path, or staging boundary differs from the approved MANUS POS values
- **THEN** deployment stops before replacing frontend files

#### Scenario: Privileged helper is missing or mutable
- **WHEN** the fixed helper is absent, is not owned by root, is group/world writable, has a different approved checksum, or cannot be invoked by the narrow non-interactive sudo rule
- **THEN** deployment stops before changing `/var/www` or restarting PM2

### Requirement: Backup, health validation, and rollback are mandatory
Before replacement, the system SHALL create and verify a recoverable backup of the active frontend and record PM2 state. The active path SHALL be a root-owned symlink to a versioned release, and activation SHALL replace that symlink with one atomic rename on the same filesystem. Transaction state SHALL permit recovery after interruption or an incomplete swap. Backup SHA-256 SHALL be revalidated immediately before any archive restore. After replacement it SHALL validate the local frontend on port `19500`, validate the frontend `/api` path against the local API on `127.0.0.1:4020`, validate that login HTML contains the MANUS POS brand, validate the served login asset SHA-256, validate the deployed Next build identity, and validate the configured public frontend URL. Any replacement, restart, identity, branding, or smoke-check failure SHALL trigger frontend rollback and a restart of only `manuspos-web`.

#### Scenario: All smoke checks pass
- **WHEN** local login, proxied API, PM2 state, and public login checks succeed within the bounded retry policy
- **THEN** the release is marked successful and the verified backup remains available

#### Scenario: Smoke check fails after replacement
- **WHEN** any required local or public smoke check fails after the active frontend was changed
- **THEN** the previous frontend is restored, only `manuspos-web` is restarted, rollback health is checked, and the workflow fails

#### Scenario: Process is interrupted during activation
- **WHEN** orchestration stops after preparation or activation but before finalization
- **THEN** the fixed helper retains enough root-owned state for a later recovery command to atomically restore the previous release without guessing paths

### Requirement: Runtime dependencies are supported and security-gated
The build SHALL use an explicit runner image and a supported Next.js release. Production dependency audit output SHALL be retained, and any critical or high production advisory SHALL fail the build unless the repository contains an explicit, time-bounded, advisory-specific acceptance approved by the security owner. Forced audit remediation MUST NOT run.

#### Scenario: Unsupported or vulnerable runtime remains
- **WHEN** the selected framework is unsupported or the production audit reports an unaccepted critical or high advisory
- **THEN** no deployable release is produced

### Requirement: Deployment evidence is explicit and retained
Every run SHALL produce non-secret evidence containing the run identifier, source commit, artifact checksum, target identity label, backup location, integrity results, component scope, restart scope, smoke-check outcomes, and final status of `deployed`, `rolled_back`, or `failed_before_change`. Evidence MUST NOT contain secret values or environment-file contents.

#### Scenario: Operator reviews completed run
- **WHEN** a deployment attempt finishes in any state
- **THEN** the workflow retains enough sanitized evidence to distinguish successful deployment, successful rollback, and failure before production change

### Requirement: Browser bridge access remains strictly typed
The web frontend SHALL compile under strict TypeScript while treating the optional `window.manusTerminal` bridge as `unknown` until validated by the existing terminal diagnostics type guard. This correction MUST NOT change Electron, peripheral, or diagnostics behavior.

#### Scenario: Browser has no Electron bridge
- **WHEN** the POS page runs in a normal browser without `window.manusTerminal`
- **THEN** strict TypeScript compilation succeeds and terminal diagnostics remain disabled as before

#### Scenario: Browser has a valid Electron bridge
- **WHEN** the POS page runs with a bridge accepted by the existing type guard
- **THEN** the existing diagnostics shortcut behavior remains available without an unsafe cast or ignored error
