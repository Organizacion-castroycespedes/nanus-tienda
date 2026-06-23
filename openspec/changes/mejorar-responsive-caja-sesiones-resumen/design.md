# Design

## Context

La pagina `web/app/[tenant]/finance/cash-sessions/page.tsx` renderiza:

- metricas superiores de caja;
- bloque `Estado actual`;
- tarjetas de apertura, esperado y accion;
- metricas de resumen (`Ingresos`, `Egresos`, `Ventas cobradas`, `Domicilios`, `Ultimo arqueo`);
- bloque `Gestion del turno` / `Caja abierta actual`;
- historial de sesiones.

El problema principal aparece cuando el layout principal usa dos columnas y dentro de la columna izquierda se renderizan grids de 3 o 5 columnas. El area efectiva de cada tarjeta queda demasiado angosta.

## Decisions

- Cambiar el layout principal a una columna hasta pantallas `2xl`; en pantallas amplias usar dos columnas con `minmax(0, ...)`.
- Reemplazar grids fijos de metricas por `repeat(auto-fit,minmax(...,1fr))`.
- Agregar `min-w-0` en contenedores de grid y tarjetas para permitir shrink correcto.
- Ajustar `FinanceMetricCard` para:
  - permitir wrapping del label;
  - usar valores con `tabular-nums`, `break-words`, `whitespace-normal` y `leading-tight`;
  - usar `text-xl sm:text-2xl` en vez de valor fijo grande.
- Ajustar `FinanceStatusBadge` para evitar overflow del badge en cards estrechas.

## Risks

- Al apilar el layout principal antes de `2xl`, el historial de sesiones baja en anchos medianos. Se acepta para mejorar lectura y eliminar compresion.
- `FinanceMetricCard` es compartido por Finanzas. El ajuste es defensivo y debe mejorar otros usos sin cambiar datos ni comportamiento.

## QA Notes

Validar visualmente en desktop, tablet y movil:

- no hay scroll horizontal global;
- valores monetarios largos son legibles;
- badges no salen de su card;
- acciones `Cerrar caja`, `Ver movimientos`, `Ver ticket`, `Descargar PDF`, `Imprimir` siguen visibles.
