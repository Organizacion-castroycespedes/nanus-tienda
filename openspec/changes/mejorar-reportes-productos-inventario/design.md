## Context

The main API signs `sub`, `tenant_id` and `roles`; it does not sign branch assignments. `backend-reporteria` verifies this JWT and exposes `sub` as `ReportUser.id`. The canonical `AccessControlService.getAccessibleBranchIds` in the main API uses active `tenant_branches` for `SUPER_USER` and `SUPER_ADMIN`. Other roles use `users.persona_id` through `persona_tenant_branches`, with tenant and active-user/branch checks. `AuthRepository.getUserContextRows` and user create/update also use that assignment path. `SUPER_ADMIN` may select a tenant; `SUPER_USER` is limited to its own tenant; `ADMIN` is limited to assigned branches.

## Goals / Non-Goals

**Goals:** Resolve a typed `tenantId` plus nonempty `branchIds` in `backend-reporteria` for future inventory reporting. A null filter means all authorized branches, not all tenant branches for ADMIN. Explicit filters narrow this set. Reject mismatches with `ForbiddenException`.

**Non-Goals:** Change JWT claims, retrofit legacy report SQL, add reporting copy tables, or infer an inventory valuation rule.

## Decisions

- Use a reporting-side DB adapter because `api` and `backend-reporteria` are separate Nest processes and have no shared package. Mirror the canonical joins and role priority in `AccessControlService`; query current assignments each request to avoid stale token-embedded branch lists.
- Require an active authenticated user for all roles. `SUPER_ADMIN` may select another tenant only explicitly; the returned branch IDs come from that tenant's active branches. `SUPER_USER` uses only its token tenant. `ADMIN` uses only active assignments in the token tenant. A missing persona produces no rows and is denied.
- Represent the result as `{ tenantId, branchIds: string[] }`. Future inventory SQL shall receive concrete `uuid[]` and filter every branch-scoped relation by those IDs. An empty array is a denial, never a wildcard. Browser-provided `branchId` can only narrow an existing set.
- Keep the resolver separate from existing report endpoints. Those endpoints currently accept single or null branch scope, so silently replacing their contracts with an array would be unsafe.
- `V087__report_product_inventory.sql` defines `fnc_report_product_inventory(tenant_id uuid, branch_ids uuid[], preset text, ...typed filters, limit integer, offset integer)` as SQL STABLE and read-only. It intersects active tenant branches with the concrete branch array. Products, codes, stock movements and lot balances are aggregated in separate CTEs. GENERAL and PHYSICAL_COUNT use one product+branch row; LOTS_EXPIRATIONS uses lot+location detail. Stock follows `inventory_dashboard_snapshot`: movement IN minus OUT. Lot quantities and reservations come from `inventory_lot_balances`.
- A GENERAL or PHYSICAL_COUNT row represents one product + branch. LOTS_EXPIRATIONS represents product + branch + lot + location. General stock is never repeated by lot/location joins. All formats use one function result. Catalog cost (`products.cost`) and lot acquisition unit cost (`inventory_lots.unit_cost`) remain distinct. No valuation total or weighted average is derived.
- Product codes come from active `product_barcodes`; the product schema has no separate QR persistence. The UI labels them barcodes. Expiration date and days to expiration are factual. `inventory_alert_rules` has thresholds, but no canonical expiring-soon evaluator was found, so that filter remains out of scope.
- `POST /api/reports/product-inventory` validates filter intent, resolves branch IDs, and supports bounded preview pages (`pageSize` default 100, maximum 500). Preview returns pagination metadata and one page. Export mode iterates 1,000-row batches until `totalRows` is consumed, with a 100,000-row operational hard limit; it rejects over-limit reports instead of truncating. Both modes call the same function and filter contract. The viewer uses the PDF bytes for preview and normal browser printing. XLSX uses ExcelJS with numeric/date cells, frozen header and filter.
- Export mode holds one dedicated `READ ONLY REPEATABLE READ` PostgreSQL client transaction for all function batches and branding reads, then commits after PDF/XLSX generation; failures roll back and release the client.
- Branding is queried separately from `tenants.config` (`logo`, `logoUrl`, `colors.primary`) and `tenants_detalles`, which are not operational inventory rows. PDF uses pdfmake A4 landscape with logo, company identity and pagination. No separate branding store is created.

## Risks / Trade-offs

- [Rule drift across services] → Tests assert tenant-safe SQL joins and document the matching canonical method. Recheck both implementations when assignment rules change.
- [Legacy report endpoints still use older null-branch semantics] → This prerequisite protects future inventory reporting only; their remediation remains separate.
- [Local workstation has no psql] -> QA certification used the authorized QA database through the existing pg dependency and recorded the V087 checksum; the repository SQL test runner and concurrent mutation test remain pending.
- [Snapshot payload and rendering memory] → Export batches are 1,000 rows and the explicit operational hard limit is 100,000 rows. Backend PDF engine and ExcelJS still buffer generated files; profile representative workloads before production release.

### Row grain and ordering

The function result grain is product + branch for `GENERAL` and `PHYSICAL_COUNT`, and product + branch + lot + location for `LOTS_EXPIRATIONS`. Products without lots remain in GENERAL/PHYSICAL_COUNT. Stable ordering uses branch name/id, product name/id, expiration, lot code/id, location code/id. `totalRows` counts the final filtered function rows after this grain and before LIMIT/OFFSET.
- [SVG or remote logo incompatibility] → Inline PNG/JPEG and SVG data URLs are handled. A remote `logoUrl` needs an approved server fetch policy before embedding in PDF.
- [Unverified SQL execution] → Do not deploy V087 until a safe test database runs migration, `scripts/database/tests/20260916_report_product_inventory_readonly_test.sql`, fixture assertions and EXPLAIN. Existing indexes cover tenant/category, stock tenant/branch/product, barcode tenant/product and lot balance tenant/branch/product; no speculative index is added.

## Migration Plan

Apply V087 through the repository's incremental `migrate_prd.sh` workflow before deploying `backend-reporteria` and `web`. No token rotation or business-table migration is needed. Roll back application deployment first; remove the function only through a separate reviewed rollback migration if required.
