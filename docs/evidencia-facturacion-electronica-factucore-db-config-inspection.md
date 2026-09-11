# Evidencia: FactuCore DB configuration inspection

Fecha: 2026-09-10

## Scope

Read-only inspection only. No INSERT, UPDATE, DELETE, secret rotation, document creation, provider POST, commit, push, or deploy.

## Repository and database

- Repository: `D:/Profe/Factucore`.
- Branch: `main`.
- HEAD: `ee1c132`.
- Runtime environment: `development`.
- Database hard guard: PASS.
- `current_database()`: `factucore`.
- `current_user`: `postgres`.
- `current_schema()`: `public`.

## API client and tenant

- API client: `60cbac48-f476-4f34-9664-6ba27df95d23`.
- API client status: ACTIVE.
- API client tenant: `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc`.
- API client expected tenant relation: PASS.
- Tenant status/environment: ACTIVE / TEST.
- Tenant issuer fields: structurally present.

## Fiscal configuration

- DIAN tenant configuration: present and structurally complete.
- Environment: TEST.
- Software ID, software PIN, test set ID, service URL, and WSDL URL: present.
- Active invoice resolution: present.
- Resolution prefix, range, validity dates, current sequence, and technical key: available.
- Active certificate: present and within configured validity period.
- Secret values and private material were not displayed.

## Readiness

- `DocumentsService.createDocument` calls `DianUblReadinessService.checkDocumentCandidate` before persistence.
- Read-only `DianUblReadinessService.checkDocument` against an existing TEST document returned `ready=true`, `missing=[]`.
- FactuCore internal DIAN readiness: PASS for tenant `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc`.
- No provider document was created by this inspection.

## Root cause correction

The earlier conclusion used the Manus tenant UUID `00000000-0000-0000-0000-000000000001`, which does not exist in FactuCore. The actual API client tenant `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc` exists and is ready. The issue was tenant-ID mismatch, not missing FactuCore issuer configuration for the actual API client.

The Manus billing tenant must use the matching FactuCore tenant/client association before retry. No reassignment was performed here.

## Safety result

- DB mutations: `0`.
- FactuCore POST calls: `0`.
- Documents created: `0`.
- PROD touched: NO.
- Secrets exposed: NO.
