## Why

La evidencia histórica incluye registros `success=false`, bundles y posibles
aplicaciones manuales. Deben tener una disposición explícita sin convertirlos
en certificación automática.

## What Changes

- Clasificar registros fallidos y procedencias manuales/bundle.
- Mantener `EXECUTED_LEGACY` separado de `HISTORY_CERTIFIED`.
- Documentar decisiones de revisión y evidencia faltante.
- Mantener fail-closed y prohibir reparación automática.

## Non-Goals

- No insertar, actualizar ni borrar `migrations_history`.
- No replay de SQL histórico.
- No convertir checksum manual/bundle en checksum certificado.
- No cambiar la semántica de migraciones post-V095.
