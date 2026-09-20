## 1. Provisioning artifact

- [x] Add the explicit QA/staging-guarded Node/PostgreSQL provisioning script.
- [x] Implement read-only preflight and sanitized report output.
- [x] Implement guarded transactional target core, synthetic admin, menu/permissions, customer, units, payment, POS, and cash setup.
- [x] Implement Licores-only category/product dependency remapping for taxes, rates, barcodes, product taxes, and tax profiles.
- [x] Verify and implement preflight support for `product_subcategories` and explicit category/subcategory mapping rules.
- [x] Add persistent source-snapshot/fingerprint manifest with definitive tenant-scoped UUID maps.
- [x] Add local `--prepare-images` with exclusive target-tree preparation, checksums, and no database writes.
- [x] Require `--confirm-images-uploaded YES` and make future `--apply` database-only; document manual server upload and no remote filesystem access.
- [x] Keep lots, stock, movements, and inventory balances out of scope; preserve only product-level lot/expiration flags.
- [x] Implement post-write count validation, rollback, manifest image-key validation, and strong identity refusal.
- [x] Remove implicit `RETURNING id` from generic inserts and validate composite-key inserts.
- [x] Gate the first write on same-transaction `REPEATABLE READ` source/manifest revalidation.
- [x] Validate and insert menus topologically with unique-key/route and SUPER_USER permission guards.
- [x] Build the final consumer from an explicit canonical allowlist.
- [x] Add same-transaction pre-commit relational validation for tenant isolation, mapped FKs, catalog/tax parity, auth/menu/POS ownership, final consumer, image keys, and expected counts.
- [x] Separate source-image checks: enforce them for `--prepare-images`, disable them for apply database preflight, and retain persistent-manifest/upload confirmation guards.
- [x] Enforce explicit persistent target UUID mappings for `public.units` and insert units after the target tenant row within the transaction.
- [x] Align operational unit scope: persist and provision all four active source units (`UND`, `KG`, `LT`, `CJ`) while retaining the separate product dependency count of `required_units=1`.
- [x] Require definitive manifest mappings for every manifest-owned `id` insert; remove apply-time UUID fallback.

## 2. Verification

- [x] Run preflight against the authorized QA database without exposing secrets or source PII.
- [x] Run apply only after explicit QA confirmation; capture target UUID and sanitized row counts.
- [ ] Run the idempotency check and FK/tenant-isolation/tax-parity validations.
- [x] Run focused script tests or a safe dry-run test fixture if available.
- [x] Run OpenSpec strict validation and `git diff --check`.
- [ ] Record login/POS QA status, including the no-stock/lot limitation and disabled electronic billing.
