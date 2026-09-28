## Risks

- `installationId` identifies a lookup record but does not prove physical possession.
- Client readiness cannot enforce physical-device trust for server-side sales.
- Agent loss can produce degraded behavior after a volatile identity was observed.
- Manual hardware certification remains separate from automated readiness tests.

## Deferred security change

Pairing codes, challenge-response, credential issuance, secure Windows/Linux storage, rotation, revocation and recovery require a separate owner-approved OpenSpec. This change must not implement them.
