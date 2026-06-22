## Context

The deliveries module already supports manual creation, creation from orders, creation/query from sales, state management, and delivery list/detail screens. The current gap is synchronization: a delivery created from an order can remain linked only to `order_id` after that order later generates a sale.

## Decisions

- Use `deliveries.sale_id` as the sale traceability column when it already exists.
- Add only an additive migration if the column is absent.
- Link the sale from the order-to-sale backend flow after the sale row exists and only when the sale has an `order_id`.
- Make the association idempotent:
  - If a delivery is already linked to the sale, do nothing.
  - If a delivery exists for the sale order with no `sale_id`, update that existing delivery.
  - If no delivery exists, do not create one from the sale flow.
- Keep duplicate prevention in delivery creation paths:
  - Creating from order fails when any delivery exists for that order.
  - Creating from sale fails when any delivery exists for that sale or its linked order.
- Keep sale association operational-only. It must not alter sale totals, payment rows, cash sessions, inventory movements, taxes, fiscal invoice state, or electronic invoicing.

## Implementation Notes

- Review `scripts/database/migrations` and the runtime database shape before adding SQL.
- Review `api/src/modules/deliveries` for existing `sale_id` filters and sale relation endpoints.
- Review the inventory/order sale service to find the point where a sale is persisted from an order.
- Prefer a small backend helper for linking an existing order delivery to a sale. The helper should accept tenant, order, sale and optional user context, and should be safe to call multiple times.
- Update frontend only when existing pages do not already expose sale reference/filter/navigation.
- Keep UI labels operational: show `Venta` rather than `sale_id`.

## Risks

- Linking before the sale transaction commits could leave stale delivery references if the sale is rolled back. The update should run in the same transaction or after a confirmed sale insert.
- Cross-tenant association must be blocked by filtering both delivery and sale/order context by tenant.
- Duplicate prevention must not block manual delivery creation when there is no order/sale association.

## Non-Goals

- No sale creation from deliveries.
- No invoicing from deliveries.
- No cash/recaudo integration.
- No payment changes.
- No fiscal/electronic invoicing changes.
- No inventory changes.
- No destructive SQL.
