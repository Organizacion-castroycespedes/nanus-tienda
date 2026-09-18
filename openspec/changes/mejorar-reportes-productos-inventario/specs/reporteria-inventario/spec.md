## ADDED Requirements

### Requirement: Server-resolved branch scope for inventory reporting

Before querying operational inventory data, the reporting backend SHALL resolve a concrete set of active branch IDs from the authenticated user, tenant, current role semantics and current branch assignments. It SHALL reject an empty or unresolved set and SHALL pass the resolved IDs, rather than an unchecked null branch, to future inventory reporting queries.

#### Scenario: ADMIN with one assigned branch and no filter
- **WHEN** an ADMIN assigned to branch A requests a report without a branch filter
- **THEN** the effective branch set SHALL be exactly A.

#### Scenario: ADMIN with multiple assigned branches and no filter
- **WHEN** an ADMIN assigned to A and C requests a report without a branch filter
- **THEN** the effective branch set SHALL be exactly A and C.

#### Scenario: Authorized branch filter
- **WHEN** that ADMIN requests C
- **THEN** the effective branch set SHALL contain only C.

#### Scenario: Unauthorized branch filter
- **WHEN** that ADMIN requests B, which is not assigned
- **THEN** the request SHALL be rejected before report data is queried.

#### Scenario: Cross-tenant branch
- **WHEN** a tenant-scoped actor requests another tenant or one of its branches
- **THEN** the request SHALL be rejected.

#### Scenario: Missing assignments
- **WHEN** an ADMIN has no persona or no active branch assignments
- **THEN** the request SHALL fail closed.

#### Scenario: Tenant-wide administrative roles
- **WHEN** a SUPER_USER requests own-tenant inventory or a SUPER_ADMIN selects a tenant
- **THEN** the effective set SHALL contain only active branches in that tenant, subject to the authenticated role and user being valid.

### Requirement: Canonical Products and Inventory report

The reporting backend SHALL obtain all operational Products and Inventory report rows from one tenant-scoped PostgreSQL stored reporting function receiving the server-resolved branch IDs. The report SHALL distinguish general movement stock from lot on-hand, reserved and available quantities, and SHALL not multiply stock when products have multiple codes, lots or locations.

#### Scenario: Multiple codes and lots
- **WHEN** a product has multiple active barcodes and multiple lots or locations
- **THEN** codes SHALL be aggregated independently, general stock SHALL remain the movement-derived product/branch amount, and each lot/location row SHALL carry only its own lot quantities.

#### Scenario: Zero movements or no lots
- **WHEN** a product has no movements or no lots in an authorized branch
- **THEN** it SHALL remain reportable with zero general stock or null lot detail as applicable.

#### Scenario: Scope and filter application
- **WHEN** category, subcategory, unit, code, stock or expiration filters are supplied
- **THEN** the function SHALL apply the validated filters only within the authenticated tenant and authorized branch array.

### Requirement: One canonical dataset contract across formats

The report SHALL create viewer preview, PDF and XLSX from the same stored-function row contract and validated filters. Each complete export SHALL use one read-only repeatable-read snapshot across its internal batches; separate preview and export HTTP requests may create separate snapshots.

#### Scenario: Review and export
- **WHEN** an authorized user opens Products reporting, applies filters and generates a preview
- **THEN** the viewer SHALL show the PDF and offer complete PDF download, typed XLSX download and normal document printing using the same canonical filters and row contract.

#### Scenario: Empty report
- **WHEN** no rows match valid filters
- **THEN** preview and exports SHALL show an empty report with the applied scope and no fabricated operational rows.

#### Scenario: Physical count
- **WHEN** the Physical Count preset is selected
- **THEN** the export SHALL provide one system quantity per product/branch and blank manual count, difference and observation cells; editing the workbook SHALL not mutate inventory.

### Requirement: Factual cost and expiration semantics

The report SHALL label catalog product cost separately from lot unit cost, and SHALL expose factual lot expiration dates and days to expiration. It SHALL not show an inventory valuation total or an expiring-soon classification until their rules are approved.

#### Scenario: Product and lot cost
- **WHEN** an authorized report includes a product with a costed lot
- **THEN** catalog cost and lot unit cost SHALL remain separate fields in the report.
