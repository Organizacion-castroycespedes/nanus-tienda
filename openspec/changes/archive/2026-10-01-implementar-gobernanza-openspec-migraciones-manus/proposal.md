## Why

Manus puede modificar y entregar código sin una relación técnica obligatoria con un OpenSpec. Además, las migraciones históricas mezclan ejecución registrada y ejecución manual, presentan drift entre repositorio y ambientes, y no tienen un mecanismo coordinado para asignar V### de forma segura.

Esta iniciativa define la arquitectura futura para hacer obligatorio OpenSpec y para gobernar migraciones nuevas sin reinterpretar ni reejecutar el SQL histórico.

## What Changes

- Crear una política transversal de OpenSpec obligatorio antes de modificar código, comportamiento, contratos, database, runtime executable configuration, integraciones o infraestructura ejecutable.
- Definir una asociación verificable entre diff y OpenSpec activo, sin depender solamente del nombre de la branch.
- Diseñar una orquestación propia de Manus que reutilice el workflow OpenSpec oficial sin modificar las skills `openspec-*` generadas por OpenSpec.
- Diseñar Database Migration Governance con `status`, `next` y `validate`.
- Definir unicidad numérica V###, filename, checksum SHA-256, applied migration immutability y reconciliación contra target branch y ambientes autorizados.
- Definir un camino oficial post-cutover para ejecutar SQL y registrar `public.migrations_history` con `success=true` y checksum de forma atómica cuando sea posible.
- Separar formalmente `EXECUTED_LEGACY` de `HISTORY_CERTIFIED`.
- Definir `PRE-GOVERNANCE EXECUTION BASELINE` para los SQL históricos reportados como ejecutados por el responsable del proyecto.
- Definir `GOVERNANCE_CUTOVER_APPROVED` como requisito antes de emitir una siguiente versión V###.
- Clasificar el drift histórico, incluidos V082/V083, V089, versiones repo-only/DB-only, checksum drift y registros manuales, como trabajo separado sin reejecución ni reparación artificial.
- Diseñar gates repository-only y environment-aware, promoción QA antes de PRD y autorización explícita de PRD.

## Capabilities

### New Capabilities

- `openspec-mandatory-governance`: Política y enforcement futuro para exigir OpenSpec antes de cambios técnicos y verificar la cobertura del diff.
- `database-migration-governance`: Gobernanza futura de migraciones, baseline legacy, cutover, reconciliación, numeración, atomicidad y promoción por ambientes.

### Modified Capabilities

Ninguna. Esta propuesta no modifica requisitos de capacidades existentes ni absorbe `mvp-web-hardening`.

## Impact

- Futuramente afectará `AGENTS.md`, workflows CI/PR, validaciones repository-only, `scripts/database/` y runners oficiales.
- Futuramente requerirá una política Manus-owned compatible con la integración actual `.codex/skills/`.
- Futuramente usará `public.migrations_history` en ambientes autorizados.
- No modifica ahora código, scripts, CI, AGENTS.md, skills generadas, migraciones, bases de datos, infraestructura ni `mvp-web-hardening`.
- El baseline histórico se acepta como evidencia operativa del responsable, no como certificación individual de `migrations_history`.
