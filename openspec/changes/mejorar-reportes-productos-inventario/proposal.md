## Why

`backend-reporteria` receives a user and tenant in its JWT but usually no branch claim. Existing reporting scope can treat a null ADMIN branch as tenant-wide, so the planned Products/Inventory report needs a proven branch authorization boundary first.

## What Changes

- Resolve authorized active branch IDs in `backend-reporteria` from the authenticated user, tenant, roles and current database assignments.
- Require a real JWT identity for report requests in QA and production; development/test mock auth must never apply there.
- Make a missing branch filter mean all and only authorized branches. Reject unauthorized or cross-tenant requests.
- Add a PostgreSQL reporting function as the sole operational data source, and produce one server snapshot containing preview data, PDF and XLSX.
- Add report filters and compact entry controls on Inventory > Products; reuse the existing PDF viewer and normal document print action.
- Preserve catalog cost and lot unit cost as separate facts. Leave valuation totals and expiring-soon policy pending domain decisions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reporteria-inventario`: Require an explicit, server-resolved branch set and one canonical Products/Inventory dataset for preview and exports.

## Impact

- `backend-reporteria/src/modules/auth`: reusable branch scope resolver and tests.
- `scripts/database/migrations/V087__report_product_inventory.sql`: tenant and authorized branch filtered read-only reporting function.
- `backend-reporteria`: product inventory report endpoint, PDF and XLSX generation.
- `web`: Products report controls, filter dialog and reused `PdfPreviewModal`.
- No authentication token, business table or existing report endpoint changes.
