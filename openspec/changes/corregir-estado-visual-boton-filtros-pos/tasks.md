## 1. Discovery

- [x] 1.1 Ejecutar `git status --short`.
- [x] 1.2 Ejecutar `git rev-parse --abbrev-ref HEAD`.
- [x] 1.3 Ejecutar `git rev-parse --short HEAD`.
- [x] 1.4 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 1.5 Localizar boton `Filtros`, chips activos y header/buscador POS.
- [x] 1.6 Revisar `Button` y clases condicionales del estado activo.

## 2. OpenSpec

- [x] 2.1 Crear change `corregir-estado-visual-boton-filtros-pos`.
- [x] 2.2 Crear proposal.
- [x] 2.3 Crear design.
- [x] 2.4 Crear spec.
- [x] 2.5 Validar change en strict.
- [x] 2.6 Validar OpenSpec completo en strict.

## 3. Implementacion

- [x] 3.1 Ajustar el boton `Filtros` para no mezclar estado activo con `outline` conflictivo.
- [x] 3.2 Mantener visible icono, texto, badge y chevron en estado activo.
- [x] 3.3 Mantener cambio visual localizado sin tocar logica POS.

## 4. QA y Validacion

- [x] 4.1 Crear evidencia QA en `docs/evidencia-qa-pos-filter-button-active-state.md`.
- [x] 4.2 Ejecutar tests frontend relacionados si existen.
- [x] 4.3 Ejecutar `cd web && npm.cmd run lint`.
- [x] 4.4 Ejecutar `cd web && npm.cmd run build`.
- [x] 4.5 Ejecutar `git diff --check`.
- [x] 4.6 Reportar `git status --short` final.
