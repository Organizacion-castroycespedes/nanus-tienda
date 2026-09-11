# Single-document DIAN status polling

Fecha: 2026-09-10.

- QA only. Database guard: `manus_tienda_qa`, schema `public`.
- Controlled provider document: `33b68113-0737-4492-9bf4-ccbe84ccb58c`, full number `SETP990000006`.
- Provider identity matched by ID and external reference. Count stayed `1`; duplicate: no.
- Prior transmission had one attempt and completed create, XML, sign, and transmit. This task executed zero calls for all four mutation operations.

## Semantics

FactuCore `transmitWithActor()` sends the signed artifact through `transmissionService.transmitDocument()`, persists the attempt, and maps the provider result. A nonterminal provider response is not DIAN acceptance. The observed response remained `SIGNED`; Manus maps that state to `PROCESSING`.

FactuCore state transitions allow `SIGNED` to `SENT`, `ACCEPTED`, `REJECTED`, or `TECHNICAL_ERROR`; `SENT` can later become `ACCEPTED`, `REJECTED`, or `TECHNICAL_ERROR`.

## Safe poll

The narrow safe method is FactuCore `GET /api/v1/external/documents/:id/status`, reached by Manus `ElectronicBillingProcessingService.refreshDocumentStatus()`. It reuses the existing provider ID, performs status lookup, and persists only reconciliation data. It cannot create, generate XML, sign, or transmit.

One controlled provider-ID status lookup returned HTTP 200 and `SIGNED`. The external-reference GET was identity preflight. No retransmission occurred. Manus remained `PROCESSING` with provider status `SIGNED`; provider ID stayed unchanged; CUFE remained absent.

Final fiscal acceptance is `PENDING`. Another poll is required later, but no additional poll ran here.

## Isolation and validation

- `FACTUCORE_BACKGROUND_JOBS_ENABLED=false`; `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`.
- No scanner, worker, queue drain, outbox redispatch, or historical processing.
- Billing tests: `140/140` passed.
- API tests: `15/15` passed.
- FactuCore status guard: `9` cases passed; background isolation passed.
- FactuCore and Billing builds passed. OpenSpec all strict: `80/80`.
- No secrets, PII, commit, push, deploy, or PROD access recorded.

## Controlled repoll

- A second and final single-document status poll was executed for provider document `33b68113-0737-4492-9bf4-ccbe84ccb58c`.
- Result: provider status `SIGNED`; mapped FactuCore/Manus state stayed nonterminal (`PROCESSING`). CUFE remained absent.
- No Manus reconciliation ran because there was no provider state change.
- Transmission attempt count remained `1`; no new transmission attempt was created.
- Provider count remained `1`; duplicate: no. Outbox remained `PENDING` and was not redispatched.

## Delayed controlled repoll

- A further single-document poll ran after a 10-second waiting interval.
- Poll timestamp: `2026-09-11T00:49:58.023Z`.
- The prior poll timestamp was not persisted in the database, so exact elapsed time is unavailable; the controlled wait was at least 10 seconds.
- Result remained provider `SIGNED`, mapped FactuCore/Manus state `PROCESSING`, with CUFE absent.
- No Manus reconciliation ran because provider state did not change.
- Transmission attempts remained `1`; provider count remained `1`; no new transmission and no duplicate occurred.
