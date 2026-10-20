## Why

The existing recovery contract handles pre-provider technical failures, but not a provider validation rejection that occurred at `PROVIDER_CREATE_INTENT` after the Outbox event was successfully published. This leaves a corrected, provider-absent document stranded even when safe recovery is possible.

## What Changes

- Extend the existing provider-create recovery path for `REJECTED` documents with `FACTUCORE_VALIDATION`, no provider document, and `PROVIDER_CREATE_INTENT`.
- Require provider lookup to prove remote absence before resetting the same document for processing.
- Preserve tenant scoping, document identity, original Outbox history, and concurrency locks.
- Keep unknown provider state and provider-present state fail-closed.

## Capabilities

### New Capabilities

- `provider-rejected-recovery`: Safely recover a provider validation rejection after confirmed remote absence.

### Modified Capabilities

- `tenant-electronic-billing-admin`: none; this change does not alter configuration administration.

## Impact

- Billing Backend processing and repository recovery predicates.
- Existing MANUS operational-sales recovery route and Billing internal `recover-processing` contract.
- Focused Billing processing tests and OpenSpec validation.
- No migration, frontend change, FactuCore change, or QA data mutation.
