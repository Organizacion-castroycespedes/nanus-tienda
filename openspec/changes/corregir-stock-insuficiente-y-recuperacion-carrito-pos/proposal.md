## Why

El POS conserva cantidades de un catálogo anterior. `inventory_create_sale_v2`
rechaza correctamente la venta con `P0001` cuando el stock agregado o el stock
FEFO elegible ya no alcanza, y la transacción revierte sus efectos. Sin embargo,
`SaleService.createSale` vuelve a lanzar el error de PostgreSQL y `PosScreen`
clasifica cualquier error del POST como `UNKNOWN`. El carrito queda bloqueado
aunque no exista venta ni pago persistido.

## What Changes

- Convertir los rechazos definitivos de stock agregado y FEFO en un contrato de
  negocio seguro con disponibilidad autoritativa y alcance tenant/sucursal.
- Refrescar disponibilidad antes de abrir el cobro y conservar el carrito con
  cantidades sin alterar automáticamente.
- Presentar productos `is_inventoryable=false` como servicios en catálogo y
  carrito, permitir agregarlos con stock cero y conservar el contrato
  comercial de la venta mixta. El backend/SQL sigue siendo la autoridad para
  decidir los efectos físicos.
- Permitir editar, eliminar o cancelar después de un rechazo definitivo de
  stock, sin eliminar claves de idempotencia de intentos ambiguos ni generar
  reintentos automáticos.
- Mantener `UNKNOWN` para timeout, red, `5xx`, `409` de idempotencia y cualquier
  resultado no demostrablemente rechazado antes de commit.
- Agregar regresiones aisladas para backend, carrito, múltiples cuentas y
  callbacks tardíos.

## Capabilities

### New Capabilities

- `pos-definitive-stock-recovery`: rechazo definitivo de inventario y
  recuperación segura del carrito POS.

### Modified Capabilities

- `pos-unknown-sale-recovery`: clasificar stock definitivo sin debilitar la
  protección de resultados ambiguos.

## Impact

- Backend: contrato de error de `SaleService`/`SaleRepository`.
- Frontend: cliente HTTP, recuperación POS, store del carrito y `PosScreen`.
- Tests: regresiones dirigidas de API y POS.
- Sin migraciones dentro de este change, ajustes directos de BD, cambios en
  V108, FactuCore, pagos, caja o lógica de anulaciones. La redefinición
  forward-only de `inventory_create_sale_v2` pertenece a la coordinación
  gobernada con `soportar-productos-no-inventariables`.
