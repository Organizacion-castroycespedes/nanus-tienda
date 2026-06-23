## Why

Manual QA found that `/{tenant}/deliveries/new` depends on limited or unrelated catalogs: customers are filtered locally from one initial load, orders are loaded broadly and filtered in the browser, and sales/facturas use the reporting service instead of the operational sales API. This makes delivery creation unreliable and forces users toward hidden technical IDs or unclear totals.

## What Changes

- Define the delivery creation flow for manual, order-based, sale-based, and order-with-sale cases.
- Add searched customer loading so the selector can find customers beyond the first visible options.
- Add tenant-scoped, branch-scoped backend filters for orders and sales by customer where missing.
- Use operational order/sale APIs from the delivery creation form instead of report-only data.
- Detect existing deliveries for selected `order_id` or `sale_id` and direct the user to manage the existing delivery instead of creating a duplicate.
- Add a tested totals helper for `subtotal`, `delivery_fee`, and `total`.
- Make subtotal and total calculated/read-only in the form.
- Keep delivery creation logistics-only: no cash/recaudo, no payments, no POS mutation, no fiscal/electronic invoicing mutation, no inventory mutation, and no sale creation from deliveries.

## Capabilities

### New Capabilities
- `deliveries-create-flow`: Functional delivery creation flows, selector behavior, duplicate prevention, and totals calculation.

### Modified Capabilities

## Impact

- Frontend deliveries module:
  - `CreateDeliveryForm.tsx`
  - `delivery-quick-create.ts`
  - new totals helper and tests
  - customer/order/sale service integrations
- Backend inventory APIs:
  - customer list query/limit support
  - order list `customerId` support
  - sale list `customerId` support
- Delivery API duplicate lookups already exist for `order_id` and `sale_id`; frontend will use them before submit.
- Documentation:
  - QA evidence for the creation flow.
- No database migration, no destructive SQL, no caja/recaudo, no payment, no POS mutation, no fiscal/electronic invoicing, and no inventory behavior changes.
