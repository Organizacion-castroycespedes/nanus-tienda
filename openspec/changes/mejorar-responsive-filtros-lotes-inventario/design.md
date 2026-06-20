## Context

La vista `web/app/[tenant]/inventory/lots/page.tsx` renderiza un bloque de filtros dentro de una tarjeta. El contenedor usa:

`xl:grid-cols-[1fr_220px_220px_180px_180px_180px_180px_160px_auto_auto]`

En viewports cercanos a `1342 x 802`, el breakpoint `xl` esta activo, pero la suma de columnas fijas y gaps excede el ancho real disponible despues de sidebar/header. Resultado: overflow horizontal, controles cortados y tabla desalineada.

## Goals / Non-Goals

**Goals:**

- Hacer que los filtros envuelvan dentro del contenedor.
- Mantener controles legibles y usables en desktop amplio, desktop/tablet reducido y movil.
- Evitar overflow horizontal global causado por filtros.
- Conservar scroll horizontal interno solo para la tabla.
- Mantener la semantica actual de busqueda, limpieza, disponibilidad y paginacion.

**Non-Goals:**

- No backend.
- No SQL.
- No contratos API.
- No permisos/guards.
- No reglas de negocio de lotes, vencimientos, stock disponible ni discrepancias.
- No cambios funcionales de filtros.

## Decisions

### Decision: Usar grilla responsive con columnas fluidas

El bloque de filtros usara `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6` y `min-w-0` en wrappers donde aplica. Esto evita ancho fijo acumulado y permite wrap ordenado.

Alternativa considerada: conservar grilla custom y ajustar tamaños fijos. Rechazada porque seguiria siendo fragil ante sidebar o cambios de viewport.

### Decision: Agrupar acciones en contenedor propio

`Buscar` y `Limpiar` se agrupan en un contenedor `flex flex-wrap` que puede ocupar todo el ancho en breakpoints medios. Esto mantiene ambos botones visibles y evita que empujen otros campos.

Alternativa considerada: dejar acciones como columnas independientes. Rechazada porque son las primeras en quedar cortadas cuando falta ancho.

### Decision: Tabla mantiene scroll interno

La tabla ya vive en `overflow-x-auto`; se refuerza que el overflow sea interno al panel y no global con `min-w-0`/`max-w-full` en contenedores.

## Risks / Trade-offs

- [Risk] En desktop muy ancho el bloque ocupa mas filas que antes. -> Mitigacion: `2xl:grid-cols-6` conserva densidad suficiente sin columnas fijas.
- [Risk] Los botones pueden quedar debajo de algunos filtros. -> Mitigacion: se prioriza visibilidad y wrap ordenado sobre una sola linea fragil.

## Migration Plan

1. Ajustar clases de layout en la tarjeta de filtros.
2. Mantener handlers y estado sin cambios.
3. Validar OpenSpec, lint, build, diff check y QA visual.

Rollback: revertir cambios en `page.tsx` y artefactos OpenSpec del change.
