## 1. Diagnosis

- [x] 1.1 Confirm Git status and active branch.
- [x] 1.2 Trace frontend sidebar rendering and tenant route replacement.
- [x] 1.3 Trace backend `/me/menu` and `/me/permissions` behavior.
- [x] 1.4 Confirm database state for `DELIVERIES` menu item and role permissions with read-only SELECTs.

## 2. Implementation

- [x] 2.1 Add an idempotent migration that makes existing `DELIVERIES` menu items visible without changing role permissions.

## 3. Validation

- [x] 3.1 Validate the OpenSpec change in strict mode.
- [x] 3.2 Validate all OpenSpec changes/specs in strict mode.
- [x] 3.3 Run `git diff --check`.
- [x] 3.4 Document endpoint evidence, SQL execution status and affected areas.
