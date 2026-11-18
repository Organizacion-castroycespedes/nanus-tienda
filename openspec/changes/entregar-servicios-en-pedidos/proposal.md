## Why

Al entregar un pedido, la API exigia stock y creaba un movimiento de salida para todas las lineas, incluidos los productos no inventariables (servicios). Un pedido con "Servicio Tecnico Celular" no se podia entregar ("No hay stock suficiente en inventario para entregar esa cantidad") y el mensaje no decia que producto fallaba.

## What Changes

- `OrderService.deliverOrder`: las lineas de productos `is_inventoryable = FALSE` registran la cantidad entregada sin validar stock y sin movimiento OUT, lotes ni series. Las lineas fisicas conservan el flujo actual (FEFO y `consumeDeliveryLots` sin cambios).
- Verificacion previa de stock de todas las lineas fisicas: si alguna no alcanza, se rechaza la entrega sin efectos y el mensaje lista cada producto con su disponible y la cantidad a entregar.
- Web (`OrderDeliverForm`): muestra los productos sin saldo en el dialogo y en el aviso del formulario.

## Impact

- API: `order.service.ts` (+ spec). Web: `OrderDeliverForm.tsx` (+ spec del mensaje).
- La facturacion del pedido (`invoice_order`) usa las cantidades entregadas, no los movimientos: no cambia.
