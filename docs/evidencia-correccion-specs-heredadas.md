# Evidencia correccion specs heredadas

Fecha: 2026-06-12.

Change OpenSpec: `corregir-specs-heredadas-inventario-precios-productos-reporteria`.

## Resumen

Se normalizaron cuatro specs heredadas al formato strict actual de OpenSpec:

- `openspec/specs/inventario/spec.md`
- `openspec/specs/precios/spec.md`
- `openspec/specs/productos/spec.md`
- `openspec/specs/reporteria-inventario/spec.md`

El cambio es documental. No modifica backend, frontend, base de datos, SQL ni reglas funcionales.

## Cambios aplicados

- `## Proposito` fue reemplazado por `## Purpose`.
- `## Requirements` se mantiene como seccion normativa.
- Los escenarios usan `#### Scenario:` con pasos `- **WHEN**` y `- **THEN**`.
- Supuestos, preguntas abiertas y riesgos heredados quedaron como notas no normativas dentro de `Purpose`.

## Validaciones

| Comando | Resultado |
|---|---|
| `openspec.cmd validate inventario --strict` | PASS |
| `openspec.cmd validate precios --strict` | PASS |
| `openspec.cmd validate productos --strict` | PASS |
| `openspec.cmd validate reporteria-inventario --strict` | PASS |
| `openspec.cmd validate --specs --strict` | PASS, 5 specs passed, 0 failed |
| `openspec.cmd validate --changes --strict` | PASS, 8 changes passed, 0 failed |
| `git diff --check` | PASS con warnings CRLF/LF |

## Resultado

PASS CON OBSERVACIONES.

Observacion unica: `git diff --check` mantiene warnings CRLF/LF conocidos, sin errores de whitespace.

El change queda listo para archive.
