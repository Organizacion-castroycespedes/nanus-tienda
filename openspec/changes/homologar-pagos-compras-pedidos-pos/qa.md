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
