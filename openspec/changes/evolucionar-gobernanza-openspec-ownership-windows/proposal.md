## Why

La gobernanza actual usa asociaciones por archivo como si fueran ownership vigente. Esto marca como `MULTIPLE_MATCH` archivos que tienen relaciones históricas legítimas y una sola HU que explica el diff actual. Además, el diagnóstico no distingue un bloqueo real del runtime OpenSpec en procesos hijos Windows de un resultado de validación.

Se necesita una evolución pequeña y fail-closed para conservar historia, exigir ownership actual explícito cuando exista ambigüedad y evitar falsos `PASS` por evidencia vieja o por un adaptador Windows bloqueado.

## What Changes

- Mantener `changes[].paths` como asociaciones históricas compatibles.
- Añadir un bloque de ownership actual, con una sola HU por ruta técnica modificada.
- Validar ownership actual antes del fallback legacy.
- Rechazar ownership duplicado, inexistente, inválido o que no corresponda al diff.
- Reportar el bloqueo Windows como estado técnico explícito sin convertirlo en `PASS`.
- Permitir evidencia externa solo si está ligada al `HEAD`, manifest, versión efectiva y conjunto de cambios actuales.
- Añadir pruebas determinísticas y documentación de la semántica.

## Capabilities

### New Capabilities

- `governance-current-ownership`: ownership actual determinístico separado de asociaciones históricas.
- `governance-windows-evidence`: diagnóstico fail-closed y evidencia reproducible del runtime OpenSpec en Windows.

### Modified Capabilities

Ninguna. Las HUs existentes conservan sus contratos y sus relaciones históricas.

## Impact

- `scripts/governance/openspec_governance_diagnostic.py`
- `scripts/governance/openspec-scope.json`
- `scripts/governance/test_openspec_governance_diagnostic.py`
- `scripts/governance/README.md`
- Artefactos de esta HU OpenSpec.

No cambia API, web, inventario, FEFO, facturación, V108, base de datos ni secretos.
