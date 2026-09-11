# Final controlled provider retry after P2002 customer fix

## Scope and guards

- Authorized document: `41f5c937-9219-4d70-9848-14b46a7aa820` only.
- QA database guard: `manus_tienda_qa`, public schema: PASS.
- Manus and FactuCore background processing stayed disabled.
- FactuCore API health and authenticated read-only access passed.
- External reference preflight returned NOT FOUND.
- No new sale, document, migration, commit, push, or deploy.

## Runtime patches

- FactuCore P2002 customer fallback patch: active in the built runtime.
- FactuCore structured error filter: active.
- Manus retry-state and structured error propagation patches: active.
- Customer location preflight and regression: PASS.

## Controlled retry

Exactly one `ElectronicBillingProcessingService.retryDocument(...)` invocation ran for the authorized document. The flow reached FactuCore CREATE once and returned HTTP 400. No later provider stage ran.

Sanitized provider result:

```text
code: DIAN_READINESS_VALIDATION
failedChecks:
- cityName: adquirente sin ciudad configurada
- departmentCode: adquirente sin codigo de departamento configurado
- departmentName: adquirente sin departamento configurado
- countryName: adquirente sin pais configurado
```

No real values, secrets, or PII are recorded.

## State and idempotency

- FactuCore provider document count for the external reference: `0`.
- Provider document ID before and after: `NULL`.
- Manus document remains `REJECTED` with `FACTUCORE_VALIDATION`.
- Generate XML: `0`; signing: `0`; transmission: `0`.
- No duplicate provider document was created.
- Historical and other documents were not processed.

The P2002 patch is loaded, but this attempt did not enter that race fallback. The repeated checks show the live create candidate still lacks customer location. This phase stops here. No patch-and-retry loop was performed.

## Validation

- Billing tests: `140/140 PASS`.
- FactuCore focused tests: `5/5 PASS` (customer propagation, DTO contract, DIAN readiness, HTTP filter, and background isolation).
- Billing build: `PASS`.
- API build: `PASS`.
- FactuCore build: `PASS`.
- Additional provider mutations: `0`.
- Secret leak: `NONE`.
