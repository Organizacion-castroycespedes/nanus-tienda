## 1. Backend Fix

- [x] 1.1 Add a small normalizer for cash-session expected amount in `CashSessionsService`.
- [x] 1.2 Use normalized expected amount for `cash_sessions.expected_amount`.
- [x] 1.3 Use normalized expected amount for `cash_counts.expected_amount`.
- [x] 1.4 Calculate `differenceAmount` from `closingAmount - normalizedExpectedAmount`.
- [x] 1.5 Skip `CLOSING` cash movement insert when `closingAmount` is zero.
- [x] 1.6 Keep `CLOSING` cash movement insert when `closingAmount` is positive.

## 2. Tests

- [x] 2.1 Add focused service test for negative summary expected amount.
- [x] 2.2 Add focused service test for non-negative summary expected amount.
- [x] 2.3 Confirm close flow still writes closing movement and commits transaction.
- [x] 2.4 Add focused service test for zero closing amount without cash movement insert.

## 3. Evidence

- [x] 3.1 Run targeted backend finance test.
- [x] 3.2 Run `api` test/build validation as feasible.
- [x] 3.3 Run OpenSpec validate and `git diff --check`.
- [x] 3.4 Update evidence notes for the fix.
