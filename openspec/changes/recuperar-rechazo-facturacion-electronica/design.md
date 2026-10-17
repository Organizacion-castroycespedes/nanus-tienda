## Context

The original principal QA document was rejected with `FACTUCORE_VALIDATION` at `PROVIDER_CREATE_INTENT`, while the MANUS Outbox event was already `PUBLISHED`. The existing operational route calls Billing `POST /internal/electronic-billing/documents/:documentId/recover-processing`, which performs provider lookup before recovery.

## Decision

Reuse the existing `recover-processing` route, document lock, provider resolver, external-reference lookup, transactional repository update, event append, and background processing. Expand only the eligibility predicate and repository transition to accept the exact rejected validation state:

- status `REJECTED`;
- error code `FACTUCORE_VALIDATION`;
- processing stage `PROVIDER_CREATE_INTENT`;
- non-empty external reference;
- no provider document ID.

The provider adapter must first return confirmed absence (`404`). A provider document found by reference is reconciled and never recreated. Timeout, network failure, malformed response, unknown status, or provider presence fail closed.

The transition uses the same tenant/document processing lock and transaction. It changes only the electronic document to `PENDING` / `PRE_PROVIDER_CREATE`, appends the existing recovery event, and leaves the original Outbox event unchanged. A later worker performs normal idempotent processing.

## Safety

- Tenant ID is required in every repository and provider call.
- Existing provider document IDs prevent create recovery.
- Concurrent recovery is rejected by the existing document lock or state transition.
- Sale, payment, fiscal identity, credentials, and Outbox rows are not rewritten.
- No migration is required.

## Rejected Alternatives

- Directly changing the QA document or Outbox state: rejected; bypasses audit and concurrency controls.
- Reusing the existing MANUS Outbox recovery endpoint: rejected; it requires an Outbox event in `FAILED`, but this event is `PUBLISHED`.
- Blindly calling retry: rejected; provider absence must be proven first.
