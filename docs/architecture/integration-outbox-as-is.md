# Integration Outbox: arquitectura AS-IS

## Productor y envelope

El productor está en `api/src/modules/inventory/services/sale.service.ts`. La venta abre transacción, crea venta y pagos, finaliza la venta y, si la política del tenant está en modo automático, construye el snapshot y encola el evento antes de `COMMIT` ([fuente](../../api/src/modules/inventory/services/sale.service.ts#L2553-L2728)). El helper de outbox recibe el mismo `PoolClient` y construye `SALE_COMPLETED_FOR_ELECTRONIC_BILLING`, versión 1, con `tenantId`, `correlationId`, fuente de tipo `SALE` y snapshots de venta, cliente, líneas, impuestos, pagos y totales ([fuente](../../api/src/modules/integration-outbox/mappers/sale-completed-for-electronic-billing.builder.ts#L10-L36), [contrato](../../api/src/modules/integration-outbox/contracts/integration-outbox-events.ts#L1-L32)).

Conclusión de atomicidad: para la creación automática de venta revisada, el evento y la operación de negocio comparten cliente y `BEGIN/COMMIT`. Si falla el enqueue, el `ROLLBACK` revierte la transacción. La conclusión no se extiende a productores futuros ni a ambientes no inspeccionados.

## Persistencia e idempotencia

`IntegrationOutboxRepository` persiste en `integration_outbox_events` con `payload` JSONB, hash SHA-256, estado, intentos, lease, próximo intento, error y timestamps. Usa `ON CONFLICT (event_id) DO NOTHING`; si existe, compara el hash y rechaza conflicto de payload ([fuente](../../api/src/modules/integration-outbox/repositories/integration-outbox.repository.ts#L12-L34), [fuente](../../api/src/modules/integration-outbox/repositories/integration-outbox.repository.ts#L106-L203)). Esto demuestra deduplicación por `event_id` y detección de payload distinto.

El contrato del evento usa un ID determinista `SALE_COMPLETED_FOR_ELECTRONIC_BILLING:{tenantId}:{saleId}` ([fuente](../../api/src/modules/inventory/mappers/sale-completed-for-electronic-billing-event-id.ts#L1-L4)). La operación manual de recuperación puede marcar el evento fallido previo y crear un reemplazo dentro de una transacción propia ([fuente](../../api/src/modules/inventory/services/sale.service.ts#L1686-L1714)).

## Dispatcher

El dispatcher es opt-in. Solo corre con `INTEGRATION_OUTBOX_DISPATCHER_ENABLED`, URL fiscal, token interno, batch y concurrencia válidos ([fuente](../../api/src/modules/integration-outbox/services/integration-outbox-dispatcher.ts#L35-L90)). Reclama eventos vencidos con lease, limita concurrencia, llama `POST /internal/electronic-billing/events/sale-completed` y actualiza el estado según respuesta ([fuente](../../api/src/modules/integration-outbox/services/integration-outbox-dispatcher.ts#L132-L309)).

Estados observables: `PENDING`, `PROCESSING`, `PUBLISHED` y `FAILED`. El dispatcher trata `PUBLISHED` y `ALREADY_PROCESSED` como entrega completada; los errores retryable usan backoff y los no retryable o agotados pasan a fallo terminal. La entrega es al menos una vez; la semántica efectiva depende también del inbox receptor.

## Límite de confianza

La llamada API→fiscal lleva `Authorization: Bearer` con token interno y JSON. El código no demuestra cifrado extremo a extremo, rotación, mTLS, cola externa ni monitoreo de dead letters. El receptor protege el endpoint y deduplica por evento/fuente antes de crear documento ([fuente](../../backend-facturacion-electronica/src/modules/electronic-billing/consumers/electronic-billing-sale-event.consumer.ts#L125-L151)).
