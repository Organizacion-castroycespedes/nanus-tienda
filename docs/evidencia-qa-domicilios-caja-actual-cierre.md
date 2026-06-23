# Evidencia QA - Domicilios con caja actual y cierre

Fecha: 2026-06-22

Cambio OpenSpec: `integrar-domicilios-con-caja-actual`

Estado: preparado para QA manual. Validacion tecnica ejecutada por agente.

## Decision funcional

- Consulta logistica de domicilios queda disponible sin caja abierta segun permisos.
- Creacion o cambio operativo de un domicilio con impacto de caja requiere caja abierta actual.
- Impacto de caja existe cuando `delivery_fee > 0` o hay `payment_method_id`.
- Asignar/cambiar repartidor no requiere caja porque es accion logistica.
- Cierre de caja suma solo `delivery_fee` de domicilios entregados.
- No se suma `subtotal` ni `total` del domicilio para evitar duplicar ventas/pedidos.

## Casos manuales

### 1. USER sin caja abierta

Pasos:

1. Iniciar sesion como USER/POS_USER sin caja abierta.
2. Abrir `/{tenant}/deliveries`.
3. Confirmar banner de caja requerida/gestion limitada.
4. Intentar crear domicilio con `delivery_fee > 0`.

Esperado:

- Se permite consulta si tiene permiso.
- Se bloquea operacion con impacto de caja.
- Se muestra accion para ir a POS / seleccionar caja.

Estado: pendiente QA manual.

### 2. USER con caja abierta

Pasos:

1. Abrir caja desde POS.
2. Abrir `/{tenant}/deliveries/new`.
3. Crear domicilio con valor domicilio.
4. Abrir listado `/{tenant}/deliveries`.

Esperado:

- Domicilio guarda `cash_session_id`, `cash_register_id`, `terminal_id`.
- Listado lo muestra con badge `Caja actual`.
- Vista por defecto usa scope de caja actual.

Estado: pendiente QA manual.

### 3. Entregado

Pasos:

1. Tomar domicilio con caja actual y `delivery_fee > 0`.
2. Cambiar estado hasta entregado.
3. Consultar resumen/cierre de caja.

Esperado:

- Estado cambia solo si la caja actual coincide.
- `delivery_fee` entra al resumen de cierre como domicilios.
- No se duplica total de venta/pedido.

Estado: pendiente QA manual.

### 4. Cancelado/no entregado

Pasos:

1. Crear domicilio con valor.
2. Cancelar o marcar no entregado.
3. Consultar cierre.

Esperado:

- Domicilio cuenta como excluido/no recaudado.
- No suma `delivery_fee` al total recaudado.

Estado: pendiente QA manual.

### 5. Cierre caja

Pasos:

1. Crear y entregar domicilios con valor en caja actual.
2. Cerrar caja.
3. Revisar resumen de cierre.

Esperado:

- Resumen incluye cantidad entregada, pendiente/excluida y total `delivery_fee`.
- Desglose por metodo de pago aparece cuando aplica.
- Ventas no quedan duplicadas.

Estado: pendiente QA manual.

### 6. Ticket cierre

Pasos:

1. Generar ticket PDF de cierre.
2. Revisar seccion `DOMICILIOS`.

Esperado:

- Ticket muestra entregados, pendientes/despachados, cancelados/no entregados.
- Ticket muestra total valor domicilio.
- Ticket mantiene secciones existentes.

Estado: pendiente QA manual.

### 7. Roles

Pasos:

1. USER/POS_USER con caja abierta entra al listado.
2. ADMIN/SUPER_USER entra al listado.

Esperado:

- USER/POS_USER ve scope operativo de caja actual por defecto.
- ADMIN/SUPER_USER puede cambiar a consulta general cuando tenga permiso.

Estado: pendiente QA manual.

## Validacion tecnica

- API focused tests: PASS.
- Backend-reporteria focused tests: PASS.
- Web focused tests: PASS.
- API build: PASS.
- Backend-reporteria build: PASS.
- Web lint/build: PASS con warnings preexistentes de lint.

## No regresion esperada

- Facturacion fiscal/electronica no cambia.
- Inventario no cambia.
- Pagos existentes no cambian.
- No se crean movimientos de caja automaticos.
- No se abre ni cierra caja desde domicilios.
