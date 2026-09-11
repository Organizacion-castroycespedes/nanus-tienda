# DIAN rejection and Manus reconciliation evidence

- Controlled FactuCore document: `33b68113-0737-4492-9bf4-ccbe84ccb58c`.
- Controlled Manus document: `af28bfb8-cbf2-437a-988a-f534374bd6e9`.
- No retransmission, creation, XML generation, signing, polling, or SQL status mutation occurred in this investigation.

## Rejection

- FactuCore persisted one transmission attempt with provider `DIAN`, response code `99`, and sanitized summary `Validación contiene errores en campos mandatorios.`.
- Code `99` is taken from the DIAN `SendBillSync` response and normalized by the FactuCore DIAN provider as `REJECTED`; it is not a FactuCore transport-only code.
- The response persistence path stores sanitized request/response data in `TransmissionAttempt.responsePayload` and the document response field. The captured top-level result exposes the generic rejection summary; detailed rule entries require a separate sanitized payload query.
- CUFE remains present because it was calculated and persisted during XML generation. It does not prove acceptance.

## Reconciliation

- FactuCore final document state after the send: `REJECTED`.
- One Manus `refreshDocumentStatus()` invocation was made after the provider state changed.
- That lookup returned provider status `SIGNED`, so Manus stayed `PROCESSING`. No retry followed.
- The observed mismatch is consistent with a stale/early provider lookup or endpoint response race, but the exact live GET response after the committed rejection was not re-polled in this task.
- Mapper source supports `REJECTED -> REJECTED`; no proven mapper conversion defect was established.
- Current task safety gate did not authorize another reconciliation because a fresh authenticated status lookup returning `REJECTED` was not obtained. The existing Manus result remains `PROCESSING` / provider `SIGNED`.
- No additional FactuCore GET, DIAN poll, transmission, or status mutation was completed in this task.

## Safety

- Provider document count remained one; no duplicate was created.
- Outbox stayed intentionally `PENDING`; no redispatch occurred.
- Historical documents were not processed or modified.
- Background workers remained disabled and PG-BOSS remained quiescent.
- No secrets or PII are recorded here.
