## Context

Cash operation currently uses:

- `cash_sessions` for open/closed register sessions.
- `cash_registers` for branch/terminal register metadata.
- `payments.cash_session_id` and `cash_movements.cash_session_id` for normal cash closing.
- `GET /api/finance/cash-sessions/current` to identify the current open cash session for a user.
- `x-pos-session-id` in frontend API calls when a POS context is required.
- `backend-reporteria` for cash closing PDF tickets.

Domicilios currently stores `delivery_fee`, `subtotal`, `total`, and `payment_method_id`, but has no cash-session context. No delivery fee is written to `payments` or `cash_movements`.

## Decisions

### Cash-impact rule

A delivery has cash impact when either:

- `delivery_fee > 0`
- `payment_method_id` is present

Cash-impacting creation requires a current open cash session. Logistic read-only actions remain available without cash.

### Model

Use additive columns on `deliveries`:

- `cash_session_id`
- `cash_register_id`
- `terminal_id`
- `cash_impact_amount`
- `cash_impact_recorded_at`

The API derives this context from the current open cash session for the authenticated user and POS context. The frontend does not type technical IDs.

No `payments` row is created for the delivery fee in this phase. No `cash_movements` row is created because the delivery fee is a separate operational concept and there is no existing safe `DELIVERY` payment reference type. Cash closing summarizes delivery fees directly from `deliveries`.

### State transitions

For cash-impacting deliveries:

- New deliveries store current cash context on create.
- State changes require the same current open cash session when the delivery already has a cash session.
- Legacy cash-impacting deliveries without cash context can be attached to the current open cash session when an operational status action is performed.

Assigning/changing a driver remains logistic and does not require cash.

### Cash closing

Cash closing includes a delivery summary from `deliveries` scoped to the cash session:

- Delivered fees count as collected delivery cash impact.
- Cancelled and not-delivered deliveries do not count as collected.
- Pending/dispatched deliveries are counted separately but not summed as collected.
- Only `delivery_fee` is summarized. `subtotal` and `total` are not added, preventing sale/order double counting.

The current-shift live summary uses the same rule so the current cash view and the final close view remain aligned.

### Ticket

The cash closing ticket adds a `DOMICILIOS` section using the existing backend-reporteria PDF flow. It shows delivered/pending/cancelled counts, delivered delivery fee total, and payment method breakdown when available.

## Risks

- Environments without the new migration must fail clearly for cash-impacting delivery operations.
- Legacy deliveries without cash context remain visible but labeled `Sin caja`; they are not counted in current cash closing until attached by an operational action.

## Non-Goals

- Payments against delivery.
- Cash-on-delivery liquidation.
- New PDF engine.
- Fiscal/electronic invoice changes.
- Inventory changes.
- Automatic cash open/close.
