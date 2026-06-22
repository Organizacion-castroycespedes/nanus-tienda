## Context

The deliveries module already supports manual creation, order creation, sale association, state transitions, driver assignment, and list/detail views. The creation form is not operational enough because it loads customers without backend search, loads all visible orders then filters locally, and uses the POS sales report for sales/facturas. Current subtotal and total fields are editable, so the user can create inconsistent values.

## Goals / Non-Goals

**Goals:**
- Make delivery creation work without typing internal IDs.
- Support manual, order, sale/factura, and order-with-sale creation.
- Search customers by text beyond the locally visible first options.
- Load relevant orders and sales/facturas by selected customer.
- Detect existing delivery for selected order or sale before creation.
- Calculate totals consistently with a tested frontend helper.
- Keep backend filters tenant-scoped and branch-scoped.

**Non-Goals:**
- No cash/recaudo.
- No contraentrega payment.
- No payment mutation.
- No sale creation or invoicing from deliveries.
- No fiscal/electronic invoice mutation.
- No inventory mutation.
- No order state mutation beyond existing operational links.
- No destructive SQL.
- No permission relaxation.

## Decisions

- Add query/limit support to `GET /api/customers`.
  Rationale: the current endpoint returns all tenant customers and the form only shows a local slice. Backend search is safer and scales better than relying on the first page or first array.
- Add optional `customerId` to `GET /api/orders`.
  Rationale: orders are already branch-scoped by service logic; filtering by customer in SQL avoids loading unrelated orders into the delivery form.
- Add optional `customerId` to `GET /api/sales`.
  Rationale: `sale_id` is the internal sale/factura reference used by deliveries, and the sales API already returns `orderId` when a sale came from an order.
- Keep the reporting service out of the delivery form.
  Rationale: reports are presentation datasets and do not expose every operational field needed for logistics, such as `customerId` and `orderId`.
- Use direct `POST /api/deliveries` for creation from the form.
  Rationale: it already accepts `order_id` and `sale_id`, infers sale `order_id`, validates scope, and prevents duplicates. This avoids special fee restrictions in relation-specific wrappers.
- Calculate totals in the browser from selected source plus delivery fee.
  Rationale: this is an operational delivery total and must not mutate order/sale/fiscal totals.
- Treat negative delivery fee as invalid.
  Rationale: negative logistics fees hide accounting semantics and should not be normalized silently.

## Risks / Trade-offs

- [Risk] Sales selector may require POS READ permission because sales are protected by the existing sales API. -> Mitigation: do not relax permissions; show a clear unavailable/permission state in the form.
- [Risk] Backend customer search could be broad. -> Mitigation: filter by tenant, enforce max limit, and only search expected customer identity fields.
- [Risk] Order statuses that are not delivery-ready could appear. -> Mitigation: frontend filters out `CANCELLED` and keeps the rule small; backend remains source of scope, not business workflow expansion.
- [Risk] Existing deliveries can be found after selection but before submit another user can still create one. -> Mitigation: backend duplicate guards remain authoritative.

## Migration Plan

- No database migration is required.
- Deploy backend query filter changes first or together with web changes.
- Rollback by reverting frontend service usage and backend optional filters; no data rollback required.
