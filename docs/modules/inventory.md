# Modulo inventory

## Proposito

Expone la vista consolidada de inventario por producto y sucursal.

## Endpoint

- `GET /api/inventory/products`

## Comportamiento

- combina producto + tenant + sucursal
- calcula stock por suma de movimientos
- obtiene nombre de ultima terminal asociada a movimiento

## UI

- la vista principal de productos usa esta informacion para filtros y stock badges
