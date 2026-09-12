# Evidencia — Gestión Operativa Phase 5.5

## Entorno seguro

- Cluster PostgreSQL disposable, local, en `localhost:55432`.
- Base aislada: `manus_billing_concurrency_test`.
- Usuario local de prueba. Sin secretos en archivos rastreados.
- No se usó configuración QA remota ni PROD.
- Cluster, base y filas temporales fueron eliminados al terminar.

## Conexiones y lock

Se usaron cuatro conexiones independientes del pool. PostgreSQL asignó
sesiones separadas. El lock real fue `pg_advisory_lock` de sesión, con clave
derivada de `tenantId:electronicDocumentId` mediante
`hashtextextended(..., 0)`.

Resultados reales:

- mismo documento en dos conexiones: un solo propietario.
- lock del servicio de procesamiento: 10 iteraciones, sin solapamiento.
- documentos diferentes: paralelismo permitido.
- tenants diferentes con mismo documento: claves independientes.
- cierre forzado de conexión: lock liberado.
- claim stale concurrente: un solo worker reclamó la fila.

Resultado: `5/5 PASS`; deadlocks y locks filtrados: `0`.

## Modelo stale

El worker usa `last_status_check_at` como vencimiento de lease. Reclama filas
`PROCESSING` vencidas con `FOR UPDATE SKIP LOCKED` y extiende el lease con
`leaseMs`. El advisory lock impide recuperación concurrente mientras la sesión
activa sigue viva, aunque el timestamp parezca vencido.

La guarda monotónica impide regresar `ACCEPTED`, `REJECTED` final o
`CANCELLED` a `PROCESSING`.

## Alcance de certificación

Certificado: comportamiento PostgreSQL multi-conexión, aislamiento de claves,
liberación por desconexión y claim stale aislado.

Pendiente: pruebas del workflow completo después de crash antes de create,
después de create, y durante/después de transmit con provider mock persistente.
Esas pruebas deben demostrar recuperación por `external_reference` y
`RECONCILE_FIRST` sin segundo envío. Retry API/UI permanece diferido.

## No mutación externa

- Remote QA DB: `NO`.
- PROD DB: `NO`.
- FactuCore live mutations: `0`.
- DIAN calls: `0`.
- QA business mutations: `0`.

## Validación

- Billing suite: `144 PASS`, `5 SKIPPED` fuera del entorno local aislado.
- Billing build: PASS.
- API build: PASS.
- OpenSpec relevante: PASS.
- OpenSpec all: `90 passed, 1 inherited failure`.
- `git diff --check`: PASS.
