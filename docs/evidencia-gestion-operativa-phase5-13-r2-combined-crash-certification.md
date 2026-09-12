# Gestión Operativa — Phase 5.13-R2

## Combined provider boundary

FactuCore remains one combined `issueInvoice()` operation. Manus persists
`PROVIDER_CREATE_INTENT` before invoking it. `PRE_TRANSMIT` and
`TRANSMISSION_INTENT` are not used by normal processing.

## Tests

The tests use the Phase 5.12 aggregate fixture, real PostgreSQL repositories,
real `ElectronicBillingProcessingService`, real advisory locks, and a
persistent provider mock. Crash injection is instance-local test code; no
runtime flag exists.

- Crash before intent: five iterations, `PASS`; issue calls before intent: `0`.
- Recovery after pre-intent crash: five iterations, `PASS`; one eventual issue.
- Crash after intent before issue: five iterations, `PASS`; reconciliation
  returned `RECONCILIATION_REQUIRED`, issue retry: `0`.
- Provider persisted after ambiguous issue: five iterations, `PASS`; issue
  total: `1`, duplicate issue: `0`.
- Stale recovery/status refresh race: five iterations, `PASS`; provider-linked
  recovery made no new issue.
- Real PostgreSQL concurrency regression: `5/5 PASS`.
- Combined focused run: `12/12 PASS`.
- Full Billing suite: `152 pass`, `12 skipped`, `0 fail`.

Provider status reconciliation remains fail-closed for missing or unavailable
provider state. Terminal monotonicity remains enforced. No retry API or UI was
exposed.

## Safety

No QA or production database was touched. No V076 re-execution occurred. No
live FactuCore or DIAN call occurred. No real fiscal document was processed.
No commit, push, or deploy was performed.

## Remaining gate

The combined-provider recovery contract is covered for the implemented
scenarios. Full operational retry exposure still needs product approval,
audit completion, and the remaining end-to-end status matrix review.
