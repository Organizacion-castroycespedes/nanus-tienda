## Phase A — Typed readiness contracts

- [x] Define shared execution-mode, local snapshot, resolution, state and reason types.
- [x] Add contract tests for bounded values and secret-free payloads.

## Phase B — Authenticated cloud runtime resolution

- [x] Add `POST /terminal-runtime/resolve` as a read-only, JWT-tenant-scoped API.
- [x] Resolve installation identity to Device/binding/Terminal without mutating state or leaking cross-tenant existence.
- [x] Add API tests for configured, unknown, unbound, revoked and disabled outcomes.

## Phase C — Web local-runtime composition

- [x] Detect `WEB` versus `ELECTRON_TERMINAL` without a browser localhost fallback.
- [x] Compose existing `getRuntimeInfo()` and `getAgentHealth()` while preserving Bridge V1.
- [x] Keep browser-only POS valid when the bridge is absent.

## Phase D — Readiness orchestrator/provider

- [x] Implement deterministic ordering of pre-auth probes and post-auth cloud resolution.
- [x] Map failures to the frozen top-level states and reason codes.
- [x] Keep cloud and binding authority in the API.

## Phase E — Electron Terminal POS gate and minimal UX

- [x] Gate Electron POS entry on the readiness result.
- [x] Render checking, ready, configuration, unavailable, incompatible and degraded states with Retry/configuration guidance.
- [x] Do not make browser mode or optional peripherals globally fail.

## Phase F — Retry and re-evaluation

- [ ] Re-evaluate on startup, auth, Electron POS entry, manual Retry, Agent recovery and local runtime changes.
- [ ] Add bounded backoff without polling or push infrastructure.
- [ ] Document that remote binding changes appear on the next evaluation.

## Phase G — Tests and QA

- [ ] Run API, Web and Electron contract/readiness tests as each layer is implemented.
- [ ] Validate the failure matrix in browser and Electron test environments.
- [ ] Run authenticated QA without claiming physical peripheral certification.
