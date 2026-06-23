# Exigir caja abierta para operaciones operativas

## Why

QA manual encontro que un usuario operativo sin caja abierta pudo crear pedido, pagar, facturar y recibir productos. Eso permite operaciones financieras, comerciales e inventario fuera de la caja actual.

## What Changes

- Agregar enforcement backend para exigir caja abierta en mutaciones operativas.
- Reutilizar contexto POS cuando exista y validar que tenga caja abierta asociada.
- Rechazar llamadas directas sin caja abierta con mensaje claro.
- Mantener listados, detalles y reportes como lectura segun permisos.
- Ajustar pedidos, compras, pagos, movimientos de caja y ventas POS.
- Mantener domicilios con regla condicional ya implementada para impacto de caja.

## Impact

- Toca guards/decorators backend.
- Toca controllers de pedidos, compras, ventas, pagos y movimientos.
- Toca UI minima si se requiere mensaje/CTA.
- No modifica calculos de ventas, compras, inventario, pagos ni factura fiscal.
