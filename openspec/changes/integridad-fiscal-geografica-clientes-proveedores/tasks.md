## 1. Audit and schema

- [x] 1.1 Inventory customer, supplier, and geographic schemas, keys, indexes, and existing fiscal catalogs.
- [x] 1.2 Produce sanitized customer/supplier completeness and deterministic backfill dry-run report.
- [x] 1.3 Add the smallest non-destructive migration only if audit proves it is required.

## 2. Shared API integrity

- [x] 2.1 Implement tenant-safe catalog hierarchy validation and canonical code resolution.
- [x] 2.2 Apply shared resolver to customer create/update and preserve compatible legacy fields.
- [x] 2.3 Apply shared resolver to supplier create/update and preserve compatible legacy fields.
- [x] 2.4 Enforce existing fiscal requirements without guessing responsibilities or final-consumer exceptions.

## 3. Web and billing contracts

- [x] 3.1 Add cascading Spanish geographic selectors for customer and supplier forms.
- [x] 3.2 Hydrate selectors from persisted IDs/codes and remove free-text code entry.
- [x] 3.3 Make electronic-billing eligibility fail closed on incomplete canonical fiscal/location data.
- [x] 3.4 Verify immutable billing snapshots retain canonical codes and fiscal values.

## 4. Backfill and verification

- [x] 4.1 Implement guarded, auditable, idempotent deterministic geographic backfill.
- [x] 4.2 Keep unresolved fiscal records marked for review and never mass-default `R-99-PN`.
- [x] 4.3 Add customer, supplier, billing, backfill, and no-side-effect regression tests.
- [x] 4.4 Run API/Web/Billing validation, OpenSpec strict, diff check, and secret scan.
- [ ] 4.5 Apply only approved deterministic backfill to QA and record sanitized counts.
