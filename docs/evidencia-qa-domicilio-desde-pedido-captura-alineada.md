# Evidencia QA - Domicilio desde pedido captura alineada

## Objetivo

Validar que el modal `Domicilio` desde pedidos capture la informacion operativa esencial y sea usable en pantallas pequenas.

## Casos

### 1. Abrir pedido sin domicilio

- Modal abre correctamente.
- Modal tiene scroll interno.
- Acciones son accesibles.

Estado: pendiente QA manual.

### 2. Crear domicilio desde pedido

- Contacto precargado.
- Telefono precargado si el cliente lo tiene.
- Direccion precargada si el cliente la tiene y editable.
- Valor domicilio editable.
- Repartidor seleccionable.
- Metodo de pago seleccionable.
- Subtotal viene del pedido.
- Total se calcula como subtotal + valor domicilio.

Estado: cubierto parcialmente por tests/helpers; pendiente QA manual.

### 3. Confirmar resultado

- Domicilio tiene `order_id`.
- Tiene `driver_id` si se selecciono.
- Tiene `payment_method_id` si se selecciono.
- Tiene `cash_session_id` si se creo con caja actual.
- Aparece en `Domicilios` con `cash_scope=current`.

Estado: pendiente QA manual.

### 4. Pedido con domicilio existente

- No crea duplicado.
- Muestra domicilio existente.
- Permite ver detalle o abrir en Domicilios.

Estado: backend cubierto; pendiente QA manual.

### 5. Responsive

- Modal usable en movil/ancho reducido.
- Sin overflow horizontal.

Estado: pendiente QA manual.

### 6. No regresion

- Pedidos siguen listando.
- Crear pedido no cambia.
- Facturar pedido no cambia.
- POS no cambia.
- Facturacion fiscal/electronica no cambia.

Estado: pendiente QA manual.

## Confirmaciones tecnicas

- POS tocado: NO.
- Facturacion fiscal/electronica tocada: NO.
- Pagos alterados: NO.
- Inventario alterado: NO.
- SQL destructivo: NO.
- Commit realizado: NO.
