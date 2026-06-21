# Proposal: correct POS cash-session scope for QA

## Problem

Packaged Electron POS reaches the route, but cash-session resolution is inconsistent.

Observed state:

- POS context selector sees a cash register as free.
- POS opening then fails with `La caja ya tiene una sesion abierta`.
- Current shift and cash sessions views report no open session for the current operational scope.

## Goal

Align POS and reporteria cash-session scope enough to unblock QA.

## Scope

- Keep tenant, branch, terminal, cash register, and user scope consistent.
- Reuse an existing open session in the current branch/register context when it exists.
- Make current-shift report the same operational state that POS uses.
- Add regression tests.

## Out of scope

- No scanner HID changes.
- No Electron changes.
- No offline.
- No USB/serial.
- No SDKs.
- No destructive session changes.
- No business rule changes for sale/payment/tax/discount/invoicing.

