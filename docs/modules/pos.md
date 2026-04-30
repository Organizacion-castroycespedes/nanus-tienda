# Modulo POS

## Proposito

Habilita operacion en punto de venta con contexto de sucursal/terminal y venta rapida.

## Piezas reales

- sesion POS: `pos-user-sessions`
- pantalla POS en frontend
- uso de `sales` como backend transaccional

## Rutas UI

- `/{tenant}/pos/select-context`
- `/{tenant}/pos`

## Reglas

- no se puede entrar al POS sin `posSessionId`
- el contexto se persiste localmente
