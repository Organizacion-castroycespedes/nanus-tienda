# FactuCore real POST readiness diagnostics

## Scope

- No additional FactuCore POST was executed in this phase.
- Document `41f5c937-9219-4d70-9848-14b46a7aa820` was not processed.
- Provider document count remained `0`.
- Worker remained disabled.

## Finding

`DianUblReadinessService.checkDocumentCandidate` returns `{ ready, missing }`. `DocumentsService.createDocument` receives that result and throws `BadRequestException` with the `missing` array. The generic `HttpExceptionFilter` previously retained only `message`, so failed readiness paths were discarded at the HTTP boundary.

## Fix

`D:/Profe/Factucore/backend/src/common/filters/http-exception.filter.ts` now preserves a bounded `DIAN_READINESS_VALIDATION.failedChecks` list containing only safe `entity`, `path`, and sanitized `reason` fields. It limits the list to 50 entries and each field to a bounded length. Secret-like values remain redacted.

## Readiness source

The real create path is:

`ExternalDocumentsController.createInvoice` → `DocumentsService.createInvoiceByApiClient` → `createExternalDocument` → `createDocument` → `DianUblReadinessService.checkDocumentCandidate`.

The guard executes before document persistence. It checks tenant, customer, resolution, document, lines/taxes, and tenant DIAN configuration.

## Validation

- FactuCore build: pass.
- FactuCore focused test was not executable because the shell could not resolve `npm.cmd` in `D:/Profe/Factucore/backend`.
- Billing build: pass.
- Previous billing tests: `135/135` passed.
- Previous API tests: `15/15` passed.
- No new provider retry was allowed because the focused FactuCore regression gate did not pass.

## Safety

- Additional create calls: `0`.
- Generate XML calls: `0`.
- Sign calls: `0`.
- Transmit calls: `0`.
- No secrets or unnecessary PII recorded.
