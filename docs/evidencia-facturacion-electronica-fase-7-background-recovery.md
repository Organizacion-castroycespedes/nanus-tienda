# Evidencia Fase 7 - Background Status Synchronization + Retry + Recovery

## Resumen

Se agrego una capa de sincronizacion en segundo plano para el dominio neutral de facturacion electronica.

## Decision de runtime

- No existe queue infra dedicada en el repo para este dominio.
- Se uso un servicio in-process de NestJS con `OnModuleInit`, `OnModuleDestroy` y `setTimeout` recursivo.
- Se evito `setInterval` para no superponer ciclos.

## Estrategia de claim

- Se reutilizo `last_status_check_at` como control de programacion.
- El claim de background usa `FOR UPDATE SKIP LOCKED`.
- Se agrego lease temporal al claim para evitar doble procesamiento entre instancias.

## Politica de reintento

- `PROCESSING` se reconsulta por ventana configurada.
- `TECHNICAL_ERROR` usa backoff exponencial con tope configurable.
- Cuando se supera el maximo de reintentos, el documento se difiere para revision manual.

## Recuperacion

- `refreshDocumentStatus()` ya soporta recuperacion por `provider_document_id` o `externalReference`.
- `retryDocument()` ya soporta recuperacion por `provider_document_id` o `externalReference`.
- Se mantuvo el resume parcial dentro del adapter FactuCore, sin filtrar detalles al dominio neutral.

## FactuCore

- Se agrego `GET /api/v1/external/documents/:id/operations` al adapter para observabilidad y resume parcial.
- Se conservaron los estados vendor-specific dentro de `providers/factucore/`.

## Archivos tocados

- `api/src/modules/electronic-billing/electronic-billing-background.service.ts`
- `api/src/modules/electronic-billing/electronic-billing-processing.service.ts`
- `api/src/modules/electronic-billing/repositories/electronic-billing.repositories.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.client.ts`
- `api/src/modules/electronic-billing/providers/factucore/factucore.provider.ts`

## Estado de ejecucion

- `V072` no fue reejecutada.
- No se toco QA.
- No se toco PROD.
- Validacion real de PostgreSQL sigue pendiente.
