# Evidencia — Gestión Operativa Phase 5.4

## Entorno

- PostgreSQL disposable local en `localhost:55432`.
- Base aislada: `manus_billing_concurrency_test`.
- Cuatro conexiones del pool; pruebas sin QA, PROD, FactuCore ni DIAN.
- Cluster y base fueron eliminados después de la prueba.

## Lock real

El procesamiento usa `pg_advisory_lock(hashtextextended($1, 0))` con clave
`tenantId:electronicDocumentId`. Es un lock de sesión. El procesamiento de
servicio mantiene la conexión hasta terminar y libera en `finally`.

Pruebas reales PASS:

- mismo documento: dos conexiones, un propietario.
- servicio de procesamiento: 10 iteraciones, sin solapamiento.
- documentos distintos: ejecución paralela.
- tenants distintos: claves independientes.
- cierre forzado de conexión: el lock fue liberado.
- lease stale: dos workers, un claim mediante `FOR UPDATE SKIP LOCKED`.

## Stale processing

El worker considera candidato un documento `PROCESSING` cuando
`last_status_check_at` es `NULL` o menor/igual a `dueBefore`. Al reclamarlo,
actualiza el timestamp con `leaseMs`. El lock advisory gana frente a un
timestamp vencido mientras otra ejecución siga viva.

La sesión caída libera el lock. La fila puede quedar `PROCESSING` hasta que
expire el lease; luego solo una ejecución puede reclamarla. Si existe
provider ID o una referencia externa, la recuperación debe reconciliar antes
de crear o transmitir. Si el resultado de transmisión es ambiguo, requiere
reconciliación o revisión manual.

## Seguridad fiscal

La guarda monotónica impide que `ACCEPTED`, `REJECTED` final o `CANCELLED`
regresen a `PROCESSING`. Retry API y UI siguen diferidos.

## Resultado

- Concurrencia PostgreSQL real: `5/5 PASS`.
- Billing unit/focused previo: `144/144 PASS`.
- FactuCore live mutations: `0`.
- DIAN calls: `0`.
- QA business mutations: `0`.
- Deadlocks/leaks observados: `0`.

La certificación cubre el lock y lease en PostgreSQL local. La recuperación
completa después de create/transmit requiere pruebas de integración del
workflow con provider mock persistente; no habilita todavía retry operativo.
