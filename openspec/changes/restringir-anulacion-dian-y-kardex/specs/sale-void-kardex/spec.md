## ADDED Requirements

### Requirement: reversal movement stores stock snapshots
The total sale-void flow SHALL create one `IN` stock movement for each original sale `OUT` movement and SHALL persist `stock_before` and `stock_after` using the tenant, branch, product, and quantity of that reversal.

#### Scenario: non-lotted product is returned
- **WHEN** a sale `OUT` movement is reversed
- **THEN** the `IN` movement stores the current scoped stock as `stock_before` and `stock_before + quantity` as `stock_after`

#### Scenario: lotted product is returned
- **WHEN** a sale `OUT` movement has `stock_movement_lots` links
- **THEN** the reversal stores snapshots and restores each linked `inventory_lot_balances` row and creates matching reverse lot links in the same transaction

### Requirement: reversal is tenant and branch scoped
The reversal SHALL calculate stock and update lot balances only for the original movement tenant and branch.

#### Scenario: same product exists in another branch or tenant
- **WHEN** a sale is voided
- **THEN** stock snapshots and lot restoration do not include movements or balances from another branch or tenant

### Requirement: void remains idempotent
The system SHALL prevent a sale from receiving a second inventory reversal.

#### Scenario: sale is already cancelled or refunded
- **WHEN** a second void request reaches the service
- **THEN** the request does not create another `IN` movement or duplicate lot restoration

### Requirement: reversal is atomic
Inventory, lots, payments, cash movements, and sale status SHALL commit or roll back together.

#### Scenario: reversal operation fails
- **WHEN** any inventory, lot, payment, or cash update fails
- **THEN** the transaction rolls back all changes for the void

### Requirement: stock snapshots use a common serialization protocol
All runtime writers that calculate stock from `stock_movements` SHALL acquire the same tenant/branch/product serialization lock before reading the balance and SHALL hold it through validation and movement insertion.

#### Scenario: concurrent movement for the same product and branch
- **WHEN** two transactions concurrently create `IN` or `OUT` movements for the same tenant, branch, and product
- **THEN** one transaction waits, the committed snapshots form a serial sequence, and no committed `stock_before`/`stock_after` pair is based on an unprotected `SUM`

#### Scenario: concurrent movements for different scopes
- **WHEN** transactions use different tenant, branch, or product scope
- **THEN** they do not block each other through the stock serialization lock

#### Scenario: multi-product transaction
- **WHEN** one transaction changes multiple products
- **THEN** it acquires scope locks in deterministic order and does not introduce lock-order deadlocks

### Requirement: local migration execution is fail-closed and auditable
The official migration runner SHALL apply V107 and V108 locally only after verifying the effective PostgreSQL identity and SHALL record each successful SQL execution atomically in `migrations_history`.

#### Scenario: local target identity differs
- **WHEN** the configured or effective host, port, database, schema, or user differs from the authorized local target
- **THEN** the runner stops before executing migration DDL

#### Scenario: V108 objects already exist locally
- **WHEN** V108 runs after an equivalent manual local application
- **THEN** its idempotent SQL verifies or recreates the same helper, trigger, and sale-function lock block exactly once before the history row commits
