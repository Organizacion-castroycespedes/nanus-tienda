# Proposal

## What

Filter operational order and purchase lists by the current open cash session by default.

Operational users must see current cash activity, not historical tenant data, when they enter:

- `/{tenant}/orders`
- `/{tenant}/inventory/purchases`

## Why

QA showed that the order and purchase lists currently return historical records from multiple dates, terminals, and sessions. This lets a cashier treat old records as current-operation records.

## Scope

- Add additive `cash_session_id` columns to `orders` and `purchases` if missing.
- Store the current open cash session on newly created orders and purchases.
- Add `cashScope=current|all` support to `GET /api/orders` and `GET /api/purchases`.
- Default the frontend operational views to current cash scope.
- Allow explicit historical scope only for authorized admin roles.

## Out Of Scope

- No destructive SQL.
- No totals changes.
- No payment changes.
- No fiscal or electronic invoicing changes.
- No inventory calculation changes.
- No cash closing, audit, or ticket behavior changes.
- No commit.
