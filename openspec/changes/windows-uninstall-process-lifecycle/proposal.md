## Why

The Windows uninstall command can report exit code `0` after only scheduling an external cleanup helper. If a POS process exits between enumeration and `OpenProcess`, Windows returns error 87 and the helper stops before deleting the POS payload, Agent payload, and uninstall registration. This leaves the workstation in a partial state while the invoking installer reports success, blocking reliable QA and creating an unsafe lifecycle contract.

The change is needed now because QA-03A reproduced the failure with `0.1.1-qa.13`: the service and port were removed, but three POS processes, both Program Files roots, and the uninstall registry entry remained while configuration data was correctly preserved.

## What Changes

### QA-terminal-10 process-image recovery

The process discovery implementation SHALL use one OS-backed native image-path fallback when the primary Win32 image query fails. It SHALL accept the fallback only after verified device-path normalization and exact managed-root containment. It SHALL never classify a process as unrelated from PID or basename alone; failed fallback or ambiguous normalization SHALL remain an observation error.

- Make POS process cleanup race-safe and strictly scoped to executable paths under the managed POS root.
- Revalidate process identity before termination so stale PIDs and PID reuse cannot terminate unrelated applications.
- Treat already-exited processes as benign only after safe revalidation; aggregate and report real access, termination, wait, and surviving-process failures.
- Add a completion-aware uninstall result contract that distinguishes completed cleanup from scheduled, partial, timed-out, crashed, or interrupted cleanup.
- Keep payload and uninstall-registry deletion ordered after successful process and file cleanup; retain registration when cleanup is incomplete so retry remains discoverable.
- Preserve standard-uninstall ProgramData and LocalService state byte-identically; keep `--remove-data` as the explicit data-removal path.
- Define bounded retry, idempotent retry, crash recovery, file-lock handling, and final-scan behavior for the external Windows cleanup supervisor/helper.
- Add deterministic Go unit tests and Windows integration coverage for process races, process-tree scope, helper failures, exit-code reporting, repeated uninstall, and configuration preservation.

### QA-terminal-15 positive POS ownership

Global Toolhelp discovery remains fail-closed but cannot reliably classify protected or unusual Windows processes. POS launch SHALL therefore create an installation-scoped Windows Job Object, launch the POS process suspended, assign it before resume, and keep child processes inside the job without breakaway. Supported launch surfaces SHALL use this controlled launcher; raw POS executable shortcuts SHALL not remain an untracked launch path.

Uninstall SHALL use positive Job Object membership as the primary scope proof, while retaining PID/start-identity revalidation and final membership checks. Unknown membership, stale job access, PID reuse, assignment failure, enumeration failure, and ACL failure SHALL remain partial or failed outcomes. Historical installations without ownership metadata SHALL never be treated as job-owned and SHALL retain the explicit \`legacy_unowned_scope\` partial behavior.

## Capabilities

### New Capabilities

- `windows-uninstall-process-lifecycle`: Reliable, completion-aware Windows uninstall of the Agent and POS payloads with scoped process cleanup, failure reporting, retry behavior, and preserved managed state.

### Modified Capabilities

<!-- The related Agent/POS integration contract currently exists only inside an in-flight change, not as a registered standalone spec under openspec/specs/. The new capability restates the required uninstall behavior and closes the implementation gaps without silently modifying that historical change. -->

## Impact
### Packaging provenance contract
The Windows installer build SHALL treat the Electron source tree, exact `desktop/electron/package.json`, lockfile, shell configuration, and freshly selected `release/win-unpacked` payload as authoritative inputs. The build SHALL reject unexpected top-level package metadata such as `allowScripts`, record SHA-256 input and payload snapshots, generate the POS manifest from the selected release payload, and verify parity against the payload embedded in the installer. Tracked POS snapshots SHALL not be silently synchronized or excluded as a workaround for provenance drift.

- Windows installer lifecycle code in `backend-perifericos/windows-installer/`, especially the uninstall entrypoint, external cleanup helper/supervisor, POS process cleanup, payload deletion, registry cleanup, and logging.
- Go unit tests and Windows integration tests for the installer.
- Installer exit-code and completion-result contract used by QA and Apps & Features uninstall.
- No changes to POS source behavior, Agent configuration contents, SCM service identity, unrelated processes, unrelated registry keys, or production environments.
- Existing protected POS working-tree modifications remain outside this change.

## QA-04-R4 hardening

The result protocol SHALL fail closed on corrupt, incomplete, fresh-pending, or foreign-operation records. Final process and uninstall-registration observations SHALL carry explicit known state before a completed result is written. The legacy uninstall entrypoint SHALL delegate to the durable-result flow. Packaging provenance SHALL contain stable logical paths and content hashes, not machine-specific filesystem paths.

## QA-04-R6 hardening

The uninstall contract SHALL use one canonical uninstall registry path and explicit x64 registry view for create, observe, and delete operations. Native process discovery SHALL fail closed when scope cannot be excluded because process access, image-path, or identity inspection is unavailable. Completed cleanup SHALL require complete process observation and durable terminal persistence.

R6 evidence SHALL include injected registry parity tests, discovery-denial tests, TEMP-only process integration results, protected hashes, and proof that live MANUS lifecycle state was not mutated.

## QA-04-R8 corrections

The registry cleanup flow SHALL ignore only key-absence errors from the canonical uninstall key. Service-domain errors, access denied, generic registry errors, and view/path errors SHALL remain observable failures.

Native process discovery SHALL use injectable seams at snapshot enumeration, OpenProcess, image-path, start-identity, termination, wait, and handle-close boundaries. It SHALL not use executable basename inventory to suppress an uninspectable process. Missing or empty managed roots SHALL still perform complete native observation; an inaccessible candidate or incomplete enumeration SHALL return an unknown/error result.

R8 evidence SHALL include production Discover-path tests for all native observation failures, a full cleanup orchestration test for registry-error retention, the guarded TEMP child integration, protected hashes, and validation commands. Historical R5/R7 failures remain recorded and are not rewritten.

### QA-05 legacy-result recovery compatibility

The uninstall recovery path SHALL recognize the exact terminal result shape emitted by the prior QA installer: `outcome=completed`, `phase=complete`, and the complete ordered phase sequence through `temp_cleanup`, without the later persisted `complete` phase and final observation fields. It SHALL normalize this record only in memory for retry bookkeeping, SHALL never treat it as proof of the current host state, and SHALL preserve the original serialized bytes until the new operation writes its own pending record. Any other incomplete, corrupt, or ambiguous terminal record SHALL remain a fail-closed recovery error.
