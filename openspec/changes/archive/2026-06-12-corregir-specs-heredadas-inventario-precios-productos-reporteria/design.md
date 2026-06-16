## Context

`openspec.cmd validate --specs --strict` falla por specs historicas que no cumplen el contrato actual de OpenSpec. Las specs afectadas son `inventario`, `precios`, `productos` y `reporteria-inventario`.

El problema es documental y estructural. Las reglas funcionales descritas siguen siendo utiles, pero el formato heredado impide validar todo el catalogo de specs despues de archivar cambios nuevos.

## Goals / Non-Goals

**Goals:**

- Convertir las cuatro specs heredadas al formato strict actual.
- Preservar los requisitos funcionales existentes sin ampliar alcance.
- Dejar delta specs trazables para cada capacidad afectada.
- Permitir que `openspec.cmd validate --specs --strict` pase luego de aplicar el cambio.

**Non-Goals:**

- No implementar logica de inventario, productos, precios o reporteria.
- No cambiar backend, frontend, base de datos ni scripts SQL.
- No resolver preguntas abiertas funcionales.
- No archivar automaticamente el cambio sin una validacion posterior.

## Decisions

### Decision: Normalizar specs existentes en sitio

La implementacion editara `openspec/specs/<capability>/spec.md` para cambiar `## Proposito` por `## Purpose`, conservar `## Requirements` y convertir escenarios al formato estricto.

Alternativa considerada: crear specs nuevas y abandonar las heredadas. Se descarta porque perderia continuidad historica y duplicaria capacidades.

### Decision: Mantener comportamiento funcional estable

Los textos normativos se conservaran con el mismo sentido. Solo se ajustara redaccion de escenarios para usar `- **WHEN**` y `- **THEN**`.

Alternativa considerada: aprovechar para completar preguntas abiertas. Se descarta porque mezclaria higiene OpenSpec con decisiones de producto.

### Decision: Registrar deltas por capacidad

Cada capacidad afectada tendra un delta spec bajo `openspec/changes/.../specs/<capability>/spec.md`.

Alternativa considerada: usar solo tasks sin delta specs. Se descarta porque el cambio modifica specs existentes y debe dejar intencion OpenSpec auditable.

## Risks / Trade-offs

- [Risk] Al reescribir escenarios se puede alterar accidentalmente el significado. -> Mitigacion: mantener los mismos nombres de requisitos y validar diff manualmente.
- [Risk] Preguntas abiertas y riesgos heredados no encajan como requisitos. -> Mitigacion: moverlos a `Purpose` o notas no normativas dentro de la spec.
- [Risk] Los deltas no pueden representar cambios de `Purpose` con la misma precision que requirements. -> Mitigacion: documentar en tasks que la implementacion edita tambien el encabezado y secciones no normativas.

## Migration Plan

1. Editar las cuatro specs heredadas con cambios de formato solamente.
2. Validar individualmente `inventario`, `precios`, `productos` y `reporteria-inventario`.
3. Ejecutar `openspec.cmd validate --specs --strict`.
4. Ejecutar `openspec.cmd validate --changes --strict`.
5. Ejecutar `git diff --check`.
6. Archivar el cambio cuando las validaciones pasen.

Rollback: revertir las cuatro specs y el directorio del change.

## Open Questions

Ninguna para este cambio. Las preguntas funcionales existentes se mantienen como notas heredadas para fases futuras.
