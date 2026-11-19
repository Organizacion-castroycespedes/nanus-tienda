# Proposal

## Why

Pedidos muestra identificadores en lugar de datos del cliente y no conecta claramente la facturación con las ventas generadas. La impresión y la búsqueda deben seguir los flujos existentes sin alterar POS ni inventario.

## What Changes

- Enriquecer el detalle del pedido con cliente y terminal, y presentar datos legibles en facturación, entrega, abonos y domicilio.
- Reutilizar el flujo de impresión de venta y facturación electrónica existente desde la página de pedidos.
- Habilitar buscadores de cliente y sucursal compatibles con el lector.
- Exponer ventas generadas y permitir gestionar una o varias desde la lista de pedidos, con retorno contextual.
- QA-01: adaptar las acciones del detalle de venta anulada a las restricciones reales de reportería, conservando información histórica y acceso al comprobante de anulación disponible.
- Regularizar los mensajes existentes de fallo de periféricos en pedidos y compras para no atribuir el fallo a MOCK sin evidencia.

## Capabilities

### New Capabilities

- `orders-billing-workflow`: identidad del cliente, búsqueda, impresión y gestión de ventas asociadas a pedidos.

### Modified Capabilities

## Impact

API de pedidos y contratos web, formularios de pedidos y domicilio, listado de pedidos y detalle de venta operativa. No se requieren migraciones ni cambios en POS, funciones de venta o consumo de inventario.
