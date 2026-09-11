# FactuCore real-create readiness differential

## Scope

- Read-only diagnosis. No FactuCore `POST` was executed.
- Manus document `41f5c937-9219-4d70-9848-14b46a7aa820` was not processed.
- Provider document count remained `0`.
- Background worker remained disabled.

## Repository state

- Manus branch: `feat/develop/implementando-facturacion-electronica`
- Manus HEAD: `7352ea7`
- FactuCore branch: `main`
- FactuCore HEAD: `ee1c132`

## Differential finding

The earlier precheck used the persisted-document path (`DianPreflightService` -> `checkDocument(documentId)`). The real API create path uses a different in-memory candidate: `DocumentsService.createDocument` resolves the actor, tenant, customer, resolution, and request lines, then calls `checkDocumentCandidate` before persistence.

FactuCore's readiness guard requires customer location fields including `cityName`, `departmentCode`, `departmentName`, and `countryName`. The Manus sale producer previously emitted `departmentCode: null`, `cityName` as the municipality identifier, and `departmentName: null`. The billing boundary also dropped flattened location fields before `FactuCoreMapper` read them from customer metadata.

## Fix

- Sale snapshot now carries the resolved fiscal `departmentCode`, customer `ciudad`, and customer `departamento`.
- Billing event mapping preserves these fields in canonical customer metadata.
- FactuCore mapping emits `departmentCode` from canonical metadata.
- No FactuCore code or QA configuration changed.

## Local regression

- API sale service tests: `15/15` passed.
- Billing tests: `135/135` passed.
- API build: pass.
- Billing build: pass.
- FactuCore build: pass.
- FactuCore readiness script could not be launched from this shell because `npm.cmd` was unavailable in the FactuCore working-directory command environment; no FactuCore source was modified.
- Added regression proves create-path customer location data survives the API/event/billing/FactuCore mapper boundary.

## Readiness result

- Before fix: real-create readiness classified as `FAIL` because the candidate could omit required customer location fields.
- After fix: local mapper/readiness input is complete for the demonstrated missing fields; failed checks: `NONE`.
- Actor tenant, issuer, DIAN configuration, resolution, document type, and environment remain aligned. The provider-specific tenant remains configuration-driven and does not enter the generic sale event.

## Safety

- Additional provider create calls: `0`.
- XML generation calls: `0`.
- Signing calls: `0`.
- Transmission calls: `0`.
- Secrets and customer PII are not included.
