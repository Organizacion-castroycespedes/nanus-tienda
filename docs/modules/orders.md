# Modulo orders

## Proposito

Gestiona pedidos con entregas parciales y facturacion posterior.

## Endpoints

- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/:id`
- `PUT /api/orders/:id`
- `POST /api/orders/:id/deliver`
- `POST /api/orders/:id/confirm`
- `POST /api/orders/:id/invoice`
- `POST /api/orders/:id/cancel`

## Estados

- `DRAFT`, `CONFIRMED`, `PARTIAL`, `COMPLETED`, `CANCELLED`

## Reglas

- soporta entregas parciales
- solo borradores se actualizan/cancelan
- solo pedidos parciales o completados se facturan
