## Context

La página `web/app/[tenant]/finance/page.tsx` ya obtiene métodos de pago, cajas, sesión actual e historial mediante `usePaymentMethods`, `useCashRegisters` y `useCashSessions`. La autorización se calcula con `getFinancePermissions`; el CTA de abrir/cerrar caja solo navega a `cash-sessions`, donde viven los handlers reales. `FinanceSectionNav` también sirve a los submódulos, por lo que no se modificará para evitar regresiones.

La portada actual muestra un encabezado amplio, seis destinos en navegación, cuatro KPI, un bloque duplicado de rutas y tarjetas verticales para sesiones. La referencia de `/reporteria` demuestra un patrón compacto: encabezado, accesos rápidos pequeños, indicadores densos y contenido en grids con `min-w-0`.

## Goals / Non-Goals

**Goals:**

- Hacer la portada `/finance` POS-first, compacta y legible en aproximadamente 1024x768, móvil y escritorio.
- Mostrar cuatro accesos rápidos inmediatamente debajo del encabezado: Caja/Sesiones, Movimientos, Cajas y Métodos de pago cuando el permiso lo permita.
- Mantener el CTA existente de abrir/cerrar caja y su condición basada en `currentSession`.
- Reorganizar los mismos KPI en tarjetas compactas, priorizando caja actual, estado, cajas activas, métodos activos y diferencias.
- Presentar historial reciente como lista densa con caja, código, estado y apertura, usando `FinanceStatusBadge` para que el estado no dependa solo del color.
- Conservar rutas, permisos, hooks, servicios, contratos, datos y estados existentes.

**Non-Goals:**

- No cambiar backend, API, DTOs, queries, PostgreSQL, migraciones o persistencia.
- No cambiar apertura, cierre, arqueo, movimientos, sesiones, métodos de pago, cajas ni turno actual.
- No rediseñar `/finance/cash-sessions`, `/finance/cash-movements`, `/finance/cash-registers`, `/finance/payment-methods` ni `/finance/current-shift`.
- No añadir gráficas históricas, filtros nuevos, consultas nuevas ni dependencias.

## Decisions

1. **Modificar solo la página padre.** La consolidación visual se implementará en `web/app/[tenant]/finance/page.tsx`. `FinanceSectionNav` permanecerá intacto porque es compartido por submódulos y sus deep links deben seguir visibles allí.

2. **Cuatro quick links, no seis tarjetas.** El padre expondrá Caja/Sesiones, Movimientos, Cajas y Métodos de pago. `Turno actual` conservará su ruta y será accesible desde el módulo especializado, pero dejará de competir visualmente con los cuatro destinos prioritarios del padre. Para USER se ocultará Métodos de pago con la misma regla actual.

3. **Datos existentes, solo nueva composición.** Se conservarán las tres cargas actuales y los cálculos locales existentes: métodos activos, cajas activas, sesión actual, sesiones cerradas y diferencias. No se recalcularán importes ni se agregará una llamada para completar campos.

4. **Composición local POS-first.** El landing implementa localmente el header compacto y los KPI/totales inline para igualar la densidad de `/reporteria`. Reutiliza `FinanceStatusBadge`, iconos de `lucide-react`, `formatCurrency`, tokens y convenciones responsive del design system, sin modificar `FinancePageHeader` ni `FinanceMetricCard`, porque sus variantes actuales conservan una altura mayor y afectarían otros submódulos Finance. No se introduce una librería ni un token nuevo.

5. **Responsive por CSS y cantidad visible.** Se usarán grids `min-w-0` y clases de columnas derivadas de la longitud final de los accesos/KPI visibles: cuatro columnas cuando hay cuatro elementos y ancho suficiente, tres cuando hay tres, y equivalentes menores para los demás casos. En móvil se mantiene una o dos columnas legibles, sin ancho fijo ni overflow horizontal global. El layout nunca agrega elementos no autorizados para completar una fila.

6. **Acción de negocio intacta.** El encabezado conserva el mismo `Link` a `cash-sessions` y el mismo texto condicional `Cerrar caja / arqueo` o `Abrir caja`. No se mueve lógica de cierre ni se llama directamente a servicios desde el padre.

## Risks / Trade-offs

- [Ocultar Turno actual del bloque principal puede reducir su descubribilidad] → Mantener la ruta y el deep link intactos; documentar en QA que el submódulo y su navegación siguen disponibles.
- [Una lista compacta puede mostrar menos detalle visual que las tarjetas] → Mantener caja, código, estado y monto de apertura, y conservar el enlace a Sesiones para el detalle completo.
- [Permisos distintos pueden dejar cuatro accesos incompletos] → Derivar Métodos de pago con `canViewPaymentMethods` y dejar los otros destinos visibles bajo el mismo `canViewFinance` ya existente.
- [Cambios de clases pueden afectar móvil] → Usar `min-w-0`, wrapping y breakpoints existentes; validar lint/build y QA manual en móvil/POS/escritorio.

## Migration Plan

No hay migración de datos ni despliegue backend. Publicar el cambio frontend junto con sus artefactos OpenSpec. Rollback: restaurar la página padre anterior; servicios, rutas y datos no requieren rollback.

## Open Questions

- La QA manual debe confirmar la densidad real en 1024x768, móvil y escritorio.
- La QA manual debe confirmar que `Turno actual` continúa accesible y que el CTA de abrir/cerrar conserva exactamente su comportamiento.
