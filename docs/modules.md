# Módulos Funcionales

## Resumen

Los módulos operativos centrales hoy son:

- POS
- Orders
- Purchases
- Inventory
- Finance como soporte transversal de caja y pagos

La capa web principal vive bajo rutas `/{tenant}/...` y la API bajo `/api/...`.

## POS

### Objetivo

Permitir venta rápida en terminal con cliente, productos, impuestos, medios de pago y caja activa cuando el pago es efectivo.

### Ruta frontend

- `/{tenant}/pos`
- `/{tenant}/pos/select-context`

### Endpoints involucrados

- `POST /pos/session`
- `GET /pos/session/current`
- `GET /products`
- `GET /customers`
- `GET /taxes`
- `GET /finance/payment-methods`
- `GET /finance/cash-sessions/current`
- `POST /sales`

### Flujo funcional actual

1. El usuario selecciona contexto POS.
2. Se crea o recupera la sesión POS.
3. El POS carga productos, clientes, impuestos y métodos de pago.
4. El carrito se persiste localmente por contexto.
5. Al cobrar:
   - valida stock
   - valida cliente
   - valida cobertura de pagos
   - exige caja abierta para pagos `CASH`
6. El backend crea la venta.
7. Si hay pagos:
   - crea registros en `payments`
   - crea `payment_allocations`
   - si hay caja y pago completado, crea `cash_movements` tipo `PAYMENT`
8. Se limpia el carrito persistido.

### Tablas afectadas

- `pos_user_sessions`
- `products`
- `sales`
- `sale_items`
- `sale_item_taxes`
- `stock_movements`
- `payments`
- `payment_allocations`
- `cash_movements`

### Estados de negocio

- venta: `DRAFT`, `CONFIRMED`, `CANCELLED`
- tipo de venta: `CASH`, `CREDIT`
- pago: `PENDING`, `PARTIAL`, `PAID`, `OVERPAID`

## Orders

### Objetivo

Administrar pedidos previos a facturación, con entregas parciales y posterior facturación a venta.

### Ruta frontend

- `/{tenant}/orders`

### Endpoints involucrados

- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `PUT /orders/:id`
- `POST /orders/:id/deliver`
- `POST /orders/:id/confirm`
- `POST /orders/:id/invoice`
- `POST /orders/:id/cancel`

### Flujo funcional actual

1. Se crea el pedido con cliente, sucursal, tipo y líneas.
2. El pedido nace en `DRAFT`.
3. Se pueden registrar abonos financieros sobre la orden usando `reference_type = 'SALES_ORDER'`.
4. La entrega mueve cantidades a `delivered`.
5. Un pedido `DRAFT` hoy puede entregarse directamente.
6. La facturación crea una `sale` usando solo cantidades entregadas y no facturadas.
7. Si la orden tenía abonos:
   - se heredan/mueven a la venta mediante `payment_allocations`
   - se pueden agregar varios pagos nuevos en la misma facturación

### Tablas afectadas

- `orders`
- `order_items`
- `stock_movements` al entregar
- `sales`
- `sale_items`
- `payments`
- `payment_allocations`

### Estados de negocio

- pedido: `DRAFT`, `CONFIRMED`, `PARTIAL`, `COMPLETED`, `CANCELLED`
- pago pedido: `PENDING`, `PARTIAL`, `PAID`, `OVERPAID`

## Purchases

### Objetivo

Gestionar compras de abastecimiento, recepción de mercancía y pagos a proveedor.

### Ruta frontend

- `/{tenant}/purchases`
- alias interno: `/{tenant}/inventory/purchases`

### Endpoints involucrados

- `POST /purchases`
- `PUT /purchases/:id`
- `GET /purchases`
- `GET /purchases/:id`
- `POST /purchases/:id/receive`
- `POST /finance/payments` para pagos a compras

### Flujo funcional actual

1. Se crea la compra con proveedor, sucursal, tipo y detalle.
2. La compra puede ser `CASH` o `CREDIT`.
3. La compra no afecta stock al crear.
4. La recepción incrementa stock por `stock_movements`.
5. Los pagos a proveedor se registran vía `finance/payments`.
6. Si el pago usa caja activa, genera `cash_movements` tipo `PAYMENT` con dirección `OUT`.

### Tablas afectadas

- `purchases`
- `purchase_items`
- `stock_movements`
- `payments`
- `payment_allocations`
- `cash_movements`

### Estados de negocio

- compra: `DRAFT`, `PENDING`, `PARTIAL`, `RECEIVED`, `CANCELLED`
- pago compra: `PENDING`, `PARTIAL`, `PAID`, `OVERPAID`

## Inventory

### Objetivo

Administrar catálogo, stock, dashboard operativo, impuestos, unidades, clientes y proveedores.

### Rutas frontend

- `/{tenant}/inventory`
- `/{tenant}/inventory/products`
- `/{tenant}/inventory/units`
- `/{tenant}/inventory/taxes`
- `/{tenant}/inventory/suppliers`
- `/{tenant}/customers`

### Endpoints involucrados

- `GET /inventory/products`
- `GET /inventory/dashboard`
- `POST /products`, `GET /products`, `GET /products/:id`, `PUT /products/:id`, `DELETE /products/:id`
- `POST /suppliers`, `GET /suppliers`, ...
- `POST /customers`, `GET /customers`, ...
- `POST /units`, `GET /units`, ...
- `POST /taxes`, `GET /taxes`, ...
- `POST /stock-adjustments`

### Dashboard operativo actual

El dashboard de `/{tenant}/inventory` ya consume datos reales y ajusta alcance por:

- tenant
- sucursal
- terminal
- caja activa
- rol

KPIs soportados:

- stock total
- productos bajos
- productos agotados
- compras pendientes
- pedidos pendientes
- ventas del día
- caja activa
- movimientos recientes

### Tablas afectadas

- `products`
- `units`
- `taxes`
- `stock_movements`
- `orders`
- `purchases`
- `sales`
- `tenant_branches`
- `terminals`
- `cash_sessions`

### Estados de negocio relacionados

- stock se deriva de movimientos, no de un snapshot único
- órdenes, compras y ventas alimentan el dashboard según filtros y rol

## Finance

### Objetivo

Soportar pagos, caja, movimientos y sesiones de caja.

### Rutas frontend

- `/{tenant}/finance`
- `/{tenant}/finance/cash-registers`
- `/{tenant}/finance/cash-sessions`
- `/{tenant}/finance/cash-movements`
- `/{tenant}/finance/payment-methods`

### Endpoints involucrados

- `GET /finance/payment-methods`
- `POST /finance/payment-methods`
- `GET /finance/cash-registers`
- `POST /finance/cash-registers`
- `POST /finance/cash-sessions/open`
- `GET /finance/cash-sessions/current`
- `GET /finance/cash-sessions/history`
- `GET /finance/cash-sessions/:id/summary`
- `POST /finance/cash-sessions/:id/close`
- `GET /finance/cash-movements`
- `POST /finance/cash-movements`
- `GET /finance/payments`
- `POST /finance/payments`

### Flujo funcional actual

1. Se abre caja con monto inicial.
2. La sesión queda `OPEN`.
3. Ventas y pagos completados en efectivo registran movimientos automáticos.
4. Gastos/retiros registran movimientos manuales.
5. El cierre usa resumen por sesión y arqueo persistido.

### Tablas afectadas

- `cash_registers`
- `cash_sessions`
- `cash_movements`
- `cash_counts`
- `payments`
- `payment_allocations`
- `payment_methods`

## Sistema de roles y permisos

## SUPER_ADMIN

- visibilidad global
- opera cualquier tenant

## SUPER_USER

- visibilidad global dentro del tenant actual

## ADMIN

- foco operativo por sucursal
- puede gestionar módulos operativos según permisos

## USER

- rol operativo
- en el estado actual ya participa en flujos de POS, orders, purchases y finance con restricciones de contexto

## Flujo de ventas

### Creación

- origen principal: POS o facturación de order
- endpoint: `POST /sales`

### Cliente asociado

- obligatorio en la creación observada del controlador

### Impacto en inventario

- cada línea vendida genera salida de stock
- cuando la venta nace desde `order`, solo factura cantidades entregadas y pendientes

### Pagos

- se registran mediante `payments`
- se asignan mediante `payment_allocations`
- ventas `CASH` deben quedar totalmente cubiertas
- ventas `CREDIT` pueden quedar parciales

## Persistencia del carrito POS

Existe y hoy se considera funcional.

### Estado actual

- persistencia local en navegador
- aislada por contexto POS
- limpieza automática al confirmar venta

### Problemas detectados

- no es colaborativa
- no protege contra divergencias de stock entre sesiones
- no existe aún un borrador POS persistido en backend

### Recomendación

- mantener la persistencia local como UX
- considerar draft server-side para PRD evolutivo
