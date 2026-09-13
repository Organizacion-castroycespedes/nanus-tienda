## Automated validation matrix

| Scenario | Expected result |
|---|---|
| Browser `WEB`, no bridge | Existing cloud POS remains usable; no installationId required |
| Electron + Agent + Cloud + configured Device | `READY`, `canEnterPos=true` |
| Electron + Agent down + configured Device | `DEGRADED`, reason `AGENT_UNAVAILABLE`, `canEnterPos=true` |
| Cloud/API unavailable | `CLOUD_UNAVAILABLE`, `canEnterPos=false` |
| Device unknown | `NOT_CONFIGURED`, reason `DEVICE_UNKNOWN`, false |
| Device unbound | `NOT_CONFIGURED`, reason `DEVICE_UNBOUND`, false |
| Device revoked | `NOT_CONFIGURED`, reason `DEVICE_REVOKED`, false |
| Terminal disabled | `NOT_CONFIGURED`, reason `TERMINAL_DISABLED`, false |
| Unsupported bridge | `INCOMPATIBLE`, reason `BRIDGE_CONTRACT_UNSUPPORTED`, false |
| Unsupported Agent API | `INCOMPATIBLE`, reason `AGENT_API_UNSUPPORTED` for hardware runtime |
| Legacy bridge | `DEGRADED`, reason `BRIDGE_LEGACY`; only callable legacy methods are used |
| Optional capability missing | `READY` or `DEGRADED/OPTIONAL_CAPABILITY_MISSING`; POS is not globally blocked |
| Electron bound Terminal differs from existing POS session Terminal | `NOT_CONFIGURED/TERMINAL_CONTEXT_MISMATCH`, `canEnterPos=false`; no auto-switch |
| Electron bound Terminal with no POS session yet | No mismatch; existing context selection continues |

## Test plan

- API: authenticated tenant resolution, generic cross-tenant absence, read-only behavior and all resolution outcomes.
- Web: mode detection, absent bridge/browser safety, local/cloud composition, state/reason mapping, entry gate and Retry.
- Electron: existing Bridge V1 metadata/health composition and secure typed exposure, without changing the bridge contract.
- Integration: authenticated Web-to-API resolution and Electron-mode readiness matrix.

No production tests are run in this discovery/design step. No database is migrated. Physical peripherals are not certified.

## Slice 3 implementation evidence

- Electron POS route now evaluates readiness before `PosScreen` when an existing POS session is present.
- A bound cloud Terminal must match the current POS session Terminal. Mismatch blocks entry without changing session or persisted context.
- Browser Web mode remains unchanged. No runtime resolution call is made without the bridge.
- Blocked states show minimal text and manual `Reintentar`; degraded allowed state shows a non-invasive peripheral warning.
- No automatic polling, session mutation, registration, binding, offline behavior or physical peripheral certification was added.

## Security boundary evidence

P9.3 readiness is operational only. It resolves cloud Device/Terminal state and gates Electron POS entry against the POS context. It does not authenticate a physical Device, provide cryptographic identity or proof of possession, attest that a POS session came from the bound Device, or provide real-time remote revocation. Client checks do not replace JWT/session/tenant/permission authorization. `DEVICE–POS SESSION SERVER-SIDE TRUST / ENFORCEMENT` is a future architectural decision. Manual operator QA is pending and is not inferred from automated validation.

## Runtime bootstrap correction

The first real Nest bootstrap exposed missing module wiring for `JwtAuthGuard` in `TerminalRuntimeModule`. The module now imports the existing `DatabaseModule` and `AccessControlModule`, matching established authenticated module patterns. No guard behavior or tenant authority changed. API startup smoke completed successfully on port `4020`.

## Slice 1 implementation evidence

- Backend TypeScript build: PASS (`npm run build` in `api`).
- Runtime resolution endpoint and service tests are present for authentication metadata, configured, unknown, unbound, revoked, missing/disabled Terminal, tenant scoping and read-only lookup behavior.
- Targeted Node test execution was blocked before test initialization by the known environment error `uv_os_get_passwd returned ENOMEM`; no product workaround was added.
- Web readiness orchestration, POS gate, retry, Electron/Agent integration and QA manual validation remain pending.

## Acceptance

All frozen states and reasons are covered. Browser mode remains usable without `window.manusTerminal`. Electron mode cannot enter POS for cloud or contract blockers. Agent loss alone is degraded and does not create offline authority.
