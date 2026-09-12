# Contrato fiscal FactuCore-Manus

## Estado

- Fiscal-location UX checkpoint: `1385030`.
- No live FactuCore call, DIAN call, QA mutation, XML generation, signing, or transmission occurred.
- Billing regression: `143/143`.

## Provenance

FactuCore source at `D:/Profe/Factucore/backend` persists the invoice fiscal identity in `Document.uuid`. Its existing detail response already exposed that value as `cufe`, but the API status response did not. The status response now exposes only safe, queryable fields: `uuid`/`cufe`, prefix, number, status, status detail, accepted/rejected timestamps, latest response code/message, and tracking identifier.

## Field matrix

| Field | FactuCore source | Available through status | Manus handling |
|---|---|---|---|
| CUFE/UUID | `Document.uuid` | Yes after status response update | Normalized `cufe` column |
| Document number/prefix | `Document.consecutiveNumber` / `prefix` | Yes | Normalized columns |
| DIAN status | `Document.status` | Yes | Canonical Manus status |
| Response code/message | latest `TransmissionAttempt` | Yes | Safe `metadata.providerResponse` |
| Accepted/rejected timestamp | `Document.acceptedAt` / `rejectedAt` | Yes | Normalized timestamp columns |
| Tracking ID | latest `TransmissionAttempt.externalTrackingId` | Yes | Safe `metadata.providerResponse.trackingId` |
| Validation timestamp | No distinct proven field | No | Unavailable |
| QR payload/URL | No distinct status field proven | No | Unavailable |
| XML/PDF references | attachment records | Already available in detail/status shape | Attachment metadata only |

## Reconciliation safety

`refreshDocumentStatus()` uses provider status lookup only. It persists provider identity, canonical status, CUFE, terminal timestamps, and safe response metadata. Existing non-null values are preserved when a later response omits a field. Reconciliation does not create documents, generate XML, sign, transmit, or poll DIAN.

Accepted, rejected, pending, recovery, and no-duplicate provider paths are covered by deterministic billing tests. Ticket rendering, QR presentation, and unattended/global processing remain open work.

## Validation

- Focused location tests: `33/33`.
- Billing suite: `143/143`.
- API build: PASS.
- Billing build: PASS.
- Web lint/build: PASS from the location checkpoint.
- OpenSpec change strict: PASS.
- OpenSpec all strict: `88 passed, 1 inherited failure`; failing change is unrelated `corregir-handoff-agent-local-perifericos-electron`.
- `git diff --check`: PASS.
