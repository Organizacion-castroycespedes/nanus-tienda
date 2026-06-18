## Context

Este change es un corte documental para `Manus POS / Tienda Castro & Cespedes` version `0.0.1`. No implementa funcionalidad nueva. No toca produccion. No ejecuta SQL. No modifica permisos ni contratos API.

Discovery inicial ejecutado:

- `git status --short`: worktree limpio al inicio.
- `git rev-parse --abbrev-ref HEAD`: `release/evolutivo/0.0.1`.
- `git rev-parse --short HEAD`: `9c6199b`.
- `openspec.cmd validate --all --strict`: `24 passed, 0 failed`.
- `openspec.cmd list`: cambios activos detectados y no mezclados.
- Revision de `docs/`, `openspec/`, `api/src/modules`, `web/modules`, `web/app`, `web/domains` y `package.json` disponibles.

Nota: `openspec validate --all --strict` directo en PowerShell fallo por `ExecutionPolicy` al intentar cargar `openspec.ps1`. Se uso `openspec.cmd`, equivalente CLI valido en Windows.

## Scope

Dentro del alcance:

- Documentar modulos desarrollados, avanzados, parciales, pendientes y bloqueados.
- Documentar submodulos, rutas, servicios y dependencias detectadas.
- Documentar QA historico y validaciones requeridas para este corte.
- Documentar matriz de permisos por rol desde seeds, route guards y evidencias existentes.
- Documentar riesgos, bloqueantes externos y backlog post-v0.0.1.
- Crear el change OpenSpec `cerrar-version-inicial-0-0-1`.

Fuera del alcance:

- Cambios en `api/`, `web/`, `backend-reporteria/`, `backend-perifericos/` o `backend-facturacion-electronica/`.
- SQL nuevo, migraciones, seeds o ejecucion de SQL.
- Cambios en permisos, roles, guards o menu.
- Cambios en contratos API o DTOs.
- Deploy, PRD, hardware real, DIAN real, Electron, Capacitor o CRM nuevo.

## State Model

La documentacion usa estos estados:

- `COMPLETO`: listo sin observaciones relevantes para el alcance actual.
- `FUNCIONAL_CON_OBSERVACIONES`: funcional y validado, con riesgos o pendientes no bloqueantes.
- `PARCIAL`: existe implementacion o UX, pero falta cobertura, cierre o estabilizacion.
- `PENDIENTE`: no implementado o solo conceptual.
- `BLOQUEADO_EXTERNO`: depende de compra, certificado, hardware, ambiente externo o aprobacion fuera del repo.

## Sources

Fuentes principales:

- Codigo local en `api/src/modules`, `web/app`, `web/modules`, `web/domains`.
- Servicios complementarios `backend-reporteria`, `backend-perifericos`, `backend-facturacion-electronica`.
- Docs existentes: `docs/modules.md`, `docs/evidencia-qa-operativo-integral-end-to-end-mvp-01-3x.md`, `docs/evidencia-qa-permisos-operativos-clientes-pedidos-pos-inventario.md`, `docs/evidencia-qa-configuracion-terminal-perifericos-fase-12.md`, `docs/release-readiness-pricing-promociones-pos-orders-fase-6-10.md`, `docs/release-readiness-dian-terceros-clientes-proveedores-fe-3-8.md`.
- OpenSpec specs y changes activos.
- `package.json` de `api`, `web`, `backend-reporteria`, `backend-perifericos` y `backend-facturacion-electronica`.

## Output Design

Se crean estos documentos:

- `docs/release/estado-sistema-v0-0-1.md`: resumen ejecutivo, discovery y estado por modulo.
- `docs/release/inventario-modulos-v0-0-1.md`: inventario tecnico por modulo/submodulo.
- `docs/release/matriz-qa-v0-0-1.md`: QA historico y matriz de validacion.
- `docs/release/matriz-permisos-v0-0-1.md`: matriz por rol y modulo.
- `docs/release/backlog-post-v0-0-1.md`: roadmap priorizado posterior.
- `docs/release/riesgos-y-bloqueantes-v0-0-1.md`: riesgos y bloqueantes separados.
- `docs/release/criterios-cierre-v0-0-1.md`: criterios de sellado y fuera de alcance.

## Validation Strategy

Validaciones finales requeridas:

- `openspec.cmd validate cerrar-version-inicial-0-0-1 --type change --strict`.
- `openspec.cmd validate --all --strict`.
- `cd api && npm.cmd run build`.
- `cd api && npx.cmd tsx --test "src/**/*.spec.ts"`.
- `cd web && npm.cmd run lint`.
- `cd web && npm.cmd run build`.
- `git diff --check`.
- `git status --short`.

Si aparece necesidad de SQL, se detiene y se reporta. Este design no requiere SQL.

## Risks

- La matriz de permisos depende de que seeds y migraciones esten aplicados en cada ambiente.
- Hay changes activos con tareas incompletas; este change no los completa ni los mezcla.
- Build/lint/test pueden fallar por issues preexistentes; se reportan como evidencia, sin modificar logica.
- Hardware real y DIAN real siguen fuera de alcance y bloqueados por dependencias externas.
