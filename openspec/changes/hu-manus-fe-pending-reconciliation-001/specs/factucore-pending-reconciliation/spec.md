## ADDED Requirements

### Requirement: Reconocer reconciliación pendiente de FactuCore
El sistema SHALL reconocer como reconciliación pendiente únicamente una respuesta FactuCore cuyo `providerStatus` mapeado provenga de `providerStatus=SIGNED` o `status=SIGNED`, con `failureClass=PENDING` y `reason=PENDING_RECONCILIATION`, sin convertirla en aceptación ni rechazo fiscal y sin depender de `queued` o `reusedExisting`.

#### Scenario: Issue 201 queda pendiente
- **WHEN** FactuCore responde al issue HTTP `201` con las tres señales de reconciliación pendiente
- **THEN** MANUS conserva el documento no terminal y marca que requiere reconciliación

#### Scenario: Respuesta 201 malformada
- **WHEN** FactuCore responde HTTP `201` sin estado ni evidencia fiscal interpretable
- **THEN** MANUS no registra el documento como `ACCEPTED`

### Requirement: Recuperar mediante consulta sin retransmisión
El sistema SHALL consultar y persistir el estado de un documento con reconciliación pendiente sin llamar `resumeInvoice` ni `POST /transmit`.

#### Scenario: Cinco ciclos del worker
- **WHEN** cinco ciclos del worker consultan el mismo documento `SIGNED/PENDING/PENDING_RECONCILIATION`
- **THEN** el contador de llamadas a `POST /transmit` permanece en cero

#### Scenario: Reinicio con documento PROCESSING
- **WHEN** el proceso reinicia con un documento `PROCESSING`, ligado al proveedor y en `RECONCILIATION_REQUIRED`, y GET detail devuelve la forma wire exacta sin `queued` ni `reusedExisting`
- **THEN** la recuperación realiza consulta y no retransmisión

#### Scenario: Worker y recuperación manual concurrentes
- **WHEN** worker y recuperación manual intentan actuar sobre el mismo tenant y documento
- **THEN** el bloqueo existente serializa las operaciones y ninguna retransmite una reconciliación pendiente

### Requirement: Conservar disposición de transmisión
El sistema SHALL conservar `reason` y cualquier `queued` o `reusedExisting` presente en la respuesta superior, SHALL NOT inferir campos superiores desde `stages.transmission`, y SHALL NOT registrar `TRANSMITTED` cuando `queued=false` y `reusedExisting=true`.

#### Scenario: GET detail no inventa disposición de cola
- **WHEN** GET detail devuelve `SIGNED/PENDING/PENDING_RECONCILIATION` sin `queued` ni `reusedExisting`
- **THEN** MANUS reconoce reconciliación pendiente y no agrega esos campos ausentes

#### Scenario: Issue queued expone señal superior
- **WHEN** issue queued devuelve las tres señales pendientes arriba y `reusedExisting=true` solo dentro de `stages.transmission`
- **THEN** MANUS reconoce reconciliación pendiente sin depender del objeto `stages`

#### Scenario: Claim existente devuelto por transmit
- **WHEN** una llamada de transmisión ya iniciada retorna `queued=false`, `reusedExisting=true` y `reason=PENDING_RECONCILIATION`
- **THEN** MANUS persiste la incertidumbre sin emitir la etapa `TRANSMITTED`, tanto al reanudar una factura como al emitir una nota crédito en modo queued

### Requirement: Exponer retryability de reconciliación
El sistema SHALL devolver `canRetry=false`, `requiresReconciliation=true`, `retryClass=RECONCILE_ONLY` y `requiredAction=RECONCILE_PROVIDER` para un documento pendiente de reconciliación.

#### Scenario: Consulta de retryability
- **WHEN** se evalúa un documento no terminal en `RECONCILIATION_REQUIRED`
- **THEN** la respuesta autoriza reconciliar por consulta y no autoriza reprocesar ni retransmitir

### Requirement: Preservar resultados terminales y separación de efectos
El sistema SHALL mantener `ACCEPTED` y `REJECTED` como estados terminales solo cuando FactuCore los reporte, y SHALL mantener efectos de notificación separados del estado fiscal.

#### Scenario: Aceptación válida
- **WHEN** FactuCore devuelve `ACCEPTED`
- **THEN** MANUS persiste `ACCEPTED` y no vuelve a transmitir

#### Scenario: Código de set 2 no aceptado individualmente
- **WHEN** FactuCore devuelve un documento no terminal asociado al código de set `2`
- **THEN** MANUS no infiere aceptación individual por el código

#### Scenario: CUFE diferente no eleva estado
- **WHEN** un resultado no terminal contiene un CUFE diferente al esperado
- **THEN** MANUS no lo convierte en `ACCEPTED` y conserva la responsabilidad de validación fiscal en FactuCore

#### Scenario: Correo 502
- **WHEN** la notificación por correo termina en `DELIVERY_UNKNOWN` con HTTP `502`
- **THEN** MANUS no modifica el estado fiscal del documento

### Requirement: Mantener idempotencia y aislamiento multi-tenant
El sistema SHALL mantener la recuperación por `externalReference`, el bloqueo por `tenantId:documentId` y las consultas acotadas al tenant.

#### Scenario: Timeout de issue
- **WHEN** el issue falla de forma incierta y existe `externalReference`
- **THEN** MANUS busca el documento existente antes de considerar una nueva creación

#### Scenario: Dos tenants con igual referencia
- **WHEN** dos tenants usan la misma referencia externa
- **THEN** cada operación usa su propio contexto y no comparte estado, credenciales ni bloqueo con el otro tenant

### Requirement: Derivar estado solo desde el contrato FactuCore
El sistema SHALL usar `status` superior como autoridad, SHALL usar `providerStatus` solo como fallback de compatibilidad y SHALL ignorar `normalizedStatus` como autoridad fiscal. Un `status=ACCEPTED` contractual sigue siendo terminal porque FactuCore conserva la responsabilidad de validar evidencia DIAN.

#### Scenario: Aceptación auxiliar contradictoria
- **WHEN** FactuCore devuelve `status=SENT`, `failureClass=PENDING`, `reason=TEST_SET_ACCEPTED`, `latestTransmissionAttempt.fiscalFinal=false` y un `normalizedStatus=ACCEPTED` auxiliar
- **THEN** MANUS ignora la promoción auxiliar, conserva `PROCESSING` y no transmite

#### Scenario: Precedencia del estado contractual
- **WHEN** `status` y `providerStatus` son contradictorios
- **THEN** MANUS usa `status` superior como autoridad contractual y no permite que `providerStatus` o `normalizedStatus` lo promuevan

#### Scenario: Aceptación contractual legítima
- **WHEN** FactuCore devuelve `status=ACCEPTED` conforme a su contrato terminal validado
- **THEN** MANUS conserva `ACCEPTED` aunque un campo auxiliar sea contradictorio y no vuelve a transmitir

#### Scenario: Aceptación administrativa con evidencia no final
- **WHEN** FactuCore devuelve `status=ACCEPTED` pero proyecta explícitamente `latestTransmissionAttempt.fiscalFinal=false`
- **THEN** MANUS conserva un estado no terminal `PROCESSING` y no transmite

### Requirement: Mantener compatibilidad con otros proveedores
El sistema SHALL aplicar las guardas específicas de `PENDING_RECONCILIATION` sin cambiar el flujo de proveedores que no entregan ese contrato.

#### Scenario: Otro proveedor en estado no terminal
- **WHEN** otro proveedor devuelve su estado no terminal normal
- **THEN** MANUS conserva el comportamiento existente de ese proveedor
