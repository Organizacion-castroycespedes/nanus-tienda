## Canonical persistence

- [x] Add pure Agent credential, binding, KG verification, logical identity, readiness and one-time capture domains.
- [x] Add scoped DEV_TO_QA migration evaluation and forward-only V103 persistence for credentials, bindings and durable captures.
- [x] Certify V103 on QA, including schema convergence and concurrent single-consumption; remove temporary certification rows.

## Secure Node Agent runtime and operator flow

- [x] Node Agent owns an RSA enrollment keypair and verifies a pinned Ed25519-signed, short-lived challenge from fixed HTTPS API configuration.
- [x] Implement opaque encrypted credential envelope, protected Node secret store, Agent credential authentication and API challenge/approval contracts.
- [x] Wire authenticated binding creation, explicit operator KG confirmation, revoke/rebind semantics and backend REAL-readiness policy.
- [x] Extend Electron IPC and Configuración → Periféricos POS UX for pairing, binding, KG confirmation and REAL test reading; never return plaintext credential to UI.
- [ ] Run Node/API/frontend security tests, typechecks and governed OpenSpec/scope validation.
- [ ] Provision the QA API Ed25519 private key in protected runtime secret configuration and matching public key/id in trusted Agent package configuration.
- [ ] Validate DPAPI storage under installed LocalService identity and perform actual QA pairing plus physical ROCHI REAL reading.

## Deferred weighted sale

- [ ] Integrate atomic capture consumption into `SaleService` in the following phase; UNIT sales remain unchanged.
- [ ] Keep WEIGHT/BOTH sale UI disabled until the runtime authorization and subsequent sale lifecycle gates pass.
