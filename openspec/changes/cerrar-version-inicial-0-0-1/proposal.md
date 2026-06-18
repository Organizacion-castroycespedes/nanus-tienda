## Why

Manus POS necesita un corte formal para sellar la version `0.0.1` sin mezclar funcionalidades nuevas ni cambios activos. Este change deja evidencia documental del estado real del sistema, sus riesgos, QA, permisos y roadmap posterior.

## What Changes

- Crear documentacion de release bajo `docs/release/` para inventario, QA, permisos, riesgos, backlog y criterios de cierre.
- Registrar discovery reproducible: rama, HEAD, OpenSpec, arboles principales, modulos backend/frontend y scripts relevantes.
- Clasificar modulos con estados `COMPLETO`, `FUNCIONAL_CON_OBSERVACIONES`, `PARCIAL`, `PENDIENTE` y `BLOQUEADO_EXTERNO`.
- Separar bloqueantes tecnicos de bloqueantes por compra o aprobacion externa.
- Definir que queda fuera de `v0.0.1` para evitar scope creep.
- No modificar logica de negocio, permisos, contratos API, SQL, produccion ni changes activos.

## Capabilities

### New Capabilities
- `release-readiness-v0-0-1`: Cubre el contrato documental para validar y cerrar la version inicial `0.0.1` sin cambios funcionales.

### Modified Capabilities
- None.

## Impact

- Documentacion: nuevos archivos bajo `docs/release/`.
- OpenSpec: nuevos artefactos bajo `openspec/changes/cerrar-version-inicial-0-0-1/`.
- Sin impacto en runtime, base de datos, permisos, endpoints, frontend productivo, backend productivo ni contratos API.
