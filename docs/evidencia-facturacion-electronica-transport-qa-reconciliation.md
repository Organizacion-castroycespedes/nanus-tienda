# Evidencia de reconciliacion transport QA - facturacion electronica

Fecha: 2026-08-28

## Guard

- Environment: `qa`
- Database: `manus_tienda_qa`
- Schema: `public`
- Database user: `manus_user`
- `current_database()`: `manus_tienda_qa`
- `current_schema()`: `public`
- PROD: no tocado
- Backup previo: `scripts/database/backups/manus_tienda_qa_20260828022244.dump`

Migration history confirmada una vez por version:

- `V072__electronic_billing_base_persistence.sql`: success
- `V073__electronic_billing_inbox_events.sql`: success
- `V074__integration_outbox_events.sql`: success

## Old pending sale

Sale: `2bcbf62c-3b93-43ad-a047-45800cc93bf1`

- Sale exists: yes
- Tenant: `00000000-0000-0000-0000-000000000001`
- Sale status: `CONFIRMED`
- Event type: `SALE_COMPLETED_FOR_ELECTRONIC_BILLING`
- Schema version: `1`
- Source type: `SALE`
- Source id: same sale id
- Payload hash: present
- Payload shape: `sale`, `customer`, `lines`, `taxes`, `payments`, `totals`
- Initial outbox status: `PENDING`
- Initial attempts: `4`
- Initial error: `Electronic billing provider configuration is disabled or missing`
- Inbox before replay: no
- Electronic document before replay: no
- Reconciliation case: `A`

Interpretation: transport had not completed. Billing config was enabled before replay. The persisted event was replayed with the same `event_id` through the real dispatcher and internal HTTP path.

## Replay result

- Replay executed: yes
- Replay event id: same persisted event id
- Final outbox status: `PUBLISHED`
- Final outbox attempts: `5`
- Inbox status: `PROCESSED`
- Electronic document count: `1`
- Electronic document id: `da862163-c4f3-44c8-92cf-066afc9abcbb`
- Document status: `PENDING`
- Provider document id: `NULL`
- Provider status: `NULL`
- External reference: `SALE-00000000-0000-0000-0000-000000000001-2bcbf62c-3b93-43ad-a047-45800cc93bf1`
- Duplicate document created: no

## Failed outbox rows

Count: `2`

Both rows have:

- Event type: `SALE_COMPLETED_FOR_ELECTRONIC_BILLING`
- Schema version: `1`
- Source type: `SALE`
- Existing confirmed sale: yes
- Inbox: none
- Electronic document: none
- Attempts: `5`
- Error: `Billing backend unavailable`

Rows:

- Source `61060218-df57-4150-abdc-6d93b5da13c0`: expected QA transport-unavailable artifact.
- Source `6a81369c-7e50-4b21-8057-e086234a7016`: expected QA transport-unavailable artifact.

No failed inbox rows were found. Failed audit rows were not deleted or changed.

## Queue health

- Outbox: `PUBLISHED = 2`, `FAILED = 2`
- Unexpected due `PENDING` rows: `0`
- Unexpected active/stale leased rows: `0`
- Inbox: `PROCESSED = 2`
- Inbox failed rows: `0`
- Electronic documents: `PENDING = 2`
- Real FactuCore HTTP: `0`
- Credential resolution during reconciliation: `0`
- Billing Backend worker during reconciliation: disabled
- API dispatcher after reconciliation: disabled

## Conclusion

Transport QA reconciliation passed.

The old pending event was reconciled without creating a new event or deleting audit data. The two failed rows remain as identified QA transport-failure artifacts. Provider QA remains blocked until its separately controlled execution; no worker or FactuCore processing was enabled here.
