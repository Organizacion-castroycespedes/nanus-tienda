## ADDED Requirements

### Requirement: Recepcion basada en cantidades pendientes

El sistema SHALL calcular la cantidad pendiente por linea de compra usando la cantidad pedida menos la cantidad ya recibida.

#### Scenario: Ocultar linea completamente recibida

- **GIVEN** una compra con una linea de arroz pedida por 15 unidades
- **AND** la linea de arroz ya tiene 15 unidades recibidas
- **WHEN** el usuario abre el formulario de recepcion
- **THEN** el sistema SHALL NOT mostrar la linea de arroz como pendiente de recepcion
- **AND** el sistema SHALL NOT pedir lote ni informacion adicional para esa linea.

#### Scenario: Mostrar linea parcialmente pendiente

- **GIVEN** una compra con una linea de azucar pedida por 15 unidades
- **AND** la linea de azucar tiene 0 unidades recibidas
- **WHEN** el usuario abre el formulario de recepcion
- **THEN** el sistema SHALL mostrar la linea de azucar con pendiente 15.

#### Scenario: Permitir recepcion parcial de lineas

- **GIVEN** una compra con cafe pedido por 15 unidades
- **AND** leche pedida por 20 litros
- **WHEN** el usuario recibe 15 unidades de cafe
- **AND** no recibe leche en esta operacion
- **THEN** el sistema SHALL permitir confirmar la recepcion
- **AND** el sistema SHALL registrar la recepcion del cafe
- **AND** el sistema SHALL conservar la leche como pendiente.

#### Scenario: Rechazar cantidad mayor al pendiente

- **GIVEN** una linea con pendiente 5
- **WHEN** el usuario intenta recibir 6
- **THEN** el sistema SHALL bloquear la confirmacion con una validacion clara.

#### Scenario: Bloquear confirmacion vacia

- **GIVEN** una compra con lineas pendientes
- **WHEN** el usuario no ingresa ninguna cantidad recibida mayor a cero
- **THEN** el sistema SHALL NOT enviar la recepcion
- **AND** el sistema SHALL mostrar un mensaje indicando que debe ingresar al menos una cantidad a recibir.

#### Scenario: Compra sin pendientes

- **GIVEN** una compra con todas sus lineas completamente recibidas
- **WHEN** el usuario abre el formulario de recepcion
- **THEN** el sistema SHALL mostrar un estado indicando que no hay productos pendientes por recibir
- **AND** el sistema SHALL deshabilitar la confirmacion de recepcion.
