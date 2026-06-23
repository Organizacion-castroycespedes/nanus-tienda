## Why

Domicilios can now be created, assigned to drivers, linked to orders/sales, and printed. The missing control is cash scope: cash-impacting delivery work must belong to the user's current open cash session so closing totals and closing tickets do not mix deliveries from another register, branch, terminal, or shift.

## What Changes

- Add delivery cash-session context for cash-impacting deliveries.
- Require the current open cash session when a delivery has `delivery_fee > 0` or `payment_method_id`.
- Keep read-only/logistic access available without opening or closing cash automatically.
- Filter or label delivery list rows by current cash scope.
- Include delivered delivery fees in cash closing summaries and closing ticket sections without duplicating sale/order totals.
- Keep fiscal/electronic invoice, inventory, existing payments, and sale totals unchanged.

## Capabilities

### New Capabilities
- `deliveries-current-cash-session`: Current-cash-session scoping for deliveries and delivery fee summary in cash closing.

### Modified Capabilities
- Delivery creation records cash session context when the delivery has cash impact.
- Delivery list/detail expose cash scope badges.
- Cash session summary and closing ticket expose delivery fee summary.

## Impact

- Additive SQL migration for delivery cash context columns.
- API delivery service/controller/query DTO changes.
- API cash session summary enrichment.
- Backend-reporteria cash closing ticket enrichment.
- Frontend delivery list/create/detail UX updates.
- QA evidence document.
- No destructive SQL.
- No fiscal/electronic invoicing, inventory, existing payment mutation, or automatic cash open/close changes.
