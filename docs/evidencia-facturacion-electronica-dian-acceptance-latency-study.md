# FactuCore QA DIAN acceptance latency study

Fecha: 2026-09-10.

## Scope

- Read-only study. No DIAN call, provider call, status poll, reconciliation, queue action, or database mutation.
- FactuCore connected to local QA database `factucore`, schema `public`; runtime is the local QA instance. Manus guard remains `manus_tienda_qa` / `public`.
- Background flags remained disabled. No commit, push, deploy, or PROD access.

## Golden accepted documents

Three accepted document records were reviewed: `SETP990000005`, `SETP990000003`, and `SETP990000002`. The selected latest accepted records have complete status histories and transmission records.

| Document | Signed → accepted | Transmit finish → accepted | Evidence |
| --- | ---: | ---: | --- |
| `SETP990000005` | 6.957 s | 2.211 s | accepted attempt, response code `100` |
| `SETP990000003` | 6.548 s | 2.625 s | accepted attempt, response code `100` |
| `SETP990000002` | 14 min 52.198 s | 14 min 48.200 s | multiple status attempts; final accepted attempt |

Observed signed-to-accepted minimum: 6.548 s. Median: 6.957 s. Maximum: 14 min 52.198 s.

## Current controlled document

`SETP990000006` is `SIGNED` with a provider document identity, but FactuCore database shows `sentAt=NULL`, `acceptedAt=NULL`, and no `TransmissionAttempt` row. It has a `TRANSMISSION_REQUESTED` event only. Therefore transmit completion time and transmit-to-acceptance age are not available. At the study clock, the signed-age proxy was about 1 h 36 min, longer than the observed golden signed-to-accepted maximum; this is not a valid transmission-latency measurement.

This evidence indicates the prior `TRANSMIT=PASS` represented request acceptance/queueing at the FactuCore boundary, not a completed DIAN transmission. No poll was run here, so no conclusion about current DIAN acceptance was invented.

## Recommendation

Do not poll in this task. Before any future poll, investigate the missing FactuCore transmission attempt and the disabled transmission dispatcher path. Based on the three accepted samples alone, a QA investigation threshold is greater than 15 minutes after a confirmed transmission attempt; the current document has no confirmed transmission attempt, so cadence is `INSUFFICIENT_DATA` until that boundary is proven.
