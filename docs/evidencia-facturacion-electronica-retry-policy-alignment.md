# Evidencia: alineación de política de retry

## Hallazgo

`retryDocument()` rechazaba cualquier estado distinto de `TECHNICAL_ERROR`. El servicio ya tenía una clasificación estable para una recuperación pre-provider: `REJECTED` + `FACTUCORE_VALIDATION` + sin `provider_document_id`. Las dos reglas eran inconsistentes.

## Decisión

`ElectronicBillingProcessingService.retryDocument()` es el entrypoint productivo canónico. Ahora consulta la misma predicción semántica `isApprovedPreProviderRecovery()` usada por `recoverPreProviderDocument()` y pasa el permiso a la única ruta `runProcessing()`.

Esto permite solo la clasificación conocida. No hace retriable todo `REJECTED` y no usa `last_error_message`.

## Matriz verificada

| Caso | Resultado |
| --- | --- |
| `TECHNICAL_ERROR`, sin proveedor, referencia no encontrada | issue/recovery permitido |
| `REJECTED` + `FACTUCORE_VALIDATION`, sin proveedor | issue/recovery permitido |
| `REJECTED` no relacionado | bloqueado |
| rechazo fiscal final | bloqueado |
| proveedor existente | no entra por create-pre-provider |
| referencia externa encontrada | reconcile; create bloqueado |

## Validación

- Billing suite: 140/140 PASS.
- Tests de `FactuCoreClient`, provider y processing: 41/41 PASS.
- Billing build: PASS.
- OpenSpec all strict: 80/80 PASS.
- Provider calls en esta fase: create 0, generate XML 0, sign 0, transmit 0.
- Documento controlado: sin mutación; status `REJECTED`, `provider_document_id` NULL.
- Manus worker: disabled.
- FactuCore background jobs: disabled.
- Secret leak: NONE.

## Resultado

La política queda consistente. El harness puede llamar al entrypoint canónico, pero esta fase no ejecuta provider POST ni procesa documentos.
