## Context

La UI actual de Domicilios crea registros desde `web/modules/deliveries/components/CreateDeliveryForm.tsx`. El formulario envia `CreateDeliveryPayload`, pero muestra campos crudos como `branch_id`, `customer_id`, `order_id`, `sale_id` y `payment_method_id`.

El frontend ya tiene servicios reutilizables para catalogos:

- Clientes: `web/modules/inventory/services/customer.service.ts`.
- Pedidos: `web/modules/inventory/services/order.service.ts`.
- Metodos de pago: `web/modules/finance/services/finance.service.ts`.
- Sucursales: `web/domains/branches/api.ts`.
- Contexto de sucursal: `state.pos.branchId` y `state.auth.user.branchId`.

No hay una pagina `web/app/[tenant]/deliveries/new` en el estado revisado; la creacion vive dentro de `/{tenant}/deliveries` como modo inline. La implementacion puede agregar ruta `/{tenant}/deliveries/new` si se decide separar la pantalla, pero el contrato aplica al flujo visible de creacion de domicilio.

## Goals / Non-Goals

**Goals:**

- Convertir la creacion manual en un flujo operativo con buscador/selector de cliente, sucursal, metodo de pago, pedido y venta/factura.
- Precargar contacto, telefono y direccion desde el cliente o fuente seleccionada sin perder la captura manual.
- Inferir sucursal desde contexto cuando exista y mostrar selector solo cuando haga falta.
- Autocalcular subtotal y total desde pedido o venta/factura seleccionada.
- Mantener labels de negocio, validaciones claras y responsive sin overflow horizontal.
- Guardar usando el contrato actual de domicilios siempre que sea suficiente.

**Non-Goals:**

- No tocar caja ni crear movimientos financieros.
- No tocar POS ni flujo de ventas POS.
- No tocar facturacion electronica ni documentos fiscales.
- No cambiar funcionalmente pedidos, estados operativos, repartidores ni recaudo contraentrega.
- No introducir SQL destructivo.
- No crear permisos nuevos salvo bloqueo tecnico comprobado.

## Decisions

### Mantener el payload de delivery como contrato interno

La UI usara campos visibles de negocio y mapeara internamente a `CreateDeliveryPayload`. El usuario no escribe IDs, pero el submit conserva `customer_id`, `branch_id`, `order_id`, `sale_id` y `payment_method_id` cuando existan selecciones validas.

Alternativa considerada: cambiar el API para aceptar nombres visibles. Se descarta porque aumentaria superficie backend sin necesidad y duplicaria resolucion de IDs que el frontend puede manejar con catalogos tenant-safe.

### Usar catalogos existentes antes de crear endpoints

La implementacion debe reutilizar `getCustomers`, `getOrders`, `listPaymentMethods` y `listBranches` cuando alcancen. Si ventas/facturas o pedidos por cliente no tienen endpoint de lectura adecuado, se permite agregar un endpoint minimo de solo lectura y tenant-scoped para selector, sin mutar pedidos, ventas, POS, caja ni facturacion.

Alternativa considerada: cargar todos los documentos y filtrar siempre en cliente. Sirve para QA pequeno, pero no escala. Se acepta solo como fallback temporal si el volumen local es bajo y queda documentado.

### Resolver sucursal por prioridad operativa

La sucursal se resuelve en este orden:

1. `state.pos.branchId` cuando existe contexto operativo activo.
2. `state.auth.user.branchId` cuando el usuario tiene sucursal asignada.
3. Sucursal unica activa del tenant.
4. Selector de sucursal activa.

El valor resuelto se muestra como nombre de sucursal, no como UUID. Si el usuario tiene permiso/rol para operar varias sucursales, el selector permite cambiarla.

### Cliente primero, fuentes despues

El selector de cliente es el punto de entrada principal. Al seleccionar cliente, el formulario precarga `customer_name`, `customer_phone` y direccion. Luego filtra pedidos y ventas/facturas por ese cliente cuando el servicio lo soporte.

La creacion manual sigue disponible: si no hay cliente registrado, el vendedor puede capturar contacto, telefono y direccion.

### Totales desde fuente, manual sin fuente

Si se selecciona pedido o venta/factura, `subtotal` y `total` se precargan desde el total de la fuente. El valor de domicilio se captura o conserva como dato operativo cuando aplique, sin crear recaudo ni movimiento de caja. En modo manual sin fuente, subtotal, valor domicilio y total pueden diligenciarse segun los datos disponibles.

### Validacion orientada a vendedor

Los errores deben nombrar datos de negocio: "Selecciona cliente o escribe contacto y telefono", "Direccion requerida", "Selecciona metodo de pago" o "Valor domicilio requerido". No deben exponer `customer_id`, `order_id`, `sale_id`, `branch_id` o `payment_method_id` al vendedor.

## Risks / Trade-offs

- [Riesgo] Clientes, pedidos o ventas pueden no tener endpoints de busqueda paginada. -> Mitigacion: usar servicios existentes primero y limitar cualquier nuevo endpoint a lectura tenant-safe.
- [Riesgo] Cliente puede tener direccion incompleta o multiples fuentes de direccion. -> Mitigacion: mostrar selector cuando haya opciones y permitir direccion manual como override.
- [Riesgo] Autocalcular totales puede confundirse con recaudo. -> Mitigacion: mostrarlo solo como informacion del domicilio y no llamar servicios de caja, POS, pagos ni facturacion.
- [Riesgo] Sucursal inferida puede ser incorrecta si hay varios contextos. -> Mitigacion: mostrar nombre de sucursal resuelto y permitir selector cuando no haya contexto fuerte.
- [Riesgo] Formularios con muchos selectores pueden romper mobile. -> Mitigacion: usar grids responsivos, contenedores `min-w-0`, labels cortos y pruebas de lint/build mas revision visual.

## Migration Plan

1. Refactorizar el formulario de creacion sin cambiar la tabla `deliveries`.
2. Conectar catalogos y estados de carga/error.
3. Agregar endpoints de solo lectura solo si los servicios actuales no permiten alimentar selectores.
4. Ejecutar `openspec validate --all --strict`, `web` lint y build.
5. Rollback: volver al componente anterior o desactivar selectores manteniendo `CreateDeliveryPayload`.

## Open Questions

- Confirmar si producto quiere ruta dedicada `/{tenant}/deliveries/new` o mantener creacion inline en `/{tenant}/deliveries`.
- Confirmar fuente de ventas/facturas disponible para selector: endpoint de ventas operativo, reporteria o endpoint read-only nuevo.
