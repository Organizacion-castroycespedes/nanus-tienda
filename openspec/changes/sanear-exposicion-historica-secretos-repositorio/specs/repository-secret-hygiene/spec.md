## ADDED Requirements

### Requirement: Exposed credentials are rotated before debt closure
The project MUST identify every credential exposed through reachable remote history and MUST rotate or revoke each active credential before closing this debt.

#### Scenario: Active exposed credential remains
- **WHEN** inventory proves an exposed credential is still active
- **THEN** the debt remains open and rotation/revocation is required before closure

#### Scenario: Exposed credential is inactive
- **WHEN** inventory proves an exposed credential is inactive or revoked
- **THEN** the evidence records that disposition and the credential remains absent from the current tree

### Requirement: PKCS#12 material is classified before closure
Private certificate material committed to remote history MUST be replaced or revoked, unless a documented safe assessment proves it is non-private and non-sensitive.

#### Scenario: PKCS#12 contains a private key
- **WHEN** safe assessment detects a private key or active signing certificate
- **THEN** the certificate is replaced or revoked and the old material is not restored to Git

#### Scenario: PKCS#12 is public and non-sensitive
- **WHEN** safe assessment proves the file contains no private key and no sensitive operational material
- **THEN** the evidence records the classification before debt closure

### Requirement: Current Git tree excludes runtime secrets
The current Git tree MUST NOT track runtime secret files, private certificate containers, or QA database dumps.

#### Scenario: Release tree inspection
- **WHEN** intended release refs are scanned
- **THEN** runtime secret files, private PKCS#12/PFX files, and QA dumps are absent from tracked content

### Requirement: History purge is coordinated across refs
History rewrite MUST enumerate and coordinate affected branches, tags, remote refs, clones, worktrees, and CI/CD consumers.

#### Scenario: Ref inventory is incomplete
- **WHEN** any affected ref or clone cannot be identified
- **THEN** history replacement is blocked until the inventory is complete or explicitly risk-accepted

### Requirement: Remediation precedes history rewrite
History rewrite MUST NOT occur before credential and certificate remediation decisions are complete.

#### Scenario: Rewrite requested before rotation
- **WHEN** an operator requests history replacement while active exposure remains unresolved
- **THEN** the operation is blocked and rotation/revocation remains the next action

### Requirement: Post-purge verification proves unreachable exposure
After an approved purge, verification MUST prove removed paths and secret material are absent from reachable intended release refs and that required tests and builds remain valid.

#### Scenario: Purge verification succeeds
- **WHEN** all intended refs are scanned after remote replacement
- **THEN** secret scans pass, release refs are valid, tests/builds pass, and revoked material remains unusable

