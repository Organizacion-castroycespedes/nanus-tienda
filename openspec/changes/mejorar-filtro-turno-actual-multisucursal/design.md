## Context

`/{tenant}/finance/current-shift` calls `GET /api/reports/current-shift` from `backend-reporteria`. The endpoint already resolves a single open session and supports `tenantId`, `branchId`, `cashSessionId`, `page`, `pageSize` and `search`.

Current behavior is safe for `USER`, but weak for `SUPER_USER`: when several sessions are open in the same tenant, the backend returns one default session and the frontend has no selector. The operator cannot identify or switch to another branch, terminal or cash register.

Main API already has cash-session history, but the current-shift screen gets its report data from `backend-reporteria`. Keeping the enhancement in the report endpoint avoids duplicating scope logic in the frontend.

## Goals / Non-Goals

**Goals:**
- Keep `GET /api/reports/current-shift` as the main report endpoint.
- Add `availableCashSessions` to the response while preserving existing fields.
- Add explicit query filters for `terminalId` and `cashRegisterId`.
- Allow `cashSessionId` selection only when the session belongs to the resolved tenant, is open, and is in actor scope.
- Keep `USER` restricted to own open sessions.
- Let `SUPER_USER` see open sessions for the tenant.
- Show a compact selector and visible operational context in the web page.
- Document QA evidence and validation results.

**Non-Goals:**
- No database migration.
- No permission matrix change.
- No new production deployment step.
- No rewrite of current shift tabs, totals, or PDF ticket actions.
- No new standalone endpoint unless implementation proves the response extension unsafe.

## Decisions

1. **Extend `/reports/current-shift` response**
   - Decision: add `availableCashSessions` and keep `cashSession`, `summary`, `filters`, and `tabs`.
   - Rationale: current clients remain compatible, and the page gets selection options with the same secured request.
   - Alternative considered: a separate `/reports/current-shift/open-sessions` endpoint. Rejected for now because it adds API surface and duplicates auth/scope.

2. **Reuse session metadata shape**
   - Decision: `availableCashSessions[]` uses the same `CurrentShiftCashSession` shape as `cashSession`.
   - Rationale: branch, terminal, register, user, opened time and status are already present.

3. **Filter before selection**
   - Decision: list selectable sessions with `tenantId`, optional `branchId`, `terminalId`, `cashRegisterId`, and actor scope. Then choose explicit `cashSessionId` if provided, else choose the first filtered session as compatible default.
   - Rationale: this keeps old behavior when one session exists, but exposes all options when many exist.

4. **Role rules stay conservative**
   - Decision: `USER` sees only own open sessions; `ADMIN` keeps current limited behavior; `SUPER_USER` and `SUPER_ADMIN` can see tenant-scoped open sessions.
   - Rationale: do not widen `USER` or `ADMIN` accidentally.

5. **Frontend state uses selected session id**
   - Decision: page stores selected `cashSessionId`; changing it refetches the report with that id and resets no unrelated tabs.
   - Rationale: report data remains backend-authoritative and all tabs refresh together.

## Risks / Trade-offs

- Multiple open sessions still need a default response for compatibility -> Mitigation: return `availableCashSessions` and show a selector immediately.
- `ADMIN` scope in report backend is simpler than main API branch assignment -> Mitigation: preserve current restriction and do not broaden.
- Large tenant could have many open sessions -> Mitigation: restrict to open sessions and support `branchId`, `terminalId`, `cashRegisterId`, and `search`.
- Frontend has no React test harness -> Mitigation: add focused helper tests where possible and rely on lint/build/manual QA notes.

## Migration Plan

- No SQL.
- Deploy backend-reporteria and web together when approved.
- Rollback is code-only: revert response extension and UI selector.

## Open Questions

- None blocking. Any later need for server-side pagination of `availableCashSessions` can be handled as a follow-up if tenants have very high concurrent session counts.
