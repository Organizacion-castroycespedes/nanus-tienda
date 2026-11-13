## Why

En `/orders` y `/purchases` (también `/inventory/purchases`) la sección de filtros ocupa buena parte de la pantalla y la sección "Alcance" se muestra siempre, aunque sin caja abierta no permite elegir nada. Además, al facturar un pedido la sección "Pagos nuevos" aparece aunque el pedido no tenga saldo, y usa un formulario antiguo de método y monto, distinto del modal moderno de cobro que se usa en la acción "Abonar" (métodos en tarjetas y banco o billetera).

## What Changes

- **Filtros colapsables** en `/orders` y `/purchases`: ocultos por defecto, con botón "Mostrar filtros" / "Ocultar filtros" y conteo de filtros activos. La elección se recuerda por usuario en el navegador.
- **Alcance dentro de los filtros**: se elimina el banner verde "Alcance". Si hay caja abierta, "Alcance" (Todas / Caja actual) aparece como un filtro más; sin caja no se muestra.
- **Cobro al facturar pedidos**: "Pagos nuevos" solo aparece si queda saldo por cubrir después de los abonos heredados. En lugar del formulario antiguo, un botón "Registrar pago" abre el mismo modal moderno de "Abonar" (`DocumentPaymentForm`). El pago se registra como abono del pedido y la factura lo hereda al recargar.

## Capabilities

### New Capabilities

- `inventory-list-filters`: filtros colapsables y alcance por caja en los listados de pedidos y compras.
- `order-invoice-payment`: cobro del saldo al facturar un pedido mediante el modal moderno de abonos.

### Modified Capabilities

Ninguna capacidad publicada en `openspec/specs/` cambia.

## Impact

- **Web:** `web/app/[tenant]/orders/page.tsx`, `web/app/[tenant]/orders/orders-responsive-layout.spec.ts`, `web/app/[tenant]/purchases/page.tsx`, `web/modules/inventory/components/OrderInvoiceForm.tsx` y nuevo `web/modules/inventory/list-filters/**`.
- **API y base de datos:** sin cambios. `POST /orders/:id/invoice` se sigue usando sin pagos nuevos cuando el saldo se cubre con abonos.
- **POS, Electron y agente de periféricos:** sin cambios.
- **Gobernanza:** reasignación autorizada de la titularidad vigente de `orders/page.tsx`, `orders-responsive-layout.spec.ts`, `purchases/page.tsx` (desde `modernizar-captura-barcode-orders-purchases`) y `OrderInvoiceForm.tsx` (desde `homologar-pagos-compras-pedidos-pos`).
