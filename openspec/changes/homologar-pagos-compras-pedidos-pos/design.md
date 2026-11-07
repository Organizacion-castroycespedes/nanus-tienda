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

## Financial institution homologation (2026-11-06)

Starting HEAD: `eda7cfe807a8aac1d0c6818c8f8edb22abb7f6e1`. Starting branch `develop` was clean and matched its recorded upstream before creating `feature/develop/fix-document-payment-financial-institution`; no foreign changes were present.

Root cause: POS payment rows already own `financialInstitutionId`, render `FinancialInstitutionSelector`, use `getRequiresFinancialInstitutionForPos`, and send the field to sale persistence. `DocumentPaymentForm` did none of those. Its `CreateDocumentPaymentPayload`, `DocumentPaymentLineDto`, canonical fingerprint and `createInternal` adapter all omitted the field. Therefore a method with `requires_financial_institution = true` reached the existing generic server validation without an institution and returned HTTP 400 `Entidad financiera requerida para este metodo de pago`.

The existing schema is sufficient: `payments.financial_institution_id`, `financial_institutions` and `payment_method_financial_institutions` already exist. The document form will reuse the selector and catalog endpoint, loading active institutions filtered by method. The line field remains optional for wire compatibility, but the UI and server require it for configured methods. Changing method clears the selected institution.

Server validation remains authoritative. `PaymentMethodsRepository` will verify one active mapping joined to an active institution visible to the current tenant (tenant-owned or global). `PaymentsService.createInternal` will perform that check using the current transaction client before any payment write. The document adapter passes the field through and adds it to the canonical fingerprint. Persistence continues through `PaymentsRepository.createPayment` inside the same transaction, so allocations, cash movements, state reconciliation and durable operation completion retain existing atomicity.

## Method-associated catalog parity follow-up (2026-11-06)

QA exposed a second divergence after document selection was implemented. `PosScreen` calls `listFinancialInstitutions()` and passes every active tenant-visible/global institution to every method. `DocumentPaymentForm` calls `listFinancialInstitutions(paymentMethodId, true)`. The repository only joins `payment_method_financial_institutions` when `paymentMethodId` is supplied. Therefore POS can display entities that the strict payment service rejects, while documents correctly display only allowed entities.

Read-only inspection of the configured local PostgreSQL database (`ENVIRONMENT=local`, no writes) proves a separate data gap. Tenant `00000000-0000-0000-0000-000000000001` has 12 active global institutions, but Débito `ecada333-f8ef-4647-8998-de48f66e3d81`, Transferencias `93c2be97-fd47-4429-a4a6-92d2608455a3`, and QR Bre-B `e6643a9b-e205-4adb-8c1d-16aac3e7eb45` each have zero active mappings. The other two inspected tenants have the same zero-mapping condition for those three methods. The QR Bre-B migration creates the method and global institution catalog but does not create method associations.

Decision: the method association is canonical because both `FinancialInstitutionsRepository.list(...paymentMethodId...)` and `PaymentsService` enforce it. POS will load active institutions per method and validate each row against that method-specific list. An empty allowed list blocks confirmation with a configuration message. No filter is removed, no backend validation is weakened, and no mapping or migration is generated automatically.

## POS non-regression correction (2026-11-06)

The preceding parity decision is superseded. It changed established POS behavior and caused banks and wallets to disappear because the inspected methods have zero mappings. The authoritative pre-branch code proves that POS intentionally calls `listFinancialInstitutions()` without `paymentMethodId`, filters active results, and supplies the same global tenant-visible catalog to each payment row. `PaymentDialog` requires a selection when that catalog is non-empty. `PaymentsService.createInternal` previously accepted a selected active institution visible to the tenant or global; it did not require a method association. `SaleRepository.assignFinancialInstitutionsToSalePayments` enforces that same active tenant/global rule.

The branch added `isFinancialInstitutionAllowed` inside shared `createInternal`. POS sale creation calls `createInTransaction`, which delegates to that shared path. Therefore the regression is two-layered: the frontend hides all institutions when mappings are absent, and the backend now rejects an institution that the original POS catalog and sale repository accepted. Visual restoration alone does not prove successful sale persistence.

Decision for authorized automatic work: restore `PosScreen`, `PaymentDialog` and `FinancialInstitutionSelector` to their exact pre-branch catalog and selector behavior using narrow patches. Preserve document DTO, per-line state, fingerprint, atomicity and persistence changes. Do not automatically alter the backend association policy. Proposed follow-up requiring explicit approval: keep the original active tenant/global validation as the default for POS and legacy payment creation, while applying active method-association validation only inside `POST /finance/payments/document`. This preserves tenant isolation and POS compatibility while retaining the stricter document contract.

## Authorized TENANT_ACTIVE document policy (2026-11-06)

The owner explicitly authorized purchase and order document payments to accept an active institution owned by the current tenant or global without requiring a row in `payment_method_financial_institutions`. This supersedes the proposed document-only `METHOD_ASSOCIATED` split. `DocumentPaymentForm` loads `GET /finance/financial-institutions?active=true` without `paymentMethodId`, filters any stale inactive response, and gives the same authorized catalog to every line whose method requires an institution. Selection remains independent by line and is cleared when its method changes.

`PaymentsService.createInternal` returns to its pre-branch `TENANT_ACTIVE` validation. A submitted institution is queried inside the existing transaction client with `active = TRUE AND (tenant_id = current tenant OR tenant_id IS NULL)`. The method-level `requires_financial_institution` check remains authoritative. DTO UUID validation, reference requirements, cash-session and branch scope, live balance, allocations, rollback, operation fingerprint and replay handling are unchanged. Removing the branch-added mapping check also restores backend compatibility for POS and legacy callers without modifying their files or payload contracts.

No repository association row is deleted and the administration mapping API remains available for configuration use. It is simply not an authorization gate for payment creation. No database migration or data write is required.

## Orders responsive workspace expansion (2026-11-06)

The owner explicitly authorized this frontend-only UX work on the current financial branch. The expansion is traceable in this same change because the orders page is already an affected purchase/order payment surface. Financial implementation and evidence remain intact. POS, backend, database, payment contracts, calculations and order state transitions are outside this UX scope.

Discovery found local layout defects, not a global shell width limit. The tenant content area already exposes the available width. The orders table instead has `min-w-[1120px]` without `w-full`, so it can remain near its intrinsic minimum on wide desktops and leave unused space. Eleven unconstrained columns then compete for width. Monetary columns lack stable right alignment and no controlled widths reserve room for customer, status or actions. The filter grid uses only two columns below `xl`, which makes intermediate desktop widths unnecessarily tall. Product rows switch to five columns at `md`, compressing the product selector and four numeric/action areas at 768 px. Delivery and invoice product tables use `min-w-full` without a readable minimum or column allocation, so long product names compete with quantities and amounts.

Decision: keep every change local to the orders route and three order form components. The main table will fill wide containers, use a fixed readable minimum with explicit column allocation, wrap descriptive text, keep monetary values aligned, and expose a labelled keyboard-focusable horizontal scroll region when the viewport is narrower. Filters will progress through 1/2/3/4/6 columns. Product edit rows will not use the five-column layout until `xl`; the selected long product name remains visible as wrapped supporting text. Delivery and invoice tables will reserve product width, align numeric values and use controlled horizontal scrolling. Existing `RowActionsMenu`, pagination, loading/empty states, data fetching, callbacks and form logic remain unchanged.

Acceptance evidence combines focused source-contract tests, lint, type checking, production build, strict OpenSpec and the responsive matrix at 1920, 1440, 1180, 1024, 768 and 390 px. Automated class/contract checks are not represented as real browser QA. Any viewport that cannot be exercised against an authenticated data-bearing environment remains explicitly manual or blocked.
