## Context

Electron 0.1.0 exposes fixed IPC methods. Agent 0.1.1-qa.9 health reports a package version, but no API generation. Web casts any bridge object to a complete interface. HID scanning is browser keyboard capture, not a native bridge API.

## Goals / Non-Goals

Goals: explicit generation 1 contracts and operation-level graceful degradation. Non-goals: P9.2+, installer changes or P7/P8 recertification.

## Decisions

- Add `getRuntimeInfo()` with `electronRuntimeVersion` (installed Manus shell `app.getVersion()`, not Chromium/Electron engine version), `bridgeContractVersion: 1`, `agentApiVersion: number | null`, and a typed capability list. Reuse bounded fixed health request; add `agentApiVersion: 1` to Agent health rather than infer API from package semver.
- Capability names map exactly to existing bridge operations: agent.health, devices.list, devices.discover, devices.create, devices.update, printer.testPrint, printer.printTicket, drawer.open, scanner.simulate, scale.currentWeight, logs.list. No scanner.input claim. Capabilities describe API support, never physical device readiness or certification.
- Only advertise Agent operations when health confirms generation 1. Always advertise the safe health probe. Unknown/unavailable Agent version is null; an explicit unsupported integer is preserved for classification.
- Web accepts only generation 1. Unsupported generations or malformed metadata are INCOMPATIBLE. Missing metadata (legacy bridge), missing requested capabilities/methods, unknown Agent generation, or failed/timed-out metadata are DEGRADED. Browser/SSR absence is DEGRADED with no terminal capabilities and does not alter browser transport.
- Legacy bridges can call only verified existing fixed methods; no claim of negotiated support. Modern metadata is authoritative and intersected with actual callable methods. Unavailable operations return controlled OPERATION_DISABLED errors through existing POS handling; no fallback to browser localhost from Electron.
- Keep wire types in Electron and Web with a cross-contract type assertion test; avoid coupling independent application builds to shared runtime code.
- Read metadata per operation (bounded at 3 seconds), allowing Agent recovery without a stale persistent cache. This adds one local health round trip.

## Risks / Trade-offs

- Legacy contracts cannot prove Agent generation: retain existing methods only, mark DEGRADED.
- Agent may change after negotiation: existing operation error handling remains required.
- Unknown generation blocks peripheral actions, not cloud POS or browser keyboard input.

## Migration Plan

Additive Agent health and Electron metadata can deploy independently. New Web supports older bridges. New Electron with older Agent degrades safely until Agent exposes generation 1. Roll back application source independently; no data migration or installer rebuild in this phase.
