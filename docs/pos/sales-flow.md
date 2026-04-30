# Flujo de venta POS

## Flujo funcional

1. Usuario abre contexto POS.
2. Selecciona sucursal y terminal.
3. Se crea `pos_user_sessions`.
4. POS carga catalogos activos.
5. Usuario agrega productos al carrito.
6. POS valida stock y cliente.
7. Usuario registra uno o varios medios de pago.
8. Si cubre el total, la venta queda `CASH`; si no, `CREDIT`.
9. Backend crea venta y movimientos de stock.

## Validaciones UI reales

- stock no puede ser superado
- cliente requerido
- items requeridos
- pagos con monto positivo
- cambio solo sobre efectivo
- pagos cash deben cuadrar con el total efectivo aplicado

## Impuestos

- cada item usa `taxId` del producto
- el UI calcula `priceWithoutTax`, `taxTotal` y subtotal

## Persistencia

- carrito no se persiste completo
- contexto POS si se persiste en `localStorage`
