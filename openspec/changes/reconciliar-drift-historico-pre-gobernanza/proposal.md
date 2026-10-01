## Why

La línea base pre-gobernanza contiene drift histórico en V082/V083, V089,
versiones repository-only/DB-only y checksums no comparables. Este change
define una futura reconciliación explícita sin reejecutar ni mutar SQL histórico.

## What Changes

- Clasificar evidencia histórica por fuente: Repository, Target, QA y PRD.
- Tratar duplicados numéricos, repo-only, DB-only y checksum drift como evidencia
  `PREEXISTING_HISTORICAL_BASELINE`.
- Emitir una decisión por hallazgo sin insertar filas sintéticas ni modificar SQL.
- Bloquear replay, renumbering, overwrite, delete y reparación automática.

## Non-Goals

- No ejecutar migraciones.
- No modificar `migrations_history`.
- No certificar individualmente ejecuciones históricas.
- No resolver V096, V097 ni el cutover post-V095.
