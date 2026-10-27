## Why

FactuCore P0 puede responder `SIGNED` con `failureClass=PENDING` y `reason=PENDING_RECONCILIATION` cuando ya existe un intento fiscal pendiente. MANUS hoy trata `SIGNED` como reanudable y su worker puede repetir `POST /transmit`, ignorar `queued=false`/`reusedExisting=true` y registrar `TRANSMITTED` sin una transmisión nueva.

## What Changes

- Derivar el estado MANUS solo desde el `status` contractual de FactuCore, con `providerStatus` como compatibilidad secundaria, e ignorar `normalizedStatus` como autoridad fiscal.
- Reconocer el resultado explícito de reconciliación pendiente de FactuCore como estado no terminal que exige consulta, no retransmisión.
- Conservar solo los campos presentes en cada respuesta: `reason` en todos los endpoints pendientes, `queued` en issue y transmit, y `reusedExisting` cuando FactuCore lo expone en `POST /transmit`.
- Hacer que recuperación, worker y reanudación de FactuCore fallen de forma segura ante `PENDING_RECONCILIATION`.
- No registrar la etapa `TRANSMITTED` cuando FactuCore indica `queued=false` y `reusedExisting=true`.
- Exponer retryability como `canRetry=false`, `requiresReconciliation=true` y `requiredAction=RECONCILE_PROVIDER`.
- Mantener sin cambios las rutas y DTO públicos, el aislamiento por tenant, la idempotencia por `externalReference` y el comportamiento de otros proveedores.

## Capabilities

### New Capabilities

- `factucore-pending-reconciliation`: Consumo seguro, persistencia de evidencia y recuperación por consulta de resultados fiscales inciertos de FactuCore.

### Modified Capabilities

- Ninguna.

## Impact

- La validez de un `status=ACCEPTED` superior sigue siendo una garantía del servidor FactuCore. MANUS no reconstruye ni sustituye el validador de evidencia DIAN.
- Backend de facturación electrónica: tipos, mapper y provider de FactuCore; servicio de procesamiento y pruebas.
- No requiere tabla, migración, dependencia, endpoint ni cambio de DTO público.
- Requiere que FactuCore P0 entregue el contrato wire `status=SIGNED` + `failureClass=PENDING` + `reason=PENDING_RECONCILIATION`; el mapper deriva `providerStatus=SIGNED`. Antes de desplegar MANUS debe coordinarse la versión compatible de FactuCore.
