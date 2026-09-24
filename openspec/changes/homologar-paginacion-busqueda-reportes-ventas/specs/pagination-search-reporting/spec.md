## ADDED Requirements

### Requirement: Common pagination
The system SHALL render visible range, real total, page-size options 10, 25,
50 and 100, numbered pages, first/previous/next/last controls, disabled states
and responsive layout at 390px.

#### Scenario: Empty result
- **WHEN** total records is zero
- **THEN** the component shows zero records, one disabled page state and no
  invalid navigation request.

#### Scenario: Server paginated operations sales
- **WHEN** the user changes page or page size after Buscar
- **THEN** exactly one request uses the applied filters, page and limit.

### Requirement: Explicit operations sales search
The system SHALL keep draft and applied filters separate and SHALL NOT request
the list on mount, filter edit or filter clear.

#### Scenario: Buscar
- **WHEN** the user presses Buscar
- **THEN** draft filters become applied, page resets to one and one list request
  starts with loading and stale responses cannot overwrite current data.

### Requirement: Independent operational reporting
The system SHALL keep operational reporting independent from POS reporting and
MUST preserve the scope resolved by `OperationalSaleScopeService`.

#### Scenario: Missing safe contract
- **WHEN** no authenticated independent export contract can preserve the
  operational scope
- **THEN** the report action is not implemented as an unsafe fallback and the
  change records BLOCKED evidence.

### Requirement: Actions first
The system SHALL place the existing Actions column first in the requested report
tables without changing action contracts or other column order.

#### Scenario: Operations sales has no actions column
- **WHEN** the local route has no Actions column
- **THEN** only the existing detail navigation is exposed as Ver detalle.

### Requirement: Independent operational export authorization
The future operational export SHALL be authorized by the API on every request
and SHALL use a separate authenticated API-to-reporteria contract. Browser JWT
claims and client-provided scope SHALL NOT authorize the export.

#### Scenario: USER with current open shift
- **WHEN** an authenticated USER requests PDF or XLSX
- **THEN** API revalidates POS READ permission and the unique current OPEN cash
  session, signs the resolved user/tenant/branch/session scope, and reportería
  renders only that signed scope.

#### Scenario: Closed or changed shift
- **WHEN** the user’s current shift is closed, ambiguous or changed before the
  export request
- **THEN** API denies the request and no document is generated.

#### Scenario: Replay or forged internal authorization
- **WHEN** reportería receives an expired, replayed, wrong-audience, invalidly
  signed or digest-mismatched authorization
- **THEN** reportería rejects it without querying sales or generating bytes.

### Requirement: Export parity and bounded documents
The future export SHALL use the operational list predicates, applied filters and
deterministic ordering, count before reading, read in stable batches, enforce an
explicit maximum and reject incomplete batches without silent truncation.

#### Scenario: More than one page
- **WHEN** the authorized result exceeds the visible page size
- **THEN** PDF and XLSX contain every authorized row matching the applied query,
  not only browser page rows.

#### Scenario: Ambiguous electronic document
- **WHEN** a sale has ambiguous electronic billing state
- **THEN** the export preserves that state as data and performs no provider,
  billing or DIAN operation.

### Requirement: Independent document response
The future contract SHALL return valid PDF preview/download bytes and XLSX
download bytes with operational fields and branding, while leaving
`/reports/pos-sales` and its exports unchanged.

#### Scenario: POS regression check
- **WHEN** the operational export contract is added
- **THEN** POS report routes, SQL scope, permissions, filters and exports have
  identical behavior and no new dependency on operational scope.
