## Why

Compras y pedidos usan un formulario de pagos separado visualmente del modal POS y proponen monto vacio. Homologar la experiencia reduce calculos manuales sin mezclar proveedor/cliente, abonos ni direccion contable.

## What Changes

- Convertir DocumentPaymentForm en experiencia modal contextual con tarjetas visuales compartidas con POS.
- Mostrar proveedor de compra y cliente de pedido desde el documento, sin selector ni duplicacion persistida.
- Proponer saldo pendiente inicial y remanente al agregar metodos; conservar abonos, referencias, notas y estados backend.
- Proteger confirmacion, foco, teclado, errores y resultados ambiguos.
- Reemplazar POST individual por línea en compras/pedidos por una operación documental atómica; conservar POST simple compatible y crear el contrato sin migración.

## Capabilities

### New Capabilities

- `document-payment-experience`: Experiencia contextual de pago de compras y pedidos con lenguaje visual POS, integridad del tercero y confirmacion segura.

### Modified Capabilities

Ninguna. La especificacion inventario cubre movimientos de stock, no esta experiencia financiera.

## Impact

Web: paginas tenant purchases/orders, DocumentPaymentForm, primitivas compartidas de pagos y extraccion visual limitada de PosScreen. API propuesta: operacion atomica limitada a pagos de documentos, conservando endpoint existente, modelos y direcciones. No modificar autenticacion, tenant, electron, perifericos, facturacion ni migraciones. No commit/push. Preservar .tmp/ sin leer ni escribir.
