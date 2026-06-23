## Context

The deliveries module already supports manual creation, order-based creation, sale association, state management, list/detail screens, and quick relation cards. The current assignment field is `assigned_courier_id`, which references `users`; the new requirement introduces a separate operational driver catalog so deliveries can be assigned to non-system-user drivers.

## Goals / Non-Goals

**Goals:**
- Create an additive tenant-scoped `delivery_drivers` table.
- Add optional `deliveries.driver_id` as the new catalog-backed assignment reference.
- Provide CRUD-style backend APIs for driver administration with logical deactivate.
- Allow assigning an active same-tenant driver, or clearing the assignment, without changing delivery status.
- Show driver name/reference in delivery list and detail and support `driver_id` filtering.
- Add a focused frontend driver administration screen and small assignment UI.

**Non-Goals:**
- No cash collection or driver settlement.
- No payment capture, payment mutation, or cash session mutation.
- No route optimization, maps, tracking, or geolocation.
- No POS flow changes.
- No fiscal invoice or electronic invoicing changes.
- No destructive SQL and no data backfill that changes operational history.

## Decisions

- Use `delivery_drivers` instead of reusing `users` for new assignments.
  Rationale: drivers may be operational contacts without login access. The existing `assigned_courier_id` remains untouched for compatibility.
- Add `deliveries.driver_id` instead of replacing `assigned_courier_id`.
  Rationale: additive migration avoids breaking existing data and old assignment endpoints.
- Use logical deactivate (`active = false`) rather than physical delete.
  Rationale: deliveries need historical driver references after a driver leaves.
- Enforce tenant isolation in all driver reads/writes and delivery assignment queries.
  Rationale: driver catalogs are tenant-specific operational data.
- Validate `active = true` only for new assignment.
  Rationale: inactive drivers can remain referenced historically but cannot be newly assigned.
- Assignment only updates `driver_id`, `updated_at`, and `updated_by_user_id`.
  Rationale: assigning a person is logistics-only and must not advance delivery state.
- Keep menu changes minimal.
  Rationale: the delivery page can expose the driver route. A separate menu item is optional and should only be added if local menu patterns make it low risk.

## Risks / Trade-offs

- [Risk] Two assignment fields can confuse UI/API consumers. -> Mitigation: show the new `driver`/`driver_id` first and keep `assigned_courier_id` as legacy courier reference.
- [Risk] Cross-tenant assignment could leak data. -> Mitigation: every lookup filters by `tenant_id`, and tests cover cross-tenant rejection.
- [Risk] Inactive historical drivers disappear from delivery detail. -> Mitigation: joins should not filter active drivers when reading existing deliveries.
- [Risk] Menu permissions may become too broad. -> Mitigation: reuse delivery permissions unless a separate menu item is added with documented role grants.
- [Risk] Assignment could accidentally change state. -> Mitigation: assignment endpoint updates only driver fields and tests assert status is unchanged.

## Migration Plan

- Add a versioned, additive SQL migration:
  - `CREATE TABLE IF NOT EXISTS public.delivery_drivers`.
  - Add `deliveries.driver_id` if missing.
  - Add foreign key and indexes if missing.
- Rollback is manual and non-destructive by ignoring the new route/field; no destructive rollback is required for this change.
