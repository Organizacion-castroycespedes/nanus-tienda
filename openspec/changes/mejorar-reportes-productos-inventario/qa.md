# Products and Inventory report QA

Status: **PASS — TECHNICAL CERTIFICATION AND MANUAL QA COMPLETE**. V087, database checks, authorization, pagination, exports, browser flow, PDF, Excel and normal document printing are certified in the authorized QA environment.

## Database gate

1. Confirm the V087 migration ledger entry and deployed function signature, `STABLE` volatility and absence of `SECURITY DEFINER` in the authorized QA database.
2. Run `scripts/database/tests/20260916_report_product_inventory_readonly_test.sql` and fixture tests for two tenants, ADMIN assignments A/C, a foreign branch B, a product without movements, a zero-stock product, a product without lots, multiple barcodes, multiple lots and multiple locations.
3. Compare each product/branch general stock to `SUM(IN)-SUM(OUT)` from `stock_movements`. Compare each lot/location on-hand, reserved and available quantity to `inventory_lot_balances`. Confirm no stock inflation or valuation total from multiple rows.
4. Run `EXPLAIN (ANALYZE, BUFFERS)` on representative function calls with two branch IDs, code filter, lot code filter and expiration range. Record row counts, time, buffers and any sequential scans before considering indexes.

## Browser and document flow

1. Sign in as ADMIN assigned A and C. Open Inventory > Products and the PDF / Reporte or Excel control. Confirm both open filter configuration before any download.
2. Generate without a branch filter. Check only A/C data appears. Select C and check only C. Send B directly to the endpoint and expect 403 before the report function executes.
3. Search a known product name, SKU and active barcode, then check category, subcategory, unit, sale type, measurement unit, operational status, stock state and stock range filters against known records.
4. Check products with and without lots, lot code, location, expiration from/to and expired-only against known lot rows. Confirm days-to-expiration and separate general stock versus lot on-hand/reserved/available.
5. Check catalog cost versus lot unit cost for an authorized role. Confirm no invented inventory valuation total or QR label.
6. Check General Inventory, Physical Count and Lots/Expirations presets. Physical Count must show one system quantity per product/branch and blank manual fields; editing Excel must not change inventory.
7. Confirm tenant name, legal name, NIT, configured inline logo and accent on a multipage PDF, including grayscale readability and page numbers.
8. Download PDF and XLSX from the same preview. Confirm the displayed values match, Excel numeric/date types remain typed, headers are frozen, filters work, and empty results produce an empty report.
9. Print the preview through a normal document printer or print-to-PDF dialog. Confirm page orientation and content. This is pending physical/manual QA.
10. Repeat with SUPER_USER and SUPER_ADMIN across permitted tenants and branches. Confirm foreign-tenant product, lot, cost and code data never appears.

Do not mutate the authorized QA database for manual checks. Use read-only records and the already certified migration.

## Certification run 2026-09-17

- QA identity confirmed from local `scripts/config/db.env`: database `manus_tienda_qa`, application role `manus_user`, sanitized QA host. Production was not contacted.
- The normal `migrate_prd.sh` command could not run because this workstation has no `psql` executable. The official V087 SQL was applied unchanged through the existing `pg` client dependency inside one transaction, then recorded in `public.migrations_history` with its SHA-256 checksum. No V087 row existed before application.
- Deployed metadata matches V087: SQL language, `STABLE` volatility, `SECURITY DEFINER = false`, preset argument, `LIMIT/OFFSET`, `COUNT(*) OVER()` and `total_rows bigint`.
- Existing QA data was read only after migration. It contains one active tenant and one active branch, so cross-tenant and ADMIN multi-branch [A,C] cases remain pending. No fixture mutation was performed.
- Existing representative product `QA-BASE-LOT-001` has two active codes and ten lots. GENERAL returned one row with stock `7.00`, matching independent `stock_movements` IN minus OUT. LOTS_EXPIRATIONS returned ten detail rows matching independent lot-balance quantities. GENERAL and PHYSICAL_COUNT each returned 83 product+branch rows; LOTS_EXPIRATIONS returned 10 rows for the representative SKU.
- Pagination with page size 40 returned 40, 40 and 3 rows, total 83, zero overlap and 83 unique keys. Empty branch array and foreign branch array returned zero rows. Code filtering returned one product and preserved both barcode strings.
- EXPLAIN ANALYZE on QA completed for GENERAL, PHYSICAL_COUNT, LOTS_EXPIRATIONS and late OFFSET. Execution times were approximately 9.817 ms, 8.351 ms, 7.359 ms and 8.320 ms respectively. Plans were function scans with small in-memory sorts and shared-buffer hits; no index was added.
- Real backend-reporteria integration against QA returned a bounded preview of 10 rows from 83 total, resolved the real ADMIN branch, denied an unauthorized branch, and exported 83 rows with valid PDF and XLSX bytes. Export uses a dedicated read-only REPEATABLE READ client transaction with commit/rollback/release lifecycle.
- Real empty-preview integration returned `rows=0`, `totalRows=0`, `totalPages=0` and a valid PDF. Physical Count and Excel structural checks remain automated-test/manual items because the Node test runner is unavailable in this environment.
- Focused backend authorization/controller/service tests now pass `20/20`; the PDF template empty branded render test passes `1/1`. The earlier filter-position assertion was corrected to match the final 23-argument function contract.
- Local web HTTP smoke for `/default/inventory/products` returns `200` after clearing only the generated `.next` dev cache; the first dev process had stale missing vendor chunks and was restarted. CUA exposed no browser surface (`browsers: []`), so interactive visual cases remain PENDING.
- Automated Node test execution remains blocked before assertions by `uv_os_get_passwd returned ENOMEM`; this is an environment failure. Manual browser, visual PDF, Excel-open, printer and concurrent two-connection mutation checks remain pending.

## Final certification 2026-09-18

- Technical certification: **PASS**.
- Manual QA: **PASS** for Products controls, report dialog, presets, filters, pagination, PDF preview/download, Excel download/open, branding and normal document print flow.
- Export completeness and snapshot behavior: **PASS**. No silent truncation observed.
- The authorized QA dataset has one tenant and one active branch. Real cross-tenant and ADMIN multi-branch cases remain classified **N/A ENVIRONMENT**; static isolation and automated branch-scope tests remain PASS.
- Feature certification: **PASS — READY FOR COMMIT**.
