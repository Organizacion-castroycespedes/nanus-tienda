# Evidencia: FactuCore DIAN readiness

Fecha: 2026-09-10

## Guards

- Manus: `feat/develop/implementando-facturacion-electronica`, HEAD `7352ea7`.
- FactuCore: `main`, HEAD `ee1c132`.
- QA database: `manus_tienda_qa`, schema `public`; hard guard PASS.
- Billing worker: `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`.
- No provider retry or additional POST was executed in this diagnosis.

## Exact failure

- Source: `D:/Profe/Factucore/backend/src/modules/documents/documents.service.ts:2377`.
- Function: `DocumentsService.createDocument`.
- Condition: `DianUblReadinessService.checkDocumentCandidate(...)` returns `ready=false`.
- Error response: `La factura no tiene todos los datos requeridos para preparar el documento DIAN.` with the internal `missing` list.
- Readiness implementation: `D:/Profe/Factucore/backend/src/modules/xml-generator/dian-ubl-readiness.service.ts:50`.
- DTO validation runs first; readiness runs after DTO acceptance and before persistence.

## Root cause

FactuCore local database has no tenant with Manus QA ID `00000000-0000-0000-0000-000000000001`, no DIAN tenant configuration for that ID, and no invoice resolution for that ID. The Manus API client `60cbac48-f476-4f34-9664-6ba27df95d23` belongs to another FactuCore tenant. That tenant has configuration, but it is not the Manus QA tenant.

The failure is therefore QA issuer/configuration association, not Manus payload shape and not a FactuCore DTO validator defect. No fiscal values, certificates, technical keys, or resolutions were invented or copied.

## Readiness requirements found in code

- Issuer: tax ID, verification digit, DIAN identification type, legal name, tax level, tax scheme, fiscal responsibilities, address, municipality, city, department, country, email.
- Customer: identification, DIAN identification type, legal name, tax level, tax scheme, fiscal responsibilities, address, municipality, city, department, country, email.
- Resolution: resolution number, prefix, range, validity dates, technical key.
- Document: full number, issue date, currency, invoice type, operation type, payment means, lines, positive total.
- Lines/taxes: description, quantity, unit, unit price, SKU, extension amount, treatment; taxed lines require tax type, rate, taxable base, amount, and valid DIAN tax scheme.
- DIAN configuration: software ID, encrypted software PIN, service URL, WSDL URL, and test set ID when required by environment.

## Association evidence

- Target Manus tenant: absent in FactuCore.
- API client `60cbac48-f476-4f34-9664-6ba27df95d23`: active, bound to tenant `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc`.
- Target tenant DIAN configuration: absent.
- Target tenant invoice resolution: absent.
- Existing configured FactuCore tenants are different tenants; no reassignment was performed.

## Result

- FactuCore external DTO: PASS from prior validation.
- FactuCore internal DIAN readiness for Manus tenant: FAIL / NOT READY.
- Correct owner: QA configuration.
- Code modified this phase: NO productive code.
- FactuCore code modified: NO.
- Migrations: NO.
- Real retry gates: FAIL.
- Real retry executed: NO.
- FactuCore create calls in this phase: 0.
- XML, signing, transmission: 0.
- Provider documents for external reference: 0.
- Historical documents: unchanged.
- Secret error leak: NONE observed.
- PII in evidence: NONE.

## Safe next step

Provision or associate a legitimate QA FactuCore tenant for the Manus tenant, using real QA issuer, DIAN configuration, resolution, and credential values through supported administration workflows. Do not copy PROD or invent fiscal configuration. Re-run readiness before any provider retry.

## Validation

- Manus billing tests: `133 passed, 0 failed`.
- Manus billing build: PASS.
- FactuCore DIAN readiness tests: PASS.
- FactuCore build: PASS.
- OpenSpec strict validation: PASS; all strict `80 passed, 0 failed`.
- Git diff checks: PASS.
