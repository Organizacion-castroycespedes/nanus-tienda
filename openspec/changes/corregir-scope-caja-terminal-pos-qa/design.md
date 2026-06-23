# Design: correct POS cash-session scope for QA

## Root cause

Two scope rules were not lined up:

1. POS context selection asked for the current cash session without always anchoring it to the selected cash register.
2. Current-shift reporting preferred the current user session even when a valid open session existed in the same operational branch.

## Fix

- In POS context selection, resolve the current cash session using the selected cash register.
- In current-shift reporting, resolve open sessions using the same branch context the user already has, instead of requiring ownership when an open branch session exists.

## Safety

- No sessions are closed automatically.
- No SQL write is introduced.
- No permission model is weakened.
- Existing open sessions remain authoritative.

