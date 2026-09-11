# FactuCore customer location create-candidate divergence

## Scope

- Controlled document: `41f5c937-9219-4d70-9848-14b46a7aa820`.
- No provider POST, document processing, worker activation, or database mutation was performed.
- FactuCore remained on `main` at `ee1c132`; existing worktree changes were preserved.

## Trace

The external DTO accepts and whitelists `departmentCode`, `cityName`, `departmentName`, and `countryName`. `ValidationPipe` uses `transform`, `whitelist`, and `forbidNonWhitelisted`, and the nested customer DTO declares all four fields.

The production path is:

```text
ExternalDocumentsController.createInvoice
  -> DocumentsService.createInvoiceByApiClient
  -> createExternalDocument
  -> createDocument
  -> resolveDocumentCustomer
  -> resolveEmbeddedCustomer
  -> DianUblReadinessService.checkDocumentCandidate
```

The normal embedded-customer create and existing-customer update paths already copy all four fields. The demonstrated loss was in the `P2002` race fallback: after a concurrent customer insert won, the fallback returned the existing row directly. That row could still lack the incoming location, so the readiness candidate saw missing fields.

## Fix

The `P2002` fallback now applies the same `buildEmbeddedCustomerUpdateData` merge used by the normal existing-customer path before returning the customer. This preserves incoming location values without weakening readiness rules or changing tenant resolution.

## Structural result

| Stage | Location fields |
| --- | --- |
| Manus canonical customer | PRESENT |
| FactuCore external request | PRESENT |
| DTO validation | ACCEPTED |
| Normal customer create/update | PRESENT |
| P2002 race fallback before fix | MISSING possible |
| P2002 race fallback after fix | PRESENT |
| DIAN readiness rules | UNCHANGED |

## Validation

- Customer location propagation regression: PASS.
- External customer DTO contract: PASS.
- DIAN UBL readiness suite: PASS.
- HttpExceptionFilter regression: PASS.
- FactuCore build: PASS.
- Additional FactuCore provider calls: `0`.
- XML, signing, and transmission calls: `0`.
- Protected Manus document remains unprocessed with provider identity null.
- Manus code was not modified in this phase.
- No migrations, commit, push, or deploy.

## Safety

No PII, credentials, technical keys, or certificate material are recorded here. Background processing remains disabled in both runtimes.
