## Purpose

Provides a controlled and repeatable way to provision a demonstration tenant while preserving tenant isolation and excluding unrelated business, personal, credential, transactional, inventory, and electronic-billing data.

## ADDED Requirements

### Requirement: Safe explicit execution
The provisioning operation SHALL require an explicit invocation and SHALL refuse production-like database names or environments. It SHALL perform preflight validation before any write and SHALL use one database transaction for the target provisioning run.

#### Scenario: Unsafe environment is selected
- **WHEN** the configured environment is not QA/staging or the database is not an approved non-production target
- **THEN** the operation stops before writes and reports the sanitized reason

#### Scenario: Preflight fails
- **WHEN** the source tenant, global references, target identity guard, or unique Licores category check fails
- **THEN** the operation stops before writes and leaves the database unchanged

### Requirement: Target fiscal and operational core
The operation SHALL create exactly one active target tenant using a collision-checked slug, verified company detail values, one principal branch named `CARIBE LICORES`, one operational terminal named `Terminal 1`, and only repository-supported POS/cash configuration.

#### Scenario: New target is provisioned
- **WHEN** all preflight checks pass
- **THEN** the target has one tenant detail, one active principal branch, one operational terminal, and no source tenant identity fields

#### Scenario: Existing target identity is found
- **WHEN** the slug or NIT exists for a different company, or an existing target is only partially provisioned
- **THEN** the operation refuses to overwrite or delete it and reports the identity collision

### Requirement: Compatible administrative access
The operation SHALL create the requested administrator login with the repository's verified `bcryptjs` cost 12 hashing convention, associate it with the existing global `SUPER_USER` role, and use the repository's established synthetic persona convention when a real representative is unknown.

#### Scenario: Administrator is created
- **WHEN** the target is new and the role exists
- **THEN** the stored credential is a bcrypt hash, the temporary plaintext is never stored or logged, and exactly one target `SUPER_USER` association exists

### Requirement: Tenant-scoped navigation and catalog mapping
The operation SHALL create fresh target IDs for tenant-scoped menus, permissions, the selected category, every selected `product_subcategories` row, products, all four active operational units (`UND`, `KG`, `LT`, and `CJ`), taxes, rates, barcodes, product-tax rows, and profiles, remapping every foreign key. Each target subcategory SHALL reference the fresh target category and target tenant. Global roles, geography, and tax dictionaries SHALL be reused by stable references. The product dependency count MAY report `required_units=1` independently; it SHALL NOT reduce the four-unit operational bootstrap set.

#### Scenario: Licores catalog is copied
- **WHEN** the source contains exactly one category named/slugged `Licores`
- **THEN** only products in that category and their required relational dependencies are copied, with source and target tenant-scoped IDs kept distinct
- **AND** each source subcategory is copied once with a `sourceSubcategoryId -> targetSubcategoryId` mapping used by every target product

#### Scenario: Source has ambiguous product scope
- **WHEN** zero or multiple plausible Licores categories are found
- **THEN** the operation stops before writes and reports the category evidence

### Requirement: Privacy and operational exclusion
The operation SHALL exclude source identity, personal, banking, credential, session, transactional, stock-history, electronic-document, outbox/inbox, audit, device, and secret data. For the selected Licores category, subcategories, and products, it SHALL prepare referenced physical image files locally using a persistent definitive-UUID manifest, fresh target tenant/entity storage keys, rebuilt image URLs, checksums, and no-overwrite semantics. Database apply SHALL require `--confirm-images-uploaded YES`, trust only the user-confirmed manual server upload, and SHALL perform no remote filesystem access or file copy. It SHALL not fabricate inventory quantities or electronic-billing credentials.

#### Scenario: A selected source image is missing
- **WHEN** a selected DB storage key does not resolve to a regular source file
- **THEN** preflight/plan/`--prepare-images` reports the missing file, performs no database writes, and does not persist an incomplete manifest or create placeholder files

#### Scenario: Prepared image tree is manually uploaded
- **WHEN** all selected images are prepared locally and the user preserves their relative `storage/uploads` paths on QA
- **THEN** apply reuses the manifest UUIDs and storage keys, requires `--confirm-images-uploaded YES`, and performs database writes only

#### Scenario: Products require runtime inventory state
- **WHEN** selected products require lot/expiration balances for sale
- **THEN** the target catalog is provisioned without stock/lots and the validation output identifies the separate later operational requirement

#### Scenario: Electronic billing is requested by fiscal detail
- **WHEN** the target is marked as obligated for electronic billing but no target credentials are authorized
- **THEN** only fiscal master data is created and no provider credential/configuration or electronic document is created

### Requirement: Idempotent validation
The operation SHALL detect a completed target by strong slug/NIT identity, avoid duplicate rows on rerun, and validate target counts, uniqueness, foreign keys, tenant isolation, final-consumer cardinality, and source-to-target Licores parity.

#### Scenario: Provisioning is run twice
- **WHEN** the same explicit command is run after successful provisioning
- **THEN** it reports the existing completed target without creating duplicate tenant-scoped records

#### Scenario: Post-write validation fails
- **WHEN** target validation detects an unexpected source reference, duplicate final consumer, incomplete tax graph, or FK problem
- **THEN** the transaction rolls back and reports the failed invariant

### Requirement: Transactional manifest gate and table contracts
The operation SHALL run authoritative source preflight and persistent-manifest fingerprint validation on the same `REPEATABLE READ` transaction connection before the first write. Generic inserts SHALL not assume an `id` column; `RETURNING` SHALL be explicit only for tables that provide the requested column.

#### Scenario: Composite-key rows are inserted
- **WHEN** the target user-role and persona-branch association rows are inserted
- **THEN** SQL omits `RETURNING id` and uses their existing composite primary keys without schema changes

#### Scenario: Source changes after advisory preflight
- **WHEN** the in-transaction source snapshot or manifest fingerprint differs
- **THEN** the transaction rolls back before any target `INSERT`

### Requirement: Deterministic menu and final-consumer provisioning
The operation SHALL reject duplicate menu IDs, orphan parents, cycles, duplicate active tenant keys/routes, invalid SUPER_USER access levels, and duplicate role/menu permissions. It SHALL insert menus in deterministic parent-before-child order and build exactly one active/default `Consumidor Final` row from an explicit allowlist with document `222222222222`.

#### Scenario: Menu hierarchy is valid
- **WHEN** selected menu rows form an acyclic hierarchy with all parents selected
- **THEN** every target parent row exists before its child and every parent UUID is remapped to the target menu UUID

#### Scenario: Canonical final consumer is created
- **WHEN** the target tenant is new
- **THEN** the customer display name is `Consumidor Final`, the document is `222222222222`, only safe fiscal identity fields are copied, and source lookup/audit metadata is excluded

### Requirement: Comprehensive pre-commit relational validation
After target inserts and before commit, the operation SHALL use the same transaction client to validate expected counts, tenant ownership, exclusion of source tenant-owned foreign keys, product/category/subcategory and barcode mappings, tax/rate/product-tax/profile parity, user-role-persona-branch links, menu parent remapping, role-menu and legacy permissions, canonical final-consumer uniqueness, POS ownership, and manifest image storage keys. Any mismatch SHALL throw and roll back the transaction.

#### Scenario: A relational target invariant fails
- **WHEN** a target row is missing, has wrong tenant ownership, references a source tenant row, or differs from its mapped source semantics
- **THEN** the operation reports the table/invariant and rolls back before commit

### Requirement: Apply image boundary
`--prepare-images` SHALL require the selected source image binaries and create the prepared manifest. After successful preparation, `--apply` SHALL not require or inspect source image binaries; it SHALL use the existing prepared manifest and explicit `--confirm-images-uploaded YES`, while remaining database-write-only with no remote filesystem access.

#### Scenario: Source binaries are absent after preparation
- **WHEN** a valid prepared manifest exists and the target image upload is explicitly confirmed
- **THEN** apply source preflight checks database scope/fingerprint only and does not report missing source image files

#### Scenario: Prepare source binaries are absent
- **WHEN** `--prepare-images` cannot resolve a selected source image to a local regular file
- **THEN** preparation remains blocked and does not create incomplete target artifacts

### Requirement: Definitive unit identifiers
Because `public.units.id` has no database default, apply SHALL require a non-null persistent-manifest source-unit to target-unit mapping before any unit insert, SHALL use the definitive target UUID explicitly with target tenant ownership, and SHALL insert units only after the target tenant row exists in the same transaction. It SHALL not generate or return a new unit UUID during apply.

#### Scenario: Unit mapping is absent
- **WHEN** any selected source unit has no definitive target UUID in the manifest
- **THEN** apply fails before the unit insert SQL and rolls back without generating a replacement UUID
