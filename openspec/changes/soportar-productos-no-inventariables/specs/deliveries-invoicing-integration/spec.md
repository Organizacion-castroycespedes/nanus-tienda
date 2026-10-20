## MODIFIED Requirements

### Requirement: Backend sales delivery integration is implemented

El sistema SHALL exponer endpoints controlados para crear y consultar entregas desde `sales`, manteniendo el flujo de facturacion existente y sin generar efectos fisicos para lineas no inventariables.

#### Scenario: Authorized user queries delivery by sale

- **WHEN** un usuario autorizado llama `GET /api/sales/:id/delivery` con `DELIVERIES_VIEW`
- **THEN** el sistema SHALL devolver la entrega vinculada a la venta o `null`.

#### Scenario: Authorized user creates delivery from sale

- **WHEN** un usuario autorizado llama `POST /api/sales/:id/delivery` con `DELIVERIES_CREATE`
- **THEN** el sistema SHALL crear una entrega `CREATED` vinculada a la venta y guardar snapshot de cliente, contacto y direccion.

#### Scenario: Sale already has delivery

- **WHEN** existe una entrega para la venta o pedido vinculado
- **THEN** el sistema SHALL rechazar crear otra para el mismo documento financiero en v0.0.1.

#### Scenario: Service sale remains billable

- **WHEN** la venta contiene productos no inventariables
- **THEN** la entrega y facturacion SHALL conservar totales, impuestos, pagos y datos DIAN y SHALL no exigir stock, lote ni movimiento `OUT`.

#### Scenario: Mixed sale remains atomic

- **WHEN** la venta contiene lineas inventariables y no inventariables
- **THEN** la facturacion SHALL conservar atomicidad y SHALL aplicar movimientos solo a lineas inventariables.

#### Scenario: Sales backend remains unchanged for fiscal data

- **WHEN** se crea o consulta una entrega desde una venta
- **THEN** el sistema SHALL no cambiar totales, impuestos, pagos, caja ni contrato de facturacion electronica.

#### Scenario: Invoice annulment remains isolated

- **WHEN** la integracion de entregas se implementa
- **THEN** no SHALL alterar anulacion de factura hasta una fase explicita, pero cualquier reverso de inventario SHALL excluir lineas no inventariables.

## ADDED Requirements

### Requirement: Outbox fiscal de servicios

El evento de facturacion electronica de una venta de servicio o mixta SHALL usar el contrato outbox vigente y SHALL conservar snapshots fiscales.

#### Scenario: Servicio con DIAN

- **WHEN** una venta de servicio se publica para facturacion electronica
- **THEN** el consumidor SHALL recibir sus lineas comerciales y fiscales sin depender de un movimiento de inventario.
