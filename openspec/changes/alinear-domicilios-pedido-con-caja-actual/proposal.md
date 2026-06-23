# Proposal

## What

Align deliveries created from orders with the current open cash session context.

When a user creates a delivery from an order through `POST /api/orders/:id/delivery`, the delivery must store the current cash session fields so it appears in `GET /api/deliveries?cash_scope=current`, even when `delivery_fee = 0`.

## Why

QA found that an order created in the current cash session produced a delivery with:

- `cash_session_id = null`
- `cash_register_id = null`
- `terminal_id = null`

The delivery was valid, but it did not appear in current cash operational delivery management. That blocked driver assignment, state management, and ticket generation from the current delivery list.

## Scope

- Require an open cash session for creating a delivery from an order.
- Attach current cash session context to order-created deliveries.
- Preserve zero cash impact when `delivery_fee = 0`.
- Reject silent cross-session reassignment.
- Safely complete cash context on an existing initial delivery with missing cash session.
- Send POS session context from frontend relation lookup.

## Out Of Scope

- No sale duplication.
- No payment changes.
- No fiscal or electronic invoicing changes.
- No inventory changes.
- No cash session open or close automation.
- No destructive SQL.
- No commit.
