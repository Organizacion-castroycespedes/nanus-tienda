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
- [x] HU-PAIRING-API-SKEW: Sign pairing challenges with `issuedAt` exactly 2,000 ms before API time and `expiresAt = issuedAt + lifetime` (integer, more than 2,000 and at most 300,000 ms), so installed Agent qa.16 accepts a clock lag of up to 2,000 ms without the Windows update; keep every signature, identity, nonce, single-use and expiry check. Evidence (2026-11-15, no deploy): `agent-pairing.domain.ts` change; focused pairing/service/config specs 28/28 PASS (baseline 20/20); whole `scale-authorization` module 52/52 PASS; tests replicate the HEAD qa.16 verifier (accepts at 0/200/1,999/2,000 ms lag, rejects at 2,001 ms) and the qa.17 verifier (accepts up to 4,000 ms), cover expiry, tampering, wrong key/key ID/audience/installation, lifetime bounds, API-side clock boundaries, and service-level replay (`PAIRING_CHALLENGE_ALREADY_USED`) and tampering (`PAIRING_CHALLENGE_INVALID`); `tsc --noEmit` on the API project PASS. Spec files are excluded from the project tsconfig; a scoped spec typecheck reports two type errors at lines 162 and 246 of `scale-authorization.runtime.service.spec.ts`, which are byte-identical to HEAD; the new test code adds none. The qa.16 behavior is a replica of the HEAD Agent source, not a run against the installed binary.
- [x] Deploy the HU-PAIRING-API-SKEW API change to QA only under separate deployment authorization, then confirm a QA challenge carries a 2,000 ms backdated `issuedAt` and a window of at most 300,000 ms before attempting task 20. Evidence (2026-11-17): release merge `a9c91b25` (PR #411, tree `f464d2e6`), QA deploy run 44114157175 SUCCESS; one authorized challenge returned HTTP 201 with audience `manus-agent:qa`, lifetime 300,000 ms and an `issuedAt` offset bounded to 1,562-2,034 ms before API time. The signature check against qa.16 was not run from the API side; the Agent's own acceptance of a later challenge is the end-to-end check.
- [ ] HU-SCALE-BINDING-REVOKE-GUARD: Revoke only `PENDING`/`AUTHORIZED` bindings and only authenticated credentials from the operator UI; report scale-save partial outcomes truthfully; expose `credentialId` in the terminal snapshot; refuse approval of a challenge that expires within 5,000 ms and clear it after `PAIRING_CHALLENGE_INVALID`/`PAIRING_CHALLENGE_ALREADY_USED`. Keep API verification, Ed25519, single-use `jti` and tenant scoping unchanged.
- [ ] HU-SCALE-REVOKED-BINDING-REBIND: Treat only `PENDING`/`AUTHORIZED` bindings as current in the operator UI so a `REVOKED` binding for a previous physical scale no longer forces `SCALE_MISMATCH` or blocks a new association for the configured scale; never count a revoked binding's KG verification as current confirmation, authorization, REAL readiness or Agent sync. Backend `createBinding` already ignores `REVOKED` rows and keeps tenant, terminal, active credential and persisted-scale checks; no API or contract change.
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
