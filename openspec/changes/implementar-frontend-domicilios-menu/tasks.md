## 1. Discovery and OpenSpec

- [x] 1.1 Confirm branch, clean worktree and HEAD baseline.
- [x] 1.2 Review frontend routing, services, auth, tenant, menu, permissions, list/filter/action/error patterns.
- [x] 1.3 Create OpenSpec proposal, design, tasks and deliveries frontend spec.
- [x] 1.4 Validate the new OpenSpec change strictly.

## 2. Frontend domain

- [x] 2.1 Create deliveries types and service using the existing API client.
- [x] 2.2 Add delivery status/action helpers and focused tests.
- [x] 2.3 Add `DELIVERIES` menu key and route permission mapping.

## 3. Frontend UI

- [x] 3.1 Create tenant route `web/app/[tenant]/deliveries/page.tsx`.
- [x] 3.2 Build `DeliveriesScreen` with header, filters, list, pagination, loading, errors and empty states.
- [x] 3.3 Build detail panel with operational fields and pending-history note.
- [x] 3.4 Build basic create delivery form.
- [x] 3.5 Build state actions for assign, dispatch, delivered, not delivered and cancel.
- [x] 3.6 Keep mobile responsive behavior without global overflow.

## 4. QA and validation

- [x] 4.1 Create frontend QA evidence document.
- [x] 4.2 Run OpenSpec validations.
- [x] 4.3 Run frontend tests, lint, build and `git diff --check`.
- [x] 4.4 Run local manual QA when services/data are available and document limits.
