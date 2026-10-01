## Why

La auditoría pre-12.4 confirmó que `NEXT_SAFE_VERSION` calcula una identidad numérica libre, pero no existe un plan verificable para mover un ambiente desde su estado actual hasta un target mediante migraciones ordenadas. Esta brecha puede permitir saltos de versión, promoción fuera de orden, replay manual o clasificación incorrecta de lag como drift.

## What Changes

- Añadir un contrato puro para evaluar el estado de un ambiente destino y clasificarlo como `ALREADY_AT_TARGET`, `BEHIND_VALIDLY`/`PROMOTION_LAG`, `BLOCKED_DRIFT` u otro estado fail-closed existente.
- Definir el conjunto pendiente exacto y ordenado de migraciones post-cutover, con checksum, elegibilidad y evidencia por paso.
- Bloquear gaps de versión, dependencias incumplidas, `DB_ONLY`, checksum mismatch, `success=false`, ejecución manual no verificada y evidencia stale o no verificable.
- Separar explícitamente la planificación de la ejecución: el plan no muta bases de datos ni autoriza promoción.
- Diseñar orquestación posterior sobre `scripts/database/apply_single_migration.sh`, con verificación por migración, stop-on-first-failure y pasos posteriores `NOT_ATTEMPTED`.
- Definir revalidación inmediata de target/evidencia, autorización `LOCAL -> QA -> PRD`, enforcement strict y rollback de governance sin mutar estado de base de datos.
- Mantener intactos V096, V097 como candidato, el baseline histórico <=V095 y los OpenSpecs históricos separados.

## Capabilities

### New Capabilities

- `environment-migration-promotion-plan`: Planificación determinista, fail-closed y separada de ejecución para promocionar migraciones versionadas entre ambientes.

### Modified Capabilities

- Ninguna. La capability de migración existente no se modifica en esta Fase A; la nueva capability define el contrato faltante.

## Impact

- Fase A: solo nuevos artifacts OpenSpec bajo este change.
- Fases posteriores: `scripts/governance/migration_runner_policy.py`, `scripts/governance/openspec_governance_diagnostic.py`, el runner oficial, tests y controles CI/promotion-path podrán integrar este contrato.
- No hay cambios de base de datos, migraciones, backend de producto, frontend, executor PRD ni infraestructura en esta fase.
