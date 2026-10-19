## Context

El manifest actual contiene relaciones por archivo entre HUs. Algunas son históricas y válidas, pero el evaluador las interpreta como ownership exclusivo del cambio actual. Por eso `sale.repository.ts`, `sale.service.ts` y archivos POS compartidos producen `MULTIPLE_MATCH` aunque el diff actual pertenezca a la HU P1.

En Windows, `openspec.cmd` funciona desde PowerShell directo, pero el proceso Python no puede lanzar `cmd.exe`, `node.exe` ni el wrapper y recibe `WinError 5`. El diagnóstico debe conservar el bloqueo y no convertir evidencia externa o un resultado obsoleto en `PASS`.

## Goals / Non-Goals

**Goals:**

- Separar relaciones históricas de ownership vigente.
- Exigir exactamente un owner actual por archivo modificado cuando el manifest lo declare.
- Mantener `MULTIPLE_MATCH`, `INVALID` y `UNCOVERED` como bloqueos estrictos.
- Conservar fallback compatible para manifests antiguos sin ownership actual.
- Reportar `WinError 5` como causa técnica específica.
- Permitir inspección de evidencia externa solamente cuando esté ligada al `HEAD`, manifest, cambios actuales y versión declarada del runtime.

**Non-Goals:**

- No atribuir por hunk.
- No modificar HUs históricas ni borrar rutas existentes.
- No cambiar OpenSpec CLI, permisos Windows, ACL, Defender, API, web, BD o migraciones.
- No aceptar evidencia externa como PASS estricto si no se puede verificar equivalencia del runtime.

## Decisions

1. `changes[].paths` seguirá siendo el registro histórico compatible. El manifest versión 2 añadirá `current_ownership`, con `change_id`, `paths` y una razón auditable.
2. `evaluate_coverage` buscará primero owners actuales. Un único owner produce `CURRENT_SINGLE_MATCH` y conserva `historical_change_ids` en el reporte. Dos owners producen `AMBIGUOUS_CURRENT_OWNERSHIP`.
3. Si no hay owner actual, se conserva la semántica legacy: cero coincidencias bloquea y varias coincidencias producen `MULTIPLE_MATCH`.
4. El owner actual debe apuntar a una HU existente y estrictamente válida. No se permitirá que un owner inexistente o inválido oculte cobertura.
5. El adaptador Windows seguirá fail-closed. `validate_openspec` clasificará el acceso denegado del proceso hijo como `WINDOWS_CHILD_PROCESS_ACCESS_DENIED`. No usará `shell=True`, elevación ni cambios de ACL.
6. La evidencia externa será un diagnóstico ligado a identidad de árbol. La ausencia de ejecución equivalente en el mismo proceso mantiene `cli_available=false` y el gate estricto bloqueado.

## Risks / Trade-offs

- [Risk] Un owner actual puede atribuir un archivo compartido a la HU equivocada. → Mitigación: razón obligatoria, revisión humana y validación estricta de la HU owner.
- [Risk] Un manifest viejo no tiene ownership actual. → Mitigación: fallback legacy conservador; la ambigüedad antigua sigue bloqueando.
- [Risk] Evidencia externa puede quedar obsoleta. → Mitigación: comparar `HEAD`, hash del manifest, fingerprint del diff y versión declarada; nunca promoverla sola a PASS.
- [Risk] El entorno Windows siga bloqueado. → Mitigación: diagnóstico específico y decisión NO-GO, sin bypass.

## Migration Plan

1. Añadir soporte de manifest versión 2 sin eliminar lectura de versión 1.
2. Registrar ownership actual solo para los archivos del diff de esta HU y los archivos P1 compartidos.
3. Ejecutar tests determinísticos del evaluador.
4. Ejecutar OpenSpec directo y revisar el bloqueo Python por separado.
5. Revertir únicamente el bloque `current_ownership` y el código de esta HU si la revisión rechaza el modelo; las asociaciones históricas permanecen.

## Open Questions

- El runtime Windows autorizado debe definir cómo producir evidencia externa confiable antes de permitir que esa evidencia participe en un gate estricto de CI.
