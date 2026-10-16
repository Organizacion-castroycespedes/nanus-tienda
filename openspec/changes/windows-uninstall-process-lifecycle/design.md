## Context

The current Windows installer stops and deletes the service in the invoking process, then copies itself to TEMP and launches an external cleanup helper because the installed executable cannot safely remove its own Program Files tree. The invoking process returns `nil` immediately after `cmd.Start()`. The helper later performs POS process discovery, payload deletion, data policy, registry deletion, and TEMP cleanup.

QA-03A showed two independent lifecycle defects:

- `closeScopedPOSProcesses` treats a stale-PID `OpenProcess` error (`ERROR_INVALID_PARAMETER`, Windows error 87) as fatal, so POS deletion and all later cleanup phases are skipped.
- The parent process cannot observe that later helper failure, so `fatal(uninstall(...))` returns exit code `0` for “cleanup scheduled.”

The design must preserve the self-uninstall constraint, keep standard uninstall data-preserving, and avoid terminating unrelated Electron or Windows processes.

## Goals / Non-Goals

**Goals:**

- Make process cleanup safe under PID disappearance, PID reuse, child-process churn, and bounded termination races.
- Make cleanup completion durable and observable after the original process exits.
- Prevent exit code `0` from meaning final uninstall success when work is only scheduled or incomplete.
- Preserve ProgramData and LocalService state for standard uninstall and keep `--remove-data` explicit.
- Keep uninstall registration until managed payload cleanup is verified, so an incomplete uninstall remains discoverable and retryable.
- Provide deterministic unit seams and Windows integration coverage for the complete lifecycle.

**Non-Goals:**

- No change to Agent API, POS business behavior, SCM account, service recovery policy, or configuration schema.
- No broad process-name termination, ownership changes, ACL weakening, registry cleanup outside the managed uninstall key, or removal of unrelated MANUS installations.
- No claim of transactional rollback for an uninstall that has already removed the service or part of the payload.
- No automatic QA-03B execution, reinstall, data purge, or production deployment.

## Decisions

### 1. Choose a durable helper-result contract over synchronous self-cleanup

The external helper remains necessary because the installed executable must exit before its own image and containing version tree can be removed. A synchronous parent wait would deadlock with a helper that waits for parent exit, while allowing the helper to delete the live image would recreate the existing self-delete failure.

Therefore the parent writes an atomic, sanitized `pending` result before launching the helper. The helper updates that record through `completed`, `partial`, `failed`, `timed_out`, or `crashed` states. The parent returns code 2 after successful handoff; it returns `1` for immediate launch or preflight failure. Exit code `0` is reserved for a completed/no-op operation that the invoking process can actually verify. The `status` contract becomes the authoritative way to read the final result after an asynchronous self-uninstall handoff.

This is smaller and safer than adding a service or scheduled task: the existing signed launcher binary has a narrow `pos-supervisor` mode. The launcher starts that mode and waits only for its atomic ownership-journal handoff. The supervisor creates the Job Object, launches POS, retains the Job handle until POS exits, and then records `exited`. A future wrapper can convert the durable result into a blocking user experience without changing the helper protocol.

### 2. Use process identity revalidation and benign-race classification

Process discovery continues to use the canonical executable image path and exact root containment. Each candidate records PID, image path, and a process-start identity where available. Immediately before termination, the helper opens the PID with limited query, terminate, and synchronize rights, re-reads the image path and start identity, and compares them with the discovery record.

The following are benign races only after revalidation:

- the PID no longer exists;
- the process already exited or its handle is already signaled;
- termination reports an already-exited condition and a fresh scoped scan cannot find the same process.

If the PID resolves to another process or an image outside the managed POS root, the helper never terminates it and records a revalidation race. Access denied, wait failure, timeout, inability to prove scope, and surviving scoped processes remain hard failures. The helper aggregates per-process failures and always performs a final scoped scan.

### 2A. Add positive POS ownership with a controlled Job Object

The POS executable is currently launched through \`explorer.exe\`, and installed shortcuts point directly at the executable. That path gives uninstall no authoritative ownership proof. The corrected launch path SHALL use the installed Windows launcher executable with a \`launch-pos\` command and SHALL also use the same native launcher from the installer UI.

The launcher SHALL:

1. derive a stable installation-scoped Job Object name from the normalized managed POS root;
2. create or open the Job Object with the default secure object ACL and explicit no-breakaway limits;
3. call \`CreateProcessW\` with \`CREATE_SUSPENDED\` for the exact managed POS executable;
4. assign the suspended process to the Job Object before \`ResumeThread\`;
5. fail and terminate only that newly-created process if assignment or resume fails;
6. leave the Job Object available by name while members exist so the official cleanup helper can query it;
7. avoid \`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE\` until crash policy is explicitly approved.

Cleanup SHALL open the same installation-scoped Job Object and enumerate \`JobObjectBasicProcessIdList\`. Each member SHALL be revalidated with a process handle, start identity, and managed-root proof before termination. A missing Job Object is legacy evidence, not proof that no POS process exists; cleanup SHALL use the existing legacy fail-closed path and publish \`legacy_unowned_scope\` when ownership cannot be established. A Job Object access, membership, or final-scan error SHALL never become known-zero state.

The Job Object is not persistent across reboot and does not retroactively own historical processes. Launcher crash, restart, nested-job assignment, breakaway attempts, cross-account access, and missing ownership records SHALL have explicit tests and non-success behavior where proof is unavailable.

#### QA-terminal-15 ownership and recovery boundaries

Implementation contract: `legacy_unowned_scope` is a sanitized durable `reasonCode`, not an outcome or phase. The result outcome remains `partial`, with the current phase, original operation ID, retry count, error evidence, retained payload roots, and uninstall registration preserved. This reason is emitted when the pre-supervisor installation has no provable Job Object ownership or ownership observation is ambiguous; it never authorizes process termination or destructive cleanup.

The installation-scoped Job Object SHALL use the default secure Windows object ACL and an explicit DACL that grants only the supported POS launcher and official cleanup helper the minimum required create/open/query/assign/terminate rights. Interactive users may start POS only through the controlled launcher. An elevated uninstall may inspect and close the Job Object through the helper, but it SHALL not broaden access to unrelated users, services, or arbitrary callers. The launcher SHALL reject raw executable invocation as an ownership path; a raw `Manus POS.exe` shortcut or CLI bypass is legacy/unowned evidence, not a supported launch.

The launcher SHALL request no-breakaway limits and treat assignment failure, nested-job rejection, resume failure, and inaccessible membership as non-success. It may terminate only the newly-created suspended process after an assignment or resume failure, and SHALL close its own handles on every path. Windows restart, launcher crash, and launcher restart do not transfer or recreate ownership for historical processes. Cleanup SHALL publish a durable partial result with sanitized outcome code `legacy_unowned_scope` whenever the Job Object is missing, inaccessible, stale, nested, or cannot be enumerated; it SHALL preserve the uninstall registration and SHALL not infer zero scoped processes.

Job membership is a primary scope proof, never a replacement for current PID/start-identity and managed-root validation. Every member is revalidated immediately before termination. A PID reuse, mismatched process-start identity, path-normalization ambiguity, or final enumeration failure remains non-success and blocks payload or registry cleanup. Historical QA recovery records may document an unowned legacy process set, but they SHALL not be rewritten as owned, completed, or clean; BUILD08 and live recovery remain deferred until the disposable ownership evidence passes.

The acceptance fixture SHALL use only uniquely named TEMP roots and copied test executables. It SHALL cover managed parent/children, an unrelated Electron-like process, graceful exit, bounded shutdown, launcher crash, restart limitations, nested-job rejection, exact-handle cleanup, and shortcut/CLI dispatch. The fixture SHALL abort before mutation if scope cannot be proven and SHALL never target installed MANUS paths, live services, real registry keys, protected POS assets, or unrelated processes.

#### QA-terminal-15 task 12.6 launch boundary decision

The supported launch inventory is: the installer CLI `launch-pos`/`/launch-pos`, the productive installer UI `launchPOS` bridge, and the installed `.lnk` shortcut generated by the installer. All three converge on `launchManagedPOS`, which starts the existing launcher binary in `pos-supervisor` mode. No supported path targets `Manus POS.exe` directly, and the launcher does not trust environment variables, command-line ownership markers, or editable journal fields as authorization.

The packaged raw `Manus POS.exe` remains directly executable by a standard Windows user. Current Electron startup has no OS-backed inherited-handle or authenticated supervisor handshake, and the installer does not own a safe ACL boundary that can prevent ordinary execution without changing packaging permissions or compatibility. Therefore raw direct execution is explicitly unsupported, is not treated as owned, and remains covered by fail-closed `legacy_unowned_scope` cleanup. This is an honest compatibility boundary, not an OS-wide prevention claim. A future enforcement change needs a signed/OS-backed handshake or approved ACL/packaging design and separate compatibility evidence.

Task 12.4 validation uses an injected Job Object security boundary for deterministic allowed, denied, and ambiguous membership cases. This proves fail-closed control flow only; it does not certify a real cross-account ACL. Genuine cross-account authorization requires a separate isolated Windows VM with disposable accounts and Job Objects, and remains blocked until that evidence exists.

#### QA-terminal-15 task 12.5 lifetime boundary

The bounded implementation adds an independent `pos-supervisor` process in the existing launcher binary and an atomic `pos-ownership.json` journal under the existing state root. The journal records only sanitized Job name, root, supervisor/POS PID and start identities, session, boot identity, state, and timestamp. It is historical evidence, not authority: no journal PID or name authorizes termination, adoption, or broad discovery.

The supervisor creates the named Job Object, rejects non-empty membership, starts the exact POS executable suspended, assigns it before resume, and retains the Job handle while waiting for POS exit. It does not use `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`; graceful shutdown is POS exit followed by journal `exited` and exact handle closure. Supervisor crash therefore does not intentionally kill POS, and a restarted supervisor refuses adoption. A stale/corrupt journal, session mismatch, boot-identity change, missing Job Object, or inaccessible membership remains non-success and requires a fresh controlled launch or explicit legacy-safe operator handling. Task 12.5 remains open until disposable runtime evidence covers crash/restart, nested jobs, exact handles, and abort-before-mutation, and isolated VM evidence covers logoff, reboot, and cross-account boundaries.

### 3. Keep cleanup ordered and fail closed

The phases are:

1. Validate the managed roots and write the pending result.
2. Stop and confirm the managed SCM service; tolerate only an already-absent service.
3. Discover and close only scoped POS processes, then perform a final process scan.
4. Remove Manus-created shortcuts and the POS payload.
5. Remove the Peripheral Agent Program Files payload.
6. For standard uninstall, preserve ProgramData and LocalService. For `--remove-data`, remove only the validated managed data roots.
7. Remove the managed uninstall registry key only after payload gates pass.
8. Schedule bounded TEMP self-cleanup and record its result separately; do not call a payload cleanup complete when managed roots remain.

If any phase fails, later destructive phases do not run. In particular, registry removal is after payload verification, so Apps & Features remains available for retry. The result records completed phases and the first blocking phase without pretending that earlier service removal was rolled back.

### 4. Make retries idempotent and crash-recoverable

The helper uses an operation ID and atomic result-file replacement. On startup it detects an existing unfinished result, revalidates current state, and either resumes safe remaining phases or marks the prior attempt interrupted before continuing. A retry never restores isolated pre-uninstall data and never recreates a service or registry entry.

If the result file cannot be written, the operation fails closed before payload deletion. If the helper crashes after a phase, the next official invocation uses filesystem, SCM, process, registry, and result evidence rather than assuming the previous phase completed. All waits are bounded; an incomplete result is retained for diagnosis and retry.

### 5. Sanitize evidence

Logs and result records contain phase names, managed paths, PID numbers, executable paths under the managed root, sanitized Windows error names/codes, timestamps, and final counts. They do not contain configuration bodies, credentials, tokens, command-line arguments, or unrelated process metadata. Command-line capture is not required for cleanup correctness.

### 6. Test through injectable process operations plus Windows lifecycle tests

The process cleanup logic should depend on a narrow Windows process-operations seam so unit tests can deterministically simulate vanished PIDs, PID reuse, access denied, wait timeout, and already-signaled handles without killing real processes. Windows integration tests use disposable child processes and a disposable install layout, then verify actual SCM, filesystem, registry, result, and exit-code behavior. Tests must assert that unrelated processes remain alive and that protected configuration hashes are unchanged.

## Risks / Trade-offs

- **Pending exit code changes existing uninstall expectations** → document result code `2` and make `status`/result evidence authoritative; add compatibility tests for Apps & Features and scripted callers.
- **A result file can be interrupted mid-write** → write to a same-directory temporary file and atomically replace it; retain the prior valid record when replacement fails.
- **PID start identity may be unavailable on some Windows versions or access levels** → require current image-path revalidation as the minimum proof and fail closed when scope cannot be established.
- **A surviving process can keep payload files locked** → stop at the payload gate, retain uninstall registration, report the scoped process count, and never broaden termination scope.
- **Service removal happens before a later payload failure** → report `partial`, do not claim rollback, and keep retry metadata; service absence remains an explicit completed phase.
- **TEMP cleanup can outlive the helper** → record TEMP cleanup separately and require bounded retries; do not use TEMP completion as proof that Program Files cleanup succeeded.

## Migration Plan

1. Add the OpenSpec capability and tests before changing installer behavior.
2. Implement the process-operation seam, stale-PID classification, final scan, durable result schema, and ordered cleanup gates.
3. Update CLI/help/README documentation and Apps & Features expectations for the pending result code and final `status` evidence.
4. Run Go unit tests, Windows integration tests, strict OpenSpec validation, and `git diff --check`.
5. Build a new QA artifact without touching the protected POS resources; verify artifact metadata and hash before execution.
6. On a disposable workstation, run fresh install, same-version reinstall, standard uninstall with running POS children, repeated uninstall, helper crash/timeout recovery, and `--remove-data` separately.
7. Roll back the implementation by restoring the prior installer artifact only; do not restore deleted payload data or alter protected repository changes.

## Open Questions
### 7. Make POS packaging provenance explicit
The packaging script keeps the existing Electron release and Go installer interfaces. Before packaging it validates the exact Electron package metadata, lockfile, and shell configuration. An unexpected build-only top-level field such as `allowScripts` fails the build. After copying the selected `release/win-unpacked` payload, the script records sorted file hashes, generates `pos-manifest.json`, verifies manifest parity against the embedded copy, and writes a machine-readable provenance sidecar beside the installer output. The sidecar records input hashes, payload snapshot, generated manifest hash, installer hash when available, and the explicit source-of-truth paths. It does not mutate tracked POS resources during validation and does not claim byte identity between independently generated Electron executables unless their hashes match.
Disposable Windows integration uses only uniquely named TEMP roots and copied test executables. It has no path or operation seam that can target the installed service, `C:\\Program Files\\Manus`, live ProgramData, LocalService, real registry keys, or unrelated processes. If scope cannot be proven, the fixture aborts before mutation.

- A future blocking UX may be added around the durable result contract, but it is not required for this change.

## QA-04-R4 hardening decisions

- A missing result is allowed only before a new operation starts. A corrupt, incomplete, or foreign-operation result is an immediate failure and is never replaced.
- A fresh pending operation blocks a second invocation. A stale pending operation is marked crashed durably before retry.
- Completion requires a known zero scoped-POS count and known absent uninstall registration. Unknown observations remain non-terminal.
- Terminal persistence errors return failure and preserve the last valid atomic record. Legacy uninstall dispatch delegates to the corrected flow.
- Provenance sidecars use stable repository-relative logical paths plus SHA-256 values. Absolute workstation paths are omitted.

## QA-04-R6 corrections

The managed uninstall registration uses the canonical path `Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ManusPeripheralAgent` in the x64 registry view. Create, query, and delete operations share one injected store contract; delete uses `RegDeleteKeyExW` so the selected view is explicit. Missing keys remain idempotent. Other registry errors remain failures.

Process discovery may ignore a vanished PID only when Windows reports a definitive missing-process error. The discovery pass inventories executable names under the managed POS root only as a prefilter for uninspectable unrelated snapshot entries. A candidate whose scope cannot be excluded still produces an observation error. Termination always requires the current executable path and start identity to match the scoped candidate.

The completion invariant remains: no durable `completed` result, exit code `0`, or registry-success claim is allowed when process observation, payload gates, registry observation, or terminal-result persistence is unknown or failed.

### QA-04-R8 corrections

Registry deletion is a registry operation, so the cleanup orchestrator now classifies only isMissingUninstallRegistryKeyError as benign. The service-domain classifier is reserved for SCM calls. The full helper path is tested with injected cleanup operations; both a service-domain error and a generic registry error retain registration and produce a non-completed durable result.

Native discovery no longer suppresses OpenProcess or image-path errors by comparing ProcessEntry32.ExeFile to a root inventory. The native boundary is injectable for snapshot creation, Process32First/Next, OpenProcess, QueryFullProcessImageName, GetProcessTimes, TerminateProcess, WaitForSingleObject, and handle close. A definitive gone error remains benign. A successful image-path query outside the root is confirmed out of scope. Any other inaccessible or incomplete observation returns an error. This preserves the TEMP integration while making the production discovery path deterministic in tests.

The completion invariant is now checked end to end: registry errors, native observation errors, final-scan errors, payload verification failures, and durable-result persistence failures cannot produce completed or exit code 0.


### QA-04-R9 single-authority cleanup

The unused legacy runUninstallCleanup implementation is removed. The only production uninstall cleanup entrypoint is runUninstallCleanupWithResult, which requires the durable operation identity and result path. The public uninstall wrapper delegates to uninstallWithResult; no second cleanup implementation may perform process, payload, data, TEMP, or registry work.

### 7. QA-05 legacy terminal result compatibility

The recovery loader accepts one narrowly defined historical terminal shape for schema version 1. The record must be standard or remove-data, have valid identity and timestamps, `outcome=completed`, `phase=complete`, no error, and the exact ordered phases through `temp_cleanup` with the mode-specific managed-data phase. The loader appends `complete` only to the in-memory phase list. It does not write or claim current completion from that record. The next official operation creates a fresh operation identity and pending record, so current process, payload, registry, and persistence gates still decide success. All other validation failures remain fail-closed and leave the original bytes untouched.

### QA-terminal-10 process-image recovery

When `QueryFullProcessImageNameW` returns an image-path error such as `ERROR_GEN_FAILURE`, discovery may make one additional OS-backed query through `GetProcessImageFileNameW`. A returned native device path is usable only after `QueryDosDevice` or `SystemRoot` normalization produces a comparable Win32 path, or after the managed root device mapping proves the native path is on another device. The exact comparable path is then checked against the managed POS root. This can prove a system process is outside scope without using a PID or basename allowlist. If the fallback query fails or neither normalization nor root-device comparison proves scope, discovery retains the unknown/error result and cleanup remains fail closed.
### QA-terminal-11 precise native image observation

The native wrapper treats a zero-length GetProcessImageFileNameW result as a failed observation even when the wrapper reports ERROR_SUCCESS. The root-aware fallback verifies the managed root DOS-device mapping. A native path on a different verified device may be excluded as positively outside scope; same-device, unmapped, ambiguous, malformed, or inaccessible paths remain unknown and block cleanup. Revalidation uses the same managed-root proof before termination.
