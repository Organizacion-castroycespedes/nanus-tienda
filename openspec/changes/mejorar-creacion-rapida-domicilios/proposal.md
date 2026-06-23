## Why

La creacion manual de domicilios hoy obliga al vendedor a escribir IDs tecnicos como `branch_id`, `customer_id`, `order_id`, `sale_id` y `payment_method_id`. Eso sirve para prueba tecnica, pero no para operacion de tienda, donde el usuario necesita buscar cliente, escoger datos visibles y guardar rapido.

## What Changes

- Reemplazar campos visibles de IDs tecnicos en `/{tenant}/deliveries/new` o el flujo equivalente de creacion por selectores, buscadores y etiquetas operativas.
- Permitir buscar y seleccionar cliente, precargando contacto, telefono y direccion cuando existan datos disponibles.
- Permitir elegir direccion de cliente cuando haya varias fuentes disponibles, manteniendo captura manual cuando falte informacion.
- Reemplazar `payment_method_id` por selector de metodos de pago activos.
- Resolver sucursal desde sesion/contexto autenticado cuando exista; si no existe, mostrar selector de sucursal.
- Permitir seleccionar pedido del cliente y venta/factura del cliente como referencias opcionales.
- Autocalcular subtotal y total cuando el domicilio venga de pedido o venta; conservar creacion manual basica cuando no haya fuente.
- Validar campos minimos con mensajes visibles no tecnicos: cliente o contacto/telefono, direccion y valor domicilio cuando aplique.
- Mantener responsive sin overflow horizontal.
- Mantener caja, POS, facturacion electronica, pedidos funcionales, recaudo contraentrega, repartidores y estados operativos fuera del cambio.

## Capabilities

### New Capabilities
- `deliveries-quick-create`: Cubre la creacion operativa rapida de domicilios en frontend con selectores, precarga de cliente, sucursal inferida, referencias opcionales a pedido/venta y validaciones no tecnicas.

### Modified Capabilities

## Impact

- Frontend: `web/app/[tenant]/deliveries/**` y `web/modules/deliveries/**`.
- Servicios frontend reutilizados o extendidos: clientes, pedidos, ventas/facturas disponibles, metodos de pago y sucursales.
- API: usar endpoints existentes cuando basten; si falta busqueda/listado minimo para selectores, agregar endpoints de solo lectura y tenant-safe dentro del alcance de domicilios o catalogos existentes.
- Sin cambios en caja, POS, facturacion electronica, flujo funcional de pedidos, repartidores, estados operativos ni SQL destructivo.
