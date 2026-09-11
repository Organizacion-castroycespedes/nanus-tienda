# Evidencia: Provider QA controlado de un documento

Fecha de verificación: 2026-09-09/10 UTC  
Entorno: QA local únicamente

## Resultado ejecutivo

La ejecución se detuvo antes de invocar `ElectronicBillingProcessingService.processDocument`.
El documento candidato no tiene el snapshot canónico requerido por el mapper: falta
`metadata.electronicBilling.customer`. También tiene cero registros en
`electronic_document_taxes`. No se ejecutó ninguna mutación de FactuCore.

## Guardas

- Rama: `feat/develop/implementando-facturacion-electronica`.
- HEAD: `7352ea7 feat(docs): add evidence for FactuCore QA environment enablement`.
- Base de datos: `manus_tienda_qa`, usuario `manus_user`, esquema `public`.
- Host DB: `54.242.102.178`, puerto `5432`.
- Las 10 tablas de facturación requeridas existen.
- No se ejecutaron migraciones.
- Billing backend local: `http://127.0.0.1:4030`, entorno `qa`, health PASS.
- FactuCore local: `http://127.0.0.1:8000`, `/api/health` HTTP 200.
- Worker: `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`; startup reportó `Electronic billing background sync disabled`.
- Dispatcher: no involucrado.

## Configuración y autenticación

- Tenant: `00000000-0000-0000-0000-000000000001`.
- Provider config: `22222222-2222-4222-8222-222222222222`.
- Provider: `FACTUCORE`, entorno `TEST`, enabled `true`, default `true`.
- URL efectiva: `tenant_electronic_billing_configs.base_url` = `http://127.0.0.1:8000`.
- Referencia: `env:FACTUCORE_TENANT_QA`.
- Credential resolver: PASS; JSON válido; `clientKey` y `clientSecret` presentes, sin registrar valores.
- Provider resolver: PASS; resolvió `FACTUCORE`.
- GET autenticado `/api/v1/external/documents`: HTTP 200.
- Lookup por externalReference: HTTP 404 `NOT_FOUND`.

## Documento candidato

- Documento: `7fa040a9-0703-434d-954c-5f348f2d6544`.
- Venta: `966060ae-3cd8-4a85-a4f0-33912cfbd295`.
- External reference: `SALE-00000000-0000-0000-0000-000000000001-966060ae-3cd8-4a85-a4f0-33912cfbd295`.
- Estado antes/después: `PENDING` / `PENDING`.
- `provider_document_id` antes/después: `NULL` / `NULL`.
- `provider_status` antes/después: `NULL` / `NULL`.
- Líneas: `1`; impuestos: `0`; referencias: `0`.
- No se invocó método de procesamiento manual: `0` invocaciones.

## Documento centinela

- Documento PENDING adicional: `da862163-c4f3-44c8-92cf-066afc9abcbb`.
- Permaneció `PENDING`, sin provider ID ni provider status.
- No fue tocado.

## Tráfico y mutaciones

- FactuCore GET: 3 lecturas de verificación, incluyendo health, listado autenticado y lookup por referencia.
- POST create invoice: `0`.
- POST generate XML: `0`.
- POST sign: `0`.
- POST transmit: `0`.
- Documentos FactuCore creados por esta fase: `0`.

## Higiene y validación

- Secretos en evidencia, código trackeado, logs y salida: ninguno observado.
- PII innecesaria en evidencia: ninguna.
- `FISCAL_PROVIDER=MOCK_LOCAL` no impacta el flujo nuevo tenant-driven.
- `FACTUCORE_BASE_URL` no es fuente efectiva del flujo tenant-based.
- Tests backend: `120` pass, `0` fail.
- Build `backend-facturacion-electronica`: PASS.
- OpenSpec relevante y `--all --strict`: PASS, `80` pass, `0` fail.
- `git diff --check`: pendiente de ejecutar junto con estado final.
- No commit, push ni deploy PROD.

## Clasificación

- Canonical document data: `NOT READY`.
- Provider create/XML/sign/transmit: `NOT REACHED`.
- QA de documento único: `FAIL / NOT READY` por guard de datos canónicos.
- Worker global: mantener deshabilitado.
