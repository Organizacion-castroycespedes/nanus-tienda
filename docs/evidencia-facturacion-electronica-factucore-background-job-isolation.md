# FactuCore background job isolation

## Findings

- FactuCore has two pg-boss drivers: transmission dispatch and webhook dispatch.
- Their `onModuleInit()` methods previously started pg-boss and registered workers when selected.
- `DocumentsService` also recovered pending status refreshes and started a scanner on module initialization.
- `WebhooksService` bootstrapped pending webhook deliveries on module initialization.
- This allowed historical queue work to run when the API started.

## Safe switch

- Added `FACTUCORE_BACKGROUND_JOBS_ENABLED`.
- Default is enabled (`true`) to preserve normal behavior.
- Local QA `.env` sets it to `false`.
- When false, pg-boss drivers do not start, workers do not register, webhook bootstrap is skipped, and the document status scanner is skipped.
- HTTP controllers, database access, authentication, and read-only queries remain enabled.

## Read-only verification

- FactuCore branch: `main`.
- FactuCore build: PASS.
- Isolation test: PASS.
- Port `8000`: listening on the current runtime.
- Health: PASS.
- Authenticated external documents GET: PASS.
- Authorized external-reference lookup: `NOT FOUND`.
- pg-boss tables exist; current job aggregate query returned zero rows.
- No queue mutation was performed.
- No provider create, XML, sign, or transmit call was performed in this phase.

## Previous activity

- Prior runtime logs showed pg-boss initialization and historical DIAN/status activity. Exact historical job ownership cannot be proven from the retained aggregate alone.
- Those logs prove background activity was possible; the new flag prevents it during isolated QA.

## Safety

- Manus worker remains disabled.
- Document `41f5c937-9219-4d70-9848-14b46a7aa820` was not processed.
- Historical jobs were not deleted, cancelled, retried, completed, or purged.
- No secrets or PII are recorded.
