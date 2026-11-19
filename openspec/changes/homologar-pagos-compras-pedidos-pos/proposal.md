## Why

Compras y pedidos usan un formulario de pagos separado visualmente del modal POS y proponen monto vacio. Homologar la experiencia reduce calculos manuales sin mezclar proveedor/cliente, abonos ni direccion contable.

## What Changes

- Convertir DocumentPaymentForm en experiencia modal contextual con tarjetas visuales compartidas con POS.
- Mostrar proveedor de compra y cliente de pedido desde el documento, sin selector ni duplicacion persistida.
- Proponer saldo pendiente inicial y remanente al agregar metodos; conservar abonos, referencias, notas y estados backend.
- Proteger confirmacion, foco, teclado, errores y resultados ambiguos.
- Mejorar el uso del ancho, la legibilidad y el overflow responsive de la tabla de pedidos y sus presentaciones de productos, sin cambiar comportamiento de negocio.
- Reemplazar POST individual por línea en compras/pedidos por una operación documental atómica; conservar POST simple compatible y crear el contrato sin migración.

## Capabilities

Financial-institution follow-up scope:

- Homologate the per-line financial institution with POS by reusing its selector and active tenant-visible/global catalog, transmitting it in the document operation, validating active status and tenant visibility without requiring a method association, and including it in persistence and idempotency.
- Preserve the established POS global active tenant-visible catalog and selector behavior. Document-payment work SHALL NOT replace the POS catalog with method-filtered associations.

### New Capabilities

- `document-payment-experience`: Experiencia contextual de pago de compras y pedidos con lenguaje visual POS, integridad del tercero y confirmacion segura.

### Modified Capabilities

Ninguna. La especificacion inventario cubre movimientos de stock, no esta experiencia financiera.

## Impact

The existing `payments.financial_institution_id` and financial-institution catalog are sufficient; this follow-up requires no migration. Purchase and order payments use the `TENANT_ACTIVE` policy: an institution must be active and tenant-owned or global, but no `payment_method_financial_institutions` row is required. POS files, sale totals, change, customer, reference, idempotency and persistence behavior remain unchanged.

Web: paginas tenant purchases/orders, DocumentPaymentForm, primitivas compartidas de pagos y extraccion visual limitada de PosScreen. API propuesta: operacion atomica limitada a pagos de documentos, conservando endpoint existente, modelos y direcciones. No modificar autenticacion, tenant, electron, perifericos, facturacion ni migraciones. No commit/push. Preservar .tmp/ sin leer ni escribir.

The owner also authorized a bounded frontend-only expansion on the same branch for `/[tenant]/orders`. It improves use of available width, responsive filters, stable table columns, long-name readability and controlled horizontal overflow in the orders list and existing product presentations. It does not change payment behavior, order calculations, state transitions, API contracts, permissions, persistence, backend code, database data or POS source files.
