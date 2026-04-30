# Modulo purchases

## Proposito

Gestiona compras, recepcion de mercancia y entrada a inventario.

## Endpoints

- `GET /api/purchases`
- `POST /api/purchases`
- `GET /api/purchases/:id`
- `PUT /api/purchases/:id`
- `POST /api/purchases/:id/receive`

## Estados

- `DRAFT`, `PENDING`, `PARTIAL`, `RECEIVED`, `CANCELLED`

## Reglas

- solo compras recibidas afectan stock
- proveedor y productos deben pertenecer al tenant
- puede usar branch context
