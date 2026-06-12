## 1. Inventario De Specs Heredadas

- [x] 1.1 Revisar `openspec/specs/inventario/spec.md` y confirmar cambios de formato requeridos.
- [x] 1.2 Revisar `openspec/specs/precios/spec.md` y confirmar cambios de formato requeridos.
- [x] 1.3 Revisar `openspec/specs/productos/spec.md` y confirmar cambios de formato requeridos.
- [x] 1.4 Revisar `openspec/specs/reporteria-inventario/spec.md` y confirmar cambios de formato requeridos.

## 2. Normalizacion Strict

- [x] 2.1 Cambiar `## Proposito` por `## Purpose` en las cuatro specs.
- [x] 2.2 Mantener `## Requirements` como seccion normativa principal.
- [x] 2.3 Convertir cada escenario al formato OpenSpec strict con `#### Scenario:` y pasos `- **WHEN**` / `- **THEN**`.
- [x] 2.4 Mover supuestos, preguntas abiertas y riesgos a texto no normativo compatible sin perder trazabilidad.
- [x] 2.5 Confirmar que no se agregan ni eliminan reglas funcionales.

## 3. Validacion

- [x] 3.1 Ejecutar `openspec.cmd validate inventario --strict`.
- [x] 3.2 Ejecutar `openspec.cmd validate precios --strict`.
- [x] 3.3 Ejecutar `openspec.cmd validate productos --strict`.
- [x] 3.4 Ejecutar `openspec.cmd validate reporteria-inventario --strict`.
- [x] 3.5 Ejecutar `openspec.cmd validate --specs --strict`.
- [x] 3.6 Ejecutar `openspec.cmd validate --changes --strict`.
- [x] 3.7 Ejecutar `git diff --check`.

## 4. Cierre

- [x] 4.1 Actualizar evidencia o nota de cierre indicando que las specs heredadas ya validan.
- [x] 4.2 Preparar archive del change cuando todo pase.
