## Context

The existing Windows provider queries printer queues and PnP devices in one discovery operation. PnP exceptions are caught and replaced with an empty list, so LocalService execution failure, empty output, parse failure, and Class_07 filtering cannot be separated from normal absence. The current reconciliation and availability contracts must remain unchanged.

## Goals / Non-Goals

**Goals:**

- Add structured, sanitized stage telemetry at the provider and discovery orchestration boundaries.
- Preserve existing `/devices/discover`, device bindings, queue mapping, reconciliation, and `findRequired` behavior.
- Make the observed null-reference response diagnosable at the Agent/API boundary.
- Test every diagnostic category with injected command results and incomplete values.

**Non-Goals:**

- No change to physical-to-queue matching rules.
- No printer selection by VID/PID, port, basename, or queue name alone.
- No live LocalService probing, service restart, printer operation, or installed-state change.
- No raw PnP payload logging or new endpoint.

## Decisions

1. **Use structured existing Agent events.** Add safe metadata to the current discovery log stream instead of introducing a new API or persistence schema. This keeps operators and existing clients compatible.

2. **Classify before fallback.** The provider will retain queue fallback for compatibility, but it will emit an explicit PnP outcome. A failed or unknown PnP stage is not represented as a known zero physical-device observation.

3. **Inject command and logger seams.** Tests will provide command output, exit/error conditions, elapsed time, and diagnostic sinks. This exercises provider behavior without LocalService credentials, real printers, or Windows mutations.

4. **Keep response compatibility.** The existing discovery response shape remains unchanged. API-boundary diagnostics will classify null or incomplete response failures without changing reconciliation or availability decisions.

5. **Apply bounded sanitization.** Reason codes are a fixed allowlist such as `EXECUTION_FAILED`, `ACCESS_DENIED`, `TIMEOUT`, `EMPTY_OUTPUT`, `PARSE_FAILED`, `INCOMPLETE_RECORD`, and `FILTERED_OUT`; identifiers and command text are never emitted.

## Risks / Trade-offs

- [Risk] Queue fallback can still leave a valid queue shown as disconnected when PnP is unavailable → retain current safe behavior and expose the exact unavailable stage for later correction.
- [Risk] New metadata could leak machine identity → use allowlisted reason codes and counts only; add privacy assertions to tests.
- [Risk] The null-reference may originate outside the provider → instrument provider completion and API response boundaries separately, then classify the first failing boundary.
- [Risk] Existing log consumers may assume metadata is small → keep fields scalar, bounded, and additive.

## Migration Plan

Deploy the Agent code through the normal isolated QA build. Validate sanitized events and existing device responses in a disposable environment. Roll back by deploying the previous Agent build; no data migration or live configuration change is required.
Matched queue `portName` is additive descriptor metadata. `windowsQueueName` remains the only Windows print transport selector. Missing port metadata remains optional. The value is copied only from a safely matched queue; PnP location data is never used to invent it.
