## 1. REAL runtime foundation

- [x] 1.1 Support `MOCK | REAL`, local JSON mode and effective mode in health/discovery
- [x] 1.2 Prevent REAL discovery failures from silently returning MOCK seeds
- [x] 1.3 Add safe Windows printer inventory diagnostics while retaining the USB/DOT4USB filter
- [x] 1.4 Add exact Manus CORS, controlled PNA and production loopback defaults

## 2. XP-58 QA packaging

- [x] 2.1 Set source and artifact version to `0.1.1-qa.2` (QA2 parser fix)
- [x] 2.8 Preserve USB cash-drawer certification as device metadata and keep guard fail-closed
- [x] 2.2 Seed Windows QA templates with REAL mode, approved origins, RAW and physical cut disabled
- [x] 2.3 Add tests for XP-58-like `Local / USB001` discovery and package config/version contents
- [x] 2.4 Add upgrade tests proving existing config and installation identity state are preserved
- [x] 2.5 Build and validate the self-contained Windows x64 package
- [x] 2.6 Generate and validate a versioned QA installer only if the higher-version upgrade path remains safe
- [x] 2.7 Record installer SHA256 and exact elevated install command

## 3. Automated validation

- [x] 3.1 Run backend tests and build
- [x] 3.2 Run Windows package validation and installer validation when generated
- [x] 3.3 Run web peripheral tests, lint and production build
- [x] 3.4 Run OpenSpec strict validation and `git diff --check`

## 4. Physical Windows QA

- [x] 4.1 Capture XP-58 queue, pre-upgrade health, version and `agentInstallationId`
- [x] 4.2 Back up local config and install the signed-off higher-version QA artifact
- [x] 4.3 Apply REAL config and prove version/identity/config preservation through health
- [x] 4.4 Discover XP-58 with no mocks and capture its physical `deviceId`
- [x] 4.5 Associate XP-58 to the terminal with `THERMAL_58MM`
- [x] 4.6 Observe paper from direct `/printer/test-print` and sale ticket API
- [x] 4.7 DEFERRED TO FOLLOW-UP: Web UI/terminal integration belongs to a future terminal/installer UX change
- [x] 4.8 DEFERRED TO FOLLOW-UP: POS UI physical flow belongs to a future terminal/installer UX change; SALE API is certified here
- [x] 4.9 Persist USB drawer certification and execute `/cash-drawer/open` API QA
- [x] 4.10 Observe physical drawer opening (QA4 final evidence)
