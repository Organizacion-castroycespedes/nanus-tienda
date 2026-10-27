## Context

MANUS usa `issueInvoice` para la emisión combinada y `getDocument`/`getStatus` para recuperar un documento ya ligado al proveedor. El worker invoca `refreshDocumentStatus`; hoy, si la consulta devuelve `SIGNED`, el servicio llama `resumeInvoice`, que puede ejecutar `POST /transmit`. FactuCore P0 usa `status=SIGNED`, `failureClass=PENDING` y `reason=PENDING_RECONCILIATION` para indicar que existe un claim fiscal pendiente que solo debe reconciliarse. El mapper de MANUS deriva `providerStatus` desde `providerStatus ?? status`. FactuCore responde a `POST /transmit` pendiente con `queued=false` y `reusedExisting=true`.

La persistencia actual ya tiene `processing_stage=RECONCILIATION_REQUIRED`, metadatos JSON, eventos y bloqueo tenant/documento. Este cambio reutiliza esos mecanismos. No agrega esquema.

## Goals / Non-Goals

**Goals:**

- Evitar todo `POST /transmit` automático cuando la respuesta consultada representa reconciliación pendiente.
- Conservar de forma durable las señales que cada endpoint realmente expone y la marca derivada `pendingReconciliation` en metadatos existentes.
- Mantener el documento no terminal y con retryability de reconciliación, no de reenvío.
- Aplicar defensa en profundidad en el servicio y en el provider FactuCore.
- Mantener aislamiento tenant-bound, bloqueo por documento e idempotencia por `externalReference`.

**Non-Goals:**

- Validar CUFE/CUDE, código DIAN `2` o aceptación fiscal individual dentro de MANUS. Esa evidencia pertenece al límite fiscal de FactuCore.
- Cambiar correo, emitir, retransmitir, consultar servicios reales o modificar bases de producción.
- Crear migraciones, tablas, endpoints o estados canónicos nuevos.
- Convertir HTTP `201`, `queued`, `reusedExisting` o correo `502` en aceptación o rechazo fiscal.

## Decisions

### 1. Predicado estricto para reconciliación pendiente

El resultado se considera pendiente de reconciliación solo cuando coinciden, sin importar mayúsculas/minúsculas:

- `providerStatus=SIGNED` después del mapeo; en el wire puede provenir de `providerStatus` o de `status=SIGNED`
- `failureClass=PENDING`
- `failureReason/reason=PENDING_RECONCILIATION`

Las tres señales son obligatorias. `queued`, `reusedExisting`, `stages.transmission`, CUFE y códigos DIAN no forman parte del predicado. Esto evita depender de campos ausentes en GET detail/status y evita cambiar la semántica histórica de otros `SIGNED` y de otros proveedores. Alternativa descartada: tratar todo `SIGNED` como pendiente; rompería la recuperación escalonada existente.

### 2. Consulta pura antes que reanudación

`refreshDocumentStatus` y `resumeLinkedProviderDocument` persisten el resultado consultado y retornan cuando el predicado estricto se cumple. No llaman `resumeInvoice`. La ruta administrativa ya basada en reconciliación continúa siendo consulta pura.

El provider FactuCore repite la guardia inmediatamente después de `GET status`. Esto protege llamadas futuras que no pasen por el servicio. Alternativa descartada: proteger solo el worker; dejaría otras rutas capaces de retransmitir.

### 3. Evidencia en metadatos existentes

El mapper conserva `queued`, `reusedExisting` y `reason` solo cuando están presentes, y agrega una marca derivada `pendingReconciliation` dentro de `metadata`. La persistencia existente guarda `providerResult.metadata` bajo evidencia del proveedor y usa `RECONCILIATION_REQUIRED`; no se requiere migración. No se promueven campos anidados de `stages.transmission` a señales superiores.

### 4. No afirmar una transmisión reutilizada

Si una llamada ya iniciada a `POST /transmit` responde `queued=false` y `reusedExisting=true`, el provider no emite la etapa local `TRANSMITTED`. La misma guardia reutilizable aplica tanto a `resumeInvoice` como al flujo queued de `issueCreditNote`. Retorna el resultado para persistirlo como incierto. Esta guardia cubre la carrera en la que el `GET` previo todavía no mostraba el claim.

`queued=false` por sí solo no significa error. `reusedExisting=true` por sí solo tampoco prueba aceptación fiscal.

### 5. Retryability explícita

Un documento `PROCESSING` con `providerStatus=SIGNED`, `processing_stage=RECONCILIATION_REQUIRED` y la evidencia persistida `pendingReconciliation=true` devuelve `canRetry=false`, `retryClass=RECONCILE_ONLY`, `decision=RECONCILE_FIRST`, `requiredAction=RECONCILE_PROVIDER` y `requiresReconciliation=true`. La acción autorizada es consultar estado. No es permiso para emitir o transmitir. Exigir la evidencia evita cambiar retryability de otros proveedores.

### 6. Contratos y compatibilidad

No cambian rutas ni DTO públicos. Los campos nuevos son opcionales en el tipo interno de respuesta FactuCore y se propagan como metadatos. Otros proveedores no producen el predicado FactuCore y conservan su flujo. HTTP `201` significa creación/procesamiento aceptado por la API, no aceptación fiscal.

### 7. Matriz wire verificada en FactuCore P0

La precedencia de estado es explícita: `status` superior de FactuCore, luego `providerStatus` como compatibilidad y finalmente el fallback seguro del mapper. `normalizedStatus` es un campo auxiliar no garantizado y nunca puede promover ni degradar el estado fiscal. Un `status=SENT` con `failureClass=PENDING`, `reason=TEST_SET_ACCEPTED` y `latestTransmissionAttempt.fiscalFinal=false` permanece `PROCESSING`, incluso si un payload contradictorio incluye `normalizedStatus=ACCEPTED`.

MANUS acepta `status=ACCEPTED` como contrato terminal del servidor y no reimplementa la correlación DIAN. FactuCore debe impedir que rutas administrativas publiquen ese estado sin evidencia individual válida. Si FactuCore entrega evidencia explícita contradictoria `latestTransmissionAttempt.fiscalFinal=false`, MANUS falla de forma segura hacia `PROCESSING`. La ausencia del campo no rechaza un `ACCEPTED` contractual legítimo, porque issue puede omitir esa proyección anidada.

| Endpoint | Campos pendientes superiores garantizados | Campos no garantizados arriba |
|---|---|---|
| issue sync | `status=SIGNED`, `queued=false`, `failureClass=PENDING`, `reason=PENDING_RECONCILIATION` | `reusedExisting` puede vivir solo en `stages.transmission` |
| issue queued | `status=SIGNED`, `queued=false`, `failureClass=PENDING`, `reason=PENDING_RECONCILIATION` | `reusedExisting` puede vivir solo en `stages.transmission` |
| GET detail | `status=SIGNED`, `failureClass=PENDING`, `reason=PENDING_RECONCILIATION` | `queued`, `reusedExisting` |
| GET status | `status=SIGNED`, `failureClass=PENDING`, `reason=PENDING_RECONCILIATION` | `queued`, `reusedExisting` |
| POST transmit con claim pendiente | `status=SIGNED`, `queued=false`, `reusedExisting=true`, `failureClass=PENDING`, `reason=PENDING_RECONCILIATION` | Ninguno de los anteriores |

Garantía del servidor: FactuCore selecciona el claim `PENDING` por `tenantId` y `documentId`, clasifica solo operaciones de envío y no vuelve a invocar al proveedor cuando reutiliza el claim. Inferencia del consumidor: MANUS deriva `providerStatus`, `normalizedStatus=PROCESSING`, `pendingReconciliation=true` y retryability `RECONCILE_ONLY`; FactuCore no entrega esos campos MANUS.

## State Matrix

| Señal proveedor | Estado MANUS | Etapa | Acción automática |
|---|---|---|---|
| `ACCEPTED` válido | `ACCEPTED` | `COMPLETED` | Ninguna |
| `REJECTED` | `REJECTED` | `COMPLETED` | Ninguna |
| `SIGNED/PENDING/PENDING_RECONCILIATION` | `PROCESSING` | `RECONCILIATION_REQUIRED` | Solo consulta posterior |
| `SIGNED` sin predicado estricto | `PROCESSING` | flujo existente | Reanudación escalonada permitida |
| `SENT` | `PROCESSING` | `RECONCILIATION_REQUIRED` | Consulta posterior |
| `SENT/PENDING/TEST_SET_ACCEPTED`, `fiscalFinal=false` | `PROCESSING` | `RECONCILIATION_REQUIRED` | Solo consulta; ignorar `normalizedStatus=ACCEPTED` contradictorio |
| `queued=false/reusedExisting=true` tras transmit | No terminal | `RECONCILIATION_REQUIRED` | No registrar `TRANSMITTED`; no reenvío |
| HTTP `201` malformado | No aceptado | error/estado seguro existente | No afirmar aceptación |
| correo `DELIVERY_UNKNOWN 502` | Sin cambio fiscal | Sin cambio fiscal | Reintento de notificación separado |

## Risks / Trade-offs

- [`normalizedStatus` contradictorio] -> Ignorarlo como autoridad y derivar solo desde `status`/`providerStatus` contractuales.
- [`ACCEPTED` administrativo en FactuCore] -> Bloqueo de integración coordinada hasta que FactuCore garantice el estado terminal; MANUS no duplica el validador DIAN.
- [FactuCore antiguo no entrega las tres señales] -> Despliegue coordinado; MANUS conserva comportamiento anterior si falta el contrato.
- [Un resultado queda pendiente por mucho tiempo] -> Observabilidad y reconciliación por consulta; nunca retransmisión automática.
- [Carrera entre worker y recuperación manual] -> Bloqueo existente `tenantId:documentId` más guardia duplicada en provider.
- [Metadatos parciales] -> Predicado estricto; una respuesta ambigua no se convierte en aceptación.
- [CUFE/CUDE o código DIAN ambiguo] -> FactuCore debe validar evidencia individual; MANUS no infiere aceptación.

## Migration Plan

1. Validar y probar MANUS con mocks del contrato P0.
2. Integrar y desplegar primero o coordinadamente FactuCore P0.
3. Desplegar MANUS con worker observado y métricas de reconciliación.
4. Ante rollback de MANUS, pausar worker antes de volver a una versión que retransmita `SIGNED` pendiente.

No hay migración de datos ni esquema.

## Open Questions

- Confirmar en integración controlada futura que la versión desplegada de FactuCore corresponde al P0 auditado; esta HU solo certifica los cambios locales sin commit ni despliegue.
- Definir en P1 alerta/umbral operativo para reconciliaciones pendientes prolongadas.
- Definir en P1 si `queued` y `reusedExisting` deben elevarse a DTO público; P0 los conserva internamente sin romper contratos.
