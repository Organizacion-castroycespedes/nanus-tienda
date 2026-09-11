# FactuCore transmission event contract

- Scope: read-only analysis for provider document `33b68113-0737-4492-9bf4-ccbe84ccb58c`.
- No provider call, queue execution, polling, or document mutation occurred.

## Creation sites

- `DocumentsService.queueTransmission()`: creates `TRANSMISSION_REQUESTED` before `TransmissionDispatchDriver.schedule()`. Meaning: API/user requested and scheduling was recorded.
- `DocumentsService.executeTransmission()`: creates the same event after the provider response, in the persistence transaction that creates `TransmissionAttempt` and updates the document. Meaning: provider transmission result was recorded; it is not a new queue request.
- `DocumentsService.executeRefreshStatusCore()`: creates the same event for a status refresh, also with `isRefresh: true`. Meaning: status lookup was requested/recorded.

## Contract finding

`TRANSMISSION_REQUESTED` is an overloaded lifecycle audit event. It is not a unique request key, not a job singleton key, and not a send idempotency guard. A normal asynchronous successful flow produces two events: one for scheduling and one for the completed provider transmission record. Status refreshes can add more.

Read-only QA counts in the controlled tenant:

- `SETP990000006`: 1 event, 0 attempts, `SIGNED`.
- `SETP990000005`: 2 events, 1 attempt, `ACCEPTED`.
- `SETP990000003`: 2 events, 1 attempt, `ACCEPTED`.
- `SETP990000002`: 14 events, 13 attempts, `ACCEPTED`.

The first event alone does not prove a send. A second event alone does not schedule a job or send to DIAN. Calling `executeTransmission()` a second time is different: the private core calls the provider before persisting its second audit event and has no event-count guard.

## Correct invariant

The valid invariant is: audit-event count may increase by lifecycle phase; provider send count and successful `TransmissionAttempt` state must remain idempotent. The prior requirement that the event count remain exactly `1` was too strict for this production event model.

The lower-level `TransmissionService.transmitDocument()` exists, but it is not a safe direct entrypoint because it bypasses document persistence, attempt recording, status guards, and audit semantics.

## Final state

- Controlled document unchanged: `SIGNED`, 0 attempts, 1 `TRANSMISSION_REQUESTED`, provider count 1.
- Next safe send method, if separately authorized: normal `executeTransmission()` flow with its normal audit event.
- This task performed no real DIAN operation.
