## 1. Discovery and authorization gate

- [x] 1.1 Verify branch, starting HEAD and clean scope except explicitly excluded .tmp/; record evidence in design.md.
- [x] 1.2 Map POS, purchases, orders, shared money/catalog/modal and backend payment contracts; deliver architecture report in design.md.
- [x] 1.3 Obtain explicit authorization for bounded document-payment backend extension; record decision and implement only approved payment scope.

## 2. Shared payment primitives

- [x] 2.1 Add shared visual payment method selector without changing POS business logic; verify web build.
- [x] 2.2 Extend existing payment helper for strict document amounts, cent sums, pending defaults and automatic remaining line; add 35000000/10000000/25000000 and decimal/invalid assertions.
- [x] 2.3 Add payment-scoped dialog lifecycle, Escape handling, Enter protection and loading disable; verify web build.
- [x] 2.4 Correct shared modal viewport sizing, internal body scroll, sticky payment actions, responsive summary/method layout and background scroll lock; record guard-resolution limitation in qa.md.

## 3. Purchase adapter

- [x] 3.1 Integrate contextual dialog preserving purchaseId/action=pay and immutable supplier.
- [x] 3.2 Preserve partial payments, notes, effective purchase totals, OUT and financial refresh; connect one atomic request.

## 4. Order adapter

- [x] 4.1 Integrate shared dialog with locked order customer and IN; verify source identity and pending default in code/build.
- [x] 4.2 Preserve partial payments and order context after refreshed backend status; connect one atomic request.

## 5. Financial contract gate implementation

- [x] 5.1 Implement approved atomic document-payment contract preserving existing endpoint and schema; add rollback/concurrency tests.
- [x] 5.2 Connect form to atomic contract; synchronous duplicate-submit guard and no automatic retry.
- [x] 5.3 Add tenant-scoped durable document-payment operation identity, canonical fingerprint, replay recovery and same-key conflict handling; add additive migration and preserve legacy callers.

## 6. Regression and delivery

- [ ] 6.1 Verify POS open/select/amount/reference/add/summary/customer/confirm/close flow; record actual evidence.
- [x] 6.2 Run targeted backend payment tests; helper assertions added but frontend runner is not configured.
- [x] 6.3 Run available runtime/manual checks and distinguish unverified authenticated persistence scenarios in qa.md.
- [x] 6.4 Run web lint/build, affected API build, OpenSpec strict and git diff --check; record results.
- [x] 6.5 Report final branch/HEAD/git status separating task files from .tmp/; do not commit, push or claim unverified PASS.
