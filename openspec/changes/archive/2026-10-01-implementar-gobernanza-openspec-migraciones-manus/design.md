## Context

La auditoría confirmó OpenSpec 1.4.0, skills generadas en `.codex/skills/`, 36 changes activos y ausencia de un gate técnico que relacione un diff con un change. También confirmó migraciones modernas en `scripts/database/migrations/`, duplicados V082/V083, drift repository/QA, runners alternativos y separación SQL/history en varios runners.

El responsable del proyecto aportó el `PRE-GOVERNANCE EXECUTION BASELINE`: todos los `.sql` existentes hasta el corte fueron ejecutados en sus ambientes correspondientes, algunos por runner y otros manualmente. Esta afirmación es evidencia operativa, no certificación individual de `public.migrations_history`.

`mvp-web-hardening` contiene contexto histórico de Local, QA, PRD y migraciones. Debe permanecer intacto y no se absorbe ni se modifica con esta iniciativa.

## Goals / Non-Goals

**Goals:**

- Definir OpenSpec obligatorio antes de cambios técnicos.
- Definir asociación verificable diff/change.
- Diseñar una orquestación Manus-owned compatible con OpenSpec oficial.
- Separar `EXECUTED_LEGACY` de `HISTORY_CERTIFIED`.
- Definir cutover formal hacia `STRICT GOVERNANCE`.
- Diseñar `status`, `next` y `validate` para migraciones.
- Gobernar V###, filename, checksum, target branch, ambientes autorizados y concurrencia.
- Diseñar atomicidad SQL + history y promoción Local → QA → PRD.
- Separar gates repository-only de gates environment-aware.
- Dejar `NEXT_SAFE_VERSION=UNVERIFIED` hasta certificar cutover y reconciliación.

**Non-Goals:**

- No corregir V082/V083, V089, V070/V086 ni ningún drift histórico.
- No modificar ni renombrar SQL existentes.
- No reejecutar SQL histórico.
- No insertar registros artificiales en `migrations_history`; la única excepción es la adopción explícita y trazable `MANUAL_APPLICATION_BASELINE_ADOPTION` definida abajo.
- No crear V096 ni ninguna otra migración.
- No modificar `AGENTS.md`, skills, CI, aplicación o infraestructura en este change. El runner oficial puede recibir únicamente las correcciones mínimas de frontera transaccional y contrato de configuración necesarias para este change.
- No consultar ni modificar bases de datos.
- No convertir `EXECUTED_LEGACY` en `HISTORY_CERTIFIED` retroactivamente.

## Decisions

### 1. OpenSpec is a pre-code control

Un cambio técnico debe tener un OpenSpec activo, apply-ready y strict-valid antes de modificar código. La clasificación se realiza antes de editar. La asociación no dependerá solamente del nombre de branch.

Alternativas consideradas:

- Solo instrucción en `AGENTS.md`: rechazada porque no bloquea commits ni PRs.
- Solo convención de branch: rechazada porque es ambigua y evadible.
- Gate repository-only con asociación explícita: seleccionada como control inicial.

### 2. Association is explicit and schema-compatible

La implementación futura debe inspeccionar el mecanismo soportado por OpenSpec 1.4.0 antes de elegir metadata, manifest o extensión Manus-owned. No se inventarán campos en `.openspec.yaml`. Si OpenSpec no ofrece asociación nativa suficiente, una extensión propia debe vivir fuera del schema generado y validarse sin modificar artifacts generados.

### 3. Manus orchestration does not replace generated skills

La capa Manus-owned clasificará cambios, buscará un active change que cubra exactamente el scope, exigirá artifacts apply-ready y delegará la creación/validación al CLI. Las skills `openspec-*` generadas por OpenSpec no se modificarán.

### 4. Legacy baseline is immutable evidence

El baseline tendrá estados separados:

- `EXECUTED_LEGACY`: declarado por el responsable o respaldado por evidencia histórica, sin equivaler a history certificado.
- `HISTORY_CERTIFIED`: fila de `public.migrations_history` con versión, `success=true` y checksum válido según la política post-cutover.

La ausencia de history no prueba que el SQL no fue ejecutado. La presencia de history no resuelve por sí sola filename, checksum o intención histórica.

### 4.1. Manual application baseline adoption

Cuando el owner confirma que una migración fue aplicada manualmente antes del cutover,
el estado físico puede adoptarse únicamente mediante `MANUAL_APPLICATION_BASELINE_ADOPTION`.
La adopción exige reconciliar la estructura y los datos deterministas contra el artefacto
canónico antes de registrar una fila de history. La reconciliación y el registro deben
ocurrir en una única transacción; un fallo revierte ambos.

La adopción no reejecuta DDL, no afirma ejecución histórica por el governed runner y no
convierte el checksum del artefacto canónico en prueba de ejecución byte-for-byte. El
checksum identifica el artefacto adoptado. `details` debe conservar la procedencia manual,
la reconciliación realizada y la separación respecto de ejecución histórica. Un estado
inesperado, divergencia funcional o falta de privilegios bloquea la operación.

### 4.2. Owner-authorized V096 canonical baseline provenance

`V096__electronic_billing_failure_detail.sql` has one owner-authorized provenance
decision made before strict activation. During development and testing, V096 was
already executed in QA and recorded in `migrations_history`. The original committed
transaction-wrapped bytes had exact SHA-256
`77d3a91a98d4904d71716e0c54fcd7978fdf6901601e443427912ea671d300a4`.

The later normalization removed only `BEGIN` and `COMMIT`, with no functional DDL
change, so the governed runner remains the sole transaction owner. The canonical
adopted baseline identity is the current normalized exact-byte SHA-256
`a4cb2d5dd300e98f671deeb4f25a323c3dd0a783209149fb50f5fced195b75c7`.
`MANUAL_APPLICATION_BASELINE_ADOPTION` reconciled the already-applied QA identity;
it did not replay V096 SQL. Later QA evidence recorded `success=true` with the
normalized checksum and confirmed V096 remained unchanged.

This is a one-time pre-strict baseline decision. It does not authorize general edits
to applied migrations, replay, renumbering, replacement, fabricated history or more
V096 DDL changes. Future governed migrations remain exact-byte immutable. The QA
evidence is historical/operator evidence, not fresh QA access by this documentation
update.

### 5. Cutover is a hard boundary

`GOVERNANCE_CUTOVER_APPROVED` requiere evidencia aprobada de política, runner oficial, gates repository-only, reconciliación autorizada y decisión explícita para cada fuente obligatoria. Antes del cutover, `next` devuelve `NEXT_SAFE_VERSION=UNVERIFIED`.

No se usará `MAX(local filenames)+1` como autoridad.

### 5.1. Deterministic next-version proposal

The owner-approved selection rule is
`FIRST_FREE_VERSION_ABOVE_CUTOVER_FROM_AUTHORITATIVE_UNION`. A future `next`
calculation starts strictly above `CUTOVER_BOUNDARY_VERSION` and selects the
smallest free `V###` numeric identity from the union of Repository, the current
integration target and every policy-required authorized environment. A numeric
identity present in any required source is occupied, including `DB_ONLY`
identities. Repository-only `MAX+1` is never an authority.

The union is certifying only when Repository, target and all required environment
sources are verified for the same controlled calculation. Live environment
evidence must be collected in that operation; no TTL is invented because the
OpenSpec does not define one. Earlier evidence remains diagnostic only.

The result is a proposal, not a reservation. No lock, registry row, branch
reservation file or migration placeholder is created. Target revalidation is
mandatory at the integration checkpoint and before execution where the existing
runner architecture provides that checkpoint. If the union changes or a collision
appears, the proposal is invalid and must be recalculated. This is optimistic
concurrency control and does not eliminate every distributed race.

The proposal does not imply QA approval, PRD authorization, promotion permission,
migration execution or `NEXT_SAFE_VERSION` activation. Historical identities at or
below V095 remain `PREEXISTING_HISTORICAL_BASELINE` and do not trigger replay,
repair, renumbering or retroactive certification.

### 5.2. PRD evidence executor trust boundary

The current Python governance process cannot be assumed to open the dedicated PRD
private key from its restricted child-process context. Therefore PRD evidence
collection SHALL be separated from the `GOVERNANCE_EVALUATOR` by an explicit
`PRD_EVIDENCE_EXECUTOR` boundary:

- `GOVERNANCE_EVALUATOR` consumes only the existing sanitized evidence contract
  and never reads, receives or stores private-key contents, passwords, DSNs or
  other credential material.
- `PRD_EVIDENCE_EXECUTOR` owns the credential-bearing SSH operation and may run
  only the pre-approved PRD read-only evidence operation from an authorized OS
  execution context. It is not a generic remote-command or deployment runner.
- The executor request SHALL contain only an allowlisted operation type,
  environment, expected host/database/schema identities, a correlation or
  operation identifier, and other non-secret control metadata. Callers SHALL
  NOT provide arbitrary shell commands, arbitrary SQL, private-key contents,
  passwords or complete connection strings.
- The executor SHALL keep the key path and remote runtime secrets within its
  authorized execution boundary, verify host/user and database/schema identity,
  establish and verify read-only PostgreSQL state, query only the approved
  metadata/history contract, and return sanitized structured evidence.
- The response SHALL identify executor status, operation/correlation identity,
  environment, transport and host verification, database/schema identity,
  read-only verification, history availability/schema, allowed version/checksum/
  success evidence, query/write counts, operation evidence context and sanitized
  failure reasons. It SHALL never contain credentials, key material, raw DSNs,
  or unredacted runtime output.
- Unavailable executor, transport/authentication failure, host or database
  mismatch, read-only failure, unexpected history schema, malformed or
  redaction-failed response, incomplete evidence, or operation-identity mismatch
  SHALL fail closed as `UNVERIFIED` or `BLOCKED`. No result may imply QA
  approval, PRD promotion authorization, migration execution, cutover activation,
  reservation or a safe next version.

For Task 10.5, the response correlation/operation identity proves that PRD live
evidence belongs to the same controlled calculation/revalidation operation. No
freshness TTL is introduced. Evidence from another operation remains diagnostic
only and is `UNVERIFIED` for current candidate certification.

Future implementation alternatives remain open: a controlled local external
process/service, an operator-mediated evidence runner, or an OS-scheduled/service
boundary. Selection requires a separate security and portability review. A
manual shell success is evidence of a working execution context, not by itself a
selected production architecture. No option is selected in this design slice.

#### 5.2.1. 10.5a-10.5c contract implementation

The repository implementation establishes the contract boundary without
selecting or invoking a credential-bearing OS transport. The boundary lives in
`scripts/governance/prd_evidence_executor.py` and uses contract version
`prd-evidence-v1` with the single operation
`collect_prd_migration_evidence`.

`validate_prd_evidence_request` accepts only the operation, correlation
identifier, expected host/database/schema and contract version. Command, shell,
script, query, SQL, credential, private-key and unknown fields are rejected.
`execute_prd_evidence_request` invokes only an injected executor boundary and
validates a sanitized response. Missing or failing executors, malformed or
mismatched responses, non-live provenance, identity mismatch, unverified
read-only state and nonzero writes fail closed.

`prd_read_only_reconcile` is integrated as a consumer of this request/response
boundary. It no longer owns credential-bearing SSH construction and has no
fallback to the old direct path. The actual authorized OS executor and live
PRD validation remain the work of 10.5d; no live evidence is created by this
contract-only slice. Deterministic contract and security tests cover 10.5c.

The process boundary is now explicit in the same module: `--process` reads one
UTF-8 JSON request from stdin and writes one UTF-8 JSON response to stdout.
The launcher uses a fixed entrypoint, `shell=False`, byte-oriented UTF-8 input,
separate stderr capture and timeout/failure handling. Request data cannot select
the executable or argv. The current process backend is intentionally
`EXECUTOR_BACKEND_UNAVAILABLE`; a test-only fixture is marked
`EXECUTOR_TEST_FIXTURE` and is rejected by live provenance validation. This
proves framing and fail-closed behavior without pretending to implement PRD
transport. The future Windows executor must supply the credential-bearing
backend from its authorized OS context; its key reference is runtime-only and
never part of the request or response.

The specialized backend plan is now local and deterministic. Trusted runtime
configuration supplies the SSH executable, target, port, user, opaque key path,
remote `.env` path and expected PRD identities. The request can only match
those identities; it cannot override them. The backend builds fixed SSH argv
with `IdentitiesOnly=yes`, `BatchMode=yes`, `bash -s` and normal host-key
verification, then sends a fixed read-only SQL heredoc. The remote script loads
only the named runtime source, sets a read-only transaction, selects the
approved migration-history evidence and emits one marked UTF-8 JSON payload.
The key path is never opened by the evaluator, and no runtime secret enters
argv, SQL, stdout or response.

The real transport is opt-in through trusted runtime configuration and remains
unexecuted in this slice. Missing configuration, transport errors, nonzero
exit, stderr diagnostics, marker errors, identity mismatch or schema/read-only
failure return `UNVERIFIED`. Only the successful backend parser assigns
`EXECUTOR_LIVE_READ_ONLY_EVIDENCE`; test fixtures cannot assign that provenance.

The sanitized response retains the allowlisted `history_rows` fields
(`version`, `checksum`, `success`, and optional filename/path metadata). The
evaluator derives row count, failed-row count, occupied numeric identities,
duplicates, highest version, V095/V096 presence and post-V095 versions from
those rows. A response marked `VERIFIED` without valid migration rows is
incomplete and fails closed. Status/correlation-only capture is not Task 10.5d
evidence.

### 6. One official path for post-cutover migrations

Una migración post-cutover debe usar `scripts/database/apply_single_migration.sh`. El runner oficial es el único propietario de la frontera transaccional: ejecuta el SQL y registra `success=true` con el checksum exact-byte SHA-256 en `public.migrations_history` dentro de la misma transacción PostgreSQL. Una migración post-cutover que contenga `BEGIN`, `START TRANSACTION`, `COMMIT`, `END`, `ROLLBACK`, `ABORT`, `SAVEPOINT` o `RELEASE` debe rechazarse antes de abrir el cliente DB; no se transforma silenciosamente.

El contrato de configuración acepta `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. `DB_ADMIN_USER` y `DB_ADMIN_PASSWORD` son aliases opcionales con precedencia explícita cuando existen, pero resolver nombres no certifica privilegios. Fallo de SQL o de history debe fallar cerrado y no declarar aplicación exitosa. El runner no imprime secretos ni connection strings.

### 7. Repository and environment gates are separate

CI valida determinísticamente filename, unicidad, target branch, OpenSpec, checksum estático y clasificación. Los checks de `migrations_history`, drift de ambientes, QA y PRD requieren acceso autorizado y deben devolver `UNVERIFIED` cuando no exista evidencia.

### 8. Concurrency is solved at integration time

La consulta de QA/PRD antes de crear una migración no resuelve dos branches que reservan el mismo V###. El gate PR debe comparar la unión target branch + feature justo antes del merge. Reservation/serialization queda como opción posterior, no como requisito inicial.

### 9. Historical drift is a separate change

La reconciliación de V082/V083, V089, repo-only/DB-only, checksums, `success=false`, bundles y registros manuales tendrá OpenSpec separado. No habrá reejecución automática, renumeración, sobrescritura ni inserción retroactiva en este change.

## Risks / Trade-offs

- [Historical drift] → Mantener baseline explícito y crear OpenSpec separado de reconciliación.
- [False confidence from history] → Exigir checksum, filename, source y evidencia; no inferir ejecución por ausencia.
- [Branch race] → Comparar contra target branch actualizado en PR.
- [Unavailable environment] → Bloquear `next` y marcar `UNVERIFIED`; no permitir bypass silencioso.
- [Atomicity gap] → Normalizar runner oficial antes de activar strict cutover.
- [Pre-existing OpenSpec failure] → Registrar baseline global y bloquear solo regresiones nuevas.
- [Governance rollout disruption] → Activar primero diagnóstico, luego warnings, luego enforcement.

## Migration Plan

1. Aprobar esta arquitectura sin tocar producción.
2. Implementar policy y clasificación OpenSpec en un change separado o fase explícita.
3. Implementar checker repository-only en modo diagnóstico.
4. Implementar `status` y `validate` sin habilitar `next`.
5. Resolver atomicidad y clasificar runners alternativos.
6. Reconciliar Local/QA/PRD mediante cambios autorizados separados.
7. Certificar `GOVERNANCE_CUTOVER_APPROVED`.
8. Habilitar `next` y enforcement estricto.
9. Ejecutar historical drift remediation únicamente con OpenSpec separado.

Rollback de adopción: desactivar el gate nuevo por configuración de CI manteniendo el reporte diagnóstico. No revertir ni modificar SQL histórico ni `migrations_history` automáticamente.

## Open Questions

- ¿Qué mecanismo de asociación diff/change soporta exactamente OpenSpec 1.4.0?
- ¿Cuál será la ubicación canónica de las skills Manus-owned: `.codex/skills/` u otra ruta documentada por la instalación?
- ¿Qué autoridad aprueba el baseline QA y el acceso read-only PRD?
- ¿Cómo se resolverán los checksums históricos no SHA-256 o bundles?
- ¿Será necesaria reservation/serialization de V### después de medir la concurrencia real?
