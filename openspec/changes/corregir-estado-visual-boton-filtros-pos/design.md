## Context

El boton `Filtros` del POS usa el componente compartido `Button` con `variant="outline"`. Ese variant agrega clases de color como `bg-white text-slate-900`. El estado activo agregaba otras clases de color en `className`, como `text-white`.

Tailwind puede resolver utilidades del mismo grupo por orden de CSS generado, no por el orden visual del string. Eso permite una combinacion mala: fondo blanco del variant y texto blanco del estado activo. El resultado visible es un rectangulo blanco/vacio.

## Goals / Non-Goals

**Goals:**

- Evitar utilidades de color conflictivas entre `variant="outline"` y estado activo.
- Mantener icono, texto, badge y chevron visibles con filtros activos.
- Usar un estado activo sutil y legible.
- Mantener responsive sin cambios de layout grandes.

**Non-Goals:**

- No cambiar helper de filtros.
- No cambiar consulta de productos.
- No tocar backend, SQL, permisos, guards, carrito, ventas, pricing, impuestos, stock ni promociones.
- No tocar Home publico.

## Decisions

### Decision: Usar `variant="primary"` solo cuando hay filtros activos

Cuando hay filtros activos, el boton usara `variant="primary"` para evitar que `outline` inyecte `bg-white`. El estado activo se limita a reforzar borde, foco y badge, sin mezclar utilidades contradictorias de fondo/texto.

Alternativa considerada: mantener `outline` y agregar mas clases con `!`. Rechazada porque aumenta fragilidad y depende de `!important`.

### Decision: Mantener el estado normal con `outline`

Sin filtros activos, el boton conserva su apariencia actual con `outline`. Esto reduce el cambio visual fuera del caso reportado.

## Risks / Trade-offs

- [Risk] El estado activo se ve mas fuerte que la propuesta sutil. -> Mitigacion: usar el azul primario existente del design system y badge pequeno.
- [Risk] El boton activo cambia de ancho por el badge. -> Mitigacion: el badge ya existia; no se agrega nueva logica.

## Migration Plan

1. Ajustar clases/variant del boton `Filtros`.
2. Validar OpenSpec, lint, build y diff check.
3. Documentar evidencia QA.

Rollback: revertir el ajuste en `PosScreen.tsx` y los artefactos/docs del change.
