# Evidencia: E2E controlado después de alinear tenants

## Alcance y guardas

- Manus branch: `feat/develop/implementando-facturacion-electronica`.
- FactuCore branch: `main`.
- QA database: `manus_tienda_qa`; schema: `public`.
- Worker: `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`.
- Solo se autorizó el documento `41f5c937-9219-4d70-9848-14b46a7aa820`.
- No se creó venta ni documento nuevo.
- No se procesó ningún otro documento.

## Preflight

- Manus tenant: `00000000-0000-0000-0000-000000000001`.
- FactuCore tenant: `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc`.
- API client: `60cbac48-f476-4f34-9664-6ba27df95d23`.
- Provider context: PASS.
- Credential shape: PASS; valores no registrados.
- Mapper/DTO validation: PASS; `unitCode=EA`.
- FactuCore internal DIAN readiness: PASS, según configuración QA validada.

## Recuperación única

- Method: `ElectronicBillingProcessingService.recoverPreProviderDocument`.
- Manual invocations: `1`.
- Document before: `REJECTED`, provider ID `NULL`.
- External reference preflight did not complete: FactuCore timed out.
- FactuCore `/api/health` also timed out during post-check.
- Recovery result: `TECHNICAL_ERROR`, `FACTUCORE_TIMEOUT`.
- `CREATE`: `0`.
- `GENERATE XML`: `0`.
- `SIGN`: `0`.
- `TRANSMIT`: `0`.
- FactuCore documents for external reference: `0`.
- Duplicate provider document: `NO`.

## Manus result

- Document after: `TECHNICAL_ERROR`.
- Provider document ID: `NULL`.
- Provider status: `NULL`.
- No SQL document mutation was used.
- Historical documents remained untouched.

## Safety

- Secret leak: `NONE` observed.
- PII leak: `NONE` in this evidence.
- Migrations: `NO`.
- FactuCore code modified: `NO`.
- Provider POST calls: `0`.
- Commit/push/deploy: `NO`.

## Validation

- Billing tests: `134 passed, 0 failed`.
- Billing build: PASS.
- OpenSpec strict relevant/all: PASS; all `80 passed, 0 failed`.
- Manus `git diff --check`: PASS.
- FactuCore `git diff --check`: PASS; worktree unchanged.

## Result

Tenant alignment is configured and resolves correctly. Controlled provider E2E
is blocked by the current FactuCore local runtime timeout. Do not retry this or
any other document until FactuCore health and authenticated read-only access are
restored.
