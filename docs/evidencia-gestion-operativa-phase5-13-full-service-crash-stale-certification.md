# Gestión Operativa — Phase 5.13

## Resultado

`PARTIAL`. The Phase 5.12 aggregate fixture works and Phase 5.14 added a
shared stale-recovery entry point. Full crash certification still needs a
real split external-call seam.

## Verified implementation

- Fixture: `backend-facturacion-electronica/test/helpers/real-billing-aggregate-fixture.ts`.
- Smoke suite: `backend-facturacion-electronica/test/electronic-billing.full-service.fixture.integration.spec.ts`.
- Real `ElectronicBillingProcessingService`, repositories, PostgreSQL and
  advisory-lock path are used.
- Persistent provider mock keeps provider documents by `externalReference`.

## Blocking finding

1. `processDocument()` claims the row and writes `PROVIDER_CREATE_INTENT`,
   then calls `issueInvoice()`. The provider contract exposes `issueInvoice()`
   as one operation. The
   service cannot inject a test-only failure between provider creation,
   signing, and transmission, nor observe a separate transmission counter.
2. The background worker still refreshes `PROCESSING` documents; wiring it to
   stale recovery and certifying PRE_TRANSMIT crash recovery needs the real
   provider boundary.

## Safety decision

No production behavior was changed to make tests pass. No retry API or UI was
exposed. Phase 5.13 crash scenarios remain open until the domain provides a
shared stale-recovery entry point and test-only provider operation seams.

No QA or production database was used. No live FactuCore or DIAN call was
made. No commit, push, or deploy was performed.
