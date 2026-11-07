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

## 7. Financial institution homologation

- [x] 7.1 Re-verify clean develop base, create the authorized feature branch, and map POS selector/rules, document form, DTO, service, repositories, catalog association and existing schema.
- [x] 7.2 Reuse the financial-institution selector and method-filtered catalog in DocumentPaymentForm; preserve per-line state, mixed methods, accessibility and purchase/order adapters.
- [x] 7.3 Extend document web type and DTO with optional per-line financialInstitutionId; include it in the durable fingerprint and transactional payment creation.
- [x] 7.4 Enforce active, tenant-visible and method-associated institution validation without weakening reference, balance, cash-session or legacy compatibility rules.
- [x] 7.5 Add focused coverage for cash omission, required/invalid/foreign institutions, references, mixed purchase/order payments, rollback and idempotent replay/conflict.
- [x] 7.6 Run focused tests, web lint/typecheck/build, API build, strict OpenSpec validation, governance diagnostics and git diff checks; update qa.md with PASS/FAIL/BLOCKED/PARTIAL evidence.

## 8. Method-associated catalog parity follow-up

- [x] 8.1 Record the global-versus-filtered query divergence and read-only QR Bre-B/debit/transfer mapping evidence without modifying database data.
- [x] 8.2 Make POS consume the same active per-method association catalog as document payments; keep selection per line and clear it on method change.
- [x] 8.3 Cover global versus filtered catalogs, empty QR Bre-B configuration, debit/transfer associations, active/inactive and tenant/global visibility, search/selection, and backend rejection.
- [x] 8.4 Run focused tests, web lint/build, API build, strict OpenSpec and governance diagnostics; record PASS/FAIL/BLOCKED/PARTIAL and manual QA.

## 9. POS non-regression correction

- [x] 9.1 Compare pre-branch POS catalog, selector, shared payment validation and sale persistence with the branch diff; record the UI and backend regression evidence.
- [x] 9.2 Restore the exact pre-branch POS global active catalog and selector behavior through narrow patches without touching unrelated sale logic.
- [x] 9.3 Update focused tests and verify POS receives the original 12 active institutions while document per-line selection, method clearing and mixed payments remain intact.
- [x] 9.4 Present the document-only association-validation policy, multi-tenant impact and required approval; do not implement that backend policy split automatically.

## 10. Authorized TENANT_ACTIVE document payments

- [x] 10.1 Update the document contract to accept active tenant-owned/global institutions without method mappings and keep POS source files out of scope.
- [x] 10.2 Load the active tenant-visible/global catalog once in DocumentPaymentForm; preserve per-line selection, method clearing, references and mixed payments.
- [x] 10.3 Restore server validation to active tenant/global checks through the existing transaction client; preserve UUID, required institution, rollback and idempotency controls.
- [x] 10.4 Cover purchase/order cash, debit, transfer, QR Bre-B without mapping, inactive/foreign institutions, references, mixed/partial payments, persistence, rollback and replay.
- [x] 10.5 Run focused tests, lint, builds, strict OpenSpec, governance and Git/POS no-diff checks; update QA evidence.

## 11. Orders responsive UX expansion

- [x] 11.1 Inspect the real orders route, filters, table, action menu, product editor, delivery/invoice detail tables and tenant shell; document the demonstrated width and truncation causes.
- [x] 11.2 Make the orders filters and list use available desktop width, stable readable columns and an accessible controlled horizontal overflow without changing data or actions.
- [x] 11.3 Improve long-product readability and responsive column allocation in order edit, delivery and invoice presentations without changing form calculations or callbacks.
- [ ] 11.4 Add focused layout contract coverage and validate the 1920/1440/1180/1024/768/390 matrix, long names, multiple products, filters, actions, pagination and overflow; distinguish automated evidence from real visual QA.
- [x] 11.5 Run web lint, typecheck and build plus strict OpenSpec, governance and Git/POS/financial no-regression checks; record truthful PASS/FAIL/PARTIAL/BLOCKED evidence.
