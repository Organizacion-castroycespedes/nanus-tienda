# Proposal: mejorar-experiencia-operativa-visual-pos

## Why
El POS ya funciona, pero pierde espacio util en pantallas medianas y pequenas. Hoy la navegacion, los filtros y parte del contexto operativo ocupan area permanente que deberia estar enfocada en productos, carrito y cobro.
QA visual mostro que el bloque fijo superior del POS todavia consume demasiada altura. El panel operativo debe vivir flotante y bajo demanda.

## What Changes
- Colapsar automaticamente el sidebar al entrar al POS desde el menu lateral, el icono de carrito superior o la URL directa del POS.
- Convertir el bloque operativo superior del POS en un panel flotante bajo demanda, cerrado por defecto.
- Hacer movibles los dos controles flotantes del POS para reubicarlos cuando tapen contenido.
- Conservar filtros y asignacion de cliente dentro de ese panel sin reservar altura permanente.
- Dar mas espacio a la grilla/lista de productos sin cambiar reglas de negocio.
- Mantener el carrito desktop como esta y cambiar el carrito movil a un modal centrado mas operativo.
- Reproducir un sonido local cuando un producto se agrega realmente al carrito.
- Reemplazar el bloque generico de topbar por contexto operativo real: rol, terminal, sucursal y fecha/hora.

## Capabilities

### New Capabilities
- `pos-operational-ux`: POS con sidebar contextual, filtros/clientes compactos, carrito movil modal, contexto operativo visible, feedback sonoro al agregar productos y controles flotantes movibles.

### Modified Capabilities
- None.

## Impact
- `web/app/[tenant]/layout.tsx`
- `web/modules/pos/components/PosScreen.tsx`
- `web/domains/pos/components/PosContextSelector.tsx`
- `web/store/pos.ts`
- `web/domains/pos/types.ts`
- new POS UI helper files for audio, drag positioning and operational context formatting
- OpenSpec docs for the new POS UX capability
