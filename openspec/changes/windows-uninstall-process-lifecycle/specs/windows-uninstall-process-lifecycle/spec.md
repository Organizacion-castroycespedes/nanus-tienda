## Purpose

This capability defines a reliable Windows uninstall lifecycle that never reports final success while cleanup is only scheduled, safely handles changing POS process state, and preserves contracted local configuration.

## Baseline and evidence status

HU-WIN-001B recovers this change from b6b4971572790dfad520aadfcc6e2245e8fdea9d against develop 6a26df541e00703e1fffb02ea73afb36c628fee2. These requirements describe the target contract, not implemented baseline behavior. No executable implementation is restored. Historical JSON and QA-05 remain immutable. VM, hardware and runtime certification remain incomplete. Document validation and CLI artifact readiness do not authorize implementation or live QA.

## ADDED Requirements

### Requirement: Scoped POS process cleanup

The uninstall flow SHALL terminate only processes with positively verified current ownership and an executable image inside the managed POS installation root. Before termination, it SHALL revalidate the process identity and executable path so a vanished or reused PID cannot cause an unrelated process to be terminated.

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
- **THEN** the helper SHALL publish the matching durable completed result and return success; an already-exited parent SHALL retain its code-2 handoff meaning and SHALL NOT be reinterpreted as synchronous code-0 completion

#### Scenario: Helper fails after the parent exits

- **WHEN** the external cleanup operation fails after the original installer process has exited
- **THEN** the lifecycle result SHALL record the failure durably and the official uninstall contract SHALL not present the operation as final success

#### Scenario: Helper crashes or times out

- **WHEN** the cleanup supervisor or helper exits unexpectedly or exceeds its bounded completion window
- **THEN** the uninstall result SHALL be non-success, SHALL retain enough registration or evidence for a safe retry, and SHALL identify the incomplete phase without claiming atomic rollback

### Requirement: Ordered payload and registration cleanup

Standard uninstall SHALL stop/remove service integration, safely close scoped POS processes, remove POS/Agent payloads and Manus-created shortcuts, and remove uninstall registration only after payload gates succeed. Protected ProgramData/LocalService data SHALL be preserved. Only an explicit --remove-data operation SHALL delete contracted managed data.

#### Scenario: Retained data and new evidence

- **WHEN** standard uninstall writes operation-specific lifecycle evidence or log entries
- **THEN** it SHALL distinguish them from retained configuration, device registry, enrollment and operational identity; existing protected bytes and ACLs SHALL stay unchanged and preexisting historical QA records SHALL remain immutable

#### Scenario: Standard uninstall completes

- **WHEN** service absence, process absence, payload deletion, shortcut cleanup, and final path checks all succeed
- **THEN** the flow SHALL remove uninstall registration and leave protected ProgramData and LocalService data bytes and ACLs unchanged, with new lifecycle evidence identified separately

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

The cleanup helper SHALL accept only a valid pending result for its own correlated operation and SHALL reject corrupt, incomplete, terminal or operation-mismatched input. A new retry SHALL NOT supersede another live/fresh pending operation. Historical evidence SHALL be preserved before any new operation replaces its current-result slot. A missing result is valid only for pre-operation creation.

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

Native POS discovery SHALL reject zero-length image-query results and require authoritative managed-root proof. Same-device, unmapped, ambiguous, malformed, inaccessible or incomplete fallback observations SHALL remain unknown and block completion. Revalidation before termination SHALL use the same proof.

#### Scenario: Exclusion without Win32 normalization

- **WHEN** a native image path cannot be normalized to a Win32 path
- **THEN** discovery MAY exclude it only when the root drive's verified DOS-device mapping positively proves the image resides on a different device

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

Supported POS launch paths SHALL create an installation-scoped Windows Job Object with an explicit minimum-rights DACL, launch the exact managed POS executable with `CREATE_SUSPENDED`, assign the returned process handle before resume, and prevent process breakaway. Installed POS shortcuts SHALL invoke the controlled launcher and SHALL not target the raw POS executable directly.

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
- **THEN** cleanup SHALL not infer zero POS processes, SHALL retain retry evidence, and SHALL publish a non-success `legacy_unowned_scope` or ownership-observation result

#### Scenario: Preexisting named Job cannot be trusted

- **WHEN** creation encounters a named object that already exists and its type, owner or exact DACL cannot be proved to match the protected installation and supported session
- **THEN** launch and cleanup SHALL fail closed and SHALL NOT assign, adopt, enumerate for authority or broaden the object's permissions

#### Scenario: Membership is revalidated for termination

- **WHEN** a live trusted Job reports a member selected for cleanup
- **THEN** cleanup SHALL retain its query handle, verify creation identity and image/root, acquire destructive rights only for that candidate, repeat identity and membership proof on the final handle, and SHALL terminate only when every observation matches

#### Scenario: Restart and crash

- **WHEN** Windows restarts or the launcher exits unexpectedly
- **THEN** the system SHALL not claim that historical processes are Job Object-owned; recovery SHALL require a fresh launcher/job or explicit legacy-safe operator handling

### Requirement: Secure ownership and launch boundaries

The installation-scoped Job Object SHALL use a secure ACL for the supported launcher and official helper with minimum required rights. Supported interactive launch SHALL use the controlled launcher. Raw POS execution, shortcuts and CLI bypass SHALL NOT establish ownership.

#### Scenario: Injected security evidence and real account acceptance

- **WHEN** deterministic tests inject allowed, denied or ambiguous Job membership observations
- **THEN** they SHALL be reported only as authorization-boundary control-flow evidence; real cross-account ACL acceptance SHALL require an isolated Windows VM with disposable accounts and SHALL remain BLOCKED without that environment

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

Neither the current develop baseline nor the historical candidate demonstrates OS-wide prevention of direct execution. Enforcing that boundary requires a separately approved OS-backed supervisor handshake or packaging/ACL design; spoofable environment or command-line markers are insufficient.

### Requirement: Durable legacy ownership and historical recovery

`legacy_unowned_scope` SHALL be serialized as reasonCode with outcome=partial and the last durable phase. The record SHALL preserve operationId, retryCount, original error evidence and remaining roots. This reason SHALL NOT authorize termination, payload/registry deletion or completion.

#### Scenario: Unavailable ownership preserves correlated partial state

- **WHEN** ownership is missing, inaccessible, stale, nested or cannot be enumerated
- **THEN** cleanup SHALL persist outcome=partial with reasonCode=legacy_unowned_scope, preserve payload and registration, and SHALL NOT rewrite historical unowned/partial evidence as owned, completed or clean

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

#### Scenario: Electron single-instance target already exists

- **WHEN** a controlled launch reaches an existing Electron instance instead of retaining the newly created primary process
- **THEN** launch SHALL report managed success only if that existing instance is currently proved inside the same trusted Job; otherwise it SHALL report `legacy_unowned_scope` and SHALL not adopt or terminate it

#### Scenario: Journal location and authority

- **WHEN** the supervisor writes lifecycle state for a standard user
- **THEN** it SHALL use a dedicated Known-Folder-derived per-user location with an explicit user/SYSTEM/Administrators DACL, SHALL not require write access to LocalService Agent state, and the record SHALL remain non-authoritative

### Requirement: Trusted helper roots and mutation boundaries

The elevated lifecycle SHALL derive permitted roots and helper/result/TEMP destinations independently from Windows Known Folders and verified installed-layout identity. It SHALL bind them to the operation, mode and parent start identity, then revalidate handle-observed identity and reparse boundaries immediately before mutation. Caller-controlled strings SHALL NOT authorize deletion.

#### Scenario: Root or result substitution

- **WHEN** helper roots, operation metadata, result or TEMP destinations differ from the validated installation or an effective path cannot be proved
- **THEN** cleanup SHALL stop before termination/deletion, preserve evidence and SHALL NOT broaden ownership or ACL permissions

#### Scenario: Isolated root-identity seam

- **WHEN** root identity is implemented before uninstall wiring
- **THEN** it SHALL only derive trusted anchors, observe effective path/file/reparse identity through injectable Windows API boundaries and compare retained observations; it SHALL NOT delete, change ACLs, launch helpers or treat a string path as authority

#### Scenario: Root observation API is unavailable

- **WHEN** a required Known Folder, directory handle, final-path, file-identity or reparse observation is unsupported, denied, truncated or ambiguous
- **THEN** the seam SHALL return unknown/failure, close every acquired handle exactly once and SHALL NOT synthesize a trusted identity from lexical normalization

#### Scenario: Unexpected reparse point or ancestor identity change

- **WHEN** any root ancestor is a junction, symlink, mount point or other reparse point outside the one explicitly approved installed-layout junction, or its handle-observed volume/file identity changes between preflight and mutation
- **THEN** cleanup SHALL stop before deletion, retain payload and registration, and record a non-success root-observation result

#### Scenario: Recursive deletion cannot retain proof

- **WHEN** the selected recursive deletion mechanism cannot prove no-follow traversal and object identity for the target descendants, or a race invalidates a retained observation
- **THEN** cleanup SHALL fail closed and SHALL NOT claim complete TOCTOU protection or invoke a path-only recursive deletion primitive

### Requirement: Isolated parent-handle managed-tree observation

The first managed-tree seam SHALL observe and revalidate children relative to retained parent handles. It SHALL NOT expose file disposition, delete-on-close, recursive deletion or production uninstall wiring.

#### Scenario: Child is opened relative to its verified parent

- **WHEN** the seam observes a child of a retained directory handle
- **THEN** it SHALL validate a single child-name component and call `NtCreateFile` with `OBJECT_ATTRIBUTES.RootDirectory`, `OBJ_DONT_REPARSE`, `FILE_OPEN_REPARSE_POINT`, `FILE_OPEN`, exact object-type options, minimum observation access and no `DELETE` right

#### Scenario: Opened child identity disagrees with enumeration

- **WHEN** the opened child handle reports a different volume, File ID, object type or reparse state than the enumerated candidate, or enumeration ends incompletely
- **THEN** observation SHALL remain unknown/failure, every acquired handle SHALL close exactly once and no destructive operation SHALL be available

#### Scenario: Native behavior is not proved

- **WHEN** `GetVolumeInformationByHandle` on the retained root does not report exact local `NTFS`, a required option/API is unavailable, access is denied, a reparse point is encountered or share/lock behavior is ambiguous
- **THEN** the seam SHALL fail closed and SHALL NOT fall back to path traversal or claim TOCTOU, junction or filesystem safety

#### Scenario: Junction is outside the explicit layout contract

- **WHEN** a child is a junction, symlink, mount point or other reparse point, including an external or substituted `current` entry
- **THEN** the first seam SHALL reject it without following or unlinking it; an exact `current` exception requires separate native evidence and authorization

### Requirement: Separate confined-disposition capability and authorization

The lifecycle SHALL preserve the existing observation-only API. Any future disposition capability SHALL require explicit operation-bound authorization and retained parent/candidate identities; observation, paths, File IDs or journals alone SHALL NOT grant mutation authority. Initial scope SHALL be one regular fixture child file with the root retained, without production wiring.

#### Scenario: Observation is offered as deletion authority

- **WHEN** a caller supplies only an observation result, CLI path, recorded identity, stale operation or journal entry
- **THEN** preparation SHALL fail before acquiring DELETE access and SHALL NOT expand the observation interface or adopt a replacement object

#### Scenario: Authorized candidate transitions to a final handle

- **WHEN** the separately authorized capability prepares an exact candidate
- **THEN** it SHALL retain the candidate guard, open one child-name component relative to the verified live parent, compare volume/File ID/type/attributes/tag across both handles, revalidate ancestors and reject incomplete or mismatched evidence before any disposition

#### Scenario: Sharing and namespace guarantees are unproved

- **WHEN** the proposed guard share 7 and final share 1 transition has not passed native namespace, existing-DELETE, parent delete-child and identity-reuse probes
- **THEN** mutation SHALL remain disabled; attribute-only handles and successful observation SHALL NOT be treated as proven rename/deletion guards, and no path-based fallback SHALL be used

### Requirement: Same-handle disposition and conservative traversal

Future authorized disposition SHALL use the final validated handle with minimum DELETE rights and a separately tested Win32 FileDispositionInfo BOOLEAN contract. It SHALL reject every reparse point, including current, without following or unlinking it. It SHALL NOT use POSIX disposition, read-only override, delete-on-close, rename, path recursion or ACL/privilege bypass.

#### Scenario: A native open succeeds on a reparse object

- **WHEN** combined OBJ_DONT_REPARSE and FILE_OPEN_REPARSE_POINT return success for a symlink, junction or mount point
- **THEN** opened-handle metadata SHALL still reject the object; successful open SHALL NOT authorize traversal or disposition

#### Scenario: Disposition is prepared for an ordinary file

- **WHEN** all authorization, identity and native preparation gates pass
- **THEN** the final file handle SHALL request exactly DELETE plus FILE_READ_ATTRIBUTES, use the approved restrictive share mode, recheck link count/delete-pending and reject observed hard links, read-only state, denial, locks or uncertainty without relaxing rights or sharing

#### Scenario: A mark is accepted but closure or removal is unknown

- **WHEN** SetFileInformationByHandle accepts a disposition request
- **THEN** the target SHALL receive no further I/O except exact-once close, primary and close errors SHALL both survive, and completion SHALL depend on a later known parent-relative absence observation rather than API acceptance

#### Scenario: Directory traversal is approved in a later checkpoint

- **WHEN** a future scope explicitly enables bottom-up directory disposition
- **THEN** it SHALL require complete bounded enumeration, independently authorized children, retained verified parents, closed children and a final known empty-directory observation; new entries, replaced identities or any reparse SHALL stop work without expanding scope or deleting the root

### Requirement: Bounded fixture disposition and truthful postconditions

Destructive QA SHALL require a new disposable operation-bound fixture, explicit per-run authorization and external controlled sentinel. Results SHALL distinguish marked from verified absent and SHALL NOT claim atomic tree removal, secure erasure or complete TOCTOU immunity. Any uncertainty SHALL stop further mutation and preserve evidence; journals SHALL remain non-authoritative.

#### Scenario: Fixture or operation confinement is uncertain

- **WHEN** NTFS, initiating token, owner/DACL, ancestor identity, exact targets or sentinel identity cannot be proved, or a target includes MANUS, another profile, the repository or a historical fixture
- **THEN** preparation SHALL fail without mutation, elevation, ACL repair or automatic cleanup

#### Scenario: Partial removal or timeout occurs

- **WHEN** an authorized target was marked/removed and another target, close, final scan or sentinel check is failed/unknown
- **THEN** the result SHALL remain non-completed with confirmed and unknown counts, stop further mutation and preserve the fixture; expired budgets SHALL produce timed_out rather than trigger an unbounded retry or replay a journal

#### Scenario: Scoped fixture completion is observed

- **WHEN** every explicitly authorized target is known absent after handle closure, parent/ancestor identities match, enumeration is complete and the external sentinel is unchanged
- **THEN** only that fixture scope MAY be completed; an already-absent target requires known parent-relative absence, and no product-uninstall, root-removal, VM or hardware certification SHALL be inferred

#### Scenario: Synchronous API call exceeds the controller budget

- **WHEN** a call blocks or returns pending/uncertain after a soft deadline
- **THEN** the controller SHALL stop scheduling mutations and SHALL NOT claim the deadline cancelled kernel I/O; hard cancellation requires a separately approved runner contract

### Requirement: Isolated namespace concurrency probes before disposition

Future B1-B5 probes SHALL use separately authorized actors, fresh protected fixtures, explicit barriers and exact parent/name/object bindings. They SHALL remain isolated from observation APIs, simulated disposition and product callers. Every production disposition prohibition SHALL remain unchanged. This documentary checkpoint SHALL NOT authorize implementation or native mutation.

#### Scenario: Historical observation is presented as namespace exclusion

- **WHEN** R3 sharing, ROOT-05C-A NumberOfLinks=1/DeletePending=false, matching live File IDs or a successful final-path query is offered as proof that an exact name stayed bound
- **THEN** the controller SHALL retain NO-GO for disposition until the parent/name/object binding and exclusion interval have separately demonstrated coverage; handles and metadata alone SHALL NOT create authority or permit adoption of a new occupant

#### Scenario: Link and rename actor APIs are selected

- **WHEN** a future test prepares a native link or rename actor
- **THEN** it SHALL verify ABI, class family, rights, retained source/destination identities and completion/buffer lifetime before mutation; classic NT link class 11 SHALL NOT be confused with the installed module's FileLinkInformation value 72 or with Win32 rename class 3, and no Ex/POSIX/replace-existing fallback SHALL be used

#### Scenario: B1 creates a controlled alias

- **WHEN** a separately authorized actor adds one unused hard-link name under its approved live fixture parent or separately approved same-volume peer
- **THEN** complete scans and opened-handle metadata SHALL demonstrate the expected extra entry, shared object identity/security/hash and increased link count; any multi-link preparation SHALL be rejected, sentinel/historical objects SHALL be excluded, and path-based CreateHardLink SHALL NOT be used without independent confinement proof

#### Scenario: B2 renames the original and creates a decoy

- **WHEN** barriers release the actor to rename an owned source to an unused controlled name with ReplaceIfExists=false and then create-new a distinct decoy at the former name
- **THEN** the observer SHALL distinguish the retained original object from the fresh name's different ID, invalidate original entry authorization, preserve all resulting objects and report partial/unknown if either step or its postconditions is uncertain; name absence alone SHALL NOT become completed

#### Scenario: B3 evaluates child, parent and ancestor guards

- **WHEN** actor-before-guard and guard-before-actor schedules test attributes-only, read-data/list-directory and DELETE-bearing guards, preexisting actor handles or a dedicated parent FILE_DELETE_CHILD variant
- **THEN** each schedule SHALL include a separate capable positive control, record open-stage versus mutation-stage errors and exact masks, and retain disposition NO-GO if a protected entry/ancestor can change; no guard SHALL be released and retried to manufacture exclusion, and directory DELETE SHALL require its own scratch-only authorization

#### Scenario: B4 inserts a link after the observation barrier

- **WHEN** a fresh count=1 observation precedes an explicitly synchronized alias creation before revalidation or after the last check
- **THEN** the controller SHALL detect the observable mismatch or document the exposed interval without mutation authority; an allowed late relink SHALL keep disposition NO-GO even if the diagnostic itself passes, and aliases SHALL NOT be deleted to reset a test

#### Scenario: B5 measures contention

- **WHEN** separately approved readers, writers or read-only mappings are held in both open orders
- **THEN** the probe SHALL record conflicts, identities, exact lifetimes and post-close recovery without content writes, writable mappings or disposition; mapping/lock behavior SHALL NOT substitute for namespace ownership and unavailable rights/API coverage SHALL remain blocked or not-run

#### Scenario: Fixture protection or actor synchronization is incomplete

- **WHEN** an operation lacks the approved fresh SID-bound objects, exact protected owner/DACL, NTFS/volume/ancestor proof, explicit barriers or complete initial/final enumeration and sentinel evidence
- **THEN** no actor mutation SHALL start; all directories SHALL have their approved SECURITY_ATTRIBUTES descriptor at CreateDirectoryW creation, old fixtures/other users/administrators SHALL NOT receive rights, and uncertain status, deadlines or close failures SHALL stop scheduling without ACL repair, rollback assumptions or automatic cleanup

#### Scenario: Diagnostic results and disposition decisions differ

- **WHEN** an authorized experiment confirms an insecure guard, fails preflight, has uncertain effects or lacks authorization
- **THEN** it SHALL distinguish diagnostic PASS/FAIL, BLOCKED, PARTIAL and NOT_RUN from the independent disposition GO/NO-GO decision; no B result SHALL claim real completed, universal atomicity or product-uninstall certification, and all existing disposition/VM/security gates SHALL remain required

### Requirement: Initiating-user and uninstall-operation identity

The lifecycle SHALL distinguish machine Known Folders from per-user `LocalAppData` and bind elevation to the initiating token's SID, session and logon LUID through an authenticated handoff and protected operation record. CLI, PID, path, environment, registry or journal data SHALL NOT independently authorize roots, user data or mutation.

#### Scenario: Elevation changes or obscures user identity

- **WHEN** the elevated token has a different SID, the initiating profile cannot be resolved, the account disappeared, the session/logon identity differs or the handoff cannot authenticate its peer
- **THEN** per-user cleanup SHALL remain blocked, user data SHALL be preserved and the result SHALL remain partial/unknown

#### Scenario: SYSTEM or LocalService executes lifecycle work

- **WHEN** the operation runs as SYSTEM or LocalService
- **THEN** that service identity SHALL remain separate and SHALL NOT infer an interactive user's `LocalAppData` or activate `--remove-data` for that user

#### Scenario: Standard, silent or legacy uninstall lacks explicit user-data authority

- **WHEN** uninstall is standard/silent, or a legacy installation lacks a protected SID-bound installation record
- **THEN** all user data SHALL be preserved and no CLI path, journal or current elevated profile SHALL substitute for explicit `--remove-data` authorization

#### Scenario: Helper and result paths are operation-bound

- **WHEN** the helper directory already exists, is outside the independently derived TEMP boundary, has an unexpected DACL/reparse state, or the result path is not derived from protected lifecycle state for the same operation
- **THEN** handoff SHALL fail before helper execution or mutation and SHALL not adopt either path from command-line input

### Requirement: Bounded helper recovery and operation ownership

Parent/helper waits SHALL have bounded observable outcomes. Unknown process access SHALL NOT prove parent exit. Old result timestamps SHALL NOT prove helper death or authorize concurrent retry. Completed cleanup SHALL require terminal observations including TEMP absence.

#### Scenario: Parent or helper liveness is unknown

- **WHEN** identity/access fails, a wait expires or an old pending operation may still have a live helper
- **THEN** the lifecycle SHALL retain non-success evidence and SHALL block destructive continuation or concurrent retry based on elapsed time alone

#### Scenario: Parent process lookup or wait does not prove the expected parent exited

- **WHEN** OpenProcess reports PID-not-found, access denied or another failure; the retained process identity mismatches; or the wait times out, fails or returns an unexpected result
- **THEN** the lifecycle SHALL NOT infer parent exit, SHALL perform no target effect and SHALL remain failed/partial/unknown; only a signaled retained handle bound to the expected parent identity after ACK and within the bounded wait MAY advance the simulated state

#### Scenario: TEMP deletion is scheduled

- **WHEN** an external command is launched but helper/TEMP removal has not been observed
- **THEN** the TEMP phase SHALL remain unverified and SHALL NOT prove completion

### Requirement: Explicit silent-uninstall data policy

Standard and silent uninstall SHALL preserve protected configuration, enrollment, device registry and operational identity bytes and ACLs. QuietUninstallString SHALL NOT imply --remove-data. Destructive removal SHALL require a separate explicit operator request and validated managed roots. Interactive-user Agent/Electron data SHALL NOT be added to cleanup without an approved retention inventory.

#### Scenario: Silent uninstall without a data-removal request

- **WHEN** the registered silent uninstall path is invoked without explicit data-removal authorization
- **THEN** the lifecycle SHALL use standard retention and SHALL NOT activate --remove-data implicitly

### Requirement: Authenticated supervisor handoff and journal permissions

The launcher SHALL bind executable, root, session and journal destinations to the newly launched supervisor and live identities. The Job DACL SHALL grant documented minimum rights only to the exact supported user and elevated system principals. Preexisting Job security SHALL match. Journal, PID, path, name, uptime or ProcessState SHALL NOT establish ownership.

#### Scenario: Journal access or handoff fails

- **WHEN** the standard user cannot persist the approved journal or a record is corrupt, foreign, stale or mismatched to the new supervisor/session/boot
- **THEN** launch SHALL remain non-success, SHALL NOT widen Agent-state ACLs or adopt journal processes, and SHALL follow the approved bounded exact-child recovery policy for any already resumed child

### Requirement: Complete absence beyond Job membership

Job membership SHALL authorize only verified members. Empty membership SHALL NOT prove raw/unowned POS absence. Cleanup SHALL detect or report unknown raw coexistence without gaining termination authority over those processes. Missing ownership after close, crash, logoff or reboot SHALL require separately proved safe idle/recovery state before deletion.

#### Scenario: Raw POS or missing ownership is observed

- **WHEN** a raw process exists or cannot be excluded, or no live ownership Job exists and safe idle has not been proved
- **THEN** cleanup SHALL remain partial/unknown, retain payload/registration and SHALL NOT terminate unowned processes or infer zero from a Job/journal alone

### Requirement: Safe Agent shutdown and child containment

The service lifecycle SHALL specify graceful acknowledgement, outstanding-operation handling, bounded fallback and child containment before clean stop is certified. Fallback SHALL affect only proven owned processes. Node startup before Job assignment SHALL NOT prove all children are contained. Discovery, RAW/GDI, XP-80 feed/cut, drawer pulses and ROCHI/COM protocol behavior SHALL remain outside lifecycle implementation changes.

#### Scenario: Shutdown acknowledgement is missing

- **WHEN** clean shutdown cannot be confirmed within its bounded window
- **THEN** lifecycle SHALL expose incomplete state, use only the approved owned-process fallback and SHALL NOT certify clean COM/operation completion from Process.Kill alone

### Requirement: Electron window-close policy is coordinated with the existing owner

The Electron main process SHALL honor its configured close behavior and allow normal application shutdown to proceed. The lifecycle contract MAY be implemented through the existing `autorizar-balanza-real-pos-peso` owner for `desktop/electron/main.ts`, provided the exact ownership remains unique and the adapter does not claim process-tree ownership or bypass lifecycle gates. This window-close behavior alone SHALL NOT certify child termination, uninstall readiness, or ROOT-05.

#### Scenario: POS window close follows the configured policy

- **WHEN** the user closes the POS window with `quit` or `hide` configured
- **THEN** Electron SHALL respectively enter its normal quit lifecycle or hide the window; already-authorized quit/maintenance closes SHALL pass through, and lifecycle certification SHALL remain separate.

### Requirement: Baseline-specific certification and immutable history

Recovered evidence SHALL remain byte-identical and attributed to its original commit/artifact. Historical checked tasks and CLI artifact readiness SHALL NOT certify current implementation, VM security, hardware or production. Static, automated, TEMP, VM and physical results SHALL be distinguished.

#### Scenario: Historical partial evidence is restored

- **WHEN** QA-terminal-22 or older QA-05 evidence is recovered
- **THEN** recovery SHALL preserve bytes and limitations, keep tasks 12.4/12.5/12.8 open and SHALL NOT upgrade readiness, BUILD08 or hardware results

#### Scenario: Dynamic lifecycle acceptance is authorized later

- **WHEN** installation, first launch, operation, close, crash, timeout, logoff/reboot, supported update, uninstall or reinstall is exercised
- **THEN** each case SHALL have authorization, disposable scope, operator checkpoint, SHA/artifact identity, sanitized observations and snapshot/rollback; unknown scope or identity SHALL stop the case

### Requirement: Operation identity frames and exact mode approval

The lifecycle SHALL apply design section 9 to separate initiating, elevated executor, helper and service identities. A complete primary/effective-thread token frame SHALL include TokenUser SID, AuthenticationId/logon LUID, SessionId, integrity, elevation type/flag, restrictions, impersonation state and token-object/change evidence. Matching SID or an elevated flag SHALL NOT alone authorize an operation.

#### Scenario: Supported consent elevation or an already elevated initiator
- **WHEN** complete evidence proves the same SID/session/logon/epoch, primary non-restricted frames, expected process identities and either an approved linked Limited-to-Full transition or the separately approved already-High path
- **THEN** policy MAY model authorization only after independent installation/root verification and exact plan approval; changed TokenId/group/privilege attributes SHALL require transition evidence rather than byte equality, and observed data, policy assertions and native authority SHALL remain separate under design 9.2

#### Scenario: Another account, session or logon is presented
- **WHEN** SID, SessionId or AuthenticationId differs, credentials switch accounts, or the caller supplies matching SID without the remaining proofs
- **THEN** authorization SHALL be rejected before target effects, per-user data SHALL remain preserved and no privilege expansion or alternate-account retry SHALL occur; equality SHALL remain conservative policy rather than a universal UAC guarantee, and documented linked logon sessions SHALL NOT waive mismatches without separately approved evidence/policy review

#### Scenario: Impersonation, restriction, incomplete or unsupported token is observed
- **WHEN** effective-thread impersonation, restricting SIDs, unsupported integrity/elevation relationship, missing linked-token proof or incomplete frame metadata is observed
- **THEN** the operation SHALL fail closed without treating TokenElevationTypeDefault as administrator proof

#### Scenario: Primary statistics contain non-applicable impersonation metadata
- **WHEN** a token is explicitly observed as TokenPrimary and its statistics are compared within a role or snapshot
- **THEN** the comparator SHALL exclude ImpersonationLevel as a meaningful Primary invariant, compare defined identity/change fields and preserve strict type/completeness checks; it SHALL NOT authorize a token from whole-structure equality or ignore a changed meaningful identity field

#### Scenario: A filtered token has no restricting SIDs
- **WHEN** complete observations report TokenHasRestrictions=1 and restricting SID count=0
- **THEN** filter history, restricting SIDs, impersonation and other restriction/sandbox evidence SHALL remain separate; filtering alone SHALL neither set the model's Restricted flag nor reject or authorize an operation, and zero restricting SIDs SHALL NOT imply a complete unrestricted frame

#### Scenario: A linked token exists without native transition evidence
- **WHEN** a linked-token handle is present but its metadata, relationship to the expected executor or mutual peer binding has not been proved
- **THEN** presence SHALL remain observational evidence only, SHALL NOT issue authority or an accepted handoff, and the I-Linked(I)-E-Linked(E)-H graph SHALL remain unproved native lineage; earlier fake/token-probe PASS results SHALL NOT establish it, and later own-linked-token, inert P2 UAC on dedicated physical QA or optional VM under design 9.8, and mutual-authentication probes SHALL require separate authorization under design 9.7

#### Scenario: Token objects differ across observed roles
- **WHEN** TokenId or ModifiedId differs between an initiator, linked token, executor or helper
- **THEN** values alone SHALL NOT prove a legitimate transition or an attack; native acceptance SHALL require independent role/process/linkage evidence and the approved policy, while the existing incompatible-logon/session rejection SHALL remain enforced

#### Scenario: Profile is missing or a service identity supplies an interactive plan
- **WHEN** a profile/account/hive is unavailable, multiple-session identity is ambiguous, or SYSTEM/LocalService is offered as the interactive initiator
- **THEN** the interactive plan SHALL be rejected; no other LocalAppData SHALL be inferred and service-owned data SHALL require its distinct verified installation/mode authority

#### Scenario: Data removal was not separately approved
- **WHEN** standard/silent mode, a CLI remove-data flag, generic UAC consent or an approval for another digest/profile/target set is presented
- **THEN** protected data SHALL remain preserved; remove-data SHALL require explicit approval bound to the exact installation generation, initiating account, mode and approved targets

### Requirement: Single-use operation claim and honest persistence evidence

Under design 9.3, the lifecycle SHALL bind a 32-byte CSPRNG operation ID to exact intent, installation generation, identities, mode and deadlines. Its production authority SHALL serialize one winner, durably commit the H-bound claim before ACK and persist intent before target effects. Journal or simulated memory/file operations SHALL NOT independently prove native authorization or durability.

#### Scenario: Two actors claim simultaneously
- **WHEN** two claim attempts compete at an explicit test barrier
- **THEN** the modeled atomic transition SHALL grant exactly one claim; an unresolved winner SHALL block the other operation and the rejected attempt SHALL NOT regress or replace the winner

#### Scenario: Duplicate, changed or terminal operation is replayed
- **WHEN** the same operation is repeated, a digest/nonce/helper changes or a terminal claim is presented for execution
- **THEN** a matching duplicate MAY read status only; no replay SHALL create another execution receipt or authorize an uncertain mutation

#### Scenario: Offer, challenge or epoch expires
- **WHEN** the five-minute offer cap, 30-second challenge/ACK cap, expected boot/authority epoch or monotonic-time evidence is violated
- **THEN** the plan SHALL be rejected or remain unresolved without effects; wall-clock age SHALL NOT prove worker death or permit takeover

#### Scenario: Store is only simulated or fails persistence
- **WHEN** claims exist only in a fake in-memory model, or native storage is corrupt, torn, unavailable or lacks verified transactional/durability semantics
- **THEN** no durable or native authority SHALL be issued; models SHALL remain simulation-marked and native mutation SHALL stay blocked

### Requirement: Authenticated helper handoff before lifecycle effects

Under design 9.4, the helper SHALL use create-new protected staging and verified binary identity. Mutual handoff SHALL bind expected retained process identities, approved intent, execution binding and fresh challenges. Service stop/delete SHALL require durable acceptance, exact-parent exit and revalidated authority. PID, pipe name, CLI roots or launch success SHALL NOT suffice.

#### Scenario: The launch receipt is absent or lacks query rights
- **WHEN** candidate ShellExecuteExW with SEE_MASK_NOCLOSEPROCESS returns no hProcess or its retained handle cannot supply the required process/token observation
- **THEN** correlation SHALL remain blocked without authority, privilege expansion or reopening solely by PID/CLI; ShellExecuteW success SHALL NOT substitute for a process receipt

#### Scenario: Process or binary identity is not accredited
- **WHEN** retained-process creation/token evidence changes or executable provenance and launch correlation cannot be proved independently of a textual image path
- **THEN** the executor/helper SHALL remain unaccepted and SHALL NOT issue a claim or acceptance ACK, authorize effects or publish completion from path/image-name equality

#### Scenario: The executor lacks a trusted expectation of the initiator
- **WHEN** E receives an asserted I frame, parent PID, nonce or named-pipe connection without independently proved expected-I binding
- **THEN** bootstrap SHALL remain NOT_PROVEN and native acceptance SHALL be blocked; DACL, MIC, kernel peer PID or token equality alone SHALL NOT substitute for mutual authentication and exact-plan approval

#### Scenario: Parent or peer is spoofed or a PID is reused
- **WHEN** a channel peer cannot be bound to its retained expected process identity, the PID was reused, token/image/start identity differs or another client occupies the channel
- **THEN** acceptance SHALL fail closed without reopening solely by PID or trusting the supplied frame

#### Scenario: Helper binary or staging path is substituted
- **WHEN** exclusive creation, owner/DACL/MIC/ancestor proof, no-reparse observation or verified binary/launch identity fails
- **THEN** no helper execution authority SHALL be granted and no current installed root or permission SHALL be repaired to proceed

#### Scenario: Parent access is denied or its exit is unproved
- **WHEN** OpenProcess is denied, the parent identity is uncertain, wait returns unexpectedly or the 30-second parent-exit budget expires
- **THEN** no service stop/delete SHALL occur; failed SHALL require proved absence of target effects and otherwise the operation SHALL remain partial/unknown

#### Scenario: ACK is lost or a participant crashes
- **WHEN** H commits accepted/pending but E misses the ACK, E/H crashes or connectivity fails before final result
- **THEN** accepted SHALL remain nonterminal and discoverable; no duplicate execution SHALL follow missing ACK, no circular completion wait SHALL be introduced and recovery SHALL reconcile authority/worker identity before further work

#### Scenario: Lifecycle effects occur before a later failure
- **WHEN** service stop/delete or another actual/possible target effect precedes an error or final-result persistence failure
- **THEN** the operation SHALL remain partial with confirmed/unknown effects, retain evidence and SHALL NOT assume rollback or publish completed from cmd.Start, ACK or API acceptance

#### Scenario: Reboot, logout, power loss or a corrupt record interrupts work
- **WHEN** live handles/token/epoch evidence is lost or operation storage cannot prove a consistent state
- **THEN** old offers SHALL NOT resume; current worker inactivity and installed state SHALL be independently reconciled before fresh approval, no uncertain mutation SHALL replay, and terminal history SHALL remain immutable

#### Scenario: Final completion or idempotent no-op is proposed
- **WHEN** all approved targets and retained data have complete current postconditions, no unresolved worker remains and the final correlated result is durably persisted
- **THEN** completed MAY be published; otherwise it SHALL remain non-success, and prior completed history SHALL NOT authorize another operation

### Requirement: Isolated fake-only operation identity implementation gate

The isolated lifecycle-owned operation-identity policy/claim model SHALL remain fake-only under design 9.6, without IPC, helpers, native mutation, persistent authority or product wiring. Policy/peer/storage approval and root/process effects SHALL remain simulated. Separately authorized read-only test-local token observations SHALL follow design 9.7 and SHALL NOT issue native authority. ROOT-05, trusted POS ownership and shared-file ownership SHALL remain independent gates.

#### Scenario: Fake evidence satisfies the policy
- **WHEN** deterministic fake frames, plan approval, peer proof, clock/entropy and exclusive claim transitions satisfy every modeled precondition
- **THEN** only a simulation-marked decision SHALL result; it SHALL NOT constitute native authorization, durable consumption, real completed or certification of Windows UAC/IPC

#### Scenario: Failure or concurrent schedule is injected
- **WHEN** any frame/binding field, profile, approval, peer, helper, expiry, claim revision or crash/ACK/result boundary is invalidated
- **THEN** tests SHALL demonstrate fail-closed transitions, no premature service action, no false completed and exact-once simulated closure retaining primary/secondary errors

#### Scenario: Product integration is requested
- **WHEN** implementation needs shared entrypoints, native IPC/persistence, elevation, helper creation, retention changes, Job/supervisor or deletion
- **THEN** separate ownership/authorization and native/VM evidence SHALL be required; 12.4/12.5/12.8 and uncertified implementation/QA tasks SHALL remain open

### Requirement: Independent inert P2 observer with physical QA alternative

The P2 observer SHALL follow design 9.8 on an explicitly approved dedicated physical QA host or optional isolated VM. This alternative SHALL NOT waive product, destructive or cross-account acceptance gates. Preparation, native consented observation and mutual bootstrap SHALL remain separately authorized checkpoints.

#### Scenario: Dedicated physical QA has unverified dependencies
- **WHEN** installed MANUS/data, PostgreSQL listeners, unclassified DB references, denied LocalService access or unproved backups/restoration are present
- **THEN** dedication SHALL NOT certify isolation; the inert observer SHALL have no application/config/DB/network/device/service dependency or effect, and native execution SHALL remain NO-GO pending risk-specific isolation, consent and recovery review without accessing denied data or secrets

#### Scenario: The independent package is not yet reserved
- **WHEN** the proposed qa-uac-observer/main_windows.go and main_windows_test.go paths under backend-perifericos/windows-installer are absent and unmapped, and the manifest is owned by another change
- **THEN** reservation and implementation SHALL remain blocked until a separately authorized governance-owner checkpoint establishes exact unique lifecycle associations; no manifest transfer, duplicate ownership, wildcard or exemption SHALL bypass the gate

#### Scenario: Harness preparation is proposed before native consent
- **WHEN** P2-HARNESS-PREP is separately authorized after ownership readiness
- **THEN** source/pure tests and approved non-elevated validation SHALL remain independent of installer code, with only justified standard-library/minimal Windows dependencies, no product imports or arbitrary commands, and no UAC/default launch, IPC, helper, claims, service, DB, device, .env or deletion capability

#### Scenario: An artifact or launch receipt cannot be accredited
- **WHEN** the fixed source/SHA, controlled QA directory/ancestors, binary/provenance, returned hProcess rights, creation or token observation is missing or uncertain
- **THEN** P2 SHALL stop without elevated fallback, PID/CLI reopening or path-only binary authority; PROCESS_QUERY_LIMITED_INFORMATION, TOKEN_QUERY and SYNCHRONIZE SHALL be verified separately for their uses, and the observer SHALL NOT issue real completed or a claim

#### Scenario: A shell launch or wait has an ambiguous outcome
- **WHEN** reviewed ShellExecuteExW returns BOOL failure, absent hProcess, an unreadable receipt, early exit or timeout
- **THEN** phase/error and UNKNOWN/PARTIAL evidence SHALL be preserved as applicable; all owned handles SHALL close exactly once with primary/close errors retained, and no automatic kill, restart, reboot or assumed rollback SHALL occur

#### Scenario: Native approval or recovery evidence is absent
- **WHEN** an operator has not separately approved P2-NATIVE with an audited artifact, authorized account, manual consent and sufficient risk-specific recovery instructions
- **THEN** no UAC SHALL execute; tests with system/data effects SHALL additionally require verified applicable backups and restoration evidence, and physical-host recovery SHALL NOT be inferred from dedication or backup existence

#### Scenario: Observed linked-token relations are reused as authority
- **WHEN** historical P1-R6 SAME SID/SessionId and DIFFERENT AuthenticationId/TokenId/ModifiedId relations or a future I-to-E receipt are offered as authentication
- **THEN** those observations SHALL NOT relax policy, prove an elevated Primary executor or authenticate E-to-I bootstrap; P3, exact intent/remove-data approval, durable claims and productive handoff SHALL remain independently blocked

#### Scenario: Future observer tests are accepted
- **WHEN** pure ABI/Unicode/lifetime/canary, process-token-wait rights, receipt/error/timeout, close-once, artifact/preflight and no-opt-in tests pass
- **THEN** only preparation evidence SHALL be accepted; no synthetic test SHALL certify native UAC, and 12.4/12.5/12.8 and all 71 pending tasks SHALL remain open until their own complete evidence exists

### Requirement: Exact-pair A-to-B update admission
The installer SHALL admit an A-to-B update only for an exact allowlisted source/target pair under design 5.2. Every unlisted transition, reused version label with different bytes or incomplete/changed evidence SHALL remain rejected under P0-B.

#### Scenario: Unsupported or ambiguous transition is offered
- **WHEN** the installed and candidate versions are not an allowlisted pair, a POS or Agent version label is reused with different bytes, or any required observation is incomplete or changes
- **THEN** admission SHALL return `UNKNOWN` or `PARTIAL` with zero target effects and SHALL NOT reinterpret the case as fresh install or repair

#### Scenario: Pure policy phase completes
- **WHEN** 14.4a deterministic tests pass
- **THEN** only policy evidence SHALL be recorded; no native call, host effect or real installation SHALL be admitted by that evidence

### Requirement: Update preserves protected state and source payloads
An admitted UPDATE SHALL preserve the LocalService installation ID, device registry, DPAPI secret blobs, Agent config and enrollment trust, service account, managed-root ACL baseline and the source Agent and POS payloads.

#### Scenario: Protected state is handled during update
- **WHEN** an admitted UPDATE runs
- **THEN** it SHALL verify protected state by digest and presence without logging contents, SHALL NOT write, copy or re-protect it, and SHALL stop with `PARTIAL` on any change

### Requirement: Update rollback is verified, not assumed
The UPDATE executor SHALL report rollback success only after re-verifying source health, installation ID, protected state, ACLs and retained payloads, and SHALL otherwise record `PARTIAL`.

#### Scenario: Native executor encounters a fault
- **WHEN** an injected locked payload, stop timeout, unreleased port, interrupted activation, start failure, health version or installation-ID mismatch, protected-state digest change or ACL drift occurs in 14.4b tests
- **THEN** the executor SHALL NOT report success or complete with mixed Agent/POS versions, SHALL NOT delete or overwrite the source payloads, SHALL NOT invoke the REPAIR/FRESH POS rollback, and SHALL record rollback PASS only after source health, installation ID, protected digests, ACLs and retained payloads are re-verified, otherwise `PARTIAL`

### Requirement: Update certification precedes any real host
Real-host UPDATE SHALL require passing 14.4c VM certification plus a separate explicit operator approval.

#### Scenario: Real-host acceptance is requested
- **WHEN** 14.4a and 14.4b pass but 14.4c has not passed on a disposable VM with distinct hash-pinned POS identities, recorded artifact hashes and a real verified rollback
- **THEN** no update SHALL run on the installed QA host or any physical deployment, and passing 14.4c SHALL still require a separate explicit operator approval for any live host
