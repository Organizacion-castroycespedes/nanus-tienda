## 1. Contract and result model

- [x] 1.1 Define the sanitized uninstall result schema with operation ID, phase, outcome, timestamps, retry count, managed roots, sanitized error code, and final-scan counts; verify atomic write/read tests preserve the last valid record.
- [x] 1.2 Define CLI result codes `0` for verified completed/no-op, `1` for immediate failure, and `2` for accepted asynchronous handoff; verify help text and existing callers document `status` as the final-result query.
- [x] 1.3 Add lifecycle state transitions for `pending`, `completed`, `partial`, `failed`, `timed_out`, and `crashed`; verify invalid transitions and incomplete records fail closed. Evidence: `uninstall_result_windows.go` validation and `uninstall_result_windows_test.go` transition tests.

## 2. Scoped process cleanup

- [x] 2.1 Introduce a narrow Windows process-operations seam around enumeration, query, termination, wait, and start identity; verify existing path-containment behavior remains limited to the managed POS root.
- [x] 2.2 Implement PID and executable-path revalidation immediately before termination; verify PID reuse outside the POS root is never terminated.
- [x] 2.3 Classify vanished PIDs, already-signaled handles, and already-exited termination races as benign only after revalidation; verify access denied, wait failure, timeout, and unknown errors remain hard failures.
- [x] 2.4 Aggregate per-process failures and perform a final scoped process scan; verify any surviving scoped POS process blocks payload deletion and produces a non-success result.
- [x] 2.5 Preserve child-process coverage without broad process-name matching; verify unrelated Electron processes remain running in the Windows integration fixture. Evidence: `uninstall_cleanup_integration_windows_test.go` opt-in TEMP fixture.

## 3. Ordered uninstall and retry

- [x] 3.1 Refactor uninstall phases so service stop/absence, scoped process cleanup, shortcuts, POS payload, Agent payload, data policy, registry removal, and TEMP cleanup have explicit gates; verify registry removal is impossible after a payload failure.
- [x] 3.2 Preserve standard-uninstall ProgramData and LocalService state and isolate `--remove-data` deletion to validated managed roots; verify before/after hashes and ACL invariants in tests. Evidence: disposable lifecycle fixture hash/ACL assertions plus existing exact-root LocalService tests.
- [x] 3.3 Make partial and interrupted results retryable and idempotent; verify repeated uninstall does not recreate services, duplicate registry entries, restore prior data, or affect unrelated MANUS installations. Evidence: disposable partial-retry fixture and service/registry seams.
- [x] 3.4 Add bounded waits, crash detection, and retry evidence for helper and TEMP cleanup; verify timeout and crash paths retain registration and sanitized diagnostics. Evidence: stale-result crash recovery test and disposable timeout/registry-retention test.

## 4. Helper handoff and reporting

- [x] 4.1 Write the `pending` result before launching the external helper and return code `2` only after a valid handoff; verify launch/preflight failures return code `1` and never claim pending success.
- [x] 4.2 Make the helper atomically publish final result states after cleanup gates and final scans; verify the original exit code cannot be `0` merely because a helper was launched.
- [x] 4.3 Update `status`, logs, and uninstall documentation to distinguish scheduled, completed, partial, failed, timed-out, and crashed operations without configuration or credential contents; verify sanitized evidence tests.

## 5. Tests and QA validation

- [x] 5.1 Add deterministic Go unit tests for vanished PID, PID reuse, already-exited process, access denied, wait timeout, surviving child, process-scope rejection, result transitions, and registry-preservation ordering; verify the installer Windows test suite passes. Evidence: process seam tests, result tests, disposable lifecycle tests, and native Windows suite.
- [x] 5.2 Add Windows integration tests using disposable processes and install roots for standard uninstall, helper failure, repeated uninstall, file lock, and complete uninstall with preserved configuration; verify unrelated processes and SCM state are unaffected. Evidence: opt-in TEMP process fixture plus injectable service, registry, process, and filesystem seams; no live MANUS paths used.
- [x] 5.3 Add regression coverage for the QA-03A sequence with multiple `Manus POS.exe` processes; verify no false exit-zero result and no residual POS/Agent payload or uninstall registration after successful completion. Evidence: multiple-child Windows fixture, pending exit-code contract test, and durable completion/registry-order tests.
- [x] 5.4 Validate the implementation with strict OpenSpec validation, `git diff --check`, protected POS file hashes, installer artifact validation, and a clean QA evidence report; verify no installer execution occurs during repository validation. Evidence: `qa-evidence-qa04-r2.json`, `qa-evidence-qa04-r4.json`, and recorded validation commands.

## 6. QA-04-R4 hardening

- [x] 6.1 Reject corrupt, incomplete, fresh-pending, and operation-mismatched durable results without overwriting evidence; test terminal transition regressions.
- [x] 6.2 Propagate stale-recovery and terminal persistence errors; preserve the last valid atomic result.
- [x] 6.3 Record known/unknown final scoped-process and registry observations and require known clean observations for completed results.
- [x] 6.4 Route the legacy uninstall entrypoint through the corrected durable lifecycle.
- [x] 6.5 Remove absolute workstation paths from provenance and test logical-path privacy.
- [x] 6.6 Run safe native, disposable, packaging, OpenSpec, and diff validations; refresh QA evidence without live lifecycle operations.

## 7. QA-04-R6 hardening

- [x] 7.1 Extend task 5.1 with deterministic registry-path parity, explicit x64-view, missing-key, and registry-error propagation tests using an injected registry store. Evidence: `qa04_r6_contract_windows_test.go`.
- [x] 7.2 Extend task 6.3 with fail-closed native discovery for access-denied, image-path, identity, vanished-PID, and final-scan outcomes. Evidence: `pos_process_cleanup_windows.go`, `process_discovery_scope_windows.go`, and `qa04_r6_contract_windows_test.go`.
- [x] 7.3 Verify cleanup completion invariants, TEMP-only disposable process integration, safe Go/build/package/OpenSpec validation, protected hashes, and no live MANUS lifecycle mutation. Evidence: `qa-evidence-qa04-r6.json`.

## 8. QA-04-R8 blocker corrections

- [x] 8.1 Correct registry error classification in uninstall_flow_windows.go so only canonical missing-key errors are benign. Add full runUninstallCleanupWithResult tests for service-domain and generic registry failures, registration retention, and non-completed durable results.
- [x] 8.2 Replace basename/root-inventory suppression with injectable native Windows API boundaries for snapshot enumeration, OpenProcess, primary and fallback image-path, identity, termination, wait, and handle close. Preserve only definitively vanished PID errors as benign; accept fallback paths only after verified normalization and exact root containment.
- [x] 8.3 Add production Discover-path tests for access denied, primary/fallback image-path denial, verified system-process exclusion, identity denial, disappeared PID, out-of-scope path, renamed/deleted or mismatched executable, missing/empty root, interrupted enumeration, PID reuse, and final rescan failure.
- [x] 8.4 Run the guarded TEMP child integration through the native API seam, complete Go tests/build, backend/POS/provenance tests, strict OpenSpec, diff check, protected hashes, and write qa-evidence-qa04-r8.json. Historical QA-04-R7 failure remains preserved.


## 9. QA-04-R9 single-authority cleanup

- [x] 9.1 Remove the unused autonomous runUninstallCleanup implementation and add a source/dispatch regression proving every uninstall entrypoint uses the durable-result lifecycle; rerun registry-error flow tests to prove no legacy path can swallow service-domain or generic registry errors.

## 10. QA-05 recovery compatibility

- [x] 10.1 Accept only the exact legacy completed-through-`temp_cleanup` result shape for retry bookkeeping, preserve its serialized evidence, reject incomplete variants, and validate the fix with the QA-05 regression, full Go suite, packaging checks, strict OpenSpec, and isolated BUILD-04 evidence.

## 11. QA-terminal-10 process-image recovery

- [x] 11.1 Diagnose the QA `ERROR_GEN_FAILURE` image-path failure, add an OS-backed native image-path fallback with fail-closed normalization, cover known out-of-scope system paths and ambiguous failures through the production Discover seam, and validate without live lifecycle operations. Evidence: `qa-evidence-qa-terminal-10-fix.json`.

- [x] 11.2 Harden native image observation for false-success zero-length results and root-aware native paths. Use the documented native QueryFullProcessImageName mode, verify the managed root DOS-device mapping, exclude only positively different devices, preserve ambiguity failures, and reuse the proof during termination revalidation. Evidence: `qa04_r10_process_image_fallback_windows_test.go`; Windows Go suite and build pass; no live lifecycle operation.


## 12. QA-terminal-15 positive POS ownership

- [x] 12.1 Define the installation-scoped Job Object ownership contract, minimum secure launcher/helper ACLs for interactive and elevated-uninstall boundaries, no-breakaway policy, raw executable bypass limits, crash/restart behavior, nested-job limits, PID/start-identity revalidation, historical QA recovery restrictions, and \`legacy_unowned_scope\` durable partial semantics in the design and specification. Evidence: `uninstall_result_windows.go`, `pos_job_ownership_windows.go`, `pos_process_cleanup_windows.go`, deterministic durable-result/ownership tests, and passing Windows Go tests/build.
- [x] 12.2 Implement a Windows POS launcher using \`CreateProcessW(CREATE_SUSPENDED)\`, \`AssignProcessToJobObject\`, and \`ResumeThread\`; replace direct \`explorer.exe\` launch and raw POS shortcuts with the controlled launcher.
- [x] 12.3 Implement positive Job Object member discovery and integrate it as the primary scope proof while preserving process start-identity, path, PID-reuse, final-scan, and fail-closed protections.
- [ ] 12.4 Add deterministic tests for assignment failure, no-breakaway policy, nested-job rejection, secure access boundaries, raw-launch bypass, PID/start-identity mismatch, inaccessible membership, final enumeration failure, durable \`legacy_unowned_scope\`, and preservation of historical QA evidence. Evidence added: injected Job Object authorization boundary tests, no-breakaway launcher contract test, membership failure tests, and existing PID/rescan/image-path regressions. Real cross-account ACL proof remains BLOCKED pending an isolated Windows VM.
- [ ] 12.5 Add disposable TEMP-only Windows integration for managed parent/children, unrelated Electron-like processes, graceful exit, bounded shutdown, launcher crash, restart limitations, nested-job rejection, exact-handle cleanup, and abort-before-mutation scope proofs. Inspection evidence: current code has no independent POS supervisor or durable POS ownership journal; named Job Object membership is live kernel state and uninstall results are historical retry evidence only. Logoff, reboot, boot-identity change, and supervisor-crash evidence remain pending disposable/VM validation.
- [x] 12.6 Verify supported shortcut, UI, and CLI dispatch paths converge on the controlled launcher and cannot target raw \`Manus POS.exe\`; document that direct raw execution remains unsupported/unowned because current Electron packaging has no proven OS-backed handshake or safe ACL enforcement boundary. Evidence: source dispatch tests cover shortcut target, UI bridge, CLI aliases, raw-command rejection, and forgeable-marker absence. No OS-wide prevention claim.
- [x] 12.7 Run targeted and full Windows Go tests, build, existing lifecycle regressions, strict OpenSpec, and \`git diff --check\`; preserve protected POS hashes and do not build an installer.
- [ ] 12.8 Record QA-terminal-15 evidence, keep historical QA partial and unowned-scope results unchanged, preserve sanitized durable evidence, and defer BUILD08/live recovery until ownership implementation, shortcut/CLI proof, and disposable evidence pass.
