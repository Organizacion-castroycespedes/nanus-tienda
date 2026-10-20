## Canonical persistence

- [x] Add pure Agent credential, binding, KG verification, logical identity, readiness and one-time capture domains.
- [x] Add scoped DEV_TO_QA migration evaluation and forward-only V103 persistence for credentials, bindings and durable captures.
- [x] Certify V103 on QA, including schema convergence and concurrent single-consumption; remove temporary certification rows.

## Secure Node Agent runtime and operator flow

- [x] Add capture-correlated, secret-safe diagnostics for REAL read, local validation, authenticated observation HTTP outcomes and READY confirmation; preserve existing response semantics. Evidence: Peripheral Agent build PASS, suite 176/176 PASS, manifest integrity 5 PASS/1 SKIP, OpenSpec strict PASS, governance focal PASS, and `git diff --check` PASS.

- [x] Node Agent owns an RSA enrollment keypair and verifies a pinned Ed25519-signed, short-lived challenge from fixed HTTPS API configuration.
- [x] Implement opaque encrypted credential envelope, protected Node secret store, Agent credential authentication and API challenge/approval contracts.
- [x] Separate runtime authentication of an existing DPAPI credential (fixed API base URL plus credential) from pairing trust (pinned Ed25519 key, audience and key ID); keep missing/invalid pairing trust fail-closed. (Evidence: focused Agent service tests cover successful existing-credential validation/observations without trust, rejected credentials without auto-pairing, missing trust, non-Ed25519 trust and absence of credential logging.)
- [x] Make existing DPAPI credential reads non-mutating while retaining restrictive ACL enforcement on writes; cover ACL independence, unprotect, buffer clearing, invalid records and DPAPI failure. (Evidence: Agent build PASS; full test suite 170/170 PASS; focused store/pairing tests 11/11 PASS.)
- [x] Wire authenticated binding creation, explicit operator KG confirmation, revoke/rebind semantics and backend REAL-readiness policy.
- [x] Extend Electron IPC and Configuración → Periféricos POS UX for pairing, binding, KG confirmation and REAL test reading; never return plaintext credential to UI.
- [ ] Run Node/API/frontend security tests, typechecks and governed OpenSpec/scope validation.
- [ ] Provision the QA API Ed25519 private key in protected runtime secret configuration and matching public key/id in trusted Agent package configuration.
- [ ] Validate DPAPI storage under installed LocalService identity and perform actual QA pairing plus physical ROCHI REAL reading.

## Bounded commercial observation persistence

- [x] Apply a transaction-local PostgreSQL statement timeout to each `markReady` statement; preserve READY validation/SQL/HTTP semantics, rollback cancelled work, and test timeout ordering and pool-scope cleanup. Evidence: API build PASS; focused scale-authorization/persistence tests 25/25 PASS, including SQLSTATE 57014 rollback/rethrow, client discard if rollback fails, and transaction-local ordering; OpenSpec strict PASS; governance focal PASS; `git diff --check` PASS. No QA capture or database integration write was run.

## Deferred weighted sale

- [ ] Integrate atomic capture consumption into `SaleService` in the following phase; UNIT sales remain unchanged.
- [ ] Keep WEIGHT/BOTH sale UI disabled until the runtime authorization and subsequent sale lifecycle gates pass.
