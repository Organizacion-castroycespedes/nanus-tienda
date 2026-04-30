# Modulo sales

## Proposito

Gestiona ventas directas y ventas derivadas de pedidos entregados.

## Endpoints

- `GET /api/sales`
- `POST /api/sales`
- `GET /api/sales/:id`
- `POST /api/sales/:id/cancel`

## Estados

- `DRAFT`, `CONFIRMED`, `CANCELLED`

## Reglas

- cliente obligatorio
- items obligatorios
- `CASH` exige cuadrar pagos
- `CREDIT` permite saldo
- crea `stock_movements`
