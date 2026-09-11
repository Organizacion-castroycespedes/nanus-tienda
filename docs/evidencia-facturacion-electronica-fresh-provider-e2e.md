# Fresh controlled document — single provider processing

Fecha: 2026-09-10.

## Scope and security

- QA database: `manus_tienda_qa`; schema `public`; database guard passed.
- The previously exposed local JWT secret was rotated in `api/.env`, without recording either secret. Only the Manus API was affected and restarted.
- Authentication after rotation returned HTTP 200 on `/api/auth/me`.
- `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false` and `FACTUCORE_BACKGROUND_JOBS_ENABLED=false` remained active. No global dispatcher, pg-boss worker, or DIAN scanner was started.
- No historical document was processed or modified. No outbox redispatch or replay occurred.

## Controlled document

- Sale: `30a0a076-d3df-483f-8966-d6e3c9f3717e`.
- Electronic document: `af28bfb8-cbf2-437a-988a-f534374bd6e9`.
- Inbox event: `29afdd82-974d-4fc4-8d86-d19f62ee1835`.
- Outbox event remained `PENDING` by design; it was not redispatched.
- The document was `PENDING` with no provider identity before processing and had exactly one document for the sale.

## Processing

- Canonical PENDING entrypoint: `ElectronicBillingProcessingService.processDocument(tenantId, documentId)`.
- Exactly one controlled processing invocation ran. `retryDocument()` was not used.
- FactuCore create, XML generation, signing, and transmission each executed once through the provider adapter.
- FactuCore returned provider identity `33b68113-0737-4492-9bf4-ccbe84ccb58c`.
- Read-only reconciliation by the new external reference found the same single provider document. No duplicate was created.
- Provider status was `SIGNED`; Manus final observed status was `PROCESSING`, so final fiscal acceptance remains `PENDING` and no status scanner was enabled.

## Persistence and safety

- Manus persisted provider identity, prefix `SETP`, number `990000006`, and full number `SETP990000006`.
- CUFE/CUDE was not present at the observed asynchronous stage.
- Electronic document events were limited to the existing `DOCUMENT_CREATED` and this attempt's `PROCESSING_STARTED` records.
- Historical document `41f5c937-9219-4d70-9848-14b46a7aa820` remained `REJECTED` with null provider identity.
- Provider idempotency passed: external-reference lookup resolved one document.
- No secrets, credentials, authorization headers, or customer values were recorded.

## Validation

- Fresh snapshot and FactuCore readiness dry run passed before processing.
- Billing tests: `140/140` passed.
- API sale tests: `15/15` passed.
- FactuCore isolation, filter, customer-location, and existing-customer tests passed.
- Billing build, API build, FactuCore build, and OpenSpec all strict (`80/80`) passed.
- No commit, push, deploy, or PROD access.
