## ADDED Requirements

### Requirement: Windows OpenSpec execution fails closed
The governance diagnostic MUST distinguish a Windows child-process access denial from a valid OpenSpec result and MUST NOT convert it into a strict `PASS`.

#### Scenario: Python child process cannot access OpenSpec runtime
- **WHEN** the OpenSpec command returns `WinError 5`, `Access is denied`, or `Acceso denegado` from a Windows child process
- **THEN** the diagnostic reports `WINDOWS_CHILD_PROCESS_ACCESS_DENIED`, `cli_available=false`, and the strict gate rejects

#### Scenario: Direct PowerShell validation passes
- **WHEN** PowerShell validates a change directly but the repository Python diagnostic cannot execute the same runtime
- **THEN** the report keeps the direct result as external evidence and keeps the Python gate blocked until equivalence is verified

### Requirement: External evidence is bound to the effective tree
External OpenSpec evidence MUST identify the change, repository tree, `HEAD`, manifest fingerprint, changed-path fingerprint, and OpenSpec runtime version. Evidence with mismatched or missing identity MUST NOT affect strict validation.

#### Scenario: Stale evidence
- **WHEN** evidence was generated for a different `HEAD`, manifest, changed-path set, or runtime version
- **THEN** the diagnostic reports stale or invalid evidence and does not promote it to `PASS`

#### Scenario: Bound evidence without runtime equivalence
- **WHEN** evidence identity matches but the current process cannot verify the same runtime
- **THEN** the diagnostic reports bound external evidence and retains `cli_available=false`
