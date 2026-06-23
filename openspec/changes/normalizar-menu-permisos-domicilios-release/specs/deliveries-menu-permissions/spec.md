## ADDED Requirements

### Requirement: Base Deliveries menu item is visible and configured for all tenants
The system SHALL ensure `menu_items` contains `key = 'DELIVERIES'` for each tenant with:
- `module = 'deliveries'`
- `label = 'Domicilios'`
- `route = '/{tenant}/deliveries'`
- `icon = 'Truck'`
- `sort_order = 240`
- `visible = TRUE`

#### Scenario: Migrate base menu item settings
- **WHEN** `V070__deliveries_menu_permissions_seed.sql` is executed
- **THEN** `menu_items` for `DELIVERIES` SHALL be upserted for each tenant.
- **AND** visible SHALL be `TRUE` even if previously `FALSE`.
- **AND** no other modules SHALL be updated by this migration.

### Requirement: Base Deliveries permissions are seeded for operational roles
The system SHALL upsert permissions in `role_menu_permissions` for `DELIVERIES` for:
- `USER`: `DELIVERIES_VIEW`, `DELIVERIES_CREATE`, `DELIVERIES_UPDATE`, `DELIVERIES_DISPATCH`, `DELIVERIES_MARK_DELIVERED`, `DELIVERIES_MARK_NOT_DELIVERED`
- `ADMIN`, `SUPER_USER`, `SUPER_ADMIN`: `DELIVERIES_VIEW`, `DELIVERIES_CREATE`, `DELIVERIES_UPDATE`, `DELIVERIES_ASSIGN`, `DELIVERIES_DISPATCH`, `DELIVERIES_MARK_DELIVERED`, `DELIVERIES_MARK_NOT_DELIVERED`, `DELIVERIES_CANCEL`, `DELIVERIES_REPORTS`

#### Scenario: Apply/refresh role permissions
- **WHEN** the migration is executed
- **THEN** each listed role SHALL receive `role_menu_permissions` for `DELIVERIES`.
- **AND** `access_level` and `actions` SHALL be updated for existing rows.
- **AND** rows for these roles and other menu items SHALL remain untouched.

### Requirement: SQL remains idempotent and non-destructive
The migration SHALL be safe to run multiple times and SHALL not delete existing role rows or other module rows.

#### Scenario: Re-run idempotent migration
- **WHEN** `V070__deliveries_menu_permissions_seed.sql` runs more than once
- **THEN** row counts for `DELIVERIES` roles and tenants SHALL converge deterministically.
- **AND** no `DELETE` operations SHALL run against `menu_items`, `role_menu_permissions`, or `roles`.
