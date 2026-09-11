# Controlled single-document DIAN status polling

Fecha: 2026-09-10.

## Scope and guards

- QA database: `manus_tienda_qa`, schema `public`; database guard passed.
- Controlled document: `af28bfb8-cbf2-437a-988a-f534374bd6e9`.
- FactuCore document: `33b68113-0737-4492-9bf4-ccbe84ccb58c` / `SETP990000006`.
- Provider identity matched by ID and external reference. Count remained one; duplicate: no.
- `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false` and `FACTUCORE_BACKGROUND_JOBS_ENABLED=false` remained active. No scanner, worker, queue drain, or outbox redispatch ran.

## Transmission semantics

- Prior issuance had one create, one XML generation, one signing, and one transmission.
- FactuCore transmission persists a transmission attempt and maps a nonterminal response to its document state. The provider returned `SIGNED`, which means the document remained nonterminal after transport; it is not synchronous DIAN acceptance.
- The FactuCore state machine allows `SIGNED` to move to `SENT`, `ACCEPTED`, `REJECTED`, or `TECHNICAL_ERROR`. In this runtime, status normalization maps `SIGNED` to Manus `PROCESSING`.
- CUFE was absent at `SIGNED`; current code expects acceptance evidence or a provider response before terminal fiscal completion.

## Single-document poll

- Safe path: `GET /api/v1/external/documents/:id/status`, exposed through `ElectronicBillingProcessingService.refreshDocumentStatus()`.
- The path reuses the existing provider identity, calls status lookup only, and persists status reconciliation. It cannot create, regenerate XML, sign, or transmit.
- One controlled status lookup by provider ID returned HTTP 200 with `SIGNED`. The external-reference GET was a separate identity preflight, not a processing operation.
- Manus reconciliation was not repeated because the provider state did not change. Manus remains `PROCESSING`, provider status `SIGNED`, provider ID unchanged, and CUFE absent.

## Result and safety

- Final fiscal acceptance: `PENDING`; another poll may be needed later, but none was run here.
- FactuCore create/XML/sign/transmit calls in this task: 0.
- Historical documents were not processed or modified.
- No secrets, credentials, authorization headers, or PII were recorded.
- Billing tests `140/140`, API tests `15/15`, focused FactuCore tests, builds, and OpenSpec `80/80` passed. Git diff checks passed with line-ending warnings only.
- No commit, push, deploy, or PROD access.
