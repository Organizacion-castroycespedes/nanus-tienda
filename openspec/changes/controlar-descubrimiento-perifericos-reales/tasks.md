# Tasks

## 1. Contract and ownership

- [x] 1.1 Validate the new change and all device-specific contracts with `openspec.cmd validate controlar-descubrimiento-perifericos-reales --type change --strict`; the new change, ROCHI contract, and scale authorization contract all pass.
- [x] 1.2 Confirm the scope manifest reports SINGLE_MATCH for every changed code, test, and OpenSpec path using the Manus governance diagnostic in STRICT mode. The official diagnostic reports SINGLE_MATCH for changed paths and no new global failures; the structural OpenSpec root config is handled separately by its exact structural owner.
- [x] 1.3 Align the existing ROCHI installer discovery delta and scale authorization profile notes with the new independent setting; historical Build 03 evidence is labeled as prior behavior, and no active contract says `enableRealAdapters` alone controls automatic discovery.

## 2. Agent configuration and startup

- [x] 2.1 Add strict `discoverOnStartup` parsing, local JSON/environment precedence, QA profile lock, and the two-flag startup predicate; focused config/policy tests pass.
- [x] 2.2 Gate Agent startup discovery with both real-adapter availability and the new policy; fake-based tests prove no provider call when the policy is false.
- [x] 2.3 Write package profile plus explicit QA/dev/production adapter and discovery values in both packaged Agent configs; profile tests pass.

## 3. Installer UI and QA

- [x] 3.1 Gate installer WebView automatic discovery on both embedded booleans; pure Go tests cover true, false, missing, malformed, and unreadable config.
- [x] 3.2 Keep the manual retry action explicit and preserve candidate selection; static Go test confirms the retry remains operator-triggered while startup is gated.
- [x] 3.3 Safe focused Agent tests pass 28/28 and focused Windows Go tests passed in earlier checkpoints. This checkpoint passes the isolated serial regression tests (10/10), TypeScript build, both affected OpenSpec STRICT validations, scoped governance STRICT, and `git diff --check`. The global OpenSpec command still exits 1 with no new failures identified by governance. Full suites and hardware QA remain NOT_RUN.
- [x] 3.5 Install a native process/socket guard in Windows discovery boundary tests and reject the default Windows command runner under `node:test`; fake-backed discovery tests pass and the negative case proves both USB/PnP and serial paths stop before native execution.
- [x] 3.6 Query CIM serial inventory and present Windows PnP Ports independently; merge only healthy, present, unambiguous PnP identity/COM pairs and preserve valid results when one source fails. Fake tests cover the COM6-only-in-PnP regression and malformed/partial inventories.
- [x] 3.4 Prepare the physical QA matrix per existing ROCHI, XP-80/XP-58, printer-attached drawer, and USB HID scanner contracts; it records per-device consent and claims no hardware PASS.

## 4. Host and artifact boundary

- [x] 4.1 Build 04, service, database, enrollment, host configuration, and hardware were not touched in this checkpoint. The prior full-suite discovery incident remains recorded above.
- [x] 4.2 Document the required future versioned candidate and P0-B admission check without generating or executing an installer. Governance blocks candidate generation; current P0-B has no demonstrated update transition from Build 04 to a different version (`transition_unproven`).
