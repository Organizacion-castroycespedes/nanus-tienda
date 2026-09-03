## Why

La pantalla `/[tenant]/pos` funciona, pero su jerarquía visual actual no prioriza la venta rápida. La referencia aprobada de `Venta express` define una experiencia más clara para el cajero: productos primero, carrito siempre legible y filtros/acciones compactos, con alta paridad visual respecto al mockup.

## What Changes

- Rediseñar visualmente el contenido de `/[tenant]/pos` con foco en venta rápida.
- Aumentar la presencia visual de la imagen de producto en cards y lista.
- Reorganizar catálogo, filtros, grid/list y carrito para que la lectura sea inmediata.
- Cambiar el estado base del catálogo a `Con stock`.
- Mantener las reglas funcionales existentes para stock, carrito, cobro, balanza y escáner.
- Preservar el fix responsive ya aprobado para carrito, sidebar y contexto global POS.
- Mantener dark mode, accesibilidad y comportamiento táctil sin introducir navegación global nueva.

## Capabilities

### New Capabilities
- `pos-venta-express`: rediseño UX/UI del POS de venta express, incluyendo catálogo visual, cards, filtros, grid/list, carrito desktop/mobile, empty state, responsive y paridad visual con la referencia aprobada.

### Modified Capabilities
- Ninguna.

## Impact

- Afecta principalmente `web/modules/pos/components/PosScreen.tsx`.
- Puede requerir componentes visuales auxiliares en `web/modules/pos/components/` y ajustes puntuales en `web/modules/pos/utils/`.
- Puede agregar o ajustar pruebas de filtros, cards, carrito y responsive en `web/modules/pos/` y `web/store/`.
- No cambia contratos API, persistencia, lógica fiscal, lógica de cobro ni navegación global.
