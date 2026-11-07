# QA evidence

Date: 2026-09-14. Branch: `feat/develop/mejora-visual-proceso-pago-compras-pedidos`. Starting HEAD: `f6ba7102863f540125e8a42e48a1e8c5d674c0e9`.

## Automated

- `api/.\node_modules\.bin\tsx.cmd --test src/modules/finance/payments/document-payment-transaction.spec.ts src/modules/finance/payments/payments.service.spec.ts`: 7 passed, 1 skipped. The skipped case is the optional PostgreSQL integration because repository env points to remote QA; no remote write was attempted.
- `api/npm.cmd run build`: passed.
- `web/npm.cmd run build`: passed. Existing lint warnings remain in unrelated pages.
- `web/npm.cmd run lint`: passed with existing warnings.
- `npx.cmd @fission-ai/openspec@1.3.1 validate homologar-pagos-compras-pedidos-pos --strict`: passed.
- `git diff --check`: passed.

## Responsive correction

Root cause: the previous payment wrapper had no dynamic viewport height, no internal flex scroll body, and actions lived after unconstrained content. Fixed through the shared responsive `Modal` mode and `PaymentDialog` lifecycle.

Expected structure after correction: fixed viewport shell with `100dvh` cap and margins, fixed modal title/header, internal payment body scroll, sticky confirm/cancel row, wrapped method cards, two-column compact summary below wide desktop, stacked fields, body scroll lock and focus restoration.

Guard matrix (browser automation unavailable in this environment):

| Viewport | Purchase 1 line | Purchase 3 lines | Order 1 line | Order 3 lines |
|---|---|---|---|---|
| 1366x768 | BLOCKED BY ENV | BLOCKED BY ENV | BLOCKED BY ENV | BLOCKED BY ENV |
| 1280x720 | BLOCKED BY ENV | BLOCKED BY ENV | BLOCKED BY ENV | BLOCKED BY ENV |
| 1024x768 | BLOCKED BY ENV | BLOCKED BY ENV | BLOCKED BY ENV | BLOCKED BY ENV |
| 1024x600 | BLOCKED BY ENV | BLOCKED BY ENV | BLOCKED BY ENV | BLOCKED BY ENV |

Static verification: web production build passed; no horizontal-overflow classes were introduced in the payment body. Authenticated browser rendering and touch/scroll behavior require a local browser/session and remain unverified.

Automated coverage includes atomic full and partial split, rollback on invalid second method, rollback of cash movement and audit, direction OUT/IN, stale overpayment, serialized concurrent adapter requests, source-party field rejection, required reference, monetary precision, legacy single payment and document amount helper arithmetic.

## Manual / runtime

- `curl.exe -I http://localhost:3000`: HTTP 200 from the existing Next dev server.
- Authenticated purchase/order/POS flows were not executable without a local authorized user/session and representative documents. UI structure and route contracts were verified by successful production build.
- Real PostgreSQL row-lock test remains unverified. The integration test is opt-in (`PAYMENT_TEST_POSTGRES=1`, `PAYMENT_TEST_ENV=<local-env>`) and refuses non-local hosts.

## Real PostgreSQL certification attempt

- Local `postgresql-x64-18` service is running and `127.0.0.1:5432` is reachable.
- Docker CLI is unavailable; the repository compose file has no PostgreSQL service.
- Local authentication with the existing `api/.env` user failed.
- `api/.env` points to `54.242.102.178` (QA). No remote connection, migration, fixture, rollback or financial test was attempted.
- Result: no disposable isolated database could be established. Scenarios 1-10 are **BLOCKED BY ENVIRONMENT**; no cleanup was necessary.

## QA database verification

- Configuration source: `scripts/config/db.env`, `ENVIRONMENT=qa`, database `manus_tienda_qa`.
- Read-only `psql` verification succeeded against QA without printing credentials.
- `public.document_payment_operations` exists with the expected columns, tenant-scoped unique index, reference index and zero rows before functional use.
- Migration was manually applied by the QA operator with `psql`, `ON_ERROR_STOP=1` and `--single-transaction`; it was not reapplied here.
- Current API process is not running locally. Read-only QA inspection found pending purchases/orders and open cash sessions, but no dedicated test-document marker. No payment was posted against an unverified shared document.
- Purchase, order, same-key replay/conflict, distinct-key and direction scenarios remain **BLOCKED BY QA FIXTURE/API SESSION**.

## Dedicated idempotency document precheck

- Requested QA reference: `Pedido 846f66fb`, UUID `b2aa9ab0-773d-468d-a45e-bacd87c3ae82`.
- Read-only lookup in canonical `public.orders` found **no order** with UUID `b2aa9ab0-773d-468d-a45e-bacd87c3ae82`.
- Alternate inspection shows that UUID belongs to a customer. An order beginning with `846f66fb` exists under a different full UUID and is therefore not assumed to be the authorized document.
- Per the QA stop condition, no operation key was generated, no API request was sent, and no financial rows changed.
- Same-key replay/conflict and distinct-key certification remain **BLOCKED: source document identity mismatch**.

## Authorized order idempotency attempt

- Correct authorized order confirmed: `846f66fb-aba5-43c6-b2bb-d46f66b820f4`, tenant `00000000-0000-0000-0000-000000000001`, total `55000.00`, paid `0.00`, pending `55000.00`, status `PENDING`.
- Branch `ab41d3da-6686-4de3-9191-875a5a7da5a5` and an open QA cash session were present. Transfer method `93c2be97-fd47-4429-a4a6-92d2608455a3` was selected for a conservative `5000.00` partial payment.
- Current source contains the durable endpoint, but the already-running process on port `4020` could not be proven to be the current working-tree runtime. Starting the current API through the canonical command loaded the current routes but failed with `EADDRINUSE` because port `4020` was occupied.
- One controlled request using operation key `8cd78a77-8cc2-43b1-8472-a0ecdbc8d4fb` reached the occupied older process. It produced one `5000.00` `IN` payment/allocation and changed the order to paid `5000.00`, pending `50000.00`, but no `document_payment_operations` row and no durable operation result. The response did not provide a usable HTTP status/body.
- This historical attempt is evidence that port `4020` was not certified current. No replay, changed-payload or second-key request was sent through that process. The orphaned test payment remains visible on the explicitly authorized QA order and is reported for operator reconciliation.

## Durable idempotency certification on current API

- Current working-tree API was started on port `4099` with QA configuration and exposed `POST /api/finance/payments/document`. Legitimate seeded QA authentication used `user+default@manustienda.local` with the existing QA session/cash context.
- Baseline before current-runtime tests included the earlier old-runtime orphan: order paid `5000.00`, pending `50000.00`.
- Chosen method: `Transferencias` (`93c2be97-fd47-4429-a4a6-92d2608455a3`), amount `5000.00`, branch `ab41d3da-6686-4de3-9191-875a5a7da5a5`, cash session `b0b50e4f-9204-47bb-88ea-230e128c35f7`.
- K1: `64eb3c30-0266-475b-8fe1-18aeb4fd9ed8`.
  - First request: successful response with payment `4abaeeef-8b6e-4b87-8f5f-2d325c6c31b4` and allocation `3b43647e-0a9e-4811-aaa4-9d2786f4770d`.
  - Replay with identical payload: successful recovery of the same payment/allocation IDs. No new rows or balance decrement.
  - Operation row: `2e449623-25b2-4e43-8a3e-e3a81f1f1845`, status `COMPLETED`, one payment ID.
- K1 changed-payload conflict: same K1 with amount `5001.00` returned HTTP `409`; no new payment, allocation, cash movement, operation completion or balance change.
- K2: `c9389ff8-0132-4230-ab66-bfb29a587681` with the same valid business values succeeded independently. Payment `fe669698-ba00-4f43-a96b-d3e3f78c99a2`, allocation `326763af-e6a1-432e-8ec7-7cf6941e09fe`, operation row `4224771c-36a7-410b-a027-7f7bbd9b0691`, status `COMPLETED`.
- Final order state: total `55000.00`, paid `15000.00`, pending `40000.00`, payment status `PARTIAL`.
- Final related rows: three payments, three allocations and three cash movements. Two are current durable operations (K1/K2); one `QA-IDEMP-A-5000` payment is the earlier old-runtime orphan and is excluded from idempotency success arithmetic.
- Result: same-key replay, same-key conflict and different-key independence **PASS** for current API. Concurrency and real rollback remain blocked by the stated safety rules.

## Human manual QA evidence

- Human operator completed manual QA and reported **PASS** for the implemented purchase payment experience, order payment experience, responsive small-screen behavior and relevant POS regression.
- This evidence covers the requested purchase/order modal behavior and POS smoke flow. No additional unobserved browser details are inferred here.
- Therefore implementation/manual statuses are recorded as PASS; durable idempotency, real concurrency and real rollback remain separate technical certifications and are not promoted from this manual result.

## Known limitation

Durable idempotency is implemented in application code and migration, but real PostgreSQL certification is still blocked. Rapid duplicate UI submission is blocked synchronously; the backend additionally uses a tenant-scoped unique operation key and request fingerprint.

## Idempotency discovery

Existing durable mechanism before this change: **NO** for document-payment operation identity. `uq_cash_movements_payment_once` only prevents two cash movements for the same already-created payment. New mechanism: `document_payment_operations` with unique `(tenant_id, operation_key)`, SHA-256 canonical fingerprint and stored payment IDs. Same key and same payload returns the committed result; same key with different payload raises conflict; a new key remains a new payment operation.

Exactly-once implementation status: **IMPLEMENTED, REAL DB CERTIFICATION PENDING**. The operation row is claimed and locked in the same transaction as document locking, balance validation and all financial writes. A failed operation rolls back its operation claim, so a later controlled retry can reuse the key safely.

Real PostgreSQL certification: **BLOCKED BY ENVIRONMENT**. Docker is unavailable, local credentials do not authenticate, and current env points to non-local QA; remote destructive/concurrency tests were not run.

## Financial institution homologation - 2026-11-06

Branch: `feature/develop/fix-document-payment-financial-institution`. Starting `develop` HEAD: `eda7cfe807a8aac1d0c6818c8f8edb22abb7f6e1`. Worktree was clean before branch creation; no foreign changes were present.

### Automated evidence

- PASS: `api/npm.cmd exec -- tsx --test src/modules/finance/payments/document-payment-transaction.spec.ts src/modules/finance/payments/payments.service.spec.ts`: 11 passed, 1 skipped. The skipped test is the opt-in local PostgreSQL integration; no QA/PRD write was attempted.
- PASS: focused transaction coverage includes cash without institution, required institution, unassociated/foreign institution rejection, required reference, mixed cash/transfer for purchase and order, full rollback, same-key replay, changed-institution conflict and older-client omission.
- PASS: `api/npm.cmd run build`.
- PASS: `web/npm.cmd run lint` with no warnings or errors.
- PASS: `web/npm.cmd run build`, including Next.js compile, lint/type validation and purchase/order/POS routes.
- PARTIAL: standalone `web/npx.cmd tsc --noEmit` failed on pre-existing unrelated `*.spec.ts` type debt and an unwritable `tsconfig.tsbuildinfo`; it reported no changed-file error. Canonical Next.js build type validation passed.
- PASS: `npx.cmd --yes @fission-ai/openspec@latest validate homologar-pagos-compras-pedidos-pos --strict` using OpenSpec 1.16.0.
- PASS: scope manifest parses and the repository diagnostic reports `manifest_valid: true`, exact current ownership for this OpenSpec, no migration regression, no database access and no historical SQL replay.
- BLOCKED: the strict governance wrapper cannot execute the OpenSpec child from Python in this Windows sandbox (`WINDOWS_CHILD_PROCESS_ACCESS_DENIED` / inaccessible npm cache). It therefore reports `STRICT_REJECTED` even though the same strict OpenSpec command passes directly. This is tooling/environment evidence, not a runtime test failure.
- PASS: `git -c core.whitespace=cr-at-eol diff --check`. The option is required because `payments.service.ts` is a repository CRLF file and default Git treats added CR characters as trailing whitespace.

### Contract and persistence evidence

- `CreateDocumentPaymentPayload.payments[]` and `DocumentPaymentLineDto` accept optional `financialInstitutionId`.
- `DocumentPaymentForm` reuses `FinancialInstitutionSelector`, `listFinancialInstitutions(paymentMethodId, true)` and `getRequiresFinancialInstitutionForPos`; method change clears stale institution selection.
- The server requires the institution for configured methods and validates an active mapping joined to an active tenant-visible or global institution through the existing transaction client.
- The canonical operation fingerprint includes the institution. Persistence continues through existing `PaymentsRepository.createPayment` and `payments.financial_institution_id`; no migration is needed.

### Manual QA still required

- Purchase: cash-only payment without institution, then transfer/bank payment with selector and persisted institution.
- Order: same two flows, plus mixed cash and transfer lines in one confirmation.
- Confirm method change clears the prior institution, keyboard selection remains usable, required-reference messaging still appears, and refreshed document balances/status are correct.
- Inspect created payment read-only to confirm `financialInstitutionId`; repeat one controlled request only in an isolated authorized fixture to verify same-key recovery. Do not test against shared or production documents.

## Method-associated catalog parity follow-up - 2026-11-06

### Demonstrated root cause

- POS called `GET /api/finance/financial-institutions?active=true` through `listFinancialInstitutions()` and supplied all active tenant-visible/global institutions to every method.
- Purchase/order document payments called `GET /api/finance/financial-institutions?paymentMethodId=<method-id>&active=true`.
- `FinancialInstitutionsRepository.list` only joins `payment_method_financial_institutions` when `paymentMethodId` is present. `PaymentsService` always validates a submitted institution against an active mapping and an active tenant-visible/global institution.
- Therefore the POS global list was not a list of allowed institutions. It could show an institution later rejected by the backend. The document list was strict and correctly exposed missing configuration.

### Read-only database evidence

Source: configured `scripts/config/db.env`, `ENVIRONMENT=local`, `DB_HOST=localhost`, database `manus_tienda_qa`. Only `SELECT` statements were executed.

Tenant `00000000-0000-0000-0000-000000000001`:

| Method | ID | Requires institution | Active mappings | Allowed active institutions |
|---|---|---:|---:|---:|
| Débito | `ecada333-f8ef-4647-8998-de48f66e3d81` | yes | 0 | 0 |
| Transferencias | `93c2be97-fd47-4429-a4a6-92d2608455a3` | yes | 0 | 0 |
| QR Bre-B | `e6643a9b-e205-4adb-8c1d-16aac3e7eb45` | yes | 0 | 0 |

The other inspected tenants have the same zero-mapping condition:

- Tenant `921f4ebf-6767-4ea6-8dc4-896951e0ee7d`: Débito `c3756230-8982-4259-87a8-318850389853`, Transferencias `775e7b05-3773-43d1-ab86-9fcb33d90c78`, QR Bre-B `97ddd520-4c5e-4a1e-bfdf-94e2bccc57a4`.
- Tenant `b159d683-4648-4bb2-9496-d3e3f84867e9`: Débito `8e1fbf69-4832-44b9-9ac5-ea77552f63f1`, Transferencias `70a5b3bd-fa55-47a2-936c-faccbf5cb089`, QR Bre-B `936652f4-c071-41ce-98b3-f8dce100da27`.

There are 12 active global institutions and no tenant-specific active institution in this database. Their IDs were reported read-only for operator selection. No code can decide which institutions the business permits for each method. Configuration must be performed per tenant through the existing administrative contract `PUT /api/finance/financial-institutions/mappings/:paymentMethodId` with an explicit `financialInstitutionIds` array. No mapping, migration or database row was created here.

Active global candidates: Bancolombia `ee29d060-5095-45b0-a509-96e21b6b631f`, Nequi `95fce336-b7c5-4387-818e-798c8f181d34`, Daviplata `c3d3fd5b-8e49-487c-8e93-f564a8625f26`, Davivienda `90213fb7-b454-4ac7-bba2-e80381f3a4ba`, Banco de Bogotá `abf091e7-5f72-4cbb-8b1b-9f02a50bc7bb`, BBVA `ee5dbe32-66c4-4ca0-81dd-6b8c5f14f28a`, Banco Popular `74c4f241-68e9-4bd3-ae17-dcd27c0ffc69`, Banco AV Villas `31d1d547-3627-4543-8995-7c8dc35d2187`, Scotiabank Colpatria `d2157dd5-9704-461f-ad02-7f913257619c`, Itaú `da6420c2-81f5-459c-850b-6fdb53a1aaaa`, Banco Agrario `93b65399-0dd7-41e4-a797-56adedb9c9b9`, Otro banco o entidad `2f8bbdc2-7c6a-4b71-afd4-3a577c405dd7`.

### Implementation evidence

- `PosScreen` now loads the same active per-method endpoint as `DocumentPaymentForm` through `loadFinancialInstitutionsByPaymentMethod`.
- `PaymentDialog` resolves institutions independently for each payment row, clears the institution on method change, rejects a stale/unallowed selection, and blocks a required method with zero mappings using a configuration message.
- `FinancialInstitutionSelector` distinguishes a truly empty method catalog from a search with no results.
- No sale total, change, customer, reference, cash-session, idempotency, atomicity or persistence logic changed. Backend validation was not relaxed.

### Verification status

- PASS: frontend focused Vitest, 6/6. Covers QR Bre-B empty catalog, debit/transfer filtered loading, cash omission, inactive results, global/tenant records as returned by the strict endpoint, search, selection and empty configuration text.
- PASS: API focused Node tests, 13 passed and 1 optional local PostgreSQL integration skipped. Covers general versus method-filtered repository SQL, tenant/global visibility clauses, active mapping/institution clauses, invalid/foreign/unassociated rejection, references, mixed purchase/order payments, rollback and idempotent replay/conflict.
- PASS: `web/npm.cmd run lint`, no warnings or errors.
- PASS: `web/npm.cmd run build`, including compile, lint and Next.js type validation.
- PASS: `api/npm.cmd run build`.
- PASS: direct strict OpenSpec validation with OpenSpec 1.16.0.
- PASS: governance manifest is valid after assigning each changed path one current owner; no ambiguous current ownership, no migration regression, no governance DB access and no historical SQL replay.
- PARTIAL: the governance Python wrapper still cannot invoke its OpenSpec child on this Windows environment (`TOOL_UNAVAILABLE`) although the same strict command passes directly. Its default `git diff --check` also reports CRLF additions in the pre-existing CRLF `payments.service.ts`; the repository-compatible `git -c core.whitespace=cr-at-eol diff --check` is the applicable check.
- BLOCKED BY CONFIGURATION: real QR Bre-B, debit and transfer selection cannot pass until an authorized operator creates explicit mappings. No QA/PRD write was attempted.

### Manual QA pending after configuration

- In one authorized tenant, map an approved subset of banks/wallets to QR Bre-B, Débito and Transferencias through the existing admin UI/API.
- Open POS, purchase payment and order payment. Confirm each method shows the identical allowed subset, not all 12 global institutions.
- Search one bank and one wallet, select independently on two mixed lines, change one method and confirm only that line's institution clears.
- Confirm required reference still blocks when empty. Confirm cash needs no institution.
- Submit one authorized purchase and one order payment, then inspect `payments.financial_institution_id` read-only. Confirm an unassociated institution sent directly receives HTTP 400 and the complete document operation rolls back.

## POS non-regression correction - 2026-11-06

The previous method-associated POS follow-up is superseded. It was a regression because it changed the established POS catalog and shared payment validation instead of limiting the document-payment adaptation to purchases/orders.

### Pre-branch contract evidence

- `PosScreen` calls `listFinancialInstitutions()` with no method ID, catches catalog failure independently, filters active entities, and passes the global tenant-visible catalog to `PaymentDialog`.
- `PaymentDialog` filters active entries once and gives the same catalog to each row requiring an institution. It requires a selection only when that active catalog is non-empty. Changing a row's method clears that row's institution.
- Before this branch, `PaymentsService.createInternal` required an institution for configured methods and validated only `active = TRUE` plus `(tenant_id = current tenant OR tenant_id IS NULL)`.
- POS sale creation passes `financialInstitutionId` through `PaymentsService.createInTransaction`. `SaleRepository.assignFinancialInstitutionsToSalePayments` also validates active tenant/global visibility, not `payment_method_financial_institutions`.
- Therefore POS historically displayed and persisted an active tenant-visible/global institution even when the method had zero mappings. Display was not merely cosmetic.

### Restored frontend

- PASS: tracked `PosScreen.tsx`, `PaymentDialog.tsx` and `FinancialInstitutionSelector.tsx` now match branch `HEAD` exactly; no unrelated sale or recovery code changed.
- PASS: focused Vitest, 9/9. Source-contract assertions prove the no-argument global call, active filtering, original dialog prop and absence of the method-map helper in POS. Selector coverage expands and renders all 12 active institutions, filters an inactive thirteenth entry, preserves search and selection, and restores the original empty-result text.
- PASS: document helper tests still cover per-method catalog loading, cash omission, QR Bre-B empty mapping, debit/transfer results and inactive filtering. These are unit tests, not real QA persistence.

### Backend and persistence evidence

- PASS: finance/document unit suites, 13 passed and 1 opt-in PostgreSQL integration skipped. They cover document mixed payments, required references, per-line institution persistence, invalid/foreign/unassociated rejection, complete rollback and idempotent replay/conflict.
- PASS: POS sale repository/service unit suites, 47/47. They prove sale payload transmission, selected institution assignment, order delivery, idempotency and sale behavior.
- PARTIAL: POS sale unit doubles do not execute the production `PaymentsService.isFinancialInstitutionAllowed` query. Production code inspection proves that the branch-level shared validation now applies to POS and will reject the inspected no-mapping methods. A real POS sale without mappings is therefore not claimed PASS.
- PASS: frontend lint and production build, including TypeScript validation.
- PASS: API production build.
- PASS: strict OpenSpec validation; all four planning artifacts are complete.
- PASS: repository-compatible whitespace validation with `git -c core.whitespace=cr-at-eol diff --check`.
- PARTIAL: the repository governance wrapper reports `TECHNICAL_FAILURE` because authoritative enforcement and environment-source verification are unavailable in this Windows run. Its useful checks passed: OpenSpec strict validation is available and passed, the scope manifest is valid, ownership is unambiguous, migration validation is clean, and it performed no database access or historical SQL replay.

### Backend decision required before implementation

Proposed policy split:

1. Default and POS/legacy `POST /finance/payments` paths keep the pre-branch `TENANT_ACTIVE` rule: selected institution must be active and owned by the tenant or global.
2. `POST /finance/payments/document` explicitly uses `METHOD_ASSOCIATED`: selected institution must additionally have one active mapping for the current tenant and payment method.
3. Both policies run through the existing transaction client. Required-institution, reference, cash-session, balance, allocation, idempotency and atomicity checks stay unchanged.
4. No cross-tenant access is introduced. Global institutions remain visible to every tenant under the existing contract; tenant-owned institutions remain isolated. Mapping strictness remains document-only.

Impact: this restores real POS compatibility while preserving the stricter document contract already tested. It does not decide which institutions should be mapped and creates no database row or migration. Per the stop condition, the policy split is proposed but not implemented without explicit business/owner approval.

### Manual QA pending

- POS UI: open Cobrar venta and confirm all 12 active banks/wallets appear for QR Bre-B, Débito and Transferencias; verify search, selection, method change clearing, required reference, mixed payment and customer behavior.
- POS persistence: after the backend policy decision, submit one authorized sale using a method with zero mappings and inspect the created `payments.financial_institution_id` read-only.
- Purchase/order: verify independent per-line selection, method clearing, mixed cash plus financial method, required reference, persisted institution, replay safety and full rollback for an invalid institution.
- No QA/PRD write was performed during this correction.

## Authorized TENANT_ACTIVE document payments - 2026-11-06

This section supersedes the earlier method-associated document-payment decision. The owner explicitly authorized purchase and order payments to use active tenant-owned/global institutions without requiring `payment_method_financial_institutions` rows. POS source files remain outside this implementation.

### Root cause and correction

- `DocumentPaymentForm` loaded `listFinancialInstitutions(paymentMethodId, true)`, so QR Bre-B, debit and transfer showed zero entities when their mapping table had no active rows even though 12 global institutions were active.
- The branch-added shared `isFinancialInstitutionAllowed` check also rejected those selections before persistence.
- The form now loads `listFinancialInstitutions(undefined, true)` once, filters stale inactive records, and gives the same tenant-scoped API catalog to every line that requires an institution.
- `PaymentsService.createInternal` now uses the pre-branch server-authoritative query through the current transaction client: selected institution must be active and either owned by the current tenant or global. No method mapping is consulted.
- Required institution, DTO UUID validation, required reference, branch/cash-session scope, live balance, allocation, transaction rollback, `financialInstitutionId` persistence, operation fingerprint and replay behavior remain unchanged.
- `api/src/modules/finance/payment-methods/payment-methods.repository.ts` matches `HEAD`; the temporary payment-authorization mapping method was removed. No association-management endpoint or table was changed.
- `PosScreen.tsx`, `PaymentDialog.tsx` and `FinancialInstitutionSelector.tsx` match `HEAD` exactly.

### Automated evidence

- PASS: frontend focused Vitest, 11/11. Covers unfiltered active catalog loading, global and tenant records, inactive filtering, per-line state, method-change clearing, required selection, selector search and the original 12-entity POS catalog contract.
- PASS: API focused Node tests, 15 passed and 1 opt-in isolated PostgreSQL test skipped. Covers purchase and order cash, debit, transfer, QR Bre-B with active institutions and no mappings, active tenant institution, inactive/foreign rejection, required reference, mixed and partial payments, persistence, rollback and idempotent replay/conflict.
- PASS: POS sale repository/service regression suites, 47/47. Sale payload, selected institution persistence and sale idempotency remain green without modifying POS production files.
- PASS: web lint, no warnings or errors.
- PASS: web production build, including TypeScript validation and purchase/order/POS routes.
- PASS: API production build.
- PASS: strict OpenSpec validation.
- PASS: repository-compatible whitespace check and exact no-diff checks for the three POS source files.
- PARTIAL: repository governance wrapper reports `TECHNICAL_FAILURE` because authoritative enforcement/environment verification is unavailable. Its scoped checks pass: OpenSpec tool available and strict-valid, manifest valid, no ambiguous ownership, migration validation clean, no database access and no historical SQL replay.

### Manual QA pending

- Purchase: select cash plus QR Bre-B/debit/transfer using one active bank or wallet that has no mapping; verify independent line selections, method-change clearing, mandatory reference and partial payment.
- Order: repeat the mixed/partial flow and confirm direction remains IN while purchase remains OUT.
- Inspect the created payments read-only and confirm each financial line stores the selected `financial_institution_id`; cash remains null.
- Send an inactive and a foreign-tenant institution through an isolated authorized request and confirm HTTP 400 with complete rollback.
- Replay one committed `operationKey` with the same payload and then a changed institution; confirm recovery followed by conflict without duplicate effects.
- No QA or PRD write was performed by this implementation.

## Final closure evidence - financial institutions and orders UX (2026-11-06)

Branch: `feature/develop/fix-document-payment-financial-institution`. HEAD: `eda7cfe807a8aac1d0c6818c8f8edb22abb7f6e1`. This section is the current closure summary. Earlier method-associated sections remain as historical evidence and are superseded by the authorized `TENANT_ACTIVE` policy above.

### Human QA reported by the operator

- PASS: manual purchase/order payment QA. This is operator-reported evidence. No additional unreported payment combination, direct API rejection or PostgreSQL rollback is inferred.
- PASS: visual QA of the Purchases payment surface from the supplied capture/report. The exact viewport was not supplied, so no resolution is inferred.
- PASS: visual QA of the Orders table at approximately 1050 px and 1370 px from the supplied captures/report. The table uses the available width and remains readable at those observed widths.
- PARTIAL: the requested orders matrix is not complete. 1920, 1440, 1180, 1024, 768 and 390 px were not individually evidenced as real browser QA. The approximately 1050/1370 observations are not relabelled as those exact widths.
- PARTIAL: long product names, multiple-product edit/delivery/invoice forms, filter combinations, action-menu keyboard navigation, pagination and horizontal scrolling were not each separately demonstrated by the supplied human evidence. They remain covered only by source-contract tests, lint/build and code review where applicable.
- BLOCKED: Computer Use could not be used for additional visual QA because the browser access host was unavailable and Windows URL confidence enforcement stopped browser control. Closure does not depend on Computer Use.

### Automated closure matrix

| Area | Status | Evidence |
|---|---|---|
| Frontend finance, POS catalog and orders layout focused tests | PASS | Vitest: 5 files, 15/15 tests. |
| Backend document payments | PASS | Node test runner: 15 passed, 1 opt-in PostgreSQL integration SKIPPED. |
| POS sale regression | PASS | Node test runner: 49/49 tests. |
| Web lint | PASS | `npm.cmd run lint`: no warnings or errors. |
| Web production build | PASS | Next.js compile, production type validation and `/[tenant]/orders`, purchases and POS routes generated. |
| API production build | PASS | `npm.cmd run build`. |
| Standalone global web typecheck | FAIL (pre-existing) | `npx.cmd tsc -p tsconfig.json --noEmit --incremental false` repeats the prior errors in 12 unchanged test files. `git diff --exit-code HEAD -- <those files>` is clean. No error names a changed financial or orders file. |
| OpenSpec strict | PASS | Direct cached OpenSpec CLI: change is valid. |
| Scope manifest JSON | PASS | JSON parse succeeds; current ownership includes both financial and orders UX paths. |
| Governance Python wrapper | BLOCKED / TECHNICAL_FAILURE | STRICT reports `WINDOWS_CHILD_PROCESS_ACCESS_DENIED`, then treats the otherwise valid change as unavailable/invalid. The same OpenSpec strict command passes directly. Manifest validation and migration validation are clean; no database access or historical SQL replay occurred. |
| Default `git diff --check` | FAIL (line-ending policy) | Reports the two added `payments.service.ts` lines because the tracked file uses CRLF. Repository-compatible `git -c core.whitespace=cr-at-eol diff --check` is the applicable companion check. |
| POS production source diff | PASS | `PosScreen.tsx`, `PaymentDialog.tsx` and `FinancialInstitutionSelector.tsx` have no diff against HEAD. |
| Database/migration diff | PASS | No changed or untracked SQL/migration path exists in this worktree. |
| Sensitive/config file diff | PASS | No `.env`, credential, secret or key path is present in the diff. |

### Contract review

- PASS: document payment lines accept optional UUID `financialInstitutionId`; cash remains compatible with omission.
- PASS: methods configured to require an institution still require one.
- PASS: server validation remains active and tenant-scoped: the institution must be active and tenant-owned or global. Cross-tenant and inactive institutions are rejected.
- PASS: no method-to-institution mapping is consulted for purchase/order document creation, as explicitly authorized.
- PASS: institution identity is included in the canonical operation fingerprint and passed to the existing transactional persistence path.
- PASS: document locking, cash-session validation, allocations, cash movements, full rollback, operation completion and same-key replay/conflict remain in the existing transaction.
- PASS: orders UX changes are class/markup-only and do not change API calls, calculations, permissions, order state, pagination logic or action callbacks.

### Residual risks and skipped evidence

- SKIPPED: opt-in real PostgreSQL integration test. It requires an isolated local database and was not run against QA/PRD.
- BLOCKED: real concurrent PostgreSQL certification and destructive rollback injection remain unavailable without an isolated authorized fixture.
- PARTIAL: standalone global typecheck remains red because of unchanged test debt even though production builds pass.
- PENDING: OpenSpec task 6.1 remains open because the available human statement does not enumerate every POS open/select/amount/reference/add/summary/customer/confirm/close step.
- PENDING: OpenSpec task 11.4 remains open until the exact responsive matrix and the product/detail interaction cases are manually evidenced.

Closure recommendation: **NO-GO for an unconditional merge/deploy** because strict governance wrapper execution is technically blocked, standalone global typecheck is red, and tasks 6.1/11.4 remain open. **GO for owner review and preparation of a commit/PR** if repository policy accepts the documented pre-existing typecheck debt and Windows governance-tool limitation; no commit, push, merge or deployment was performed here.
