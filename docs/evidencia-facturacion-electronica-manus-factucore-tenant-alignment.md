# Evidencia: alineación de tenant Manus y FactuCore

## Alcance

- Solo QA local y configuración del adaptador.
- No se procesó ningún documento electrónico.
- No hubo `POST` de proveedor.
- Worker global permaneció deshabilitado.
- No hubo migraciones, commit, push ni deploy.

## Identidades

| Identidad | Valor |
|---|---|
| Manus tenant | `00000000-0000-0000-0000-000000000001` |
| FactuCore tenant | `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc` |
| FactuCore API client | `60cbac48-f476-4f34-9664-6ba27df95d23` |
| Manus provider config | `22222222-2222-4222-8222-222222222222` |

## Contrato y causa

FactuCore resuelve el tenant efectivo desde el API-client autenticado. Para el
API-client QA, el actor pertenece al tenant FactuCore `d5bacedc-c3cd-48bf-b1a9-e4327ef0ffdc`.
El `tenantId` de la solicitud no reemplaza ese tenant para actores API-client.

La causa era tratar el UUID de Manus como si fuera el UUID interno de FactuCore.
Ese supuesto era incorrecto entre bounded contexts. No se agregó el tenant
específico al evento `SALE_COMPLETED_FOR_ELECTRONIC_BILLING`.

## Corrección

- `tenant_electronic_billing_configs.tenant_id` conserva el tenant Manus.
- El JSON `settings` de la configuración QA contiene `factuCoreTenantId`.
- `FactuCoreProvider` exige y resuelve ese valor en el contexto runtime.
- `FactuCoreRuntimeContext` conserva la identidad externa para el adapter.
- No se envía el UUID Manus como identidad FactuCore.
- No hay UUIDs de tenant hardcodeados en código.
- No se modificó el contrato genérico de venta.

## Verificación QA

- Base de datos: `manus_tienda_qa`; schema: `public`.
- Configuración provider: `FACTUCORE`, `TEST`, habilitada, URL local, referencia de credencial existente.
- Resolución runtime: PASS; resolvió Manus tenant y FactuCore tenant distintos.
- Asociación API-client → FactuCore tenant: PASS.
- FactuCore tenant → issuer: PASS.
- FactuCore tenant → DIAN config: PASS.
- FactuCore tenant → invoice resolution: PASS.
- FactuCore internal DIAN readiness: PASS.
- `ELECTRONIC_BILLING_BACKGROUND_ENABLED=false`.
- Documentos procesados: `NO`.
- Provider POST calls: `0`.

## Validación

- Billing tests: `134 passed, 0 failed`.
- Billing build: PASS.
- FactuCore code: sin cambios.
- OpenSpec strict relevante: PASS.
- OpenSpec strict all: `80 passed, 0 failed`.
- Git diff check Manus: PASS (line-ending warnings only).
- Git diff check FactuCore: PASS; repository sin cambios.
