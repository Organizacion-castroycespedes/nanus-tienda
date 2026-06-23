# Proposal

## What

Align the delivery creation flow opened from `/{tenant}/orders` with the main delivery creation flow.

The order delivery modal will capture operational delivery fields, calculate totals, support active driver assignment, and remain usable on small screens with internal scrolling.

## Why

QA found two issues:

- The order delivery modal can overflow the viewport, leaving bottom actions hard to reach.
- The order delivery form was a small custom form and did not include the same operational fields as `/{tenant}/deliveries/new`, especially driver and payment method.

## Scope

- Improve order delivery modal responsive behavior.
- Extend the order delivery creation form with driver, payment method, fee, subtotal, total, notes, contact, phone, address, and reference.
- Reuse delivery helpers for payload mapping, validation, and totals.
- Load customer, payment method, active driver, and current cash context safely.
- Infer `sale_id` in backend when the order already generated a sale.
- Preserve duplicate prevention and current cash-session alignment.

## Out Of Scope

- No POS changes.
- No fiscal or electronic invoicing changes.
- No payment mutation changes.
- No inventory changes.
- No destructive SQL.
- No permission relaxation.
- No commit.
