## Security risks

P9.3 provides operational startup readiness, cloud Device/Terminal resolution, the Electron Terminal POS-entry gate, and Device-bound Terminal versus POS-context consistency. It does not provide physical Device authentication, cryptographic Device identity, proof of possession, server-side attestation that a POS session originated from the bound Device, or real-time remote revocation. Client readiness checks are not a server authorization boundary; existing JWT/session/tenant/permission authorization remains authoritative. `DEVICE–POS SESSION SERVER-SIDE TRUST / ENFORCEMENT` remains a future architectural decision and is not implemented in P9.3.

| Risk | Mitigation |
|---|---|
| Spoofed `installationId` | Treat it as lookup data only; require verified JWT tenant context; no registration or binding from readiness. |
| Cross-tenant existence leak | Scope query by authenticated tenant and return generic unavailable behavior. |
| Client-only gate bypass | Keep readiness operational; enforce business authorization on the API. |
| Stale result after bind/revoke | Re-evaluate at defined triggers; no claim of push invalidation. |
| Legacy bridge fail-open | Mark `DEGRADED/BRIDGE_LEGACY`; use only known callable methods and never claim modern negotiation. |
| Generic IPC or local proxy expansion | Keep typed methods and fixed metadata; preserve context isolation, no arbitrary Agent URL, filesystem or command access. |
| Device/peripheral identity confusion | Keep TerminalDevice, cloud Device, logical Terminal and printer/scanner/scale/drawer IDs separate. |

## Architectural risks

- Duplicating cloud binding rules in Web or Electron.
- Treating a missing optional peripheral as a global POS blocker.
- Reusing current POS session terminal as the Device binding target.
- Introducing local cache or offline authority under the name of readiness.
- Scope creep into P9.4 diagnostics, P9.5 updates or P9.6 Linux work.

## Open decisions

- Required versus optional capability policy is not modeled yet; no global required-capability blocker is allowed in the first slice.
- Exact local snapshot implementation may compose existing bridge methods without a V1 bump.
- Whether a future runtime response needs `deviceId` remains open; initial response omits it.
- Exact retry timing and behavior when a bound Terminal changes during an active POS session need implementation review.
- Multi-tenant SUPER_ADMIN lookup scope remains the verified JWT tenant context unless a later authorized context model is designed.
- Agent autostart ownership remains later lifecycle work.
