# FactuCore create 400: payload validation

## Scope

- Manus repository: `D:/Profe/manus-tienda`
- FactuCore repository: `D:/Profe/Factucore`
- Manus branch: `feat/develop/implementando-facturacion-electronica`
- FactuCore branch: `main`
- FactuCore runtime: `http://127.0.0.1:8000`
- QA document: `41f5c937-9219-4d70-9848-14b46a7aa820`
- No second document was processed.

## FactuCore source contract

The real route is `external-documents.controller.ts`, with `@Post('invoices')`.
It calls `DocumentsService.createInvoiceByApiClient`.
The request type is `CreateInvoiceDto`, extending `BaseCreateDocumentDto`.
Global validation uses `ValidationPipe` with `whitelist: true` and
`forbidNonWhitelisted: true`.

Relevant DTO rules:

- Invoice requires exactly one of `customerId` or embedded `customer`.
- `lines` requires at least one nested `DocumentLineDto`.
- A `TAXED` line requires nested taxes.
- An `EXCLUDED` or `NOT_APPLICABLE` line must not contain nested taxes.
- Tax objects allow `taxType`, `rate`, `taxableBase`, `taxAmount`, and `metadata`.
- Nested tax keys such as `taxCode`, `taxSchemeId`, and `taxSchemeName` are not DTO fields.
- `TaxType` does not contain `Exento`.

## Manus correction

`FactuCoreMapper` now sends only FactuCore tax DTO fields, preserves internal tax
identity under `metadata`, omits taxes for excluded lines, and maps generic
`UNIT` to provider-compatible `EA`. Regression tests cover these shapes.

## Controlled result

The QA document was `REJECTED` with no provider document before the controlled
recovery. The application performed the external-reference lookup first and
received `404`, then one create request returned `400`. No provider document
was created. XML generation, signing, and transmission were not called.

The 400 body is not retained in the Manus error model; it is reduced to the
sanitized message `FactuCore request failed with status 400`. Therefore the
remaining runtime validation field cannot be claimed as proven from this run.
No further POST was attempted.

## Safety

- Provider create calls in the final attempt: `1`; all later mutation calls: `0`.
- No migration, commit, push, deploy, or PROD access.
- Background worker remained disabled.
- QA document remains without a provider document ID.
- No credentials or customer PII are included here.

## Validation

- Billing tests: `130 pass`.
- Billing build: `PASS`.
- FactuCore source was not modified; FactuCore build was previously `PASS`.
- Controlled provider QA: `NOT READY` until the exact 400 response is retained
  in a redacted diagnostic or the remaining source validation gap is proven.
