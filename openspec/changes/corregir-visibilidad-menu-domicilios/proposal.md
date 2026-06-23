## Why

`DELIVERIES` exists in `public.menu_items` and has role permissions, but it is stored with `visible = FALSE`. The backend menu builder filters invisible catalog items, so authorized users never receive `Domicilios` in `/me/menu`.

## What Changes

- Add a narrow, idempotent SQL migration to make the existing `DELIVERIES` menu item visible.
- Preserve the current route `/{tenant}/deliveries`, module `deliveries`, label `Domicilios`, icon `Truck`, tenant scope and existing role permissions.
- Do not change deliveries runtime logic, POS, orders, cash, finance, invoicing or destructive data operations.

## Capabilities

### New Capabilities
- `deliveries-menu-visibility`: Authorized roles can see the Domicilios sidebar item when `DELIVERIES` is configured and permitted.

### Modified Capabilities
- None.

## Impact

- Database migration only: `scripts/database/migrations/V064__deliveries_menu_visible.sql`.
- Menu API behavior changes only because `DELIVERIES.visible` becomes `TRUE`; `/me/menu` already respects `role_menu_permissions`.
- No frontend code changes are expected because the sidebar already supports `deliveries`, `Truck`, and tenant route replacement.
