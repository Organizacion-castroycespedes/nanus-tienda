## 1. Backend contract and authorization

- [x] 1.1 Add DTOs for terminal session listing filters and individual administrative close reason.
- [x] 1.2 Add authenticated `GET` and `POST` routes under `pos-user-sessions` with `SUPER_ADMIN`, `CONFIG_TERMINALS READ`, and `CONFIG_TERMINALS WRITE` guards.
- [x] 1.3 Preserve actor tenant and branch scope; resolve terminal by internal ID and reject mismatched tenant, branch, or inactive terminal.

## 2. Safe repository and service behavior

- [x] 2.1 Add tenant-safe repository queries for active sessions, user display data, terminal context, cash indicators, and pending-operation indicators.
- [x] 2.2 Implement individual close inside a PostgreSQL transaction with row locking and a second active-state check.
- [x] 2.3 Block close for open own/shared cash sessions, pending operations, invalid state, or concurrent changes without changing business records.
- [x] 2.4 Update only `pos_user_sessions.is_active` and `ended_at` on success and emit the existing administrative audit event with sanitized operational context.
- [x] 2.5 Keep normal logout, `auth_sessions`, other user sessions, Devices, bindings, sales, payments, and cash sessions unchanged.

## 3. Backend tests

- [ ] 3.1 Test tenant isolation, branch and terminal validation, SUPER_ADMIN permission, and rejection of insufficient roles.
- [x] 3.2 Test safe individual closure and open-cash conflict without changing other records.
- [ ] 3.3 Test open cash, shared cash, pending sales/payments, and concurrent session changes.
- [ ] 3.4 Test audit payload and post-close rejection through the existing POS-session guard behavior.

## 4. Terminal administration UI

- [x] 4.1 Add authenticated client methods and types for listing active sessions and closing one session.
- [x] 4.2 Add an `Administrar sesiones POS` panel to the selected terminal using existing Design System components.
- [x] 4.3 Show user, start time, terminal, branch, cash indicator, close availability, loading, empty, permission, and conflict states.
- [x] 4.4 Add reason input and `ConfirmDialog` confirmation with real terminal and user context; do not use native dialogs.
- [x] 4.5 Prevent duplicate requests and stale actions when closing, cancelling, or pressing Escape.
- [x] 4.6 Refresh the selected terminal after success and preserve other terminal/device panels unchanged.

## 5. Validation and QA

- [x] 5.1 Run focused API tests for closure and safety conflict behavior.
- [ ] 5.2 Run focused Web tests for confirmation, cancellation, loading, error messages, refresh, and terminal isolation.
- [x] 5.3 Run API typecheck and Web lint; separate pre-existing Web type errors from regressions.
- [x] 5.4 Run `git diff --check` and strict OpenSpec validation.
- [ ] 5.5 Perform only owner-authorized QA read-first in tenant QA; do not close TERM-001 automatically and do not change TERM-003, Devices, bindings, or sales during implementation validation.
