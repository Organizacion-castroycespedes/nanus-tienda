## Purpose

This capability defines a reliable Windows uninstall lifecycle that never reports final success while cleanup is only scheduled, safely handles changing POS process state, and preserves contracted local configuration.

## ADDED Requirements

### Requirement: Scoped POS process cleanup

The uninstall flow SHALL identify and terminate only processes whose current executable image is inside the managed POS installation root. Before termination, it SHALL revalidate the process identity and executable path so a vanished or reused PID cannot cause an unrelated process to be terminated.

#### Scenario: POS process exits during enumeration

- **WHEN** a discovered POS PID no longer exists before the termination handle is opened
- **THEN** the flow SHALL treat that process as already exited, continue safely, and perform a final scoped process scan before deleting the POS payload

#### Scenario: PID is reused by an unrelated process

- **WHEN** a discovered PID now resolves to an executable outside the managed POS root
- **THEN** the flow SHALL not terminate that PID and SHALL record the revalidation race without affecting the unrelated process

#### Scenario: POS child processes remain

- **WHEN** scoped POS processes remain after bounded termination and verification
- **THEN** the flow SHALL report cleanup failure and SHALL NOT delete the POS payload or uninstall registration

### Requirement: Completion-aware uninstall result

The uninstall command SHALL distinguish completed cleanup from scheduled, partial, timed-out, crashed, interrupted, and failed cleanup. It SHALL report final success only after the completion result confirms all required cleanup gates, and a helper failure SHALL be observable to the invoking uninstall contract as a non-success result or an explicitly documented completion failure.

#### Scenario: Helper completes successfully

- **WHEN** the external cleanup operation removes the managed payloads, shortcuts, service integration, and registry metadata and confirms the final scan
- **THEN** the uninstall command SHALL return success and SHALL report completed cleanup rather than merely scheduled cleanup

#### Scenario: Helper fails after the parent exits

- **WHEN** the external cleanup operation fails after the original installer process has exited
- **THEN** the lifecycle result SHALL record the failure durably and the official uninstall contract SHALL not present the operation as final success

#### Scenario: Helper crashes or times out

- **WHEN** the cleanup supervisor or helper exits unexpectedly or exceeds its bounded completion window
- **THEN** the uninstall result SHALL be non-success, SHALL retain enough registration or evidence for a safe retry, and SHALL identify the incomplete phase without claiming atomic rollback

### Requirement: Ordered payload and registration cleanup

Standard uninstall SHALL stop and remove service integration, safely close scoped POS processes, remove POS and Peripheral Agent payloads, remove Manus-created shortcuts, and remove uninstall registration only after the payload cleanup gates succeed. It SHALL preserve ProgramData and LocalService state byte-identically. `--remove-data` SHALL remain the only path that removes the contracted managed data.

#### Scenario: Standard uninstall completes

- **WHEN** service absence, process absence, payload deletion, shortcut cleanup, and final path checks all succeed
- **THEN** the flow SHALL remove uninstall registration and leave ProgramData and LocalService state preserved byte-identically

#### Scenario: Payload deletion is incomplete

- **WHEN** a file lock, access error, or other failure prevents removal of a managed payload
- **THEN** the flow SHALL retain uninstall registration, preserve configuration data, report the exact incomplete phase, and avoid broad deletion or ownership changes

### Requirement: Idempotent retry and bounded recovery

The uninstall flow SHALL be safe to retry after a partial, timed-out, crashed, or interrupted cleanup. A retry SHALL re-discover current managed state, SHALL not restore prior production data, SHALL not duplicate service or registry entries, and SHALL finish with an explicit completed or incomplete result within bounded waits for process and helper operations.

#### Scenario: Retry after stale-PID failure

- **WHEN** a prior attempt preserved registration because POS cleanup failed on a stale PID
- **THEN** a subsequent official uninstall SHALL re-scan current scoped processes, complete remaining cleanup when safe, and preserve already-retained configuration

#### Scenario: Retry after completed uninstall

- **WHEN** the official uninstall is invoked after all managed payloads and registration are already absent
- **THEN** the operation SHALL be idempotent, SHALL not affect unrelated applications, and SHALL return a completed or explicitly no-op success result

### Requirement: Sanitized lifecycle evidence

The uninstall flow SHALL record sanitized phase, result, timeout, process-scope, payload, registry, and final-scan evidence without writing credentials, tokens, or configuration contents to logs. Evidence SHALL distinguish expected preserved data from residual installation defects.

#### Scenario: Failure evidence is written

- **WHEN** cleanup fails or becomes incomplete
- **THEN** the logs and durable completion result SHALL identify the managed target, phase, sanitized Windows error, and retry state without exposing secrets or unrelated process data
### Requirement: Deterministic POS packaging provenance
The Windows installer build SHALL validate authoritative Electron inputs, reject unexpected package metadata mutation, generate the POS manifest from the selected release payload, and verify parity with the payload embedded in the installer. It SHALL emit machine-readable SHA-256 provenance without exposing configuration contents.
#### Scenario: Build metadata is mutated
- **WHEN** the Electron package metadata contains an unapproved build-only field such as `allowScripts`
- **THEN** the packaging workflow SHALL fail before copying or replacing POS resources
#### Scenario: Embedded payload drifts from release payload
- **WHEN** a selected release file, embedded file, or generated manifest differs in path, size, or SHA-256
- **THEN** packaging validation SHALL fail and SHALL not present the installer as distribution-ready
#### Scenario: Inputs and outputs are recorded
- **WHEN** the package workflow completes
- **THEN** the provenance sidecar SHALL record package metadata, lockfile, shell configuration, selected payload, generated manifest, and installer hashes
### Requirement: Disposable Windows integration scope
Windows integration tests SHALL use unique disposable TEMP roots, copied test executables, injectable SCM/registry/process/filesystem seams, and explicit scope assertions. They SHALL never target the installed MANUS service, live MANUS paths, real registry keys, or unrelated applications.
#### Scenario: Scoped child cleanup
- **WHEN** multiple POS-like child processes and an unrelated Electron-like process run from disposable roots
- **THEN** cleanup SHALL terminate only the scoped children, verify the final scoped scan is empty, and preserve the unrelated process

### Requirement: Fail-closed durable result correlation

The cleanup helper SHALL reject corrupt, incomplete, fresh-pending, or operation-mismatched durable results. It SHALL never replace prior evidence with a new record. A missing result is valid only for pre-operation creation.

#### Scenario: Foreign or corrupt result

- WHEN the helper receives a result file with invalid JSON, missing mandatory fields, a terminal regression, or a different operation ID
- THEN it SHALL fail without cleanup mutation and SHALL preserve the existing file

#### Scenario: Terminal persistence failure

- WHEN cleanup reaches a terminal state but atomic result persistence fails
- THEN the process SHALL return non-success and SHALL not claim completed durable cleanup

### Requirement: Explicit final observations

A completed result SHALL include known observations proving zero scoped POS processes and absent uninstall registration. Observation errors SHALL produce non-success or unknown state, never fabricated success.

#### Scenario: Observation access fails

- WHEN the final process or registry observation cannot be read
- THEN the result SHALL remain non-success with the corresponding known flag false and SHALL not be serialized as completed

### Requirement: Safe legacy and provenance contracts

The legacy uninstall entrypoint SHALL delegate to the completion-aware flow. Packaging provenance SHALL expose stable logical paths and hashes without machine-specific absolute paths.

#### Scenario: Legacy uninstall command

- WHEN the documented uninstall command is dispatched
- THEN it SHALL use the durable-result lifecycle and code-2 pending contract

#### Scenario: Sanitized provenance

- WHEN packaging provenance is written
- THEN it SHALL contain logical repository paths and hashes and SHALL omit local absolute paths

### Requirement: Canonical uninstall registry contract

The installer SHALL use one canonical uninstall registry path and one explicit x64 registry view for registration creation, presence observation, and deletion. Missing-key results SHALL be idempotent; other registry failures SHALL remain observable failures.

#### Scenario: Registry operations share the installed contract

- **WHEN** the installer creates, observes, or deletes its uninstall registration
- **THEN** each operation SHALL use `Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ManusPeripheralAgent` in the same x64 registry view

#### Scenario: Registry observation or deletion fails

- **WHEN** a managed registry operation returns an error other than key absence
- **THEN** the uninstall result SHALL remain non-success and SHALL preserve retry evidence

### Requirement: Fail-closed process discovery

Native process discovery SHALL distinguish definitively absent PIDs from candidates that cannot be inspected. Access-denied, image-path, identity, and final-scan errors SHALL prevent a completed result whenever managed-root scope cannot be excluded. No process SHALL be terminated without current path and identity revalidation.

#### Scenario: Candidate process cannot be inspected

- **WHEN** a process candidate may be under the managed POS root but OpenProcess, image-path, or start-identity inspection fails
- **THEN** discovery SHALL return an observation error and cleanup SHALL not report zero remaining processes or delete gated payloads

#### Scenario: Unrelated inaccessible process is excluded safely

- **WHEN** the primary image-path query fails but `GetProcessImageFileNameW` returns a native path that is normalized through a verified DOS-device or `SystemRoot` mapping and is outside the managed POS root
- **THEN** discovery SHALL exclude the process using that exact normalized path, SHALL not use PID or basename alone, and SHALL continue to require complete observation for all other candidates

### Requirement: Registry error classification

The cleanup orchestrator SHALL treat only absence of the canonical uninstall registry key as benign. It SHALL propagate service-domain, access-denied, generic, path, and registry-view errors.

#### Scenario: Registry deletion returns a service-domain error

- WHEN the registry cleanup seam returns a Windows service-domain error
- THEN the operation SHALL remain non-success, SHALL retain uninstall registration evidence, and SHALL not publish completed

#### Scenario: Registry deletion returns a generic error

- WHEN deletion of the canonical uninstall key returns an unexpected registry error
- THEN the helper SHALL preserve the durable failure result and SHALL not delete or claim absence of the registration

### Requirement: Native process observation boundaries

Native process discovery SHALL inject snapshot enumeration, OpenProcess, image-path, start-identity, termination, wait, and handle-close boundaries for deterministic testing. It SHALL not suppress an uninspectable process using only executable basename or a root filename inventory.

#### Scenario: Native candidate cannot be inspected

- WHEN OpenProcess, image-path, start-identity, or snapshot enumeration fails for a process that cannot be positively excluded
- THEN discovery SHALL return an observation error and SHALL not report a known zero process count

#### Scenario: Root is missing or empty

- WHEN the managed POS root is missing or contains no files while a process observation is incomplete
- THEN discovery SHALL retain the observation error rather than converting the state to known zero

#### Scenario: Native image fallback is ambiguous

- **WHEN** the primary image-path query fails and the native fallback query fails, or neither path normalization nor verified managed-root device comparison can prove scope
- **THEN** discovery SHALL return an observation error and SHALL not report known zero scoped processes or permit payload cleanup

#### Scenario: Native process is confirmed outside scope

- WHEN image-path observation succeeds and proves the executable is outside the managed POS root
- THEN discovery SHALL skip the process without termination or failure

### Requirement: End-to-end completion invariant

A durable completed result and exit code 0 SHALL require successful payload verification, known-zero scoped process observation, known-absent canonical registry observation, and successful terminal result persistence. Any unknown or failed gate SHALL remain non-success and retain retry evidence.

#### Scenario: Cleanup gate fails after process cleanup

- WHEN payload deletion, registry deletion, final process scan, or terminal result persistence fails
- THEN the operation SHALL not publish completed and SHALL retain the applicable diagnostic and registration evidence


### Requirement: Single-authority uninstall cleanup

The installer SHALL have one production cleanup implementation. Any legacy uninstall wrapper SHALL delegate to the durable-result lifecycle, and no legacy helper SHALL independently perform process, payload, data, TEMP, or registry cleanup.

#### Scenario: Legacy duplicate cleanup is absent

- **WHEN** the installer source and CLI dispatch are inspected
- **THEN** the cleanup command SHALL dispatch to runUninstallCleanupWithResult, the uninstall wrapper SHALL delegate to uninstallWithResult, and no duplicate runUninstallCleanup implementation SHALL exist

### Requirement: Legacy terminal result recovery

The recovery loader SHALL support the exact schema-version-1 terminal result shape emitted before the final `complete` phase and final observation fields were persisted. It SHALL use that shape only as historical retry evidence, SHALL preserve the serialized record during recovery, and SHALL require a new operation to re-run current cleanup gates.

#### Scenario: Historical completed result precedes a new uninstall

- **WHEN** the result has valid identity, timestamps, mode, `outcome=completed`, `phase=complete`, and the exact ordered phases through `temp_cleanup`, but omits the later `complete` phase and final observation fields
- **THEN** recovery SHALL accept it for retry bookkeeping, normalize only the in-memory phase list, and allow the new official operation to create a fresh pending result

#### Scenario: Incomplete historical terminal result

- **WHEN** a terminal result omits any required phase, contains an unexpected phase, or has invalid identity, timestamps, mode, or error fields
- **THEN** recovery SHALL fail closed and SHALL not rewrite the original result
### Requirement: Precise native process image observation

Native POS discovery SHALL treat a zero-length image-query result as an observation failure even when the native wrapper reports success. It MAY exclude a process without Win32 path normalization only when a native image path is positively proven to reside on a different device from the managed POS root using the root drive's verified DOS-device mapping. Same-device, unmapped, ambiguous, malformed, inaccessible, or incomplete observations SHALL remain unknown and SHALL block cleanup completion. Revalidation before termination SHALL use the same managed-root proof.

#### Scenario: Native API reports false success

- **WHEN** `GetProcessImageFileNameW` returns zero characters and `GetLastError` is `ERROR_SUCCESS`
- **THEN** discovery SHALL record an observation failure and SHALL not report known-zero scoped processes

#### Scenario: Different native device is proven outside scope

- **WHEN** native image observation returns an absolute device path whose device prefix differs from the verified device mapping of the managed POS root
- **THEN** discovery MAY exclude the process as positively outside scope without using PID, owner, or basename, while all other candidates remain subject to complete observation

#### Scenario: Root mapping or native path is ambiguous

- **WHEN** the native path cannot be mapped or compared to the managed root device with authoritative Windows metadata
- **THEN** discovery SHALL return an observation error and SHALL not permit payload or registry cleanup


### Requirement: Positive POS Job Object ownership

Supported POS launch paths SHALL create an installation-scoped Windows Job Object, launch the exact managed POS executable with \`CREATE_SUSPENDED\`, assign it before resume, and prevent process breakaway. Installed POS shortcuts SHALL invoke the controlled launcher and SHALL not target the raw POS executable directly.

#### Scenario: Controlled POS launch

- **WHEN** the supported UI or installed shortcut launches POS
- **THEN** the launcher SHALL create or open the installation-scoped Job Object, assign the suspended POS process before resume, and return failure without leaving an unmanaged child if assignment or resume fails

#### Scenario: Child containment and unrelated exclusion

- **WHEN** POS creates Electron-like child processes and an unrelated Electron-like process exists outside the Job Object
- **THEN** the POS children SHALL be Job Object members and cleanup SHALL never select the unrelated process

#### Scenario: Positive membership cleanup

- **WHEN** the Job Object is available during uninstall
- **THEN** cleanup SHALL enumerate Job Object members, revalidate PID/start identity and managed-root scope, and perform bounded termination only for verified members

#### Scenario: Unknown ownership

- **WHEN** the Job Object is missing, inaccessible, stale, nested, or cannot be enumerated
- **THEN** cleanup SHALL not infer zero POS processes, SHALL retain retry evidence, and SHALL publish a non-success \`legacy_unowned_scope\` or ownership-observation result

#### Scenario: Restart and crash

- **WHEN** Windows restarts or the launcher exits unexpectedly
- **THEN** the system SHALL not claim that historical processes are Job Object-owned; recovery SHALL require a fresh launcher/job or explicit legacy-safe operator handling

### Requirement: Secure ownership and launch boundaries

The installation-scoped Job Object SHALL use a secure ACL limited to the supported POS launcher and official cleanup helper. Interactive users SHALL launch POS only through the controlled launcher, and elevated uninstall SHALL use the helper's minimum required Job Object rights. Raw `Manus POS.exe` execution, raw POS shortcuts, and direct CLI dispatch SHALL not be treated as owned launch paths.

Deterministic tests MAY inject the Job Object security boundary to prove allowed, denied, and ambiguous membership control flow. Such tests SHALL be reported as authorization-boundary evidence, not as proof of real cross-account ACL behavior. Real cross-account ACL authorization SHALL require an isolated Windows VM with disposable accounts and SHALL remain BLOCKED when that environment is unavailable.

#### Scenario: Ownership ACL boundary

- **WHEN** an unsupported caller or unrelated account attempts to create, open, assign, or terminate through the installation-scoped Job Object
- **THEN** access SHALL be denied or remain outside the supported contract, and cleanup SHALL fail closed without broadening ACLs or touching unrelated processes

#### Scenario: Assignment and nested-job failure

- **WHEN** `AssignProcessToJobObject` or `ResumeThread` fails, or the current process is already in a job that rejects nesting
- **THEN** the launcher SHALL terminate only the newly-created process, close all owned handles, and return failure without leaving an unmanaged POS child

#### Scenario: Inaccessible or ambiguous membership

- **WHEN** Job Object membership cannot be queried, the membership handle is inaccessible, or a member cannot be revalidated with current PID/start identity and managed-root proof
- **THEN** cleanup SHALL fail closed, SHALL not terminate or delete payloads, and SHALL retain a non-success durable result

#### Scenario: Raw executable bypass

- **WHEN** a shortcut or CLI path targets the raw POS executable instead of the controlled launcher
- **THEN** dispatch SHALL reject or route through the launcher, and any legacy process found without positive Job Object ownership SHALL remain `legacy_unowned_scope` evidence rather than known clean scope

#### Scenario: Direct raw executable execution

- **WHEN** a standard Windows user starts the packaged `Manus POS.exe` directly outside the supported shortcut, CLI, or installer UI paths
- **THEN** the platform SHALL treat that process as unsupported and unowned; cleanup SHALL not infer supervisor authorization from its PID, command line, environment, or journal, and SHALL retain fail-closed `legacy_unowned_scope` behavior when positive Job Object ownership is unavailable

The current architecture does not claim OS-wide prevention of direct execution. Enforcing that boundary requires a separately approved OS-backed supervisor handshake or packaging/ACL design; spoofable environment or command-line markers are insufficient.

### Requirement: Durable legacy ownership and historical recovery

`legacy_unowned_scope` SHALL be serialized as the sanitized `reasonCode` while `outcome` remains `partial` and `phase` remains the last durable lifecycle phase. The record SHALL preserve `operationId`, `retryCount`, original error evidence, remaining roots, payload, and uninstall registration; the reason SHALL never permit process termination, payload deletion, registry deletion, or a completed result.

When Job Object ownership is missing, inaccessible, stale, nested, or cannot be enumerated, cleanup SHALL persist a sanitized non-success result with outcome `legacy_unowned_scope`, preserve uninstall registration, and block payload and registry deletion. Historical QA recovery records SHALL remain immutable evidence; recovery SHALL not rewrite an unowned process set as owned, completed, or clean.

#### Scenario: Unavailable ownership observation

- **WHEN** Job Object creation/open, membership enumeration, member identity, or final ownership observation is unavailable
- **THEN** cleanup SHALL retain retry evidence, report `legacy_unowned_scope` or another non-success ownership observation, and SHALL not claim zero processes or exit code `0`

#### Scenario: Historical QA recovery restriction

- **WHEN** a historical result describes a legacy or partial process set without positive Job Object ownership
- **THEN** recovery SHALL preserve the serialized record, SHALL not upgrade it to completed ownership, and SHALL defer BUILD08/live recovery until disposable ownership tests pass

### Requirement: Disposable ownership acceptance

Windows integration coverage SHALL use uniquely named TEMP roots and copied executables only. It SHALL cover managed parent/children, unrelated Electron-like processes, graceful exit, bounded shutdown, launcher crash, restart limitations, nested-job rejection, exact-handle cleanup, and shortcut/CLI dispatch. The fixture SHALL abort before mutation when scope cannot be proven.

#### Scenario: Safe disposable integration

- **WHEN** the TEMP fixture runs ownership and cleanup cases
- **THEN** it SHALL avoid installed MANUS paths, live services, real registry keys, protected POS assets, and unrelated processes, and SHALL prove the managed parent/children are the only selected members

### Requirement: Supervisor lifetime and reboot recovery boundary

The lifecycle SHALL distinguish live kernel-backed Job Object membership from durable historical evidence. The controlled launcher SHALL hand off POS to an independent `pos-supervisor` mode that retains the Job handle until POS exit and atomically writes a minimal ownership journal. The journal SHALL not prove that a PID or Job Object survives supervisor crash, user logoff, Windows reboot, stale session, or boot-identity change, and SHALL never authorize adoption or termination.

#### Scenario: Job Object disappears or boot identity changes

- **WHEN** the named Job Object is absent, the launcher/supervisor disappears, the user session is stale, or the boot identity differs from recorded evidence
- **THEN** the lifecycle SHALL retain non-success evidence and require a fresh controlled launch or explicit operator handling; it SHALL not infer current ownership from a persisted PID, path, or journal

#### Scenario: Graceful close and restart

- **WHEN** a controlled POS process exits normally and a later launcher starts again
- **THEN** the new launch SHALL create or validate its own current Job Object membership and SHALL not adopt unrelated or historical processes

#### Scenario: Supervisor handoff and graceful exit

- **WHEN** the controlled launcher starts POS
- **THEN** the independent supervisor SHALL publish an atomic active journal only after suspended launch, Job assignment, and resume succeed, SHALL retain the Job handle while POS runs, and SHALL publish `exited` only after POS exits and owned handles close

#### Scenario: Supervisor crash and bounded restart

- **WHEN** the supervisor disappears or a later supervisor starts with an active, stale, corrupt, session-mismatched, or boot-mismatched journal
- **THEN** the new supervisor SHALL refuse adoption and SHALL not terminate, relaunch, or scan based on journal identity; cleanup SHALL use live Job membership and preserve non-success evidence when ownership cannot be proven
