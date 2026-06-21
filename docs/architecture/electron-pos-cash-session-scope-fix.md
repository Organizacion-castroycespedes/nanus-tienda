# Electron POS cash-session scope fix

Fecha: 2026-06-21
OpenSpec change: `corregir-scope-caja-terminal-pos-qa`

## Objetivo

Corregir la desalineacion entre POS y reporteria para que un mismo contexto operativo no se vea como libre en una vista y ocupado en otra.

## Cambio aplicado

- POS context selection ahora resuelve la caja actual usando la caja seleccionada.
- current-shift ahora toma la sucursal del usuario como contexto por defecto y no exige propiedad de la caja si la sucursal ya coincide.
- Se agregaron tests de regresion en current-shift.

## Riesgo

- No se cierran cajas automaticamente.
- No se cambian reglas de venta ni de facturacion.
- La correccion solo alinea lectura de contexto.

## Fuera de alcance

- Scanner HID.
- Electron shell.
- Empaquetado.
- Offline.
- USB/serial.
- SQL de remediacion.

