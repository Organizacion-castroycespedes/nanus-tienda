## ADDED Requirements

### Requirement: Tipo de producto seleccionable al crear

El frontend SHALL permitir seleccionar `is_inventoryable` como `Producto inventariable` o `Servicio / no inventariable` durante la creacion y SHALL enviar la seleccion en el payload de creacion.

#### Scenario: Crear producto inventariable

- **WHEN** el usuario abre el formulario en modo creacion y selecciona `Producto inventariable`
- **THEN** el control SHALL estar habilitado y el payload SHALL contener `isInventoryable: true`.

#### Scenario: Crear servicio

- **WHEN** el usuario abre el formulario en modo creacion y selecciona `Servicio / no inventariable`
- **THEN** el control SHALL estar habilitado y el payload SHALL contener `isInventoryable: false`.

### Requirement: Tipo de producto inmutable en edicion frontend

El frontend SHALL mostrar el `is_inventoryable` persistido para productos existentes y SHALL impedir cambiarlo mediante el formulario de edicion.

#### Scenario: Editar producto inventariable

- **WHEN** el usuario abre un producto existente con `isInventoryable: true`
- **THEN** el formulario SHALL mostrar `Producto inventariable`, el control SHALL estar deshabilitado y la explicacion SHALL indicar que el tipo solo se define al crear.

#### Scenario: Editar servicio

- **WHEN** el usuario abre un producto existente con `isInventoryable: false`
- **THEN** el formulario SHALL mostrar `Servicio / no inventariable`, el control SHALL estar deshabilitado y el valor SHALL permanecer `false`.

#### Scenario: Edicion parcial conserva el tipo

- **WHEN** el usuario edita otro atributo autorizado de un producto existente
- **THEN** el payload de actualizacion SHALL omitir `isInventoryable` y `inventoryabilityChangeReason`, y SHALL conservar los demas cambios autorizados.

#### Scenario: Motivo de cambio no aplica

- **WHEN** el usuario edita un producto existente
- **THEN** el campo `Motivo del cambio a servicio` SHALL permanecer oculto, sin importar el tipo persistido.
