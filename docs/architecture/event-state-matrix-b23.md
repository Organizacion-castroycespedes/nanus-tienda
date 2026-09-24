# Matriz de eventos y estados B2.3

| Momento | Estado/resultado | Responsable | Evidencia | Garantía demostrada |
|---|---|---|---|---|
| Venta automática | `SALE_COMPLETED_FOR_ELECTRONIC_BILLING`, `PENDING` | API / Outbox | `api/src/modules/inventory/services/sale.service.ts:2698-2728` | Atomicidad con venta en el flujo inspeccionado |
| Claim | `PROCESSING` + lease | Dispatcher | `api/src/modules/integration-outbox/services/integration-outbox-dispatcher.ts:55-70` | Evita procesamiento concurrente dentro del mecanismo de claim |
| Entrega | `PUBLISHED` | Dispatcher | `.../integration-outbox-dispatcher.ts:256-261` | Marca después de respuesta aceptada o ya procesada |
| Reintento | `PENDING`/estado retryable con `next_attempt_at` | Dispatcher | `.../integration-outbox-dispatcher.ts:264-308` | Backoff y máximo configurado |
| Fallo terminal | `FAILED` | Dispatcher | `.../integration-outbox-dispatcher.ts:221-239`, `286-289` | No reintenta después de condición terminal |
| Recepción fiscal | `RECEIVED` en inbox | Facturación | `.../electronic-billing-sale-event.consumer.ts:176-195` | Inserción transaccional del inbox |
| Documento fiscal | `PENDING`, `PROCESSING`, `TECHNICAL_ERROR`, `ACCEPTED`, `REJECTED`, `CANCELLED` | Facturación | `.../electronic-billing-processing.service.ts:139-145` | Reglas de procesamiento y retry |
| Etapa fiscal | `PRE_PROVIDER_CREATE` … `COMPLETED` | Facturación | `.../contracts/processing-state.ts:1-38` | Reconciliación antes de repetir mutaciones externas |

Los nombres de estado son los observados en código. No equivalen por sí solos a aceptación DIAN ni a una entrega externa certificada.
