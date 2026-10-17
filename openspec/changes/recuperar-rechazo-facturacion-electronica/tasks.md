## 1. Implementation

- [x] 1.1 Confirm existing Outbox and operational recovery contracts.
- [x] 1.2 Extend Billing eligibility for `REJECTED` + `FACTUCORE_VALIDATION` + `PROVIDER_CREATE_INTENT`.
- [x] 1.3 Extend the guarded transactional repository transition for this exact state.
- [x] 1.4 Preserve remote absence lookup, tenant lock, idempotency, and original Outbox history.

## 2. Validation

- [x] 2.1 Add focused regression for confirmed absence recovery.
- [x] 2.2 Run focused Billing processing tests.
- [x] 2.3 Run Billing build and OpenSpec strict validation.
- [ ] 2.4 Execute one controlled QA recovery only after fresh FactuCore identity verification and explicit operator approval.
