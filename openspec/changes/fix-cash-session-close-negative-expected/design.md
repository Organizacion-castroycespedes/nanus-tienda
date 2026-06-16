## Context

`CashSessionsService.close()` reads `summary.totals.expectedAmount` and sends that value directly to `cash_sessions.expected_amount` and `cash_counts.expected_amount`. The database already defines both fields as non-negative. When the summary value is negative, PostgreSQL rejects the update with `cash_sessions_expected_amount_check`, Nest returns HTTP 500, and the user cannot close caja.

## Goals / Non-Goals

**Goals:**
- Close caja without HTTP 500 when the computed summary expected amount is negative.
- Persist a non-negative expected amount that satisfies existing DB constraints.
- Keep `differenceAmount` consistent with the persisted expected amount.
- Avoid inserting zero-value closing movements because `cash_movements.amount` requires `amount > 0`.
- Add focused backend coverage for negative expected summary values.

**Non-Goals:**
- No database migration.
- No change to finance authorization, route paths, or request DTOs.
- No change to frontend UI unless backend contract requires it.
- No recalculation of the summary SQL function in this fix.

## Decisions

1. Normalize expected amount in the service layer.

   `CashSessionsService.close()` will convert the summary expected amount to a monetary number and clamp values below zero to zero before persistence.

   Rationale: the DB contract says expected amounts in `cash_sessions` and `cash_counts` are non-negative. Service code should honor that before calling the repository.

   Alternative: loosen the DB check constraint. Rejected because expected physical cash should not be negative and this would require a migration with broader reporting impact.

2. Difference uses persisted expected amount.

   `differenceAmount` will be calculated as `closingAmount - normalizedExpectedAmount`.

   Rationale: API responses, `cash_counts`, and persisted session rows must agree. Using the raw negative value in one place and zero in another would create mismatched reports.

3. Keep summary SQL unchanged.

   The summary can still expose raw operational totals elsewhere. The close command only normalizes the value that must satisfy the non-negative persisted field.

4. Skip zero-value `CLOSING` cash movement.

   `cash_movements.amount` has `CHECK (amount > 0)`. A close with `closingAmount = 0` is valid for `cash_sessions` and `cash_counts`, but it cannot be represented as a `cash_movements` row. The service will create the `CLOSING` movement only when `closingAmount > 0`.

   Alternative: change the DB check to `amount >= 0`. Rejected because regular cash movements should remain strictly positive, and zero-value rows add noise to reports.

## Risks / Trade-offs

- [Risk] A negative expected amount may indicate inconsistent movement data.
  Mitigation: this fix prevents user-facing failure but does not hide totals in the summary endpoint; future reporting hardening can show raw negative diagnostics if needed.

- [Risk] Difference amount becomes larger when expected is clamped to zero.
  Mitigation: this matches persisted non-negative expected amount and avoids contradictory cash count data.

- [Risk] Existing tests for finance are sparse.
  Mitigation: add a focused unit test around `CashSessionsService.close()` with mocked repositories.

- [Risk] Zero closing amount will not appear in `cash_movements`.
  Mitigation: the authoritative close amount remains stored in `cash_sessions.closing_amount` and `cash_counts.counted_cash_amount`.
