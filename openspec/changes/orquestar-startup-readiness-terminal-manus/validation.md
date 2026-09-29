## Automated validation

Planned and executed after implementation:

- API resolution: authentication, Tenant isolation, configured, unknown, unbound, revoked, missing and inactive Terminal, read-only behavior.
- Web orchestration: browser without Agent, compatible Electron, cloud reachability, cloud failure and retry, Terminal context mismatch.
- Existing P9.1 and P9.2 suites must remain passing.
- `git diff --check` must pass.

## Manual validation pending

Browser Web, Electron Agent states, Device lifecycle, inactive Terminal, wrong Tenant, POS mismatch and Retry require operator QA. Physical peripherals and Installer certification are not inferred from readiness tests.

## QA execution record

On 2026-09-24, no local API, Web, Electron or Peripheral Agent endpoint was listening on the configured QA ports (`4020`, `3000`, `4050`). No browser tab or Electron window was available. Starting development servers would create or update local runtime artifacts and was outside this QA pass. Therefore browser, Electron, Device lifecycle, Terminal data, Agent outage and Cloud outage scenarios are `NOT EXECUTED`, not PASS.

The compatible/legacy/incompatible bridge scenarios were covered by the automated P9.1/P9.3 contract tests. No physical hardware, Installer, production or migration activity was performed.

## Controlled local smoke

On 2026-09-24, the existing Peripheral Agent was reused on `127.0.0.1:4050` and returned HTTP `200` from `/health` in `REAL` mode with API version `1`. The API was started with the existing `npm run start:dev` command on `127.0.0.1:4020`; bootstrap completed and the route `/api/terminal-runtime/resolve` was registered. The API version endpoint returned HTTP `200`. Web was started with the existing `npm run dev -- --hostname 127.0.0.1 --port 3000` command and `/login` returned HTTP `200`.

No credentials were entered. An unauthenticated POST to `/api/terminal-runtime/resolve` did not return a resolution and was rejected with HTTP `400`; the authenticated Device resolution scenarios therefore remain pending. No browser provider was available for GUI QA. Electron was not started: its available development script runs `clean` and `build`, and the un-packaged path does not load the configured Agent shell contract; running it would not be a valid READY test and could overwrite local `dist` output.

## Follow-up smoke evidence

The earlier HTTP `400` was reproduced as a request-construction error: the test body contained literal backslash escapes and was not valid JSON. A valid JSON payload without `Authorization` now returns HTTP `401`, confirming the expected JWT guard rejection. API startup registered `/api/terminal-runtime/resolve`; Web `/login` returned HTTP `200`; the existing Agent returned HTTP `200` with API version `1` in `REAL` mode.

The workstation has an installed POS runtime at version `0.1.0` and an installed Peripheral Agent at `0.1.1-qa.11`. The installed POS shell configuration targets the production origin, so it was not launched. The repository Electron development command performs `clean` and `build`, and was not launched against protected repository output. Authenticated cloud resolution and real Electron readiness remain pending an authorized QA session and a QA-packaged shell.

## P9.3 Windows 1 preflight block

The current local Web target is classified as `LOCAL_API` (`localhost:4020`). The API `.env` DB host is classified as `NONLOCAL_HOST`; the database name is not production-like, but that is not proof of an authorized QA database. The destination remains `UNVERIFIED`. Under the test stop condition, no login, Device registration, binding, revocation, cloud resolution, sale or Electron startup was performed.

The installed POS shell remains excluded because its packaged configuration targets the production origin. The repository Electron development path performs `clean` and `build` in the main project output. No isolated Electron build was started while the API database target and QA session remained unverified.

## Read-only database preflight

On 2026-09-24, `api/.env` was inspected locally by variable names only. The API loader uses the `DB_*` group (`DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_SSL`); the separate `QA_DB_*` group is metadata and is not the effective API connection. The effective `DB_*` and `QA_DB_*` host, database, user and SSL settings do not match. No values were printed or copied.

A PostgreSQL diagnostic connection using only the effective `DB_*` settings succeeded with a five-second timeout and a read-only transaction. The server was classified as `PRIVATE_NETWORK`. The connection used `SSL_CONNECTION=false` because `DB_SSL` is disabled; server SSL support was present. This is a diagnostic result, not proof that the target is the authorized QA environment.

Read-only schema metadata confirmed `public.terminals`, `public.terminal_devices`, `public.terminal_device_bindings` and `public.migrations_history`. Tenant foreign keys, status/date checks, device installation uniqueness, and active binding indexes for device and Terminal were present. The `V075` migration row and tenant operational data were not queried because the effective database could not be independently verified as QA. No registration, binding, revocation, migration, sale or other write was performed.

Result: `DATABASE_CONNECTION=PASS` for diagnostics; `QA_ENVIRONMENT=BLOCKED`; `P9.3_DATABASE_READINESS=PARTIAL`. Owner confirmation is required for the effective DB target and SSL policy before querying QA tenant/device/Terminal state or performing any administrative write.

## Authorized QA database follow-up

The owner confirmed that the effective `DB_*` settings target the authorized QA database and that non-SSL PostgreSQL is allowed on the current private network. `QA_DB_*` was not used. A second read-only transaction confirmed `V075_APPLIED` in `public.migrations_history`.

Using only the configured QA tenant and branch values, sanitized counts were: `3` Terminals, `3` active Terminals, `3` Devices, and `3` ACTIVE bindings. No other tenant was enumerated. The configured `QA_TERMINAL_ID` is a placeholder, so the exact Terminal 1 and its exact Device binding remain `NOT EXECUTED`; no registration or binding write was attempted.

The real Windows Agent returned HTTP `200`, `agentApiVersion=1`, mode `REAL`, platform `win32`, version `0.1.1-prd.2`, and an installation identity present. Two `/health` reads matched without printing the identity, establishing local persistence for this check. The Agent remained on `127.0.0.1:4050`.

An isolated Electron QA package was built under `%TEMP%`, outside the repository and the installed POS. Its shell config allows only `http://127.0.0.1:3000/login` and Agent `http://127.0.0.1:4050`; the production shell was not launched. The QA process opened from the isolated `win-unpacked` executable. Visual login, authenticated resolution, Device binding, READY and POS entry require operator confirmation and remain `NOT EXECUTED`.

OpenSpec strict initially failed because `terminal-startup-readiness/spec.md` had no delta section. The spec was then corrected with `ADDED Requirements` and executable `#### Scenario:` blocks, without changing implementation code or adding pairing, credential, Installer, or hardware guarantees. A second run with the local `openspec.cmd` returned `Change 'orquestar-startup-readiness-terminal-manus' is valid`.

## Security evidence

No pairing credential or physical possession mechanism is implemented. `installationId` remains lookup-only. P7/P8 are not recertified by this change.

## Windows 1 final read-only certification preflight — 2026-09-26

- Git remained on `feat/develop/despliegue-manus-terminal` at `425bcc72b9e0c408ea8c112ec1d3e4750cf3c422`. No Git operation or QA write was performed.
- API `127.0.0.1:4020`, Web `127.0.0.1:3000`, and Agent `127.0.0.1:4050` responded with HTTP `200`. API version was `0.0.1`; Agent reported `status=ok`, `REAL`, API `1`, `win32`, `x64`, version `0.1.1-prd.2`, and persistence `loaded`.
- A read-only PostgreSQL transaction using the owner-authorized `DB_*` configuration connected to the QA database. Tenant, branch, and Terminal scope were confirmed without enumerating other tenants. `TERM-001`, `TERM-002`, and `TERM-003` were ACTIVE.
- `TERM-001` had exactly one ACTIVE binding to the Device masked as `b4d3...0683`; the Device was `BOUND`. `TERM-003` had no ACTIVE binding. `TERM-002` had no ACTIVE binding, preserving its prepared state.
- Exact in-memory comparison between the Agent installation identity and the Device installation identity returned `true`. The Agent Device had exactly one ACTIVE binding, to `TERM-001`. The former Device masked as `3448...485f` remained registered as `UNBOUND` and was not revoked.
- Active binding uniqueness indexes were present for Device and Terminal. No Device, binding, session, cash session, sale, payment, or schema record was modified.
- TERM-001 still had one active POS session and one open cash session. This is compatible with an operator using the POS, but it blocks any administrative session closure. No closure was attempted.
- An isolated Electron QA executable was already running from `%TEMP%`, outside the repository and installed production POS. Its shell configuration targeted only `http://127.0.0.1:3000/login` and Agent `http://127.0.0.1:4050`; no production origin was found in that effective shell configuration.
- Windows UI inspection could not be completed because the Computer Use helper returned `Trusted RPC service is not configured: sky`. Therefore Electron bridge inspection, authenticated `terminal-runtime/resolve`, `CONFIGURED`, `cloud.reachable`, `READY`, `canEnterPos`, and visual POS entry remain `NOT EXECUTED`.

Result: `DATABASE=PASS`, `DEVICE_IDENTITY_EXACT_MATCH=PASS`, `TERM_001_BINDING=PASS`, `TERM_003_FREE=PASS`, `ELECTRON_PROCESS_AND_CONFIG=PASS`, `ELECTRON_OPERATIONAL_READINESS=BLOCKED`, `P9.3_CERTIFICATION=PARTIAL`.

## Windows 1 visual follow-up — 2026-09-26

- Owner-provided captures show successful SUPER_ADMIN login with `Terminal 1` and `Sucursal Principal`, followed by a visible POS screen with `232` products. This is `WEB/POS VISUAL QA=PASS` as supplied evidence.
- The running Windows process was identified at the isolated `%TEMP%\manus-electron-qa-...\release\win-unpacked\Manus POS.exe` path. Its effective shell configuration allows only Web `http://127.0.0.1:3000/login` and Agent `http://127.0.0.1:4050`; no production origin appears in that configuration. This is `ELECTRON PROCESS AND LOCAL CONFIG=PASS`.
- A fresh read-only database check confirmed `TERM-001` ACTIVE with one ACTIVE binding, exact Agent installation match, and Device `BOUND`; `TERM-003` has zero ACTIVE bindings; `TERM-002` has zero ACTIVE bindings. The prior Device remains registered, `UNBOUND`, and not revoked.
- The same check found two active POS sessions and one open cash session on `TERM-001`. No session or cash write was performed. Activity is compatible with the owner/operator using the POS, but administrative session closure remains blocked.
- The captures cannot prove that the displayed window was the identified Electron process. The Windows UI helper remains unavailable with `Trusted RPC service is not configured: sky`. No safe authenticated response observer was available, so `POST /api/terminal-runtime/resolve`, `CONFIGURED`, `cloud.reachable=true`, aggregate `READY`, `canEnterPos=true`, and Electron visual entry remain `NOT EXECUTED` for technical certification.
- Hardware printing, drawer, scanner, scale, Installer, Linux, production, pairing, and physical certification remain `NOT EXECUTED`.

Result: `WEB_VISUAL_QA=PASS`, `ELECTRON_PROCESS=PASS`, `LOCAL_QA_CONFIG=PASS`, `TERM_001_EXACT_DEVICE_MATCH=PASS`, `TERM_003_FREE=PASS`, `AUTHENTICATED_RESOLUTION=NOT_EXECUTED`, `READY=NOT_EXECUTED`, `CAN_ENTER_POS=NOT_EXECUTED`, `P9.3_CERTIFICATION=PARTIAL`.

## Readiness observation support — 2026-09-26

- Local inspection confirmed that the existing POS gate consumes `readiness.value.canEnterPos` and renders `PosScreen` only when it is `true`. The existing UI did not expose the complete readiness object, so direct field observation was not possible from the screen alone.
- Added a minimal read-only diagnostic panel in `web/domains/terminal-readiness/TerminalReadinessDiagnostics.tsx`. It reuses the actual `useTerminalReadiness` result and displays `resolution`, `deviceStatus`, sanitized terminal/branch IDs, Agent reachability, `cloud.reachable`, aggregate `readiness`, `canEnterPos`, and `reason`.
- The panel activates only when the browser origin is `localhost` or `127.0.0.1` and the explicit query parameter `terminalReadinessDiagnostics=1` is present. It is unavailable on production origins, cannot change readiness, cannot call administrative endpoints, and does not display JWTs, cookies, secrets, or the full installation identity.
- The orchestrator result now carries the real backend resolution classification. `CONFIGURED` is set only after the authenticated cloud resolution returns the configured branch/terminal payload; `READY` and `canEnterPos` remain computed by the existing orchestrator.
- Focused Web orchestrator tests passed `4/4`; Web lint passed. Global Web typecheck still reports the existing unrelated `*.spec.ts` errors and no new error from this diagnostic panel.
- The panel was not observed through the Electron window because the Windows UI helper remains unavailable. Therefore direct runtime values for `READY` and `canEnterPos` remain `NOT VERIFIED` in this run. The owner can open the local POS route with `?terminalReadinessDiagnostics=1` and inspect the panel inside the same Electron QA window.

Current result: `AUTHENTICATED_RESOLUTION=PASS` from owner DevTools evidence (`HTTP 201`, `CONFIGURED`, `BOUND`, active TERM-001 and PRINCIPAL); `DEVICE_IDENTITY_EXACT_MATCH=PASS` from PostgreSQL; `ELECTRON_PROCESS_AND_CONFIG=PASS`; `READINESS_DIAGNOSTIC=IMPLEMENTED_NOT_OBSERVED`; `READY=NOT_VERIFIED`; `CAN_ENTER_POS=NOT_VERIFIED`; `P9.3_CERTIFICATION=PARTIAL`.

## Visual readiness toggle — 2026-09-26

- Added a minimal `Diagnóstico de terminal` button to the existing POS page. It reuses `TerminalReadinessDiagnostics` and its real orchestrator value; it does not add a second readiness calculation or change the POS gate.
- The button is rendered only for `localhost` or `127.0.0.1` on local Web port `3000` (or an empty port). Production origins do not render the control. The existing explicit query-parameter activation remains supported.
- The panel continues to display only sanitized operational fields: `resolution`, `deviceStatus`, `cloud.reachable`, aggregate `readiness`, `canEnterPos`, and `reason`. No credentials, tokens, cookies, or full installation identity are exposed.
- Focused orchestrator tests passed `4/4`; Web lint passed; `git diff --check` passed; OpenSpec strict returned `Change 'orquestar-startup-readiness-terminal-manus' is valid`.
- Direct visual clicking in Electron was not observed because the Windows UI helper remains unavailable. `READY` and `canEnterPos` therefore remain `NOT VERIFIED`, not inferred from `CONFIGURED` or owner screenshots.

Current result: `VISUAL_DIAGNOSTIC_CONTROL=PASS`, `PRODUCTION_HIDDEN=PASS`, `AUTOMATED_VALIDATION=PASS`, `ELECTRON_CLICK_OBSERVED=NOT_EXECUTED`, `READY=NOT_VERIFIED`, `CAN_ENTER_POS=NOT_VERIFIED`, `P9.3_CERTIFICATION=PARTIAL`.

## Windows 1 readiness evidence and diagnostic control — 2026-09-26

- Owner-provided QA evidence for Windows 1 shows authenticated `TERM-001` / `PRINCIPAL` context and POS access with `232` products. The diagnostic values observed were `resolution=CONFIGURED`, `deviceStatus=BOUND`, `agent.reachable=true`, `cloud.reachable=true`, `readiness=READY`, and `canEnterPos=true`.
- This manual evidence is separate from the PostgreSQL read-only exact installation identity match and from automated orchestrator tests. It does not certify physical hardware, Installer, Linux, pairing, or production.
- Source review confirmed the old `reason=CHECKING` result was a presentation/state bug: the configured success path returned `state=READY` and `canEnterPos=true` while retaining the transitional reason. The success path now returns `reason=READY`; blocked reasons remain unchanged.
- The normal POS access button `Diagnóstico de terminal` was removed. The existing `TerminalReadinessDiagnostics` component and explicit localhost query activation `terminalReadinessDiagnostics=1` remain available for controlled QA investigation. The P9.3 calculation and POS gate were not removed or altered.
- The separate `Diagnóstico de periféricos` control, `Balanza Lista`, `Periféricos OK`, and their handlers were not modified.
- No database write, Device operation, binding operation, session closure, sale, or production action was performed.

Current result: `OWNER_READINESS_EVIDENCE=PASS`, `REASON_CHECKING=FIXED`, `NORMAL_DIAGNOSTIC_BUTTON=HIDDEN`, `QA_QUERY_PANEL=PRESERVED`, `PERIPHERAL_DIAGNOSTIC=UNCHANGED`, `P9.3_CERTIFICATION=PARTIAL` pending repeatable direct observation by the operator after this UI source change.

## Browser READY reason correction — 2026-09-26

- The owner reproduced the browser-only combination `resolution=NOT_RESOLVED`, `deviceStatus=-`, `agent.reachable=false`, `cloud.reachable=false`, `readiness=READY`, `canEnterPos=true`, `reason=CHECKING`.
- Root cause was confirmed in the `WEB` branch of `TerminalReadinessOrchestrator.evaluate()`: authenticated browser mode intentionally bypasses Agent/cloud resolution, but still emitted the transitional `CHECKING` reason. This was a presentation-state inconsistency, not a cloud or Agent failure.
- The browser branch now emits `reason=READY` when it emits `state=READY` and `canEnterPos=true`. It still reports `resolution=NOT_RESOLVED`, `agent.reachable=false`, and `cloud.reachable=false`; no cloud resolution is fabricated and no Electron rule changes.
- The focused test now asserts the exact browser result: `WEB`, `NOT_RESOLVED`, Agent false, Cloud false, `READY`, `canEnterPos=true`, and `reason=READY`.
- Electron configured success, context mismatch, cloud failure, Agent compatibility, and blocked reasons remain covered by the existing tests. The peripheral diagnostic control and peripheral readiness indicators were not changed.

Current result: `BROWSER_REASON=FIXED`, `BROWSER_CLOUD_BYPASS=PRESERVED`, `ELECTRON_RULES=PRESERVED`, `BLOCKED_REASONS=PRESERVED`, `P9.3_CERTIFICATION=PARTIAL` pending fresh manual browser and Electron observation after this correction.

## Chrome browser regression evidence — 2026-09-26

- Owner-provided Chrome evidence from the local QA URL with `terminalReadinessDiagnostics=1` shows `resolution=NOT_RESOLVED`, `deviceStatus=-`, `agent.reachable=false`, `cloud.reachable=false`, `readiness=READY`, `canEnterPos=true`, and `reason=READY`.
- The POS catalog rendered with `232` products. This confirms the browser-only cloud flow remains usable without a local Agent. It does not replace the separate Electron evidence.
- The normal `Diagnóstico de terminal` button remains hidden. The QA panel remains query-gated on loopback. The peripheral diagnostic control and peripheral status indicators remain unchanged.
- Electron shell inspection found the local development override `MANUS_START_PATH` and `MANUS_WEB_URL`, but the supported `dev:local` script fixes the start path to `/login`. The isolated packaged QA shell loads its packaged shell configuration and has no verified command-line navigation mechanism for appending `terminalReadinessDiagnostics=1` after startup. No unsafe shortcut or production executable was used.

Current result: `CHROME_BROWSER_REGRESSION=PASS`, `CHROME_READY_REASON=PASS`, `ELECTRON_REGRESSION=NOT_EXECUTED`, `ELECTRON_NAVIGATION=BLOCKED_PENDING_SAFE_MECHANISM`, `P9.3_CERTIFICATION=PARTIAL`.

## Temporary Electron QA diagnostic shortcut — 2026-09-26

- Added a temporary keyboard access path for the existing read-only panel: `Ctrl+Alt+Shift+D` toggles it only when the page is on `localhost` or `127.0.0.1`, port `3000` or empty, and `window.manusTerminal.getRuntimeInfo` exists.
- The listener is registered in the POS page, cleaned up on unmount, ignores repeated key events and ignores editable controls. It does not add a button, change the readiness calculation, or expose credentials.
- The existing `terminalReadinessDiagnostics=1` query path remains available. The panel still rejects non-loopback origins. The production shell and public domains cannot use this shortcut.
- Peripheral diagnostics and indicators were not changed.
- Automated shortcut tests and Electron readiness regression remain pending until the owner performs the single manual Electron observation.

Current result: `QA_SHORTCUT_IMPLEMENTED=PASS`, `LOOPBACK_AND_BRIDGE_GATE=PASS`, `PRODUCTION_BLOCKED=PASS`, `ELECTRON_REGRESSION=NOT_EXECUTED`, `P9.3_CERTIFICATION=PARTIAL`.

## Electron QA restart preflight — 2026-09-26

- The active Electron QA executable was identified at `%TEMP%\\manus-electron-qa-af5b4a0944eb4b55846964f6b0dc308a\\release\\win-unpacked\\Manus POS.exe`. The main process was PID `31368`; child GPU, renderer, network, and audio processes shared the same executable path. The production installation was not targeted.
- The effective packaged shell configuration was read by metadata only: environment `dev`, Web `http://127.0.0.1:3000/login`, allowed origin `http://127.0.0.1:3000`, and Agent `http://127.0.0.1:4050`. The protected `app.asar` was not opened or changed.
- API `4020`, Web `3000`, and Agent `4050` responded HTTP `200`. Process metadata showed the QA main process responding.
- Windows UI automation returned no targetable apps/windows. Therefore the active POS screen, sale state, printing state, login state, and renderer diagnostic values could not be confirmed safely. The authorized QA process was not terminated or restarted.
- No new Electron evidence was obtained. The seven readiness fields remain `NOT_EXECUTED` for this restart attempt. Existing owner evidence remains valid but was not repeated here.

Current result: `QA_EXECUTABLE_IDENTIFIED=PASS`, `QA_CONFIG=PASS`, `SERVICES=PASS`, `SAFE_RESTART=BLOCKED_PENDING_OPERATOR_CONFIRMATION`, `ELECTRON_READINESS=NOT_EXECUTED`, `P9.3_CERTIFICATION=PARTIAL`.

## Final Windows 1 Electron regression — 2026-09-26

- Owner-provided Electron QA evidence confirms `resolution=CONFIGURED`, `deviceStatus=BOUND`, `agent.reachable=true`, `cloud.reachable=true`, `readiness=READY`, `canEnterPos=true`, and `reason=READY`.
- The observed context is `TERM-001` / `PRINCIPAL`; the POS catalog displayed `232` products. This closes the functional Windows 1 readiness regression for the implemented P9.3 path.
- The evidence is manual owner evidence. It is distinct from the PostgreSQL exact installation identity match, the automated `7/7` focused tests, and the independent Chrome Web evidence.
- Hardware peripherals, Installer packaging, Linux runtime, secure pairing, production and additional Windows computers remain `NOT_EXECUTED`.

Current result: `WINDOWS_1_ELECTRON_READINESS=PASS`, `WINDOWS_1_POS_ENTRY=PASS`, `CHROME_WEB_REGRESSION=PASS`, `P9.3_WINDOWS_1_FUNCTIONAL_SCOPE=PASS`, `P9.3_FULL_PROGRAM_CERTIFICATION=PARTIAL`.
