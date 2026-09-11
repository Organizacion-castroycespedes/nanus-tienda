# FactuCore runtime failed-check capture

## Scope

- FactuCore patch: `HttpExceptionFilter` now preserves bounded, sanitized `DIAN_READINESS_VALIDATION.failedChecks`.
- The filter previously retained only `message`; `readiness.missing` was lost during HTTP serialization.
- No sale or electronic document was created or processed in this phase.

## Validation

- Focused filter test printed `HTTP exception filter tests passed.` using the direct Node/ts-node launcher.
- The test process did not terminate cleanly because of an open Node handle; exit completion was therefore not available.
- FactuCore build: PASS.
- The response now includes `statusCode`, `code`, `message`, and sanitized `failedChecks`.
- Each check is bounded; sensitive message values are redacted. Candidate and PII values are not serialized.

## Runtime gate

- The existing local process on port `8000` was stopped and the current `dist/src/main.js` was started.
- The new process hung before binding port `8000`; it was stopped by PID.
- Because the patched runtime could not be proven active, no retry or provider POST was allowed.
- Authenticated read-only checks had passed before the restart attempt; no provider mutation occurred.

## Safety result

- FactuCore create calls: `0` in this phase.
- XML, sign, transmit calls: `0`.
- Provider document count: `0`.
- Worker: disabled.
- Historical documents: untouched.
- Secrets and PII: not written to this evidence.

## Next gate

Start FactuCore successfully with the patched build, verify health and authenticated read-only access, then capture the real failed checks in a separate controlled phase. Do not retry until runtime patch loading is proven.
