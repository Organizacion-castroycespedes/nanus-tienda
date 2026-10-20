## Context

La auditoría final de `implementar-gobernanza-openspec-migraciones-manus` mostró dos capacidades diferentes. `next_safe_version_evaluation()` propone la menor identidad `V###` libre sobre fuentes autoritativas. No existe todavía una capacidad que responda qué migraciones concretas debe recibir un ambiente, en qué orden y con qué verificaciones, para alcanzar un target.

El change debe cubrir migraciones post-cutover y preservar el baseline pre-governance `V095`. `scripts/database/apply_single_migration.sh` sigue siendo el runner oficial de una sola migración y conserva atomicidad SQL + `migrations_history`. La planificación no debe ejecutar SQL, crear reservas ni cambiar bases de datos.

## Goals / Non-Goals

**Goals:**

- Definir un modelo verificable del estado de un ambiente y del estado autoritativo Repository/Target.
- Producir un plan ordenado de migraciones post-cutover desde el estado destino observado hasta un target solicitado.
- Fallar cerrado ante gaps, dependencias, drift, checksum mismatch, history fallida, ejecución manual no verificada, evidencia stale o target cambiado.
- Separar plan, autorización, ejecución y verificación.
- Diseñar una orquestación posterior sobre el runner oficial, con evidencia por paso y stop-on-first-failure.
- Definir controles de strict activation, revalidación, concurrencia y rollback de governance.

**Non-Goals:**

- No implementar código, runner, CI, migraciones ni cambios de base de datos en Fase A.
- No modificar V096, crear o reservar V097, promover migraciones ni activar strict/cutover.
- No reparar, renumerar, replayar ni certificar artificialmente el baseline `<=V095`.
- No absorber los OpenSpecs históricos `reconciliar-drift-historico-pre-gobernanza` ni `disponer-historial-fallido-y-bundles-manuales`.
- No cambiar el executor PRD ni su manejo de credenciales.

## Decisions

### 1. Planner puro separado de ejecución

El planner recibe estado Repository/Target, evidencia sanitizada del ambiente, metadata canónica de migraciones y política. Devuelve `VERIFIED_ORDERED_PLAN`, `ALREADY_AT_TARGET` o un estado bloqueado con razones deterministas. No abre conexiones, no invoca runners y no muta archivos o bases de datos.

`NEXT_SAFE_VERSION` permanece como propuesta de identidad. No se reutiliza como plan ni se extiende para representar promociones.

### 2. Modelo de estado y clasificación

El modelo conserva versiones, checksum, `success`, duplicados, DB-only, repository-only, evidencia faltante, identidad, target SHA, correlación y freshness. Clasifica el destino como `ALREADY_AT_TARGET`, `PROMOTION_LAG`, `BLOCKED_DRIFT`, `EVIDENCE_UNVERIFIED` o `UNSUPPORTED_DOWNGRADE`.

Las anomalías `<=V095` conservan `PREEXISTING_HISTORICAL_BASELINE` y no participan en reparación contigua post-cutover. Una versión post-cutover DB-only bloquea promoción aunque ocupe el namespace para `next_safe_version`.

### 3. Orden, gaps y dependencias

Para un target `V099` y destino `V095`, con `V096..V099` canónicas disponibles, el único plan válido es `[V096,V097,V098,V099]`. Un destino con `V096` y `V098` sin `V097` produce `BLOCKED_VERSION_GAP`. El orden numérico post-cutover es requisito mínimo; metadata de dependencia explícita solo se añade si la implementación demuestra que el orden numérico no basta.

No se permite confiar en el fallo eventual del SQL ni en disciplina manual para prevenir orden incorrecto.

### 4. Integración por migración

La futura orquestación consume únicamente un plan verificado. Ejecuta cada paso con `scripts/database/apply_single_migration.sh`, verificando cada resultado antes de continuar. Cada migración conserva su frontera atómica SQL + history. Si un paso falla, se detiene; pasos posteriores quedan `NOT_ATTEMPTED`. No se diseña rollback automático de pasos ya committed.

### 5. Freshness y concurrencia

El plan queda ligado a target SHA, estado de ambiente, correlation/freshness y evidencia de la operación. Antes del primer paso, el orquestador revalida esas fuentes. Un cambio invalida el plan como `PLAN_STALE` y exige recomputación.

No se crea reserva en Fase A. Se documentan dos alternativas: reserva/lock coordinado en una fase posterior, o optimistic concurrency con revalidación inmediata. Mientras no exista serialización, una propuesta no es identidad reservada.

### 6. Autorización y strict

Un plan verificado no autoriza ejecución. Se mantiene `LOCAL -> QA -> PRD`; QA requiere aprobación/evidencia según la política actual y PRD requiere aprobación QA más autorización explícita. Strict deberá bloquear el camino gobernado si falta plan, hay runner inseguro, gap, drift, checksum inválido, evidencia stale, QA no verificada o autorización PRD.

La activación cambia gates de diagnóstico a bloqueo en repository/CI/promotion-path. No intenta impedir físicamente que un administrador ejecute cualquier script fuera del camino gobernado; sí impide aceptar esa ejecución como promoción válida.

La enforcement de repositorio se ejecuta en un workflow CI dedicado, sin credenciales
de ambientes. El workflow valida los changes OpenSpec relevantes, ejecuta el gate
`repository_strict_gate()` mediante `openspec_governance_diagnostic.py --enforcement-mode STRICT`
y corre las suites deterministas de governance. La protección de ramas y la exigencia
remota del status check son configuración administrativa externa; no se asumen como
demostradas por el archivo YAML. Los gates QA/PRD siguen fuera de CI y requieren
evidencia autorizada durante la promoción.

### 6.1 D.1B: serialización transaccional del runner

La revalidación de target SHA y evidencia de ambiente sigue ocurriendo fuera de PostgreSQL.
No sustituye la serialización de escritores. El runner oficial `scripts/database/apply_single_migration.sh`
adquiere un `pg_try_advisory_xact_lock` fail-fast sobre el namespace estable
`manus-governed-migration-v1` + base de datos + schema. El lock no usa credenciales,
no crea reservas persistentes y vive en la misma conexión y transacción que las aserciones,
el SQL de migración y el `migrations_history INSERT`.

Dentro de esa transacción se repiten las decisiones autoritativas: identidad de base/schema,
ausencia del target, ausencia de duplicados/`success=false`, estado esperado del predecessor,
checksum canónico y ausencia de versiones post-cutover conflictivas. El primer paso gobernado
usa `PRE_GOVERNANCE_BOUNDARY=V095` sin inventar checksum histórico; los siguientes requieren
predecessor gobernado `success=true` y checksum exacto. Fallos producen estados sanitizados como
`PROMOTION_LOCK_UNAVAILABLE`, `EXPECTED_PREDECESSOR_MISMATCH` o `TARGET_ALREADY_APPLIED` y
abortan antes del SQL de migración.

La estrategia es lock por migración, no por plan completo. Los commits previos de un plan parcial
se conservan; la recuperación exige evidencia fresca y un plan nuevo. El lock solo coordina rutas
gobernadas cooperantes. Un DBA con acceso directo o un runner legado puede ignorarlo, por lo que
strict también debe rechazar esas rutas y la operación debe limitar permisos fuera del repositorio.
La validación real usa el harness local desechable `scripts/governance/test_postgres_concurrency.py`:
cluster privado, autenticación trust local, historia y SQL sintéticos, sin QA/PRD ni datos de negocio.

### 6.2 Remediación de identidad entre plan y runner

El descriptor que cruza el límite de orquestación al runner queda ligado por un
binding determinista a versión, ruta relativa canónica, checksum exacto,
predecessor, checksum del predecessor y runner oficial. El orquestador construye
el item normalizado antes de invocar el callback; el runner exige el binding y
rechaza campos faltantes o cambiados.

El runner resuelve la raíz canónica con realpath, rechaza symlinks, traversal,
targets no regulares y cualquier resolved path fuera de
`scripts/database/migrations`. Después crea un snapshot regular privado de los
bytes validados. Recalcula el SHA-256 del snapshot, lo compara con el checksum
esperado y usa ese mismo snapshot para la transacción PostgreSQL. Así el `-f`
autoritativo no reabre el pathname mutable del repositorio. El checksum guardado
en `migrations_history` es el checksum del snapshot ejecutado.

Esto protege contra mutaciones concurrentes normales y sustitución independiente
de campos dentro del camino gobernado. No intenta proteger contra un administrador
con control total del host/proceso que pueda cambiar simultáneamente el descriptor
completo, el snapshot y el ejecutor. El target SHA sigue siendo una señal de
política fuera de PostgreSQL: si cambia, el plan debe invalidarse y recomputarse,
aunque los bytes canónicos no hayan cambiado.

### 6.3 Certificación local del camino de escritura QA

La certificación de escritura es una operación distinta a una migración:
`QA_WRITE_PATH_CERTIFICATION`. Tiene un executor dedicado y una única fixture
SQL allowlisted por repositorio. No recibe SQL, ruta de fixture, versión ni
operación desde CLI, ambiente, stdin o JSON del llamador.

La fixture crea únicamente `public.governance_certification_probe_v1` dentro de
una transacción PostgreSQL y luego ejecuta `ROLLBACK` obligatorio. No contiene
`migrations_history`, no usa nombres `V###` y no puede producir evidencia de
`HISTORY_CERTIFIED`. El descriptor liga operación, fixture, checksum de snapshot,
base/esquema QA, fingerprint previo de `migrations_history`, executor y
correlación. Un descriptor de migración normal no es válido para certificación,
y uno de certificación no es válido para `apply_single_migration.sh`.

El executor exige identidad QA. La interfaz local de pruebas solo permite una
base loopback con prefijo disposable `manus_governance_qa_`; una identidad PROD,
un host remoto o `manus_tienda_qa` fuera de la interfaz autorizada son rechazados.
La fixture se copia a un snapshot privado, se hashea y ese mismo archivo se
entrega a `psql`. Lock advisory transaccional, identidad DB/schema, fingerprint
histórico y ausencia previa del objeto se comprueban antes de la escritura
sintética, en la misma transacción. Una conexión posterior comprueba ausencia
del objeto, fingerprint idéntico y adquisición del lock liberado.

Esto prueba la frontera técnica local. No es promoción QA ni autorización de
PRD. La certificación QA real requiere una operación posterior, explícita y
autorizada, usando identidad QA real y sin cambiar la semántica del runner
canónico.

### 7. Rollback de governance

Rollback significa desactivar o revertir la configuración/gate de enforcement y conservar evidencia. No significa borrar migrations, modificar `migrations_history`, deshacer schema, replayar SQL ni revertir commits de base de datos. Un plan parcialmente ejecutado se reanuda solo después de nueva evidencia y recomputación; los pasos posteriores al primer fallo permanecen `NOT_ATTEMPTED`.

### 8. Alternativas rechazadas

- Usar `next_safe_version` como plan: no representa estado destino ni orden.
- Ordenar por filename sin validar historia/checksum: permite saltos y drift.
- Ejecutar una secuencia arbitraria en un único shell/SQL: rompe límites del runner y evidencia por paso.
- Reparar gaps históricos: contradice el boundary `V095` y el replay prohibition.
- Reservar una versión en Fase A: requiere coordinación externa no definida y ampliaría alcance.

## Risks / Trade-offs

- [Race entre ramas sin reserva] → revalidación inmediata, duplicate detection y plan stale; evaluar lock en fase posterior.
- [Dependencia semántica no expresable por número] → bloquear hasta metadata explícita; no confiar en fallo SQL.
- [Legacy runner invocado fuera del camino] → clasificarlo y exigir strict rejection en promotion-path; no eliminarlo automáticamente.
- [Ambiente detrás con history incompleta] → separar `PROMOTION_LAG` de `BLOCKED_DRIFT` y exigir evidencia suficiente antes de planificar.
- [Fallo después de pasos committed] → detener y conservar evidencia por paso; no rollback automático de schema.
- [Divergencia entre QA y PRD] → revalidar por ambiente y no usar evidencia de un ambiente como autorización para otro.

## Migration Plan

1. Implementar el modelo y planner puro sin I/O.
2. Añadir contratos de estado, orden, gaps, checksum, history y autorización.
3. Integrar un orquestador que solo invoque el runner oficial por migración.
4. Añadir revalidación, stop-on-first-failure, evidencia por paso y controles strict.
5. Validar localmente y luego ejecutar una revisión autorizada de QA; cualquier PRD requiere autorización separada.
6. Activar strict solo mediante decisión explícita y después de demostrar enforcement del promotion-path.

Rollback de implementación: desactivar el nuevo gate/configuración y volver a modo diagnóstico, sin mutar datos ni history. La recuperación de una ejecución parcial requiere nueva evaluación, no replay automático.

## Open Questions

- ¿Se requiere reserva/lock distribuido antes de permitir materialización concurrente, o basta optimistic concurrency con revalidación inmediata?
- ¿Qué metadata de dependencia post-cutover está disponible y quién la mantiene?
- ¿Qué componente CI/promotion-path será el punto obligatorio de enforcement strict?
- ¿Qué formato persistido, si alguno, conservará evidencia por paso sin almacenar secretos ni raw production output?
