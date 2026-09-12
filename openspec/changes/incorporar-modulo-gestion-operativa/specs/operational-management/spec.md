## ADDED Requirements

### Requirement: Operational sales access uses existing authorization
Gestión Operativa MUST reuse Manus roles, permissions, tenant context, branch assignments, and backend guards. It MUST NOT create a second authorization system.

#### Scenario: Existing authorization architecture
- **WHEN** the module evaluates an operational sales request
- **THEN** it uses the existing actor, tenant, branch, shift, and permission context before querying sales

### Requirement: Operational role scope
The backend MUST enforce `USER` current-shift scope, `ADMIN` authorized-branch scope without requiring an open shift, `SUPER_USER` tenant scope, and the existing `SUPER_ADMIN` global policy.

#### Scenario: Admin without open shift
- **WHEN** an `ADMIN` requests an authorized branch sale without an open shift
- **THEN** the backend allows the administrative read if permission permits

#### Scenario: Operational user previous shift
- **WHEN** a `USER` requests a sale from a previous shift
- **THEN** the backend denies the request

### Requirement: Tenant and branch isolation
Operational sales queries MUST derive tenant and branch scope in the backend. Client-provided scope filters MUST NOT expand access.

#### Scenario: Cross-tenant identifier
- **WHEN** an actor submits a known sale identifier from another tenant
- **THEN** the backend returns the existing forbidden/not-found response

### Requirement: Paginated operational sales
The operational sales API MUST provide server-side pagination, sorting, and authorized filters without loading all sales into the client.

#### Scenario: Paged list
- **WHEN** an authorized actor requests a page of sales
- **THEN** the server returns only the scoped page and pagination metadata

### Requirement: Electronic billing is referenced, not duplicated
The module MUST display safe electronic billing status and metadata from the electronic billing domain without duplicating its source of truth.

#### Scenario: Accepted electronic document
- **WHEN** an authorized actor views a sale with an accepted document
- **THEN** the detail shows available fiscal status and identifiers safely

### Requirement: Safe operational actions
Operational actions MUST respect status, permissions, tenant scope, and audit rules. Terminal fiscal documents MUST NOT be retransmitted from this module.

#### Scenario: Terminal rejected document
- **WHEN** an actor views a terminal rejected fiscal document
- **THEN** the UI does not offer an unsafe retransmission action

### Requirement: Current shift resolution is deterministic
For `USER`, the backend MUST require exactly one matching `OPEN` cash session.
Zero or multiple matching sessions MUST fail closed.

#### Scenario: No open shift
- **WHEN** `USER` has no matching `OPEN` cash session
- **THEN** scope resolution is denied

#### Scenario: Ambiguous open shift
- **WHEN** `USER` has multiple matching `OPEN` cash sessions
- **THEN** scope resolution is denied without selecting an arbitrary session

### Requirement: Direct sale access uses the same scope
Direct sale-ID access MUST validate tenant, branch, and current-shift scope
independently of list filters.

#### Scenario: Direct UUID bypass
- **WHEN** an actor requests a sale UUID outside its resolved scope
- **THEN** access is denied with the existing `403` or `404` convention

### Requirement: Requested filters cannot expand scope
The effective query scope MUST be the intersection of authorized scope and
requested filters. `tenantId`, `branchId`, `cashSessionId`, and `userId` MUST
NOT expand access.

#### Scenario: Filter tampering
- **WHEN** a client submits an unauthorized tenant, branch, cash session, or user filter
- **THEN** the backend rejects or narrows the result without expanding scope

### Requirement: Permission authorization remains mandatory
Operational access MUST use existing menu permissions and permission guards in
addition to role-based scope resolution.

#### Scenario: Role without permission
- **WHEN** a role lacks the required operational menu permission
- **THEN** the backend denies the operation even when its role scope is valid
### Requirement: Conservative stale recovery
Stale processing recovery MUST reconcile an existing provider document by
provider identity or `external_reference` before any provider creation.
Missing provider identity or a `NOT_FOUND` response MUST NOT prove that no
provider mutation occurred.

#### Scenario: Ambiguous create timeout
- **WHEN** provider creation may have persisted but Manus has no provider link
- **THEN** recovery looks up `external_reference` first and never creates a second document

#### Scenario: Create timeout not found
- **WHEN** provider creation may have happened and recovery returns `NOT_FOUND`
- **THEN** recovery fails closed without creating or transmitting

### Requirement: Transmission ambiguity is reconcile-first
The electronic billing domain MUST reconcile provider state before retrying a
document whose transmission outcome is unknown. Operational recovery MUST NOT
blindly retransmit an ambiguous or terminal document.

#### Scenario: Ambiguous transmission
- **WHEN** transmission may have reached the provider but local outcome was not persisted
- **THEN** recovery requires reconciliation/manual review and sends no second transmission

### Requirement: Terminal statuses are monotonic
Stale recovery MUST NOT overwrite `ACCEPTED`, final `REJECTED`, or `CANCELLED`
with a non-terminal status.

#### Scenario: Older stale response
- **WHEN** recovery receives an older `PROCESSING` response for a terminal document
- **THEN** the persisted terminal status remains unchanged

### Requirement: Durable processing stage
The electronic billing domain MUST persist a processing stage separate from
canonical status. New documents MUST start at `PRE_PROVIDER_CREATE`.
`PROVIDER_CREATE_INTENT` and `TRANSMISSION_INTENT` MUST be persisted before
their respective external calls. Ambiguous stages MUST reconcile first and
never authorize blind create or transmission.

#### Scenario: Create intent is durable
- **WHEN** processing is about to call provider creation
- **THEN** `PROVIDER_CREATE_INTENT` is persisted before the call

#### Scenario: Transmission intent is durable
- **WHEN** processing is about to transmit an existing provider document
- **THEN** `TRANSMISSION_INTENT` is persisted before the call

#### Scenario: Unknown historical stage fails closed
- **WHEN** a legacy row has no durable evidence of its processing stage
- **THEN** it is `UNKNOWN` and cannot retry or transmit without reconciliation

### Requirement: Secure stale authentication recovery
The authentication system MUST maintain at most one active session per user
and tenant. After successful password verification, a user MUST be able to
explicitly replace an unavailable stale session through the supported
`/auth/login/replace-session` flow. Replacement MUST revoke the previous
session and its refresh token atomically before the new session is committed.

#### Scenario: Valid replacement after lost refresh token
- **WHEN** a user with an active server-side session provides valid credentials
  to `/auth/login/replace-session`
- **THEN** the previous session and refresh token become unusable and exactly
  one replacement session remains active

#### Scenario: Invalid replacement credentials
- **WHEN** a user provides an incorrect password to
  `/auth/login/replace-session`
- **THEN** the active session remains unchanged and no replacement is created

#### Scenario: Revoked session refresh
- **WHEN** a previously replaced session submits its old refresh token
- **THEN** refresh is rejected as revoked or inactive
