# Delta spec: cash-session-operations

## ADDED Requirements

### Requirement: Cash close operational dialog

El sistema SHALL mostrar el resultado de cierre de caja con `web/components/design-system/NoticeDialog.tsx`.

#### Scenario: Cierre exitoso muestra resumen y acciones

- GIVEN un usuario autorizado tiene una caja abierta
- WHEN cierra la caja correctamente
- THEN la UI SHALL mostrar `NoticeDialog` variant `success`
- AND SHALL mostrar el mensaje "Caja cerrada correctamente"
- AND SHOULD mostrar monto apertura, entradas, salidas, esperado, real, diferencia y fecha/hora de cierre cuando el backend entregue esos datos
- AND SHALL ofrecer acciones para ver ticket, descargar PDF e imprimir.

#### Scenario: Cierre fallido no cambia estado operativo

- GIVEN un usuario autorizado intenta cerrar una caja abierta
- WHEN el backend rechaza el cierre o falla la peticion
- THEN la UI SHALL mostrar `NoticeDialog` variant `error` o `warning`
- AND SHALL NOT disparar impresion
- AND SHALL NOT marcar la caja como cerrada en frontend
- AND SHALL mantener visible el formulario para reintento.

### Requirement: Cash closing ticket flow

El sistema SHALL permitir visualizar, descargar e imprimir el ticket de cierre despues de un cierre exitoso.

#### Scenario: Ticket posterior al cierre

- GIVEN el cierre de caja finalizo correctamente
- WHEN el usuario selecciona una accion de ticket
- THEN el sistema SHALL usar el patron PDF existente del proyecto
- AND SHALL permitir vista previa, descarga e impresion del ticket de cierre.

#### Scenario: Impresion bloqueada por navegador

- GIVEN el cierre fue exitoso
- WHEN el navegador bloquea popup o impresion automatica
- THEN el sistema SHALL mantener acceso manual al ticket
- AND SHALL mostrar feedback operativo sin revertir el cierre.

### Requirement: Cash sessions ticket actions

La vista `/{tenantId}/finance/cash-sessions` SHALL exponer acciones de ticket para sesiones cerradas.

#### Scenario: Sesion cerrada muestra acciones

- GIVEN el historial contiene una sesion de caja con status `CLOSED`
- WHEN el usuario autorizado visualiza la fila o tarjeta
- THEN la UI SHALL mostrar acciones Ver ticket, Descargar PDF e Imprimir.

#### Scenario: Sesion abierta no tiene ticket de cierre

- GIVEN el historial contiene una sesion `OPEN`
- WHEN el usuario visualiza la fila o tarjeta
- THEN la UI SHALL no mostrar acciones de ticket o SHALL mostrarlas deshabilitadas
- AND SHALL dejar claro que aun no hay ticket de cierre.

#### Scenario: Error de ticket

- GIVEN el usuario intenta abrir, descargar o imprimir un ticket
- WHEN el backend responde no encontrado, no autorizado o error
- THEN la UI SHALL mostrar feedback entendible
- AND SHALL NOT ocultar la sesion del historial.

### Requirement: Cash closing ticket authorization

El sistema SHALL autorizar tickets de cierre sin exponer datos de otro tenant ni de sesiones ajenas no autorizadas.

#### Scenario: USER accede a ticket autorizado

- GIVEN un `USER` solicita un ticket de cierre de su tenant, sucursal y sesion autorizada
- WHEN llama el endpoint de ticket
- THEN el backend SHALL permitir la respuesta PDF.

#### Scenario: USER no accede a sesion ajena

- GIVEN un `USER` solicita un ticket de cierre de otra sucursal, otro usuario no autorizado u otro tenant
- WHEN llama el endpoint de ticket
- THEN el backend SHALL negar el acceso o no devolver el ticket
- AND SHALL NOT exponer datos cross-tenant.

#### Scenario: Roles administrativos respetan alcance

- GIVEN `ADMIN`, `SUPER_USER` o `SUPER_ADMIN` solicitan ticket de cierre
- WHEN el ticket pertenece a su alcance autorizado
- THEN el backend SHALL permitir la respuesta
- AND SHALL mantener las reglas existentes de tenant y sucursal.

### Requirement: POS requires open cash session

El POS SHALL impedir operacion de venta si el usuario no tiene caja abierta.

#### Scenario: Menu muestra POS no operativo sin caja

- GIVEN el usuario autenticado no tiene caja abierta
- WHEN visualiza el menu lateral
- THEN POS SHALL mostrarse desactivado o como requiere caja abierta
- AND SHALL ofrecer camino a `/{tenantId}/pos/select-context`.

#### Scenario: Navegacion directa a POS sin caja

- GIVEN el usuario no tiene caja abierta
- WHEN navega directo a `/{tenantId}/pos`
- THEN la UI SHALL bloquear la operacion
- AND SHALL explicar que debe abrir caja
- AND SHALL mostrar CTA a `/{tenantId}/pos/select-context`.

#### Scenario: POS habilitado con caja abierta

- GIVEN el usuario tiene caja abierta
- WHEN entra al POS
- THEN el flujo actual SHALL seguir operativo.

### Requirement: POS context selection before opening cash

El sistema SHALL obligar seleccion de contexto en `/{tenantId}/pos/select-context` antes de abrir caja.

#### Scenario: USER o ADMIN usa sucursal asignada

- GIVEN un `USER` o `ADMIN` entra a seleccion de contexto
- WHEN carga la vista
- THEN su sucursal SHALL mostrarse fija o readonly
- AND las terminales SHALL pertenecer solo a esa sucursal y tenant.

#### Scenario: SUPER_USER o SUPER_ADMIN selecciona sucursal del tenant

- GIVEN un `SUPER_USER` o `SUPER_ADMIN` entra a seleccion de contexto
- WHEN selecciona una sucursal autorizada
- THEN la lista de terminales SHALL corresponder solo a esa sucursal y tenant.

#### Scenario: Contexto invalido bloquea apertura

- GIVEN se intenta abrir caja con sucursal o terminal no autorizada
- WHEN se envia la apertura
- THEN el sistema SHALL rechazar la operacion
- AND SHALL NOT crear caja cross-tenant ni cross-branch.

### Requirement: Open shift management

El sistema SHALL ofrecer una gestion de turno asociada a la caja abierta actual.

#### Scenario: Turno muestra datos de la caja abierta

- GIVEN el usuario tiene una caja abierta
- WHEN entra a gestion de turno
- THEN la UI SHALL mostrar resumen de ventas POS, pedidos, compras, movimientos, arqueo y tickets asociados a esa caja
- AND SHALL NOT mezclar cajas cerradas, sucursales no autorizadas ni otros tenants.

#### Scenario: Turno sin datos muestra empty states

- GIVEN la caja abierta no tiene ventas, pedidos, compras, movimientos o tickets
- WHEN el usuario consulta gestion de turno
- THEN la UI SHALL mostrar empty states operativos.
