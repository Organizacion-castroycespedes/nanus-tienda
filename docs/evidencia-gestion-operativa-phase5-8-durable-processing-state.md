# Evidencia — Gestión Operativa Phase 5.8

## Objetivo

Se agrega estado durable para distinguir avance normal de intención externa
ambigua. No se expone retry API ni retry UI.

## Migración

Archivo: `scripts/database/migrations/V076__electronic_billing_processing_stage.sql`.

Nota de versionado: la ejecución local histórica se documentó antes de
reservar V075 para `V075__terminal_device_binding.sql`; el archivo fue
renumerado a V076 antes de cualquier aplicación en QA.

Agrega de forma aditiva `processing_stage`, `processing_stage_updated_at` y
un constraint de valores permitidos. El default es `UNKNOWN`.

Backfill conservador:

- `ACCEPTED`/`CANCELLED` y `REJECTED` con `rejected_at`: `COMPLETED`.
- Documento con `provider_document_id`: `RECONCILIATION_REQUIRED`.
- Cualquier otro histórico: `UNKNOWN`.

`UNKNOWN` nunca autoriza creación ni transmisión.

## Estados y matriz de transición

| Desde | Hacia | Disparador | Mutación externa | Recuperación |
|---|---|---|---|---|
| `PRE_PROVIDER_CREATE` | `PROVIDER_CREATE_INTENT` | Antes de crear proveedor | Ninguna | La intención exige reconciliación si el proceso cae |
| `PROVIDER_CREATE_INTENT` | `PROVIDER_LINKED` | Identidad persistida | Creación posible | Buscar primero por `externalReference` |
| `PROVIDER_LINKED` | `PRE_TRANSMIT` | Documento proveedor listo | Ninguna | Solo estado pre-transmisión permite primer envío |
| `PRE_TRANSMIT` | `TRANSMISSION_INTENT` | Antes de transmitir | Ninguna | La intención exige reconciliación |
| `TRANSMISSION_INTENT` | `RECONCILIATION_REQUIRED` | Resultado incierto | Transmisión pudo ocurrir | Leer proveedor antes de transmitir |
| `RECONCILIATION_REQUIRED` | `COMPLETED` | Resultado terminal conocido | Ninguna | Estado terminal gana |
| `UNKNOWN` | `RECONCILIATION_REQUIRED` | Evidencia histórica ambigua | Ninguna | Fail closed/manual review |

Estados terminales no tienen transición saliente de procesamiento. Estado
canónico terminal gana sobre una ejecución vieja.

## Flujo

`ElectronicBillingProcessingService` conserva el advisory lock
tenant/document. Después de reclamar el documento, persiste el stage antes
del camino externo. Sin identidad usa `PROVIDER_CREATE_INTENT`; con identidad
usa `PRE_TRANSMIT` y `TRANSMISSION_INTENT`. Resultados y errores actualizan el
stage durable. La recuperación busca por `externalReference` y no crea cuando
la evidencia es ambigua.

Metadata conserva una copia por compatibilidad con fixtures antiguos; la
columna durable es la fuente preferida.

## Seguridad y validación

- No cambia `OperationalSaleScope`, permisos ni endpoints.
- No cambia ownership de FactuCore/FE.
- No permite retry de `ACCEPTED`, rechazo fiscal final o `CANCELLED`.
- Billing build: PASS.
- Tests Billing: `152 passed`, `5 skipped`, `0 failed`.
- Los skips son PostgreSQL local sin conexión autenticada; no certifican
  integración real.
- FactuCore/DIAN: cero llamadas live. QA/PROD: cero datos usados.

## Pendiente

La certificación completa de crash-before-create, create ambiguo, transmisión
ambigua y refresh/stale requiere ejecutar la migración y pruebas contra
PostgreSQL local autenticado. Stale processing y safe retry quedan `PARTIAL`;
retry API/UI siguen diferidos.
