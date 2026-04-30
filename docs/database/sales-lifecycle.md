# Ciclo de ventas

## Estados detectados

- `DRAFT`
- `CONFIRMED`
- `CANCELLED`

## Tipos detectados

- `CASH`
- `CREDIT`

## Reglas reales

- Venta `CASH`: el saldo debe ser `0`.
- Venta `CASH`: la suma de medios de pago debe ser exactamente igual al total.
- Venta `CREDIT`: permite saldo pendiente.
- Cliente obligatorio.
- Items obligatorios.
- POS context requerido si no viene completo, se intenta resolver la sesion POS activa.

## Tablas implicadas

- `sales`
- `sale_items`
- `sale_item_taxes`
- `sale_payment_methods`
- `stock_movements`

## Integracion con pedidos

Los pedidos pueden facturarse parcialmente o totalmente mediante `invoiceOrder()`, que delega a `SaleService`.
