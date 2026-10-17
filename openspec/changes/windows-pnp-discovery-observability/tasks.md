## 1. Discovery contracts and seams
- [ ] 1.1 Trace the `/devices/discover` request, orchestration, provider, normalization, reconciliation, and response boundaries; record the null-reference boundary with a deterministic failing test or source evidence.
- [x] 1.2 Add injectable command timing/result and sanitized diagnostic seams to the Windows printer provider; verify no live LocalService, printer, queue, or installed-state operation is reachable from the tests.
## 2. PnP observability
- [x] 2.1 Emit bounded PnP stage events for invocation, completion, timeout, execution/permission failure, empty output, parse failure, incomplete records, filtered records, and accepted Class_07 records; verify allowlisted reason codes and scalar counts only.
- [x] 2.2 Preserve queue fallback and existing physical reconciliation behavior while marking PnP failure/unknown separately from known empty inventory; verify existing device response fixtures remain compatible.
- [x] 2.3 Add API-boundary classification for null or incomplete discovery responses without changing the `/devices/discover` contract; verify null and incomplete responses are observable and not reported as physical discovery success. The historical Windows null-reference remains unconfirmed.
- [x] 2.4 Preserve matched Windows queue `portName` as additive descriptor metadata without changing queue selection or physical identity rules.
## 3. Deterministic tests
- [x] 3.1 Test command exit failure, permission denial, timeout, empty output, malformed JSON, missing CompatibleID, valid Class_07, and filtered-out records through the production provider seam.
- [x] 3.2 Test diagnostic privacy by asserting logs contain no raw instance IDs, serial numbers, full CompatibleID values, command output, personal paths, secrets, or configuration payloads.
- [x] 3.3 Test orchestration counts and reconciliation inputs for successful, failed, and unknown PnP stages; verify no false `physicalDetected=true` or availability bypass occurs.
- [x] 3.4 Run targeted backend and Electron tests, relevant lint/build checks, OpenSpec strict validation, and `git diff --check`; record preexisting failures separately.
- [x] 3.5 Test matched, unmatched, queue-only, legacy, ambiguous, and missing-port cases; verify queue port propagation does not cross-associate devices and null port metadata does not bypass print safety.
## 4. Isolated validation evidence
- [x] 4.1 Produce sanitized evidence showing the implementation and tests use only injected seams or disposable non-live fixtures; verify BUILD-04 and protected POS assets remain untouched.
- [x] 4.2 Review the final diff and OpenSpec task evidence; verify no live POST, print, service, registry, ACL, queue, PostgreSQL, AWS, installer, or source-asset mutation occurred.
