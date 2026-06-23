# Evidencia QA - Flujo funcional creacion domicilios

Fecha: 2026-06-22
Rama: `feat/develop/cierre-funcionalidad-de-domicilios`
Cambio OpenSpec: `definir-flujo-funcional-creacion-domicilios`

## Alcance

Validar que `/{tenant}/deliveries/new` permita crear domicilios manuales, desde pedido, desde venta/factura, y desde pedido con venta asociada, sin escribir IDs tecnicos y sin tocar caja, pagos, POS, inventario ni fiscal/electronica.

## Diagnostico

- Clientes: el formulario cargaba `getCustomers()` una vez y luego aplicaba busqueda local con limite visual de 12 opciones. Si el cliente no estaba en esa carga/lista visible, no aparecia. Ahora `GET /api/customers?query=...&limit=25` busca por texto en backend y mantiene tenant isolation.
- Pedidos: el formulario cargaba `GET /api/orders` sin filtro por cliente y filtraba en frontend. Con alcance por sucursal y datos grandes, podia no traer o no mostrar lo esperado. Ahora `GET /api/orders?customerId=...&branchId=...` filtra en backend y el frontend solo muestra no cancelados.
- Ventas/facturas: el formulario usaba `getPosSalesReport`, un dataset de reporteria, no el servicio operativo de ventas. No exponia `customerId`/`orderId` de forma suficiente para el flujo. Ahora usa `GET /api/sales?customerId=...&branchId=...`.
- `sale_id`: representa la venta interna registrada en `sales`. En la UI se presenta como venta/factura operativa; no modifica factura electronica ni totales fiscales.
- Totales: antes `Subtotal` y `Total` eran editables y podian quedar inconsistentes. Ahora salen de `delivery-totals.ts`, con total calculado readonly.

## Casos QA manual

### 1. Cliente

- [ ] Buscar cliente que no aparece en la carga inicial.
- [ ] Seleccionarlo.
- [ ] Confirmar que se precargan contacto, telefono y direccion principal cuando existen.
- [ ] Confirmar que se cargan pedidos del cliente.
- [ ] Confirmar que se cargan ventas/facturas del cliente si el usuario tiene permiso POS READ.

### 2. Manual

- [ ] Crear domicilio sin pedido/venta.
- [ ] Valor domicilio: `5000`.
- [ ] Confirmar `Subtotal = 0`.
- [ ] Confirmar `Total = 5000`.
- [ ] Confirmar que no se solicita UUID tecnico.

### 3. Pedido

- [ ] Seleccionar cliente con pedidos.
- [ ] Confirmar selector de pedidos lista pedidos no cancelados.
- [ ] Seleccionar pedido.
- [ ] Confirmar subtotal del pedido.
- [ ] Diligenciar valor domicilio.
- [ ] Confirmar `Total = subtotal pedido + valor domicilio`.
- [ ] Crear domicilio.
- [ ] Confirmar `order_id` guardado.

### 4. Venta/factura

- [ ] Seleccionar cliente con venta/factura.
- [ ] Confirmar selector lista ventas/facturas no canceladas/refundidas.
- [ ] Seleccionar venta/factura.
- [ ] Confirmar subtotal de venta/factura.
- [ ] Confirmar `Total = subtotal venta/factura + valor domicilio`.
- [ ] Crear domicilio.
- [ ] Confirmar `sale_id` guardado.
- [ ] Si la venta tiene pedido, confirmar `order_id` guardado.

### 5. Duplicados

- [ ] Intentar crear domicilio para pedido que ya tiene domicilio.
- [ ] Confirmar alerta de domicilio existente.
- [ ] Confirmar boton `Ver/Gestionar domicilio`.
- [ ] Intentar crear domicilio para venta/factura que ya tiene domicilio.
- [ ] Confirmar alerta de domicilio existente.
- [ ] Confirmar que el formulario no crea duplicado.

### 6. No regresion

- [ ] Listado de domicilios funciona.
- [ ] Detalle de domicilio funciona.
- [ ] Estados de domicilio funcionan.
- [ ] Repartidores siguen funcionando.
- [ ] Filtro por pedido funciona.
- [ ] Filtro por venta funciona.

## Validaciones tecnicas ejecutadas

- [x] `cd web && npx.cmd tsx --test modules/deliveries/*.spec.ts modules/deliveries/services/*.spec.ts`
- [x] `cd web && npm.cmd run lint`
- [x] `cd web && npm.cmd run build`
- [x] `cd api && npx.cmd tsx --test src/modules/inventory/services/customer.service.spec.ts src/modules/inventory/services/order.service.spec.ts src/modules/inventory/services/sale.service.spec.ts src/modules/deliveries/deliveries.service.spec.ts`
- [x] `cd api && npm.cmd run build`

## No impacto

- Caja/recaudo tocado: NO.
- Pagos tocados: NO.
- POS tocado: NO, solo lectura de ventas con permiso existente.
- Facturacion fiscal/electronica tocada: NO.
- Inventario tocado: NO.
- SQL destructivo: NO.
- Commit realizado: NO.
