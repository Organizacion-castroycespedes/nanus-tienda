## Why

Hoy una compra se guarda en `DRAFT`, pero la web no ofrece forma de corregirla: un error de proveedor, cantidad o costo obliga a cancelar y crear otra. Además, un borrador se puede recibir directamente, de modo que el estado `DRAFT` no aporta un punto de control antes de que entre mercancía. El `PUT /purchases/:id` existente permitía editar compras `PENDING` y `PARTIAL` y, al reemplazar renglones, reiniciaba las cantidades recibidas.

La regla del propietario es no afectar inventario: la recepción, los lotes, las series, FEFO y los movimientos de stock no cambian.

## What Changes

- Edición de borrador: `PUT /purchases/:id` solo acepta compras `DRAFT` sin cantidades recibidas ni movimientos de inventario. Se editan proveedor, tipo, productos, cantidades y costos. Sucursal, terminal, estado y fecha no son editables (la sucursal se deriva del evento `PURCHASE_CREATED`). El total no puede quedar por debajo de lo pagado. Audita `PURCHASE_DRAFT_UPDATED`.
- Confirmación: nuevo `PATCH /purchases/:id/confirm` (`DRAFT` → `PENDING`), exige al menos un producto, audita `PURCHASE_CONFIRMED`. No toca inventario, pagos ni caja.
- Recepción: `POST /purchases/:id/receive` rechaza compras `DRAFT` con un chequeo de estado al inicio; la lógica de recepción no cambia.
- Historial de estado del detalle incluye `PURCHASE_DRAFT_UPDATED` y `PURCHASE_CONFIRMED`.
- Web `/inventory/purchases`: acciones Editar y Confirmar compra para borradores (menú y detalle); Recibir solo en compras confirmadas; formulario de compra en modo edición; proveedor con buscador (`SearchableSelect`); confirmación con advertencia (`ConfirmDialog` del design-system vía `useConfirm`) al guardar borrador, guardar cambios, confirmar y registrar pago (opt-in `submitConfirmation` en `DocumentPaymentForm`, sin cambio para pedidos).
- Listado: columna "N° factura" (factura del proveedor registrada en la recepción; vacía si no hay) después de Proveedor y búsqueda por ese número.
- Liquidación parcial: la tabla de productos ocupa el ancho disponible y en móvil se muestra como tarjetas.

## Impact

- API: `purchase.controller.ts`, `purchase.service.ts` (+ spec).
- Web: `purchases/page.tsx`, `PurchaseForm.tsx`, `PurchaseDetailPanel.tsx`, `SettlePartialPurchaseForm.tsx`, `purchase.service.ts`, `DocumentPaymentForm.tsx`, `PaymentDialog.tsx`.
- Sin migraciones. Compras `DRAFT` existentes deben confirmarse antes de recibirse.
- Fuera de alcance: cambiar sucursal del borrador, fecha de compra editable, edición después de confirmar.
