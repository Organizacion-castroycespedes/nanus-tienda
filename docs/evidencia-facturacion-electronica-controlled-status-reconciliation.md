# Controlled FactuCore async status reconciliation

Fecha: 2026-09-10.

## Scope

- QA only: `manus_tienda_qa`, schema `public`.
- Document: `af28bfb8-cbf2-437a-988a-f534374bd6e9`.
- Provider document: `33b68113-0737-4492-9bf4-ccbe84ccb58c`.
- Full number: `SETP990000006`.
- No create, XML generation, signing, retransmission, retry, outbox replay, or worker activation occurred in this reconciliation task.

## Identity and isolation

- Manus provider identity matched the FactuCore document by provider ID and external reference.
- Provider count by external reference: one. Duplicate: no.
- Outbox stayed `PENDING`; no redispatch occurred.
- Manus and FactuCore background processing remained disabled. Queue remained quiescent.
- Historical documents were not processed or modified.

## Status behavior

- Manus state before refresh: `PROCESSING`, provider status `SIGNED`.
- FactuCore read-only status lookup by ID and external reference returned HTTP 200 with provider status `SIGNED`.
- Production status entrypoint: `ElectronicBillingProcessingService.refreshDocumentStatus(tenantId, documentId)`.
- The entrypoint resolves the provider, calls `getDocumentStatus`, and persists the returned status. It does not issue, create, generate XML, sign, transmit, or retry.
- Exactly one controlled refresh ran. Result stayed FactuCore `SIGNED` and Manus `PROCESSING`; no CUFE was returned.

## Signed-after-transmit explanation

The provider adapter performs create, XML, sign, and transmit in the issuance flow. The observed transmit response still reported `SIGNED`. The mapper normalizes `SIGNED` to Manus `PROCESSING`, while terminal acceptance requires a later provider status transition. Therefore `TRANSMIT=PASS` means transport operation completed; it does not mean DIAN acceptance was synchronous. The single read-only refresh confirmed the provider was still nonterminal.

## Events and validation

- Document events remained coherent: `DOCUMENT_CREATED` followed by `PROCESSING_STARTED`; no duplicate lifecycle event was added by refresh.
- FactuCore provider status mapping uses the production mapper; no status was invented or forced.
- Billing tests: `140/140` passed.
- API sale tests: `15/15` passed.
- FactuCore isolation, filter, customer-location, and existing-customer tests passed.
- Billing, API, and FactuCore builds passed.
- OpenSpec all strict passed: `80/80`.
- No secrets or PII were recorded. No commit, push, deploy, or PROD access.
