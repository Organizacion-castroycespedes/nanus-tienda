## Context

The frontend already defines `MENU_KEYS.DELIVERIES`, protects `/{tenant}/deliveries`, renders a `Truck` icon for delivery labels/modules, and replaces `{tenant}` in menu routes. The backend `/me/menu` endpoint builds the sidebar from `role_menu_permissions` plus `menu_items`, then skips any catalog item where `visible` is false.

Local DB diagnosis showed:

- `public.menu_items.key = 'DELIVERIES'` exists for tenant `00000000-0000-0000-0000-000000000001`.
- `module = 'deliveries'`, `label = 'Domicilios'`, `route = '/{tenant}/deliveries'`.
- `visible = FALSE`.
- `role_menu_permissions` rows already exist for `SUPER_ADMIN`, `ADMIN`, `SUPER_USER`, and `USER`.
- `/api/me/permissions` includes `DELIVERIES`, but `/api/me/menu` does not include it.

## Goals / Non-Goals

**Goals:**
- Make the existing `DELIVERIES` menu item visible to roles that already have `role_menu_permissions`.
- Keep tenant route replacement as `/{tenant}/deliveries`.
- Keep existing modules visible exactly as before.
- Avoid any role permission grants or revokes in this fix.

**Non-Goals:**
- No changes to deliveries business logic.
- No changes to POS, orders, cash, finance or invoicing.
- No destructive SQL.
- No global permission matrix expansion.

## Decisions

1. Use a database migration instead of a frontend workaround.

   Rationale: the backend intentionally filters invisible menu catalog rows. If the frontend hardcoded `DELIVERIES`, it would bypass the API contract and could show the module to users without a returned menu item.

   Alternative considered: add a frontend fallback for `deliveries`. Rejected because it would weaken role/menu consistency.

2. Update only existing `DELIVERIES` menu rows.

   Rationale: current evidence shows the item exists but is invisible. The migration changes only `visible` and `updated_at`; it does not insert menu items or mutate `role_menu_permissions`.

   Alternative considered: re-run the local QA permission seed with `visible = TRUE`. Rejected because the existing seed also writes role permissions and intentionally marked the item backend-only.

3. Do not clear caches in code.

   Rationale: the API catalog/menu cache and frontend session menu cache expire naturally. Deployment can restart API or wait for TTL; users can log in again or refresh after cache expiration.

## Risks / Trade-offs

- Existing API menu cache may keep the old invisible catalog briefly -> Restart API or wait for `CATALOG_CACHE_TTL_SECONDS`/`MENU_CACHE_TTL_SECONDS`.
- Existing frontend session menu cache may omit `DELIVERIES` briefly -> User logs in again or waits up to 10 minutes.
- Environments without a `DELIVERIES` menu row remain unchanged -> This fix targets the observed configured item.

## Migration Plan

1. Backup target DB or confirm normal deployment backup exists.
2. Apply `scripts/database/migrations/V064__deliveries_menu_visible.sql` through the normal migration runner.
3. Restart API or wait for menu/catalog cache TTL.
4. Validate `/api/me/menu` for an authorized role includes `DELIVERIES`.
5. Validate sidebar shows `Domicilios` and route resolves to `/{tenant}/deliveries`.

Rollback:

```sql
UPDATE public.menu_items
SET visible = FALSE, updated_at = NOW()
WHERE key = 'DELIVERIES'
  AND module = 'deliveries'
  AND deleted_at IS NULL;
```

Only use rollback if product decides the menu must remain hidden.

## Open Questions

- Should `USER` keep current full write-level `DELIVERIES` permission matrix, or should a separate permission-hardening change narrow it later?
