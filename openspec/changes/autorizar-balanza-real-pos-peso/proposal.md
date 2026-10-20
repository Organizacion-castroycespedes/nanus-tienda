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
