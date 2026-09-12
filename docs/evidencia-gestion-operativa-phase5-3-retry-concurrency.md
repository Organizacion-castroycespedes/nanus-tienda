# Evidencia — Gestión Operativa Phase 5.3

## Resultado

Se agregó un candado advisory de PostgreSQL por `tenantId` y
`electronicDocumentId`. El candado vive en una conexión del pool y cubre la
operación completa, incluido el primer llamado al proveedor. No es un mutex
de memoria.

## Modelo actual

`processDocument()`, `retryDocument()` y `retryRecoverableDocument()` pasan
por `runProcessing()` y el claim condicional de `electronic_documents`.
El worker usa los mismos métodos. `refreshDocumentStatus()` y
`reconcileExistingProviderStatus()` también toman el candado antes de leer y
persistir estado.

El claim SQL solo cambia un documento cuyo estado todavía pertenece a la
lista permitida a `PROCESSING`. La actualización devuelve cero filas para el
competidor. El candado advisory agrega exclusión entre instancias durante la
llamada externa, donde una fila `PROCESSING` por sí sola no basta.

## Carreras cubiertas

| Carrera | Protección |
|---|---|
| retry manual/manual | mismo advisory lock + claim CAS |
| worker/worker | mismo lock por documento |
| worker/manual | mismo lock y mismo claim |
| refresh/retry | mismo lock; refresh no pisa una ejecución activa |
| doble HTTP / doble click | backend serializa; la UI no es la seguridad |
| instancias distintas | lock PostgreSQL, no estado local |

## Límites y estados

`ACCEPTED`, `REJECTED` final, `CANCELLED` y `PROCESSING` no se vuelven
reintentables. Un estado desconocido falla cerrado. La revisión de
`externalReference` continúa siendo obligatoria antes de cualquier creación.
La transmisión ambigua exige reconciliación o revisión manual; nunca hay
retransmisión ciega.

La persistencia aplica una guarda monotónica: un resultado tardío de
`PROCESSING`, `PENDING` o `TECHNICAL_ERROR` no puede regresar un documento
terminal a procesamiento. `CANCELLED` tampoco se reinicia.

El estado `PROCESSING` es estado de negocio y señal de claim. El advisory
lock dura la ejecución; si el proceso muere, la conexión libera el lock. El
estado persistido puede requerir la recuperación existente de worker/manual,
por lo que la certificación de lease y recuperación de `PROCESSING` queda
abierta para una fase posterior.

## Prueba

La prueba determinista `document processing lock serializes competing
executions` verifica que dos ejecuciones sobre el mismo documento nunca
mantienen dos propietarios simultáneos. No usa FactuCore, DIAN ni datos QA.

La prueba no certifica una transmisión real. El retry operativo sigue sin
endpoint ni UI hasta completar la certificación de recuperación, lease y
transmisión única.

## Invariantes

- Creación duplicada por `externalReference`: bloqueada por recuperación
  previa y claim compartido.
- Transmisión ciega: bloqueada por la política de ambigüedad.
- Creación/XML/firma/transmisión en esta validación: `0`.
- Llamadas DIAN en esta validación: `0`.

## Pendiente

La ejecución de retry recuperable aún requiere una prueba de integración con
dos conexiones PostgreSQL reales y una política formal de stale processing.
Por eso el endpoint y la UI de retry permanecen diferidos.
