# Evidencia Fase 6 - Provider Processing Orchestration

Fecha: 2026-08-27

## Alcance

- `ElectronicBillingProcessingService`
- Claim de documentos con transaccion corta
- Invocacion de provider fuera de la transaccion de DB
- Persistencia de resultado del provider
- Refresh de status
- Retry orchestration
- Clasificacion de errores retryable / no retryable
- Persistencia de provider line ids cuando el response los trae

## Archivos clave

- `api/src/modules/electronic-billing/electronic-billing-processing.service.ts`
- `api/src/modules/electronic-billing/electronic-billing-processing.service.spec.ts`
- `api/src/modules/electronic-billing/electronic-billing.service.ts`
- `api/src/modules/electronic-billing/repositories/electronic-billing.repositories.ts`
- `api/src/modules/electronic-billing/contracts/electronic-billing-errors.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.mapper.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.types.ts`

## Flujo

- `PENDING` o `TECHNICAL_ERROR` entra a claim.
- `PROCESSING` se marca antes del HTTP externo.
- `FactuCoreProvider` o provider fake corre fuera de la transaccion.
- Resultado se persiste en nueva transaccion.
- `provider_document_id`, `provider_status`, `status`, `prefix`, `number`, `full_number`, `cufe`, `cude` y errores se actualizan segun resultado.

## Seguridad y concurrencia

- No hay transaccion PostgreSQL abierta durante HTTP.
- Documento ya `PROCESSING` bloquea segundo procesamiento.
- `ACCEPTED` no se vuelve a emitir.

## Resultado de tests

- Processing tests: `PASS`
- Full electronic-billing tests: `PASS`
- API build: `PASS`
- Real PostgreSQL local: `NO EJECUTADO`

## Riesgos abiertos

- `BASE MIGRATION HAS NOT BEEN EXECUTED AGAINST A REAL LOCAL POSTGRESQL DATABASE`
- `CREDENTIAL STORAGE`: `PENDING`
- `CREATE TIMEOUT RECOVERY`: `DEFINED`
- `PROVIDER SUCCESS + DB FAILURE RECOVERY`: `DEFINED`
- `PARTIAL PIPELINE RESUME RISK`: `OPEN`

