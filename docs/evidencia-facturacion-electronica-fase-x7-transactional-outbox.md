# Evidencia Fase X7 - Transactional Outbox en API

## Scope

- API producer side only.
- No SaleService switch yet.
- No Billing Backend worker cutover yet.
- No real FactuCore HTTP.

## What was added

- `api/src/modules/integration-outbox/`
- `IntegrationOutboxModule`
- reusable outbox repository
- billing internal HTTP client
- lease-based dispatcher
- deterministic sale billing event builder
- contract compatibility tests against X6 shape
- official migration `scripts/database/migrations/V074__integration_outbox_events.sql`

## Outbox table

- `integration_outbox_events`
- `event_id` unique
- `payload` stored as `jsonb`
- retry fields:
  - `attempt_count`
  - `next_attempt_at`
  - `last_error`
- lease fields:
  - `lease_until`
  - `last_attempt_at`
- publishing fields:
  - `status`
  - `published_at`

## Delivery model

- at-least-once
- row claiming uses `FOR UPDATE SKIP LOCKED`
- claim lease prevents dual API instances from dispatching the same row at once
- no infinite retry

## Internal billing client

- endpoint: `POST /internal/electronic-billing/events/sale-completed`
- auth: `Authorization: Bearer <API_INTERNAL_TOKEN>`
- backend response classification:
  - `ACCEPTED`
  - `ALREADY_PROCESSED`
  - `INVALID_EVENT`
  - `TEMPORARY_FAILURE`

## Tests

- outbox contract compatibility
- repository enqueue / duplicate / claim SQL
- internal HTTP client classification
- dispatcher disabled by default
- dispatcher success and idempotent success

## Runtime

- dispatcher default: disabled
- API sale flow unchanged
- Billing Backend worker unchanged

