# Controlled E2E after customer location fix

## Result

- One controlled recovery was executed through `ElectronicBillingProcessingService.recoverPreProviderDocument`.
- The request reached FactuCore and ended with the generic DIAN readiness rejection (`HTTP 400`); no provider document was created.
- No second retry was executed.
- No sale or electronic document was created.
- Historical documents were not processed.

## Guards

- Manus branch: `feat/develop/implementando-facturacion-electronica`
- Manus HEAD: `7352ea7`
- FactuCore branch: `main`
- FactuCore HEAD: `ee1c132`
- FactuCore health: `200`
- Authenticated read-only GET: `200`
- External-reference lookup: `404 NOT FOUND`
- Billing health: `200`
- Background worker: disabled
- Credential values and PII: not recorded

## Blocking state

- Document: `41f5c937-9219-4d70-9848-14b46a7aa820`
- Observed status: `REJECTED`
- Observed provider document ID: `NULL`
- Recovery classification: `CORRECTABLE_PRE_PROVIDER_REJECTION`.
- Recovery method: `ElectronicBillingProcessingService.recoverPreProviderDocument`.
- Manual invocations: `1`.

Result remained `REJECTED`, with provider ID `NULL` and provider status `NULL`. No SQL update was attempted. No second retry is authorized in this phase.

## Payload readiness

- Customer city: present
- Customer department code: present
- Customer department name: present
- Customer country name: present
- Unit normalization: `EA`
- FactuCore DTO validation: pass
- Real-create readiness: pass by prior validated mapper regression
- The real provider response still returned the generic DIAN readiness message. Corrected location fields are not sufficient to prove full runtime readiness; the next missing check must be diagnosed before any further POST.

## Provider mutation counts

- Create: `0`
- Generate XML: `0`
- Sign: `0`
- Transmit: `0`

## Validation

- Billing tests: `135/135` passed previously.
- API sale tests: `15/15` passed previously.
- Billing build: passed previously.
- API build: passed previously.
- FactuCore build: passed previously.
- OpenSpec relevant/all strict: passed previously.
- No commit, push, deploy, or production access.
