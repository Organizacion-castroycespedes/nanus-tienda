## ADDED Requirements

### Requirement: Edicion de compra en borrador

El sistema SHALL permitir editar proveedor, tipo, productos, cantidades y costos de una compra solo mientras este en estado `DRAFT`, sin cantidades recibidas ni movimientos de inventario. La sucursal, la terminal, el estado y la fecha de creacion MUST NOT ser editables. Cada edicion SHALL auditarse como `PURCHASE_DRAFT_UPDATED`.

#### Scenario: Editar un borrador

- **WHEN** un usuario autorizado guarda cambios sobre una compra `DRAFT`
- **THEN** el sistema SHALL reemplazar los renglones, recalcular total y saldo, conservar el estado `DRAFT` y no SHALL crear movimientos de inventario.

#### Scenario: Compra ya confirmada

- **WHEN** se intenta editar una compra en `PENDING`, `PARTIAL`, `RECEIVED`, `CERRADA_PARCIAL` o `CANCELLED`
- **THEN** el sistema SHALL rechazar la edicion con conflicto y no SHALL modificar renglones.

#### Scenario: Total menor a lo pagado

- **WHEN** el nuevo total del borrador es menor al total ya pagado
- **THEN** el sistema SHALL rechazar la edicion.

### Requirement: Confirmacion de compra

El sistema SHALL ofrecer una accion explicita para confirmar un borrador, pasando de `DRAFT` a `PENDING`, solo si tiene al menos un producto. La confirmacion MUST NOT mover inventario, pagos ni caja y SHALL auditarse como `PURCHASE_CONFIRMED`.

#### Scenario: Confirmar borrador

- **WHEN** un usuario autorizado confirma un borrador con productos
- **THEN** el sistema SHALL dejar la compra en `PENDING` y SHALL bloquear su edicion posterior.

#### Scenario: Confirmar compra que no es borrador

- **WHEN** se intenta confirmar una compra que no esta en `DRAFT`
- **THEN** el sistema SHALL rechazar la operacion sin cambiar el estado.

### Requirement: Recepcion solo de compras confirmadas

El sistema SHALL rechazar la recepcion de una compra en `DRAFT` antes de cualquier efecto de inventario; la logica de recepcion para compras confirmadas MUST permanecer sin cambios.

#### Scenario: Recibir un borrador

- **WHEN** se envia una recepcion para una compra `DRAFT`
- **THEN** el sistema SHALL rechazarla indicando que debe confirmarse primero y no SHALL crear movimientos, lotes, series ni cambios en renglones.

### Requirement: Confirmacion con advertencia en acciones de compra

La interfaz de compras SHALL pedir confirmacion con un texto de advertencia antes de guardar un borrador, guardar cambios de un borrador, confirmar una compra, registrar un pago, cancelar y liquidar.

#### Scenario: Usuario desiste

- **WHEN** el usuario cancela el dialogo de confirmacion
- **THEN** la interfaz SHALL volver al formulario sin enviar la operacion.

### Requirement: Busqueda por factura del proveedor

El listado de compras SHALL mostrar el numero de factura del proveedor despues del proveedor, vacio cuando no exista, y el buscador SHALL filtrar por ese numero.

#### Scenario: Buscar por factura

- **WHEN** el usuario busca un numero de factura registrado en una recepcion
- **THEN** el listado SHALL mostrar las compras cuyo numero de factura coincide.
