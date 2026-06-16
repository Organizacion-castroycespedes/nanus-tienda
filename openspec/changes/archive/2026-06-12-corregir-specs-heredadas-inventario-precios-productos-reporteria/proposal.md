## Why

La validacion estricta post-archive falla por cuatro specs heredadas que usan formato antiguo: `## Proposito`, escenarios estilo `GIVEN/WHEN/THEN` sin negrilla y secciones finales fuera del contrato esperado.

Este cambio corrige solo la forma OpenSpec de esas specs para que `openspec.cmd validate --specs --strict` pueda pasar sin alterar reglas funcionales de inventario, precios, productos o reporteria.

## What Changes

- Normalizar las specs heredadas `inventario`, `precios`, `productos` y `reporteria-inventario` al formato actual de OpenSpec.
- Cambiar `## Proposito` por `## Purpose`.
- Mantener `## Requirements` como seccion principal de requisitos.
- Reescribir escenarios al estilo requerido por OpenSpec con pasos `- **WHEN**` y `- **THEN**`.
- Mover supuestos, preguntas abiertas y riesgos a texto compatible dentro de `Purpose` o notas de requisitos, sin perder trazabilidad.
- No cambiar comportamiento esperado, endpoints, base de datos, frontend ni backend.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `inventario`: normalizar estructura strict sin cambiar requisitos funcionales.
- `precios`: normalizar estructura strict sin cambiar requisitos funcionales.
- `productos`: normalizar estructura strict sin cambiar requisitos funcionales.
- `reporteria-inventario`: normalizar estructura strict sin cambiar requisitos funcionales.

## Impact

- Afecta solo documentacion OpenSpec bajo `openspec/specs/`.
- Agrega evidencia de cambio bajo `openspec/changes/corregir-specs-heredadas-inventario-precios-productos-reporteria/`.
- No modifica codigo de aplicacion.
- No ejecuta SQL.
- No toca produccion.
