## ADDED Requirements

### Requirement: Entrega de servicios en pedidos

El sistema SHALL permitir entregar lineas de productos no inventariables de un pedido sin validar stock y sin crear movimientos de inventario, lotes ni series, registrando la cantidad entregada.

#### Scenario: Pedido con un servicio

- **WHEN** se entrega un pedido cuya linea es un servicio sin saldo en inventario
- **THEN** el sistema SHALL registrar la entrega sin movimiento OUT.

#### Scenario: Pedido mixto

- **WHEN** se entrega un pedido con un servicio y un producto fisico con stock suficiente
- **THEN** el sistema SHALL crear el movimiento OUT solo para el producto fisico.

### Requirement: Mensaje de productos sin saldo

El sistema SHALL rechazar la entrega sin efectos cuando algun producto fisico no tenga stock suficiente y SHALL informar cada producto con su disponible y la cantidad a entregar.

#### Scenario: Dos productos sin saldo

- **WHEN** dos productos fisicos del pedido no alcanzan
- **THEN** el mensaje SHALL nombrar ambos productos y ningun movimiento SHALL crearse.
