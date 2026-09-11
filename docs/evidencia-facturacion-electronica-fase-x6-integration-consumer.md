# Evidencia facturacion electronica fase X6 - integration event consumer

## Scope

- Stable sale billing integration event contract
- Transactional inbox for durable consumer idempotency
- Internal intake boundary for billing backend
- Sale snapshot to `IssueElectronicInvoiceCommand` mapping

## Current architecture

- API still owns the productive sale runtime
- Billing backend owns the electronic billing bounded context runtime
- Billing backend worker remains disabled by default
- No API transactional outbox implemented yet

## Event contract

- Event type: `SALE_COMPLETED_FOR_ELECTRONIC_BILLING`
- Schema version: `1`
- Envelope carries `eventId`, `tenantId`, `correlationId`, `occurredAt`, `source`, and `payload`
- Payload carries sale, customer, lines, taxes, payments, totals, currency, and metadata snapshots

## Consumer

- Consumer lives in `backend-facturacion-electronica`
- Consumer validates envelope and payload
- Consumer resolves tenant provider config before building the billing command
- Consumer creates the invoice aggregate inside one backend transaction
- Consumer does not call provider HTTP

## Transactional inbox

- New official migration: `scripts/database/migrations/V073__electronic_billing_inbox_events.sql`
- Inbox stores `eventId`, source identity, payload hash, processing status, and linked document id
- Unique guards protect duplicate delivery and same-sale repeated delivery

## Internal transport

- Internal intake endpoint: `POST /internal/electronic-billing/events/sale-completed`
- Auth pattern: `Authorization: Bearer <token>`
- Token source: `API_INTERNAL_TOKEN`

## Tests

- Contract and mapper tests added
- Inbox repository SQL tests added
- Consumer idempotency tests added
- Internal auth controller tests added

## Notes

- No real PostgreSQL execution done in this phase
- No real FactuCore HTTP executed in this phase
- No sale service changes done in this phase
