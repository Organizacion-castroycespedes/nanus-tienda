## Why

At baseline `develop` `6a26df541e00703e1fffb02ea73afb36c628fee2`, Windows uninstall returns success after starting an external cleanup helper. POS cleanup reopens a PID without revalidating its creation identity and image on the termination handle. Errors during process observation can be omitted. These source-confirmed gaps can conceal incomplete cleanup or select a reused PID.

Historical QA-03A reports service removal with surviving POS processes, payloads and uninstall registration. That is historical evidence, not a new observation of this host. The current discovery has not executed an installer, uninstall, service, fixture, hardware operation or database query.

HU-WIN-001B restores this existing OpenSpec from `b6b4971572790dfad520aadfcc6e2245e8fdea9d` and reconciles documents only. No historical executable implementation is recovered. CLI artifact readiness and strict validity do not certify runtime safety or authorize implementation.

## What Changes

### Current authorized document recovery

- Recover exactly the 16 files listed in design.md from the historical lifecycle folder.
- Reconcile only proposal.md, design.md, specs/windows-uninstall-process-lifecycle/spec.md and tasks.md.
- Preserve .openspec.yaml, the ten historical JSON files and qa-05-manual-acceptance.md byte-identically.
- Reopen historical implementation checkboxes because their code and test results are not present or revalidated on this baseline.
- Keep 12.4, 12.5 and 12.8 open. Preserve PARTIAL, skipped integration and missing VM evidence.
- Reconcile `legacy_unowned_scope` to `outcome=partial` and `reasonCode=legacy_unowned_scope`, consistent with the historical result enum and serializer.
- Retain STRICT/ACTIVE enforcement. Add a scope declaration only if the checker requires it, confined to this documentation folder.

### Future implementation requirements, separately authorized

1. Use one completion-aware uninstall authority, correlated durable results and exit codes `0=verified completed/no-op`, `1=immediate failure`, `2=accepted asynchronous handoff`. Pending is not completion.
2. Require current PID/start identity, exact image/root proof and positive ownership before termination. Detect unowned raw POS coexistence; an empty Job alone cannot prove host-wide absence.
3. Bind helper operation, roots, mode, result path and parent identity before mutation. Validate exact trusted roots and reparse boundaries, including TEMP. Reject broad or substituted targets.
4. Bound helper waits and recovery. An old timestamp does not prove that an earlier helper stopped; concurrent retries must not delete concurrently.
5. Preserve configuration, enrollment, device registry and operational identity on standard uninstall. Separate new lifecycle evidence from protected retained data. Silent uninstall must not imply data deletion; `--remove-data` requires a separate explicit request.
6. Specify minimum Job/journal permissions, session boundaries, standard-user launch, authenticated handoff, stable boot evidence and failure cleanup before selectively recovering a supervisor.
7. Define safe Agent shutdown and child containment, followed by bounded fallback only within proven process scope. Preserve peripheral APIs, transport behavior, service identity and configuration schemas.
8. Verify install, first launch, operation, close, failure, reboot, supported update, uninstall and reinstall in disposable environments before any live QA.

The historical supervisor is a candidate requiring correction. It is not the current architecture or an approved complete solution. Unresolved security mechanisms are recorded as design gates in design.md and open tasks.

### HU-WIN-002E-GOV architecture and ownership preparation

- Reserve exact ownership for the four absent lifecycle files `pos_job_ownership_windows.go`, `pos_job_ownership_windows_test.go`, `pos_supervisor_windows.go` and `pos_supervisor_windows_test.go`. Reservation does not create or approve their implementation.
- Reserve exact ownership for the absent `managed_root_identity_windows.go` and `managed_root_identity_windows_test.go`. This seam is limited to trusted-root derivation, handle-observed identity, reparse metadata and revalidation; it does not delete, change ACLs, launch the helper or wire uninstall.
- GOV-R2 reserved exact ownership for `managed_tree_operations_windows.go`, `managed_tree_operations_windows_test.go`, `uninstall_operation_identity_windows.go` and `uninstall_operation_identity_windows_test.go`. The first pair's initial implementation is parent-handle-relative observation without disposal; ROOT-05 below defines a later separate capability without widening that observation API. The second pair remains reserved for authenticated SID/session/logon identity and protected operation binding without product wiring.
- Assign only `main_windows.go` to this lifecycle change for the A-to-B admission/update path; retain the P0-B policy as a mandatory contract from `autorizar-balanza-real-pos-peso`. Reserve exact lifecycle-owned transition policy/test files. `main_windows_test.go` and `productive_ui_windows.go` remain owned by `controlar-descubrimiento-perifericos-reales`; edits to them remain blocked unless separately coordinated. This documentary transfer authorizes no runtime change.
- Define trusted-root proof from Windows Known Folders, installed-layout identity and handle-observed effective paths. Helper arguments, registry strings, journals and lexical normalization remain inputs to validate, never deletion authority.
- Select `NtCreateFile` with `OBJECT_ATTRIBUTES.RootDirectory` and metadata from `GetFileInformationByHandleEx`. ROOT-01/ROOT-03 implement observation only. The ROOT-04-R1 report demonstrates six native observation cases on Windows build 26200 AMD64/NTFS: combined `OBJ_DONT_REPARSE` and `FILE_OPEN_REPARSE_POINT` can open the reparse object successfully, so metadata rejection is mandatory. Disposition, delete-right transitions and complete TOCTOU protection remain NOT_PROVEN.
- Define live Job Object membership, verified through retained process handles and an explicitly secured Job, as positive POS ownership. The journal remains informational and cannot authorize adoption, termination or deletion.
- Keep the historical candidate at `67f9ca452208bd412915dd463f6a0cd964163a59` as review evidence only. No code is recovered by this governance phase.

## Capabilities

### HU-WIN-002E-ROOT-05-DESIGN boundary

- Reconcile only proposal, design, spec and tasks. No Go, mapping, helper or runtime change; no new fixture or deletion execution.
- Keep the existing `managedTreeAPI` observation-only. A future, separately authorized capability in the same lifecycle-owned managed-tree file pair must separate observation, explicit fixture authorization, preparation with minimum `DELETE` access, same-handle disposition and verified postconditions. No new path or ownership transfer is needed for this isolated scope.
- Propose `SetFileInformationByHandle(FileDispositionInfo)` as the first disposition mechanism, without POSIX flags, read-only override, delete-on-close or path deletion. API availability is verified; safe execution remains gated by native evidence for sharing, namespace protection and close semantics.
- First implementation checkpoint is fake-only, one explicitly authorized regular child file, retained fixture root and no product wiring. Bottom-up directory traversal, root removal, installed payload and user-data cleanup are later independent gates. All reparse points, including `current`, remain rejected without traversal or unlinking.
- Preserve the observation API and old evidence. Add no completed implementation/QA marks. Native destructive QA requires a new operation-bound disposable fixture, external sentinel and explicit per-run authorization after non-destructive preparation proof; historical ROOT-04 fixtures are excluded.

### HU-WIN-002E-ROOT-05C-B-DESIGN boundary

- Capture the future B1-B5 fixture-only namespace experiments in design sections 8.6-8.11 and the existing open task 15.3. This checkpoint changes only these four editable artifacts; it does not authorize fixture creation, hard links, renames, DELETE-bearing opens, disposition or implementation.
- Preserve R3 sharing and ROOT-05C-A metadata reports as prior observations. Two handles with one File ID prove observed object identity, not a permanently bound parent/name entry. The test-local StandardInfo decoder is not a production capability.
- Require per-case approval, fresh protected fixtures, a same-volume controlled peer, separate evidence/sentinel, deterministic actor barriers, positive controls and exact object/name postconditions. An expected namespace escape can pass a diagnostic assertion while keeping the candidate guard and all disposition NO-GO.
- Prefer handle-relative actor operations for the first hard-link probe. Resolve the local NT class-name mismatch (the installed module's `FileLinkInformation` equals 72; the documented classic class equals 11) with an explicitly reviewed test-local class/ABI contract before any native mutation. Do not update dependencies or silently choose Ex/POSIX/path fallbacks.
- Keep rename/hard-link actors isolated in a future opt-in test harness. They do not extend `managedTreeAPI`, the fake-only disposition interfaces, product authority or shared-file ownership. Every production disposition and reparse prohibition remains unchanged.

### HU-WIN-OPERATION-ID-DESIGN boundary

- Reconcile only these four existing artifacts; no executable, mapping, fixture, helper, IPC or security-descriptor change. Discovery is source evidence, not a live uninstall result.
- Define separate initiator/executor/helper/service frames, verified same-account elevation policy, installation-generation/plan binding, explicit remove-data approval, mutual handoff, single-consumed claims and honest asynchronous/recovery states in design section 9.
- Prepare only the later isolated fake-only operation-identity file pair under existing ownership. Fake CAS/entropy/peer approval cannot issue native or durable authority; production storage, MIC/IPC, binary launch and cross-account/power-loss evidence remain gates.
- Reuse open task 13.11 and acceptance tasks 14.1/14.2. Preserve all checked states, historical evidence, shared owners and B1/ROOT-05 product NO-GO. No new change, service, table, endpoint or duplicate task set is introduced.

### HU-WIN-OPERATION-ID-UAC-CONTRACT-R1 boundary

- Reconcile only proposal, design, spec and existing tasks. No Go, mapping, native query, UAC launch, IPC, helper, token/security change or fixture operation is authorized by this documentation checkpoint.
- CURRENT: the operation-identity file pair exists with a fake-only policy/claim model. Prior NATIVE-01-R1 evidence covers read-only observations of one Primary/Medium/Limited token; linked-token metadata, a launched executor and mutual authentication were not proved. Keep observations, policy assertions and real authority separate under design 9.2/9.7.
- Preserve the current fail-closed SID/session/logon and reciprocal token-binding policy as a conservative simulation rule, not a universal Windows UAC guarantee. Neither equal nor different TokenId/AuthenticationId independently proves a supported transition. Preserve explicit remove-data approval, exclusive claims, nonterminal ACK and the pending durable-result gate.
- Require field-aware Primary token comparison, distinct filtered/restricting-SID observations, retained-process launch evidence and a proved E-to-I bootstrap. Sequence separately authorized own-linked-token observation, inert UAC observation on a dedicated physical QA host or optional VM under design 9.8, and mutual-authentication QA as separately authorized checkpoints; no production handoff or shared-owner integration is enabled.
- Reuse open tasks 13.11, 14.1 and 14.2; keep 12.4/12.5/12.8 and all uncertified tasks open. B1/NT11, destructive ROOT-05 and productive uninstall remain NO-GO.

### HU-WIN-OPERATION-ID-UAC-P2-QA-CONTRACT boundary

- DOCUMENTED TARGET: P2 may use the dedicated physical Windows QA host or an optional isolated VM. Dedicated QA is not proof of isolation or recoverability. This exception covers only the autonomous inert observer; existing destructive, cross-account, service and product-lifecycle acceptance gates are unchanged.
- HISTORICAL OBSERVATION: P1-R6 observed the current Primary token and a returned Impersonation/SecurityIdentification linked token with stable per-token snapshots. SID/SessionId were SAME; AuthenticationId/TokenId/ModifiedId were DIFFERENT. No elevated E, UAC lineage, bootstrap, intent authority or production handoff was demonstrated.
- Separate P2-HARNESS-PREP (source, pure tests and non-elevated validation only) from P2-NATIVE (future explicit approval and operator consent). Neither is authorized to run by this documentary checkpoint. Recovery, artifact provenance and physical-host isolation must be assessed under design 9.8 before any elevation.
- Candidate independent package paths are backend-perifericos/windows-installer/qa-uac-observer/main_windows.go and main_windows_test.go in that directory. Both are absent and unmapped. Reservation is BLOCKED: scripts/governance/openspec-scope.json has unique owner implementar-gobernanza-openspec-migraciones-manus, not lifecycle. Do not edit it under this scope, create the package, or claim SINGLE_MATCH for absent unreserved paths.
- Coordinate a separately authorized governance-owner checkpoint to append only those two literal paths to the existing lifecycle entry, preserving all historical mappings and the manifest's governance owner. No wildcard, duplicate owner, exemption or transfer is proposed. Only after exact SINGLE_MATCH and scoped STRICT/apply readiness may an independent P2-HARNESS-PREP be authorized.
- Reuse tasks 14.1/14.2; retain 71 pending tasks, all checkbox states, historical PARTIAL records and every production NO-GO.

### New Capabilities

- `windows-uninstall-process-lifecycle`: Completion-aware Windows lifecycle cleanup, ownership proof, retained data and bounded recovery.

### Modified Capabilities

No registered base capability is modified by HU-WIN-001B. Related existing changes are `crear-instalador-visual-manus-terminal-windows`, `automatizar-despliegue-manus-terminal` and `preparar-empaquetado-electron-windows`. Their requirements remain separate.

## Impact

### Authorized file boundary

HU-WIN-001B recovered the lifecycle documents. HU-WIN-002E-GOV, R1 and R2 may reconcile the four editable artifacts and reserve only exact absent lifecycle paths: the four Job/supervisor files, the two root-identity files, the two managed-tree files and the two operation-identity files. No executable file, exemption, generated skill, runtime setting or enforcement downgrade is permitted.

Future code candidates are confined to installer lifecycle functions and their tests, subject to a new authorization and scope review. The scope manifest associates `main_windows.go`/`main_windows_test.go` and `productive_ui_windows.go` with historical peripheral changes; do not duplicate those mappings. Their eventual dispatch and root-security edits require an explicit ownership decision with preserved historical traceability.

### Preserved integration and deferred packaging

PR #354 is the local baseline merge. Do not recover historical printer discovery, reconciliation, Electron Agent-client changes, RAW/GDI, XP-80 feed/cut, cash drawer pulses, ROCHI/COM, POS business behavior, finance, invoicing, database or environment files.

Historical packaging provenance requirements remain pending distribution gates. The separate historical change `validar-installer-windows-independiente-estado-host` and commit `1a4cd9b3919653ebd1988926ec8cbe44dcd96ce8` are not recovered here. Artifact validation scripts that execute installer inspect/status are not static checks.

### Evidence limits

QA-05 targets an older BUILD-04 baseline and XP-58. Its instructions are retained as historical evidence, not an executable protocol for this machine. QA-terminal-22 remains PARTIAL with `readyForLiveQa=false` and `build08Justified=false`. No security-vm-acceptance.md was located in accessible Git history; VM acceptance remains UNKNOWN/BLOCKED until real evidence is supplied.
