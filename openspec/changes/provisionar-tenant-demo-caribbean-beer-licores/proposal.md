## Why

Manus needs a controlled demonstration tenant for CARIBBEAN BEER LICORES SAS without copying another tenant's identity, credentials, transactions, stock, or secrets. The repository has tenant-scoped seed conventions but no explicit safe product-scope provisioning artifact for this customer.

## What Changes

- Add an explicitly invoked, QA/staging-guarded provisioning script for `CARIBBEAN BEER LICORES SAS`.
- Preflight the source tenant, unique `Licores` category, target identity collisions, global references, and dependency counts before writes.
- Create the target tenant, fiscal detail, principal branch, synthetic demo administrator, `SUPER_USER` association, menu/permission mappings, final consumer, units, payment methods, POS terminal, operational terminal, cash register, and minimal inventory location.
- Clone only the source tenant's `Licores` category, its supported `product_subcategories`, and products with fresh tenant-scoped UUIDs and explicit category/subcategory remapping, plus unit, tax, barcode, product-tax, and alcohol tax-profile dependencies.
- Keep source-specific configuration, customer records other than final consumer, stock/lots/history, transactions, electronic documents, billing credentials, sessions, devices, and secrets out of the target. Prepare only explicitly authorized selected catalog images locally with a persistent UUID manifest; the user manually uploads the generated target tree before database apply.
- Exclude all operational lots, stock, movements, and inventory balances; create them later through normal Manus operations.
- Make execution transactional and safely rerunnable; provide sanitized validation output and no automatic migration execution.

## Capabilities

### New Capabilities

- `tenant-demo-provisioning`: Explicit, idempotent, privacy-safe provisioning of a demonstration tenant from an allowlisted catalog scope.

### Modified Capabilities

- None.

## Impact

- Adds one operational script under `scripts/database/provisioning/` and documentation/tests for its preflight and validation behavior.
- No API, frontend, Electron, Peripheral Agent, schema, or automatic migration changes.
- Uses existing PostgreSQL tables, global catalogs, `bcryptjs` cost 12 convention, and repository QA environment guardrails.
