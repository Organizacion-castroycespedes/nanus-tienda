## Ownership

- Peripheral Agent owns local health and persisted `installationId`.
- Electron owns the typed bridge and runtime metadata.
- API owns Tenant, Device, binding and Terminal state.
- Web composes observations and controls the Electron POS entry experience.

## API contract

`POST /terminal-runtime/resolve` accepts only `{ installationId }`. Tenant comes only from the verified JWT context. The lookup is read-only and returns bounded outcomes: `CONFIGURED`, `DEVICE_UNKNOWN`, `DEVICE_UNBOUND`, `DEVICE_REVOKED`, `TERMINAL_UNKNOWN` and `TERMINAL_DISABLED`.

## Readiness contract

Browser `WEB` mode does not probe Agent or call cloud runtime resolution. Electron mode uses P9.1 `getRuntimeInfo()` and `getAgentHealth()`. A configured Device must resolve to an active Terminal. A mismatch with the existing POS Terminal blocks entry without changing persisted context. Cloud success is reported as reachable. Agent loss after volatile identity acquisition is degraded, not offline authority.

Readiness is operational only. JWT, Tenant isolation, permissions and backend authorization remain authoritative.
