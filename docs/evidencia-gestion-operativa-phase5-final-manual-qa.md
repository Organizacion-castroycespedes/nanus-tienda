# Gestión Operativa — Phase 5 final manual QA

## Phase 5.21 — authenticated final manual QA

## Phase 5.23 — resolve auth session conflict

### Resultado

`AUTH_SESSION_ISOLATION: BLOCKED`. CDP `9223` is reachable and attach passed.
The attached dedicated QA profile shows the login page. The conflict is not a
shared browser cookie or local-storage problem. The backend enforces one active
`auth_sessions` record per user and tenant; `/auth/login` returns HTTP `409`
when that record exists. Separate profiles would still hit the same server-side
conflict. Normal logout could not be exercised because the attached page has no
authenticated browser session and no safe refresh token was available.

### Mandatory report

- TASK: `PHASE 5.23 RESOLVE AUTH SESSION CONFLICT`
- CDP REACHABLE: `YES`
- SESSION STORAGE MODEL: access token in client state; refresh token in memory and optionally `sessionStorage` when `NEXT_PUBLIC_REFRESH_TOKEN_STORAGE=session`; no auth cookie is used by the frontend request path, while backend logout clears `access_token` defensively
- AUTH_SESSION_CONFLICT ROOT CAUSE: `SESSION_REUSE` / server-side one-active-session-per-user rule (`auth_sessions_user_active`)
- ISOLATION METHOD: `BLOCKED` (separate profiles do not remove server-side active sessions; normal logout unavailable)
- USER ISOLATED LOGIN: `FAIL` (`AUTH_SESSION_CONFLICT` in attached browser)
- ADMIN ISOLATED LOGIN: `FAIL` (`AUTH_SESSION_CONFLICT` already observed)
- SUPER_USER ISOLATED LOGIN: `FAIL` (`AUTH_SESSION_CONFLICT`)
- SUPER_ADMIN ISOLATED LOGIN: `FAIL` (`AUTH_SESSION_CONFLICT`)
- USER ROLE IDENTITY VERIFIED: `NO`
- ADMIN ROLE IDENTITY VERIFIED: `NO`
- SUPER_USER ROLE IDENTITY VERIFIED: `NO`
- SUPER_ADMIN ROLE IDENTITY VERIFIED: `NO`
- CROSS_ROLE_SESSION_CONTAMINATION: `NO OBSERVED`; no authenticated cross-role session was established
- QA VARIABLES REQUIRING CORRECTION: `NONE`
- PASSWORD/ROLE CHANGES: `0`
- SALES CREATED: `0`
- ELECTRONIC DOCUMENTS CREATED: `0`
- BILLING OUTBOX EVENTS CREATED: `0`
- FACTUCORE MUTATIONS: `0`
- DIAN CALLS: `0`
- GLOBAL MANUS BILLING WORKER: `KEEP_DISABLED`
- FACTUCORE BACKGROUND JOBS: `KEEP_DISABLED`
- SECRET REDACTION: `PASS`
- WORKTREE PRESERVED: `YES`
- OPENSPEC RELEVANT: `PASS`
- GIT DIFF CHECK: `PASS`
- FINAL CLASSIFICATION: `AUTH_SESSION_ISOLATION BLOCKED`
- AUTHENTICATED_BROWSER_QA_CONTEXT: `BLOCKED`
- NEXT_ACTION: `FIX_AUTH_SESSION_ISOLATION`

### Safe diagnosis

- Reviewed `web/domains/auth/session.ts`, `web/domains/auth/session-manager.ts`,
  `api/src/modules/auth/auth.controller.ts`, and `api/src/modules/auth/auth.service.ts`.
- `/auth/login` uses the normal path only. No `/auth/login/force` call was made.
- No passwords, tokens, cookies, Authorization headers, localStorage values,
  or sessionStorage values were printed.
- No sales, fiscal documents, outbox events, FactuCore calls, DIAN calls, or
  worker changes occurred.

## Phase 5.22 — prepare browser/CDP and auth context

### Resultado

`AUTHENTICATED_BROWSER_QA_CONTEXT: BLOCKED`. The repository-supported flow is
Chrome with a local Chrome DevTools Protocol endpoint. The QA scripts connect
to `http://localhost:9223/json/new` and then use the returned WebSocket URL.
CDP port `9223` is now reachable and the agent attached successfully to one
page in the dedicated QA profile. The page is the QA login page. Authenticated
browser context remains blocked because the normal login flow reports an active
session conflict. No conflict action or force-login was used.

### Mandatory report

- TASK: `PHASE 5.22 PREPARE BROWSER/CDP AND AUTH CONTEXT`
- BROWSER/CDP MECHANISM: repository scripts `scripts/qa/manual-role-qa-cdp.mjs` and `scripts/qa/manual-cash-ops-qa-cdp.mjs`; Chrome DevTools Protocol WebSocket discovery through `/json/new`
- SUPPORTED BROWSER: `Chrome`
- CDP PORT: `9223` (script default)
- CDP REACHABLE: `YES`
- OPERATOR_BROWSER_ACTION_REQUIRED: `NO`
- EXACT OPERATOR ACTION: none; CDP is reachable and attached to the dedicated QA profile
- WINDOWS COMMAND (operator only; no credentials):
  ```powershell
  $qaProfile = Join-Path $env:TEMP "manus-tienda-qa-cdp"
  Start-Process -FilePath "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9223", "--user-data-dir=$qaProfile", "https://www.apptiendamanus.space/login"
  ```
- USER LOGIN: `PASS` (previous API smoke; current retry returns active-session conflict)
- ADMIN LOGIN: `PASS` (previous API smoke; current retry returns active-session conflict)
- SUPER_USER LOGIN: `FAIL` (HTTP `409` active-session conflict; not classified as invalid credentials)
- SUPER_USER FAILURE CLASSIFICATION: `AUTH_SESSION_CONFLICT`
- SUPER_ADMIN LOGIN: `FAIL` (HTTP `409` active-session conflict; no force-login used)
- SUPER_ADMIN FAILURE CLASSIFICATION: `AUTH_SESSION_CONFLICT`
- QA VARIABLES REQUIRING CORRECTION: `NONE_CONFIRMED`
- CDP ATTACH: `PASS`; login page present; dashboard not yet reached
- USER BROWSER SESSION READY: `NO`
- ADMIN BROWSER SESSION READY: `NO`
- SUPER_USER BROWSER SESSION READY: `NO`
- SUPER_ADMIN BROWSER SESSION READY: `NO`
- SECRET REDACTION: `PASS`
- SALES CREATED: `0`
- ELECTRONIC DOCUMENTS CREATED: `0`
- BILLING OUTBOX EVENTS CREATED: `0`
- FACTUCORE MUTATIONS: `0`
- DIAN CALLS: `0`
- GLOBAL MANUS BILLING WORKER: `KEEP_DISABLED`
- FACTUCORE BACKGROUND JOBS: `KEEP_DISABLED`
- WORKTREE PRESERVED: `YES`
- FINAL CLASSIFICATION: `AUTHENTICATED_BROWSER_QA_CONTEXT BLOCKED`
- NEXT_ACTION: `OPERATOR_RESOLVE_AUTH_SESSION_CONFLICT`

### Safe diagnosis

- `/auth/login` was used only with operator-provided environment values. No
  password, token, header, database credential, or response body was printed.
- HTTP `409` indicates the account/session conflict path. This run did not
  force-login, reset passwords, inspect or change roles, or change assignments.
- Prior QA evidence confirms the four QA users and role assignments exist and
  are active in the QA tenant. No replacement user or credential was invented.
- CDP attach was read-only. No full Phase 5.21 UI QA was started.

### Resultado

`FINAL_MANUAL_QA: BLOCKED`. QA credential variables were present in the
process, but the browser/CDP surface was unavailable. A direct read-only API
smoke reached the public QA API. USER and ADMIN completed `/auth/login` once;
SUPER_USER and SUPER_ADMIN did not complete login. Later login attempts for
all four roles returned HTTP `409` active-session conflict. No force-login was
used, so the existing SUPER_ADMIN session was not intentionally changed.

`AUTH_CONTEXT_READY: BLOCKED`. Full authenticated role UI, POS, shift,
accepted reprint, automatic/on-demand UI, status badges, and customer/supplier
location UX were not certifiable without browser access. No credential values,
tokens, Authorization headers, database credentials, or PII were recorded.

### Mandatory report

- TASK: `PHASE 5.21 AUTHENTICATED FINAL MANUAL QA`
- BRANCH: `feat/develop/completar-ciclo-facturacion-electronica`
- HEAD: `21a710b0845215ee86c137639aca581bd781edb8`
- QA_DB_GUARD: `PASS` (inherited Phase 5.20 evidence)
- PROD_EXCLUDED: `YES`
- QA CREDENTIALS PRESENT: `YES`
- USER LOGIN: `PASS` (API login completed before active-session conflict)
- ADMIN LOGIN: `PASS` (API login completed before active-session conflict)
- SUPER_USER LOGIN: `FAIL` (not completed)
- SUPER_ADMIN LOGIN: `FAIL` (not completed; no force-login used)
- USER TENANT CONTEXT: `NOT_CERTIFIED`
- USER BRANCH CONTEXT: `NOT_CERTIFIED`
- ADMIN CONTEXT: `NOT_CERTIFIED`
- SUPER_USER AUTHORIZED BRANCH: `NOT_CERTIFIED`
- SUPER_USER UNAUTHORIZED BRANCH MANUAL: `NOT_AVAILABLE`
- SUPER_USER UNAUTHORIZED BRANCH AUTOMATED: `PASS` (inherited negative-scope evidence)
- SUPER_ADMIN GLOBAL CONTEXT: `NOT_CERTIFIED`
- USER OPEN SHIFT REQUIRED: `YES` (per existing role policy)
- USER OPEN SHIFT CREATED: `NO`
- USER POS WRITE: `BLOCKED_CONTEXT`
- USER ROLE QA: `NOT_CERTIFIED`
- ADMIN ROLE QA: `NOT_CERTIFIED`
- SUPER_USER ROLE QA: `NOT_CERTIFIED`
- SUPER_ADMIN ROLE QA: `NOT_CERTIFIED`
- ACCEPTED REPRINT: `NOT_TESTED`
- REPRINT PROVIDER CALLS: `0`
- REPRINT DIAN CALLS: `0`
- REPRINT STATUS MUTATION: `NO`
- AUTOMATIC UI: `NOT_TESTED`
- ON_DEMAND UI: `NOT_TESTED`
- BATCH ACTION UI: `NOT_TESTED`
- STATUS BADGES: `NOT_TESTED`
- CUSTOMER LOCATION UX: `NOT_TESTED`
- SUPPLIER LOCATION UX: `NOT_TESTED`
- RAW LOCATION CODE INPUTS: `NOT_CERTIFIED`
- SAFE RETRYABLE FIXTURE: `MISSING`
- MANUAL RETRY QA: `NOT_TESTED_NO_SAFE_FIXTURE`
- SECRET REDACTION: `PASS` (helper source review; no secret values logged)
- TEMP USER SHIFT CLEANUP: `NOT_APPLICABLE`
- PRE-EXISTING SUPER_ADMIN SESSION: `UNCHANGED`
- SALES CREATED: `0`
- ELECTRONIC DOCUMENTS CREATED: `0`
- BILLING OUTBOX EVENTS CREATED: `0`
- FACTUCORE MUTATIONS: `0`
- DIAN CALLS: `0`
- OPENSPEC RELEVANT: `PASS`
- OPENSPEC ALL: `90 passed, 1 inherited failure: corregir-handoff-agent-local-perifericos-electron`
- GIT DIFF CHECK: `PASS`
- SECRET LEAK: `NONE`
- EVIDENCE COMMIT: `NO`
- WORKTREE: `DIRTY` (pre-existing user changes preserved)
- AUTHENTICATED_QA_CONTEXT: `BLOCKED`
- ROLE_MATRIX: `PARTIAL`
- FINAL_MANUAL_QA: `BLOCKED`
- ELECTRONIC BILLING OPERATIONAL UI: `BLOCKED`
- GLOBAL MANUS BILLING WORKER: `KEEP_DISABLED`
- FACTUCORE BACKGROUND JOBS: `KEEP_DISABLED`
- NEXT_ACTION: `OPERATOR_PROVIDE_BROWSER_OR_CDP_SESSION; CONTROLLED_AUTOMATIC_ON_DEMAND_E2E`

### Safe execution notes

- QA variables were checked by presence only. Values were never printed.
- QA frontend loaded by HTTP, but `localhost:3001` and CDP `localhost:9223`
  were unavailable in this process.
- Public API endpoint used: `https://api.apptiendamanus.space/api`.
- Only login and GET requests were attempted. No POST billing, retry, sale,
  cash-session, FactuCore, or DIAN operation was executed.
- V076 was not rerun. No role assignment, branch, sale, document, outbox, or
  existing SUPER_ADMIN cash session was changed.

## Resultado

Manual QA no pudo ejecutarse en QA desde esta sesión. El Browser tool no está
disponible y los smoke requests locales a `localhost:3000` y `localhost:4020`
no respondieron. No se intentó usar PROD ni se ejecutó una mutación de QA.

La configuración inspeccionada fue `scripts/config/db.env`; sus valores no se
imprimieron. No se hizo conexión ni cambio de base de datos, por lo que la QA
DB guard queda `NOT_TESTED`, no `PASS`.

## Evidencia estática

- Rutas frontend presentes: `/{tenant}/operations/sales` y
  `/{tenant}/operations/sales/{saleId}`.
- El botón `Reintentar procesamiento` depende únicamente de
  `electronicBilling.retryability.canRetry`.
- La confirmación es explícita y el hook comparte `actionLoading` para bloquear
  doble envío.
- El backend usa `OperationalSaleScopeService` y `POS WRITE`.
- La ruta llama el cliente Billing estrecho; no expone el `retryDocument()`
  legado.
- Auditoría usa `AuditService` y `auditoria_eventos`, sin nueva migración.

## Automatización

- API: `587 passed`, `1 skipped`.
- Billing: `152 passed`, `15 skipped`.
- API build: `PASS`.
- Billing build: `PASS`.
- Web lint: `PASS` con warnings existentes.
- Web build/typecheck: `PASS`.
- OpenSpec relevante: `PASS`.
- OpenSpec all: `90 passed`, `1 inherited failure`:
  `corregir-handoff-agent-local-perifericos-electron`.
- `git diff --check`: `PASS`.

## No ejecutado

No se validaron cuentas USER/ADMIN/SUPER_USER/SUPER_ADMIN, menú real QA,
turnos, ramas, reimpresión real, refresh real, retry real, auditoría QA,
Electron ni responsive visual. Estos resultados quedan `NOT_TESTED`.

No hubo llamadas FactuCore/DIAN, no se reejecutó V076, y no se tocaron datos
QA/PROD.

## Phase 5.18 — desbloqueo de entorno

- `QA APP SOURCE`: `EXISTING_DEPLOYMENT`. Repository config points to the QA
  frontend `https://www.apptiendamanus.space`.
- Read-only HTTP check: root and `/{tenant}/operations/sales` returned `200`
  and the expected Manus POS title.
- `QA FRONTEND ACCESS`: `PARTIAL`. Deployment is reachable, but no browser
  session was available to execute login or interactive QA.
- `QA API ACCESS`: `BLOCKED`. No authenticated API session was available; no
  role, tenant, branch, or cash-session context was guessed.
- `ELECTRON DEV ENV`: `PARTIAL`. `desktop/electron/resources/manus-shell.config.json`
  declares `environment: qa`, the same QA frontend URL, and the allowed origin.
  Electron shared-web loading was not run. Installer was not rebuilt and the
  agent was not modified.
- Role contexts: `USER`, `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN` remain
  `MISSING` for manual execution. Open-shift and authorized-branch fixtures
  were not provisioned. Safe sales and retryable fixtures were not mutated or
  created.
- QA mutations: `0`. V076 was not reexecuted. PROD, FactuCore, and DIAN were
  not touched.

## Phase 5.19 — contextos QA

- QA guard: `PASS`. Read-only identity used `scripts/config/db.env`; sanitized
  target was `manus_tienda_qa`, schema `public`, role `manus_user`, environment
  `qa`. PROD was excluded.
- Existing QA data: `1` tenant, `1` branch, and `1` role assignment for each
  `USER`, `ADMIN`, `SUPER_USER`, and `SUPER_ADMIN`. Menu `READ` permissions
  exist for both Gestión Operativa keys for all four roles.
- Existing open cash session: `1`, owned by `SUPER_ADMIN`; no open session is
  owned by `USER`. Required USER current-shift context is missing.
- The single branch cannot provide the required SUPER_USER authorized and
  unauthorized branch pair. No users, roles, branches, sessions, sales, or
  fiscal documents were provisioned or changed.
- Repository-supported automation exists in `scripts/qa/manual-role-qa-cdp.mjs`
  and `scripts/qa/manual-cash-ops-qa-cdp.mjs`, but required QA credentials are
  operator-supplied environment values and were unavailable here. No password,
  token, email, or hash was printed.
- `SAFE_SALES_FIXTURES`: `READY` by sanitized count (`102` sales, `6`
  electronic documents); suitability by role and retryability remains
  unverified. `SAFE_RETRYABLE_FIXTURE`: `MISSING` for manual QA.
- `AUTH_CONTEXT_READY`: `NO`; `HUMAN_LOGIN_REQUIRED`: `YES`.

## Phase 5.20 — preparación de login y contexto mínimo

- `AUTH_SETUP_MECHANISM`: existing normal `/auth/login` plus the repository
  QA runners `scripts/qa/manual-role-qa-cdp.mjs` and
  `scripts/qa/manual-cash-ops-qa-cdp.mjs`. They require operator-provided
  `QA_*` environment values. No credential reset was attempted because no
  approved operator secret was available.
- QA role data remains present: one tenant, one branch, and one assigned user
  for each target role. Role assignments were unchanged.
- `USER_OPEN_SHIFT_SETUP`: `BLOCKED`. QA has one `OPEN` cash session, owned by
  `SUPER_ADMIN`; the existing `USER` has none. No ad-hoc `cash_sessions` row
  was inserted and the existing session was not changed.
- `SUPER_USER_UNAUTHORIZED_BRANCH_CONTEXT`: `NOT_AVAILABLE`. QA has one
  branch, so no safe same-tenant negative branch pair exists. Automated scope
  tests remain the available negative evidence.
- `SAFE_RETRYABLE_FIXTURE`: still `MISSING`. Existing electronic documents
  were not changed; no fiscal document or outbox event was created.
- `OPERATOR_ACTION_REQUIRED`: `YES`. Operator must supply QA login values to
  the existing runners, and provide/approve a normal USER cash-session setup.
  Do not place values in source, docs, logs, or chat.
- QA mutations: `0`. V076 was not reexecuted. FactuCore, DIAN, and PROD were
  not touched.

## Phase 5.24 — fix auth session lifecycle

- CURRENT SESSION POLICY: `SINGLE_ACTIVE_SESSION_REJECT_NEW_LOGIN` with
  explicit password-confirmed replacement at
  `/api/auth/login/replace-session`.
- STALE SESSION REPRODUCED: `YES` in deterministic service tests and QA API
  behavior (`409 SESSION_ACTIVE`).
- ROOT CAUSE: server-side `auth_sessions` active-session uniqueness per
  user/tenant; a lost refresh token made normal logout impossible.
- IMPLEMENTED POLICY: `SINGLE_SESSION_REPLACE`.
- PASSWORD REQUIRED BEFORE REVOCATION: `YES`.
- Replacement revokes the old session and its refresh-token hash in the same
  transaction before creating the new session. The partial unique index remains
  in place, so at most one active session survives a race.
- WRONG_PASSWORD_CAN_REVOKE: `NO`.
- LOCAL AUTH TESTS: `3 passed`; initial login, active-session conflict,
  replacement, old-session revocation, and wrong-password protection covered.
- API QA re-authentication: `BLOCKED`; deployed QA returned HTTP `404` for the
  new replacement endpoint because this local change was not deployed. No
  force-login or legacy replacement endpoint was called.
- USER/ADMIN/SUPER_USER/SUPER_ADMIN QA identity verification: `NOT_COMPLETED`.
- PASSWORD CHANGES: `0`; ROLE CHANGES: `0`.
- SALES CREATED: `0`; ELECTRONIC DOCUMENTS CREATED: `0`; BILLING OUTBOX
  EVENTS CREATED: `0`; FACTUCORE MUTATIONS: `0`; DIAN CALLS: `0`.
- GLOBAL MANUS BILLING WORKER: `KEEP_DISABLED`.
- FACTUCORE BACKGROUND JOBS: `KEEP_DISABLED`.
- Relevant OpenSpec: `PASS`; full OpenSpec retains inherited unrelated failure
  `corregir-handoff-agent-local-perifericos-electron`.
- Worktree preserved. No deployment or push performed.

## Phase 5.25 — controlled QA deploy auth session fix

- QA TARGET: `https://api.apptiendamanus.space`; PROD excluded: `YES`.
- SOURCE COMMIT: `d4bd9db9e29179bc13967095d7c94697fd8fb03f`.
- Approved mechanism: GitHub Actions workflow
  `.github/workflows/deploy-qa-backends.yml`, dispatched from the certified
  ref. It builds and deploys the four repository backend binaries through
  `scripts/deploy/qa-deploy-backends.sh`; Web has no repository deploy command
  in this workspace.
- DEPLOY RESULT: `BLOCKED_BEFORE_EXECUTION`. Local `gh` and `vercel` tools are
  unavailable, and the Git remote cannot authenticate. No push or deploy was
  attempted.
- API health remains `PASS` (`/api/system/version` and
  `/api/reports/health` return `200`). `POST /api/auth/login/replace-session`
  remains unavailable on QA (`404`), so authenticated QA re-test was not run.
- USER/ADMIN/SUPER_USER/SUPER_ADMIN QA login: `NOT_TESTED_DEPLOY_BLOCKED`.
  Role identities, session replacement, old refresh rejection, and CDP role
  authentication remain unverified against deployed QA.
- SALES CREATED: `0`; ELECTRONIC DOCUMENTS CREATED: `0`; BILLING OUTBOX
  EVENTS CREATED: `0`; FACTUCORE MUTATIONS: `0`; DIAN CALLS: `0`.
- Global Manus billing worker and FactuCore background jobs remain disabled.
- Unrelated dirty worktree changes were preserved and are not part of the
  certified commit. No evidence commit was created in this blocked attempt.
