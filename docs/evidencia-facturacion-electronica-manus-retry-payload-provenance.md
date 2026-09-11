# Manus retry payload provenance

## Scope

Read-only QA investigation. No provider POST, retry, outbox replay, worker, or database mutation was executed.

## Database guard

- Database: `manus_tienda_qa`
- User: `manus_user`
- Schema: `public`
- Server: private QA database
- Guard: passed

## Structural comparison

| Field | Current canonical customer | Outbox | Inbox | Document snapshot | Retry mapper input | FactuCore HTTP |
|---|---|---|---|---|---|---|
| `cityName` | PRESENT | PRESENT | PRESENT | MISSING | MISSING | PRESENT |
| `departmentCode` | PRESENT | NULL | NULL | MISSING | MISSING | NULL |
| `departmentName` | PRESENT | NULL | NULL | MISSING | MISSING | NULL |
| `countryName` | PRESENT | PRESENT | PRESENT | MISSING | MISSING | PRESENT |

The current canonical customer is the Manus customer linked to sale `e06ea802-077a-4d03-865f-56075d44ce6c`. Its safe UUID is `92020000-0000-0000-0000-000000000001`.

The stored event ID is `SALE_COMPLETED_FOR_ELECTRONIC_BILLING:00000000-0000-0000-0000-000000000001:e06ea802-077a-4d03-865f-56075d44ce6c`. Outbox and inbox share the same incomplete snapshot. The electronic document metadata also contains an incomplete customer snapshot.

## Retry source

`retryDocument()` loads the electronic document aggregate. `buildInvoiceCommand()` reads `metadata.electronicBilling.customer`, then `FactuCoreProvider` maps that snapshot into the provider request. It does not reload the current sale/customer for invoice retry.

Therefore retry reuses the persisted document snapshot. It does not refresh the canonical customer.

## Timeline

- Sale created: `2026-09-10T04:29:27.259Z`
- Outbox event created: `2026-09-10T04:29:27.081Z`
- Inbox event received: same event timestamp recorded in QA
- Electronic document created: `2026-09-10T04:34:34.216Z`

The stored event and document were created before the later location corrections were available in the current canonical record. The exact source change timestamp is not used as authority; the data comparison proves the snapshots are pre-fix/stale relative to canonical data.

## Semantics and decision

The event has an immutable payload hash and is persisted in outbox/inbox tables. The consumer reuses existing inbox records, and retry reads the document snapshot. This is immutable-snapshot behavior.

Primary root cause: the controlled document was created from an incomplete historical event snapshot. Department fields became `NULL` upstream of FactuCore and remained absent in the document snapshot and retry mapper input.

Safe QA strategy: create a new controlled document after proving a fresh outbox payload, inbox payload, and document snapshot contain all four location fields. Do not rewrite this historical event or mutate the existing document.

## Safety

- FactuCore provider calls: `0`
- XML, sign, transmit: `0`
- Document processed: `NO`
- Manus worker: disabled
- FactuCore background jobs: disabled
- Secret leak: none
- No commit, push, deploy, or production access
