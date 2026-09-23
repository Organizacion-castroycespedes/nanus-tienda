## Why

The current `/{tenant}/inventory` route is the principal inventory dashboard, but the next Inventory BI experience needs an explicit economic read model, strict scope semantics, real server-side pagination, and a valuation workflow that preserves every existing inventory capability. This change formally records Section 0 before any visual, API, SQL, migration, staging, commit, or push work begins.

## What Changes

- Define the Inventory BI and current inventory valuation architecture.
- Preserve `/{tenant}/inventory` as the principal route; replace its experience later instead of creating a parallel dashboard.
- Preserve the route guard, permissions, all current dashboard capabilities, and all existing Inventory child routes.
- Define the conceptual Inventory BI base read model and its summary, page, count, and export-batch responsibilities.
- Define backend-enforced role scope, stock/cost source-of-truth rules, valuation formula, consistency invariants, pagination, and document export contracts.
- Recommend `/{tenant}/inventory/valuation` as the future specialized valuation route, subject to a later menu and route-permission decision.
- Define the incremental delivery sections from architecture through global QA.
- Explicitly exclude production code, physical SQL functions, migrations, visual implementation, staging, commit, and push from Section 0.

## Capabilities

### New Capabilities

- `inventory-bi-architecture`: Formal Section 0 contracts for Inventory BI, current valuation, scope, read models, pagination, exports, consistency, and incremental delivery.

### Modified Capabilities

No existing requirement is modified in Section 0. Existing `inventario` and `reporteria-inventario` requirements remain in force; the new architecture capability adds the future BI and valuation contracts without removing them.

## Impact

- OpenSpec artifacts only under `openspec/changes/redisenar-dashboard-inventario-bi-valorizacion/`.
- Future impact areas: `web/{app,modules}/inventory`, `api/src/modules/inventory`, `backend-reporteria`, and SQL migration conventions.
- No production source, database migration, endpoint, stored function, menu, permission, staging environment, commit, or push is changed by Section 0.
