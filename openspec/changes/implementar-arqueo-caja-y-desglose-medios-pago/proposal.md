# Implementar arqueo de caja y desglose por medios de pago

## Why

La vista de caja permite cerrar sesiones, pero el cajero no tiene una revision preliminar clara antes del cierre. Ademas, los totales mezclan efectivo fisico con pagos electronicos, transferencias, compras, domicilios y movimientos, lo que hace confuso el valor real esperado en caja.

## What Changes

- Agregar arqueo preliminar para una caja abierta sin cerrar la sesion.
- Persistir arqueos preliminares reutilizando `cash_counts` con tipo `AUDIT`.
- Calcular efectivo esperado solo con apertura, pagos y movimientos en efectivo.
- Separar pagos no efectivo por metodo/categoria.
- Mostrar desglose por origen: ventas POS, pedidos, compras, domicilios y movimientos.
- Mejorar cierre de caja para usar efectivo esperado y mostrar desglose claro.
- Actualizar ticket de cierre para incluir efectivo esperado, contado, diferencia y resumen por medios.

## Impact

- Toca API de finance/cash-sessions.
- Toca vista frontend `finance/cash-sessions`.
- Toca backend-reporteria para ticket de cierre.
- Agrega migracion aditiva sobre `cash_counts`.
- No modifica facturacion fiscal/electronica, inventario, ventas ni pagos existentes.
