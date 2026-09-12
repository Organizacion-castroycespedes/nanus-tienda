# Evidencia — Gestión Operativa Phase 5.2

## Decisión

No se expone retry operativo. El dominio FE sí expone `evaluateRetryability()`
como decisión de solo lectura, pero devuelve `canRetry: false` hasta certificar
una ejecución con idempotencia y un solo envío.

## Call graph actual

`retryDocument()` → `runProcessing("retry")` → `claimDocument()` →
`retryWithProviderOrIssue()`.

- Con `provider_document_id`: `retryWithProvider()` → provider
  `retryDocument()` → FactuCore `retry-transmission` → posible retransmisión.
- Sin `provider_document_id`: provider status lookup; si responde not found,
  `issueWithProvider()` → create → generate XML → sign → transmit.
- En ambos casos hay mutación local de estado/eventos y no existe garantía
  suficiente para un botón operativo ciego.

## Taxonomía y política

| Clase | Política actual |
|---|---|
| Error local/customer fiscal | `FIX_SOURCE_DATA_FIRST`; snapshot existente no se modifica |
| Provider readiness / HTTP 400 validation | `MANUAL_REVIEW` o corrección; no retry UI |
| Network before provider mutation | `RECONCILE_PROVIDER_ONLY` primero |
| Create succeeded / local persist failed | `RECONCILE_PROVIDER_ONLY`; outcome ambiguo |
| Provider document exists not transmitted | reconciliar estado; no retry normal |
| Transmission outcome ambiguous | reconciliar antes de cualquier decisión |
| DIAN `REJECTED` final | `FORBIDDEN` |
| DIAN `ACCEPTED` | `FORBIDDEN` |
| `PROCESSING` | `ALREADY_PROCESSING` |
| `PENDING` | `RECONCILE_FIRST` |
| `TECHNICAL_ERROR` | `RECONCILE_FIRST` |
| `CANCELLED` | `FORBIDDEN` |
| Unknown error | `MANUAL_REVIEW` |

Los códigos transitorios existentes reconocen `TIMEOUT`, `NETWORK`,
`RATE_LIMIT`, `UNAVAILABLE` y `TEMPORARY`. Esta clasificación pertenece al
dominio, no al frontend.

## Snapshot fiscal

La emisión usa el snapshot fiscal persistido del documento. Corregir el
cliente no reescribe ese snapshot. Resultado: `CUSTOMER CORRECTION RETRY:
NEW_DOCUMENT_REQUIRED`.

La razón exacta es estructural: `buildInvoiceCommand()` lee el cliente desde
`electronicDocument.metadata` mediante `readBillingSnapshot()`. No lee el
cliente actual para reconstruir un documento existente. Por eso una corrección
posterior del cliente no puede alterar legalmente el documento persistido.

## Identidad e idempotencia

- Creación: `electronicDocumentId` y `externalReference` identifican la
  operación Manus; el provider document ID se persiste después de crear.
- Recuperación parcial: `externalReference` permite buscar el documento
  creado antes de volver a emitir.
- Estado: `providerDocumentId` se usa primero para el GET de estado; si falta,
  se usa `externalReference`.
- Reconciliación: `electronicDocumentId` + tenant protegen la actualización
  local y el conflicto de identidad del proveedor.

Si create o transmisión termina con timeout, el resultado es ambiguo. La
política obligatoria es `READ / RECONCILE FIRST`: nunca se repite create o
transmit antes de consultar por `providerDocumentId` o `externalReference`.
La creación por `externalReference` debe mantener como máximo un documento
de proveedor por referencia.

## Estados de transmisión

La evidencia local distingue documento pendiente/procesando y la identidad
del proveedor, pero no demuestra por sí sola que una transmisión ambigua haya
terminado. `TRANSMISSION_OUTCOME_UNKNOWN` exige reconciliación externa. No se
convierte automáticamente en retry.

## Protección

`evaluateRetryability()` prueba estados terminales, procesamiento activo,
pendiente y error técnico. No invoca provider, create, XML, sign, transmit,
`retryDocument()` ni `processDocument()`.

## Concurrencia

`claimForProcessing()` usa una actualización SQL condicional atómica. Solo un
proceso puede cambiar un documento elegible a `PROCESSING`. Worker y
recuperación manual usan ese mismo claim. El perdedor relee el documento y
observa `PROCESSING` o un estado terminal; no entra al provider.

La recuperación pre-provider consulta primero por `providerDocumentId` o
`externalReference`, y `runProcessing()` vuelve a ejecutar el claim antes de
cualquier create. Dos llamadas concurrentes no pueden crear dos documentos
desde la misma referencia.

La UI y el endpoint operativo de retry siguen deshabilitados. Una futura
exposición debe conservar el claim, agregar idempotency key/auditoría y probar
worker contra API en instancias separadas.

El resultado tipado ya comunica `canRetry`, `decision` y `reason`; la
proyección futura puede añadir `requiresReconciliation`, `providerDocumentExists`
y `transmissionState` sin filtrar DTOs del proveedor. Hoy todas las decisiones
operativas son no ejecutables hasta cerrar ese contrato.

Retry UI y endpoint quedan diferidos. La próxima implementación requiere
contrato explícito para recuperación pre-provider, deduplicación por
`externalReference`, reconciliación obligatoria y límite de un envío.
