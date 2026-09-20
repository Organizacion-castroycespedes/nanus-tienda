## Context

The repository uses PostgreSQL SQL seeds for environment setup, but the requested customer data must not run as an automatic migration. The inspected QA database contains the source tenant, a unique `Licores` product category, the supported tenant-scoped `product_subcategories` model, tenant-scoped tax/catalog rows, current menu and POS models, and an established synthetic demo-persona seed convention. Authentication uses `bcryptjs` with cost 12. The source subset includes 71 products, 3 subcategory IDs, 3 barcodes, 1 unit, 2 legacy taxes, 207 product-tax rows, and 71 alcohol tax profiles; 11 products have image/storage references and require lot/expiration handling.

## Goals / Non-Goals

**Goals:**

- Provide one explicit Node/PostgreSQL provisioning command with preflight, transactionality, idempotency, fresh UUID remapping, and sanitized validation.
- Preserve existing tenant, RBAC/menu, POS, tax, geography, and authentication contracts.
- Provision only the verified company data and allowed Licores catalog scope.

**Non-Goals:**

- No schema migration, new endpoint, service, frontend, Electron, device enrollment, completed sale, opening cash session, stock quantity, lot, electronic document, billing credential, or source image-object copy.

## Decisions

1. **Explicit provisioning artifact over migration.** The script is invoked with `--preflight`, `--plan`, `--prepare-images`, or `--apply`; it is not included in the normal migration/seed chain. `--apply` requires QA/staging, `--confirm-demo-provisioning YES`, `--confirm-images-uploaded YES`, and a valid persistent manifest.
2. **One transaction and strong identity guard.** Preflight checks source ID, target slug/NIT, global references, unique Licores category, safe source scope, and required tables. Apply uses one transaction and refuses ambiguous or partial target state rather than deleting/recreating it. The authoritative source preflight and manifest fingerprint comparison run on the same `REPEATABLE READ` transaction connection before the write gate and first `INSERT`.
3. **Allowlisted copy.** Company data is written from verified constants. Template config is not copied because its logo/branding payload is source-specific; unambiguous safe technical fields can be added later by explicit allowlist. No source PII or secret-bearing metadata is selected.
4. **Fresh IDs with maps.** The script maps source-to-target IDs for the Licores `product_categories` row, every selected `product_subcategories` row, products, units, taxes, rates, menus, and all relationship rows. Each target subcategory receives a fresh UUID, the new target category UUID, and the target tenant UUID; products use the `sourceSubcategoryId -> targetSubcategoryId` map. Global role, geography, tax dictionary, and provider catalog IDs are resolved and reused. Generic inserts do not assume an `id` column; `RETURNING` is opt-in, so composite-key rows are inserted without invalid `RETURNING id`.
5. **Existing synthetic persona convention.** Create `Super User` with a deterministic `SU-` document based on the target slug, target email, and no claim that it is a legal representative. The requested temporary password is hashed using `bcryptjs` cost 12 and never emitted.
6. **Operational state boundary.** Create configuration rows only: branch, terminal, POS terminal, and cash register. Do not create sessions, movements, balances, lots, inventory locations solely for lot seeding, devices, or bindings.
7. **Persistent local image preparation.** `--prepare-images` allocates definitive UUIDs once in `.tmp/provisioning/caribbean-beer-licores/manifest.json`, verifies local source regular files, and prepares the exact target `storage/uploads` tree with exclusive writes. It records byte size and SHA-256 for every selected image. No database rows are written.
8. **Manual upload boundary.** The user manually transfers the generated `storage/uploads` tree to QA, preserving relative paths. Apply validates the manifest and image keys but performs no SSH, SCP, remote filesystem access, file copy, or overwrite. The user confirms upload with `--confirm-images-uploaded YES`.
9. **Menu and customer contracts.** Selected menus are validated for unique keys/routes, orphan parents, and cycles, then inserted by deterministic parent-before-child topological order. The final consumer is built from an explicit safe allowlist with canonical name `Consumidor Final`, document `222222222222`, and exactly one active/default row; source lookup and audit metadata are excluded.
10. **Comprehensive pre-commit validation.** After all inserts and before `COMMIT`, the same transaction client validates tenant ownership, source-FK exclusion, product/category/subcategory and barcode remapping, tax/rate/product-tax/profile parity, user/role/branch links, menu parent and permission remapping, canonical customer state, POS ownership, expected counts, and manifest image storage keys. Any mismatch throws and reaches the existing `ROLLBACK` path.
11. **Image check boundary.** Source image regular-file checks belong to `--prepare-images`. Apply preflight passes `checkLocalImages: false`, validates database source scope/fingerprint and the existing prepared manifest, and relies on `--confirm-images-uploaded YES`; apply never requires source binaries and never accesses remote storage.
12. **Units contract.** The authoritative `public.units` schema has no ID default. Apply resolves every source-unit UUID through the persistent manifest before write SQL, fails closed on missing/null/source-reused mappings, explicitly inserts the definitive target UUID and target tenant UUID, and inserts units only after the target tenant row exists in the same transaction.
13. **Manifest ID fail-closed contract.** Every manifest-owned `id` insert uses a required mapping assertion before SQL. Apply never falls back to `randomUUID()` for a target entity; only diagnostic/prepare planning may allocate preview or definitive IDs.
14. **Operational unit scope.** The source tenant's four active operational units (`UND`, `KG`, `LT`, and `CJ`) are the bootstrap unit set and receive four persistent target mappings. The product dependency report may separately show `required_units=1`; that dependency count does not reduce the four-unit operational bootstrap scope.

## Risks / Trade-offs

- **Catalog drift:** Source catalog can change between preflight and apply. → Use a repeatable-read transaction and recheck the unique category and source counts inside the transaction.
- **Source spelling discrepancy:** QA currently stores `Whiksy`/`whiksy` while the supplied evidence says Whisky. → Preserve live source values and report the discrepancy; do not silently normalize catalog data.
- **Legacy/current tax overlap:** Products use both `products.tax_id` and `product_taxes`. → Map both and validate every selected product has equivalent target references.
- **Application requires stock to sell:** Catalog setup may not be enough for POS sale. → Do not fabricate stock; report the explicit stock/lot follow-up.
- **Existing partial target:** Automatic cleanup could damage customer data. → Refuse ambiguous or partial targets; only a fully recognized completed target is idempotent.

## Migration Plan

1. Run `node scripts/database/provisioning/provision_caribbean_beer_licores.cjs --preflight --env scripts/config/db.env`.
2. Run `node scripts/database/provisioning/provision_caribbean_beer_licores.cjs --plan --env scripts/config/db.env` and review counts plus the image-copy manifest.
3. Make every selected source image file available locally and run `--prepare-images`; missing files block without creating an incomplete manifest.
4. Manually upload the generated `storage/uploads` tree to QA and verify it before apply.
5. Run `--apply --confirm-demo-provisioning YES --confirm-images-uploaded YES` only against explicitly authorized QA/staging.
6. Run the script's post-write validation and normal login/POS read-only QA. Do not transmit DIAN or complete a sale.

Rollback is transaction rollback on error. No automatic cleanup command is provided; any later target-specific cleanup requires separate authorization and double identity guards.
