# Criterios de cierre v0.0.1

## Objetivo del cierre

Sellar la primera version `0.0.1` de Manus POS como corte funcional documentado, sin introducir funcionalidades nuevas.

## Criterios obligatorios

| Criterio | Estado esperado |
| --- | --- |
| OpenSpec change creado | `cerrar-version-inicial-0-0-1` |
| Documentacion release creada | 7 archivos bajo `docs/release/` |
| Discovery registrado | Rama, HEAD, status, OpenSpec, modulos y scripts |
| Modulos clasificados | Todos con estado explicito |
| QA documentado | Matriz y evidencias existentes referenciadas |
| Permisos documentados | Matriz por `SUPER_ADMIN`, `SUPER_USER`, `ADMIN`, `USER` |
| Riesgos documentados | Tecnicos y compra/aprobacion separados |
| Backlog post-release | Priorizado y separado de v0.0.1 |
| Validaciones finales | Ejecutadas y reportadas PASS/FAIL |
| Sin commit | Mantener para revision humana |

## Restricciones del cierre

Este change debe cumplir:

- No tocar produccion.
- No ejecutar SQL.
- No crear SQL.
- No modificar logica de negocio.
- No modificar permisos.
- No modificar contratos API.
- No modificar runtime de `api`, `web`, `backend-reporteria`, `backend-perifericos` ni `backend-facturacion-electronica`.
- No mezclar cambios activos.
- No hacer commit.

## Debe quedar dentro de v0.0.1

- Core operativo web/API.
- POS con mocks y caja operativa.
- Pedidos, compras, inventario, clientes, proveedores e impuestos funcionales.
- Pricing/promociones como motor backend y UI admin existente.
- Reportes principales JSON/PDF.
- Seguridad/RBAC actual.
- Multitenant/branding/configuracion actual.
- Documentacion de limitaciones.

## No debe entrar en v0.0.1

- Hardware real.
- Electron productivo.
- Capacitor productivo.
- DIAN real.
- Facturacion electronica real.
- Certificados reales.
- CRM completo.
- Home/dashboard producto final.
- Nuevas migraciones.
- Cambios de permisos.
- Cambios de contratos API.
- Deploy PRD.

## Validaciones finales requeridas

| Validacion | Resultado esperado |
| --- | --- |
| `openspec.cmd validate cerrar-version-inicial-0-0-1 --type change --strict` | PASS ejecutado |
| `openspec.cmd validate --all --strict` | PASS ejecutado |
| `cd api && npm.cmd run build` | PASS ejecutado |
| `cd api && npx.cmd tsx --test "src/**/*.spec.ts"` | FAIL ejecutado: 1 test falla en `InventoryService product mapping` por `RangeError: Invalid time value` |
| `cd web && npm.cmd run lint` | PASS ejecutado con warnings existentes |
| `cd web && npm.cmd run build` | PASS ejecutado con warnings existentes |
| `git diff --check` | PASS ejecutado |
| `git status --short` | Ejecutado; solo archivos esperados del corte documental |

## Decision recomendada

Si el equipo acepta o corrige en change separado el test unitario fallido de inventario, sellar `v0.0.1` como:

`FUNCIONAL_CON_OBSERVACIONES`

La siguiente fase debe ser post-release hardening y no una extension silenciosa de `v0.0.1`.
