## Context

Starting HEAD: f6ba7102863f540125e8a42e48a1e8c5d674c0e9. Branch: feat/develop/mejora-visual-proceso-pago-compras-pedidos. Untracked .tmp/ explicitly excluded and preserved.

POS: web/modules/pos/components/PosScreen.tsx owns payment state via cart, active method catalog, cash session, editable customer, cash rebalance, effective payments after change, and createSale with payments array. Payment modal uses shared Modal, Input and Button; focuses amount on open, method selection and addition. processingSale controls closing/loading. Business validation requires full coverage and disallows duplicate methods. Do not alter these semantics.

Purchases: web/app/[tenant]/purchases/page.tsx renders contextualPanel for purchaseId/action=pay; inventory/purchases resolves this page. DocumentPaymentForm receives PURCHASE/OUT, totalPaid/balanceDue/paymentStatus and effective received/liquidated totals. supplierId/supplierName are already in source response. Existing callback closes to list, refreshes queried purchases and invokes existing peripheral feedback (preserve integration).

Orders: web/app/[tenant]/orders/page.tsx uses formMode=payment and selectedPaymentOrder with SALES_ORDER/IN. Source exposes customerId/customerName. Same DocumentPaymentForm allows partial payments and notes per line; callback refreshes orders. No customer field is currently sent to finance payment creation.

Shared finance form loads catalog and current cash once on mount. It validates methods, required references, positive amounts, branch/session, pending balance and overpayment. Amount starts empty. A loop calls createPayment once per line. Each backend create commits independently. If line 2 fails, line 1 remains persisted; form retains both lines and generic error. No batch endpoint or idempotency key in PaymentsController/CreatePaymentDto. PaymentsService validates balance before its owned BEGIN; findReferenceDocument has no row lock. Thus client-only split cannot satisfy atomicity or concurrency safety.

Money: existing shared payment-allocation.helper.ts uses two-decimal rounding and permissive numeric parsing. Extend this location for strict document input and integer-cent sum/remainder without changing POS parsing/rebalance behavior. No decimal dependency is installed in web.

## Goals / Non-Goals

Goals: shared visual payment controls, locked source party, contextual modal, pending defaults, partial payment preservation, safe split submission, accessible keyboard operation.

Non-goals: generalized sale/order/purchase business engine; global Modal rewrite; schema changes; authentication/tenant changes; peripheral changes; replacing canonical status derivation.

## Decisions

1. Extract PaymentMethodSelector from POS markup with its tokens and explicit selected semantics. POS retains its own handlers, amount/ref fields, customer picker and summary. DocumentPaymentForm remains shared between orders/purchases; avoid three separate composers or giant source switches.
2. Add payment-scoped dialog around existing Modal appearance with focus containment/restoration, Escape, initial amount focus and scroll bounds. Confirmation uses explicit button activation; Enter in text fields cannot submit. Disable editing/closing during financial request with synchronous ref guard, not state alone.
3. Supply locked party label/id/name from source document; display id fallback for historical unnamed relation. Do not persist another party. Missing required id blocks payment. Labels and direction come from page adapter. Purchase effective total remains supplementary; pending comes from canonical backend balanceDue.
4. Default first amount to pending. Additional line defaults to uncovered balance and remains automatic until edited; changing earlier lines recalculates only automatic remainder. Editing first amount alone preserves partial payment. Reject malformed/negative/excess precision inputs rather than silently stripping characters. Aggregate in cents using existing helper location.
5. Keep purchase action deep link, show underlying purchase context, and return to document context on success. Orders keep selected order context; refresh financial values without full browser reload. Preserve existing callback functionality and notes.
6. Backend extension approved and implemented at `POST /finance/payments/document`. It accepts document identity, active cash session and payment lines only; server derives direction (`PURCHASE` OUT, `SALES_ORDER` IN), source party existence and live balance. One `BEGIN` locks the source row and cash session, revalidates balance, validates methods/references, writes payment/allocation/cash movement and syncs document state through the same client, then commits. Existing `POST /finance/payments` remains compatible and now locks document references for document types.

## Risks / Trade-offs

- Existing consumers -> preserve the single-line endpoint and DTO; document endpoint is additive.
- Existing balance reads before BEGIN -> concurrency tests and source lock required; frontend refresh alone is insufficient. Legacy writers also need inspection before claiming universal protection.
- Durable idempotency is now implemented through a tenant-scoped operation table; the client supplies one UUID per confirmation lifecycle. Same-key/same-fingerprint replays recover stored payment IDs, while same-key/different-fingerprint requests conflict.
- Existing Modal lacks focus trap -> payment-scoped focus handling avoids global modal regression.
- Existing POS money parser sanitizes negatives -> document strict wrapper, preserve POS behavior and regression tests.
- Live QA needs reachable app/API and representative authorized documents -> distinguish mocked UI checks from real financial persistence and report unavailable scenarios as unverified.

## Migration Plan

Migration: `scripts/database/finance/migrations/20260914_1200_document_payment_idempotency.sql` creates `document_payment_operations`, keyed by `(tenant_id, operation_key)`, with SHA-256 request fingerprint, source reference, status and payment UUID array for replay recovery. It is additive, does not backfill historical payments, and is included in `migrate_prd.sh`. The operation claim, all payment/allocation/cash writes and completion update share the existing transaction. A rollback is a forward deployment rollback (remove API use first); historical payment rows are left intact. Real PostgreSQL certification remains blocked because configured DB host is remote QA and no isolated local test DB is available.

The operation key is optional for legacy callers; the service generates an ephemeral UUID when absent. New frontend confirmations send and retain a UUID across a controlled retry. Legacy single-payment endpoint remains unchanged.

## Responsive correction

Manual QA found that `PaymentDialog` wrapped the existing fixed `Modal` in a native `<dialog>` without a viewport height cap. The modal content therefore grew beyond short POS screens and the action row fell below the viewport. The shared `Modal` now owns a responsive viewport-safe shell (`max-h: calc(100dvh - margin)`, small padding, `min-h-0`, `flex-col`, `overflow-hidden`) and an internal `flex-1 overflow-y-auto` body. Its header is fixed within the shell; document payment actions are sticky at the bottom of the internal scroll area. `PaymentDialog` locks document body scroll, restores prior focus, traps Tab, handles Escape while idle, and restores focus on close. Summary cards use two columns before wide desktop four-column layout; method cards wrap and form fields stack at small widths. This changes the shared primitive only in layout/accessibility behavior; business semantics stay unchanged.

The requested guard sizes are 1366x768, 1280x720, 1024x768 and 1024x600 at 100% zoom. Browser automation is unavailable in this environment, so these remain environment-blocked manual assertions; production build verifies all responsive classes and routes compile.
