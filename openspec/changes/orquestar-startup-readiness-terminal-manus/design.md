## Context

P9.3 starts from merged P9.2 (`276feaa490cd8d7a62042b9b87034176523f663a`). The current Electron shell loads the configured Web origin through a secure preload bridge. Web obtains P9.1 runtime metadata only when peripheral runtime code asks for it. The Agent owns and persists `installationId` and exposes it through health. The API owns tenants, Devices, bindings and logical Terminals. No combined readiness state or non-mutating runtime Device resolution endpoint exists today.

## Execution modes

`WEB` means browser-only Manus Web. Missing `window.manusTerminal` is normal in this mode. Web must keep its existing cloud POS flow and must not probe a browser localhost Agent.

`ELECTRON_TERMINAL` means the secure Electron shell hosting the current Web deployment. This mode runs the physical-terminal readiness flow. Mode detection is a client boundary: presence of the typed Manus bridge and Electron shell context selects Electron mode; absence selects Web mode. It is never an authorization decision.

## Ownership

- Electron is local runtime authority: secure window, bridge metadata and typed Agent transport.
- Agent is hardware authority: local health, peripherals and persisted `installationId`.
- Cloud API is authority for tenant, Device identity/status, binding and logical Terminal.
- Web is readiness orchestrator: it composes local and cloud observations and gates Electron POS entry.
- Electron must not reproduce cloud binding rules. Web must not invent or mutate a binding.

P9.1 Bridge Contract V1 remains unchanged. Initial probes compose `getRuntimeInfo()` and `getAgentHealth()`. Agent and Installer source remain unchanged.

## Contracts

### Local runtime snapshot

```ts
type LocalRuntimeSnapshot = {
  mode: "WEB" | "ELECTRON_TERMINAL";
  bridgePresent: boolean;
  runtime: RuntimeInfo | null;
  agent: {
    reachable: boolean;
    apiVersion: number | null;
    installationIdAvailable: boolean;
    capabilities: RuntimeCapability[];
  };
};
```

`installationId` is lookup data only. It is not a credential, proof of possession or authorization input. No secret, Agent URL, filesystem path or unrestricted native operation is returned.

### Cloud resolution

Future API endpoint: `POST /terminal-runtime/resolve`.

Request:

```ts
{ installationId: string }
```

The tenant comes only from the verified JWT context. The request does not accept a tenant authority field. The lookup does not register, bind, unbind, revoke, authenticate or authorize the caller. An installation owned by another tenant has the same generic unavailable/not-found behavior and does not leak existence.

Response:

```ts
type TerminalRuntimeResolution =
  | {
      resolution: "CONFIGURED";
      deviceStatus: "BOUND";
      terminal: { terminalId: string; branchId: string; active: true };
    }
  | {
      resolution:
        | "DEVICE_UNKNOWN"
        | "DEVICE_UNBOUND"
        | "DEVICE_REVOKED"
        | "TERMINAL_UNKNOWN"
        | "TERMINAL_DISABLED";
    };
```

The response does not return `deviceId` unless a later implementation proves a concrete runtime need.

### Readiness result

```ts
type TerminalReadinessResult = {
  state: "BOOTING" | "READY" | "DEGRADED" | "NOT_CONFIGURED" | "CLOUD_UNAVAILABLE" | "INCOMPATIBLE" | "ERROR";
  reason:
    | "CHECKING" | "AUTH_REQUIRED" | "BRIDGE_UNAVAILABLE" | "BRIDGE_LEGACY"
    | "BRIDGE_CONTRACT_UNSUPPORTED" | "AGENT_UNAVAILABLE" | "AGENT_API_UNKNOWN"
    | "AGENT_API_UNSUPPORTED" | "INSTALLATION_ID_UNAVAILABLE" | "CLOUD_UNAVAILABLE"
    | "DEVICE_UNKNOWN" | "DEVICE_UNBOUND" | "DEVICE_REVOKED" | "TENANT_MISMATCH"
    | "TERMINAL_UNKNOWN" | "TERMINAL_DISABLED" | "OPTIONAL_CAPABILITY_MISSING"
    | "METADATA_INVALID" | "RETRYABLE_ERROR";
  canEnterPos: boolean;
  localRuntime: LocalRuntimeSnapshot;
  cloud: { reachable: boolean; authenticated: boolean };
  device: { status: "BOUND" | "REGISTERED" | "UNBOUND" | "REVOKED" | null };
  terminal: { terminalId: string | null; branchId: string | null; active: boolean | null };
  capabilities: RuntimeCapability[];
};
```

The initial model has no global `REQUIRED_CAPABILITY_MISSING` blocker. Existing per-terminal feature flags do not yet distinguish required from optional capabilities.

## State semantics and ordering

Pre-auth probes may collect mode, bridge metadata, Agent reachability/API, installation identity and capabilities. They grant no authorization. After authentication, Web uses the verified session and tenant, then asks the cloud resolution endpoint for Device/binding/Terminal state.

`READY` requires Electron mode, a supported bridge, valid authenticated cloud context, configured active Device/Terminal resolution and no blocking condition. A cold Agent outage before an installationId was obtained in the current renderer session is `DEGRADED/AGENT_UNAVAILABLE`, false. After successful identity acquisition, the orchestrator may retain that identity only in volatile memory; if a later cloud lookup remains configured while Agent is down, readiness is `DEGRADED/AGENT_UNAVAILABLE`, true. Restart clears this identity. No localStorage, IndexedDB, filesystem or new cache is used. Optional capability absence is `DEGRADED` or `READY` and does not globally block POS. Cloud loss is `CLOUD_UNAVAILABLE`, false. Unknown, unbound or revoked Device, and unknown or disabled Terminal are `NOT_CONFIGURED`, false. Unsupported bridge is `INCOMPATIBLE`, false. Unsupported Agent API is `INCOMPATIBLE` for hardware runtime. Legacy bridge is `DEGRADED/BRIDGE_LEGACY` and cannot enter physical POS when it cannot provide the identity/contract required for resolution. Browser Web is unaffected by Agent absence.

Readiness is an operational entry gate, not authentication. Client readiness can never replace server authorization, and binding does not prove physical possession. In Electron mode, the existing POS session Terminal must match the cloud-resolved bound Terminal. A mismatch is `NOT_CONFIGURED/TERMINAL_CONTEXT_MISMATCH`, false. No session or persisted context is auto-switched. If no POS session exists, the selector may continue and the eventual session must match. The current POS session API does not enforce physical Device binding; Slice 3 adds only this client operational gate and does not simulate server enforcement with installationId.

P9.3 provides operational startup readiness, cloud Device/Terminal resolution, the Electron Terminal POS-entry gate, and Device-bound Terminal versus POS-context consistency. It does not provide physical Device authentication, cryptographic Device identity, proof of possession, server-side attestation that a POS session originated from the bound Device, or real-time remote revocation. Client readiness checks are not a server authorization boundary; existing JWT/session/tenant/permission authorization remains authoritative. `DEVICE–POS SESSION SERVER-SIDE TRUST / ENFORCEMENT` is a future architectural decision and is not implemented in P9.3.

## Orchestration and UX

Web owns the composition. Electron supplies local observations; the API supplies cloud resolution. The minimal UI states are “Checking Manus Terminal…”, “Ready”, “Device requires configuration”, “Agent unavailable”, “Cloud unavailable”, “Runtime incompatible” and “Degraded operation”. Actions are limited to waiting, Retry and a configuration message. Full diagnostics belong to P9.4.

Evaluate on Web startup, successful authentication, entering the Electron POS route, manual Retry, Agent health recovery and detectable local runtime changes. Remote bind/revoke changes appear on the next evaluation; no websocket or push system is added. Use conservative retry backoff (for example 0/1/2/5/10 seconds, capped) and avoid aggressive polling. In Electron mode, a configured cloud binding must match any existing POS session Terminal; a mismatch is `NOT_CONFIGURED/TERMINAL_CONTEXT_MISMATCH`, false. No session or persisted context is auto-switched. With no POS session yet, the selector may continue and the eventual session must match.

## Database and non-goals

No database migration or V076 is required. Cloud remains authoritative and online. Out of scope: offline sales, transactional cache, managed updates, Linux adaptation, full diagnostic shell, Installer redesign, Agent lifecycle redesign, peripheral driver redesign, migration hardening, device credentials/certificates and server-side physical-possession authentication.
