# Ciclo de compras

## Estados detectados

- `DRAFT`
- `PENDING`
- `PARTIAL`
- `RECEIVED`
- `CANCELLED`

## Tipos detectados

- `CASH`
- `CREDIT`

## Reglas reales

- Items obligatorios.
- El proveedor debe pertenecer al tenant.
- Los productos deben pertenecer al tenant.
- Una compra `RECEIVED` o `CANCELLED` no puede actualizarse libremente.
- Solo compras recibidas afectan inventario.

## Tablas implicadas

- `purchases`
- `purchase_items`
- `stock_movements`

## Derivacion de estado

- `PENDING`: nada recibido
- `PARTIAL`: recepcion parcial
- `RECEIVED`: recepcion completa
