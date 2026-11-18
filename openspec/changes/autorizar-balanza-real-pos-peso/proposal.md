## Why

The POS currently keeps weight sales fail-closed. The installed Agent has a local installation identity and the POS has a terminal-to-device binding, but neither proves Agent possession of a secret nor binds a particular physical scale with verified KG units. A renderer-supplied weight cannot be trusted as sale evidence.

V103 is the canonical forward-only persistence contract and has already been applied and certified in QA, including durable capture single-consumption under PostgreSQL concurrency. Fiscal reconciliation remains separately deferred. This phase wires secure Node Agent pairing/authentication, operator scale authorization and backend-derived REAL readiness; it deliberately does not wire weighted-sale consumption into `SaleService` or enable weight sales.

## What Changes

- Define an opaque high-entropy Agent credential contract with verifier-only persistence, expiration and revocation semantics; keep `installationId` as identity, never secret.
- Define scale-binding lifecycle and KG verification invariants across tenant, branch, logical POS terminal, operational terminal, cloud device and logical peripheral scale.
- Define backend-owned `REAL_AVAILABLE` readiness and reason codes.
- Define a REAL-only, KG-only, context-bound one-time weight-capture contract and sale input contract that carries a capture reference, never a client weight.
- Implement Ed25519-signed Agent-initiated pairing, native protected Agent secret storage, authenticated Agent requests, persisted binding/KG authorization and backend-derived REAL readiness.
- Evolve Configuración → Periféricos POS to pair the Agent, associate ROCHI, confirm KG and test a fresh REAL reading without exposing credential secrets.

## Out of Scope

- No new DB migration unless an unavoidable persistence invariant is proven missing; V103 is reused.
- No `SaleService`/cart/payment/ticket integration for weighted sale and no `/pos` weight-sale activation. UNIT sales remain unchanged.
- No changes to the paused fiscal reconciliation or migration history.

## Acceptance Boundary

Passing unit/build tests is not physical QA certification. QA activation additionally requires the operator-provisioned signing key and pinned public key, LocalService DPAPI validation, authenticated terminal binding, explicit operator KG confirmation and a successful physical ROCHI read. No PRD/global promotion is implied.

## Windows lifecycle P0 contract alignment

HU-WIN-LIFECYCLE-P0-CONTRACT-ALIGNMENT adds only the P0-A conservation and P0-B installation-admission contracts below. These contracts remain normative here. The exact file-level owner of `backend-perifericos/windows-installer/main_windows.go` is now `windows-uninstall-process-lifecycle` for lifecycle admission/update implementation; this transfer does not move pairing, Agent trust or scale-authorization ownership. `main_windows_test.go` remains owned by `controlar-descubrimiento-perifericos-reales`; lifecycle update tests use the exact dedicated paths reserved under its own owner. No runtime implementation or installation is authorized by this documentary ownership decision.

- P0-A: generated normal and quiet uninstall commands preserve data/configuration by default, with Windows quoting preserved and no implicit `--remove-data`. Explicit data-removal consent remains separate and does not authorize destructive execution in this checkpoint.
- P0-B: classify installation evidence read-only before any persistent effect; admit only proven fresh, coherent repair or supported update, and reject partial/inconsistent or unknown evidence without automatic recovery.
- Align with the existing `windows-uninstall-process-lifecycle` requirements "Explicit silent-uninstall data policy" and "Ordered payload and registration cleanup", without editing that change or weakening its authority/completion gates.
- Existing ROCHI, Agent authentication, pairing, enrollment, capture and KG requirements remain unchanged. P1 helper, ROOT-05 disposition and real install/uninstall certification remain outside P0; documentary PASS is not executable or physical QA evidence.

## QA package startup safety

The future Windows QA Agent package SHALL keep `mode=REAL` and its configured QA endpoint/audience, set `enableRealAdapters=true` for explicitly requested real-device operations, and set `discoverOnStartup=false`. Production packaging keeps explicit real adapters and its existing startup discovery policy. The installed Build 04 remains unchanged. This profile change does not alter the enrollment trust contract or certify enrollment; see `controlar-descubrimiento-perifericos-reales` for the independent policy.
