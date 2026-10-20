## MODIFIED Requirements

### Requirement: Backend can create and query delivery from order

El sistema SHALL exponer endpoints controlados para crear y consultar la entrega asociada a un pedido, sin cambiar el ciclo de vida existente, y SHALL aplicar las reglas de inventariabilidad al entregar o facturar sus lineas.

#### Scenario: Authorized user queries order delivery

- **WHEN** un usuario autorizado llama `GET /api/orders/:id/delivery` con `DELIVERIES_VIEW`
- **THEN** el sistema SHALL devolver la entrega vinculada o `null` y SHALL limitar la consulta por `tenant_id`.

#### Scenario: Authorized user creates delivery from order

- **WHEN** un usuario autorizado llama `POST /api/orders/:id/delivery` con `DELIVERIES_CREATE`
- **THEN** el sistema SHALL crear una entrega `CREATED` vinculada al pedido y guardar snapshot de cliente y direccion.

#### Scenario: Order address is incomplete

- **WHEN** el snapshot del pedido o cliente no entrega datos suficientes de direccion
- **THEN** la solicitud SHALL exigir `delivery_address`.

#### Scenario: Order belongs to another tenant

- **WHEN** un usuario intenta crear o consultar una entrega de un pedido de otro tenant
- **THEN** el sistema SHALL rechazar la solicitud.

#### Scenario: Order already has delivery

- **WHEN** existe cualquier entrega para el pedido
- **THEN** el sistema SHALL rechazar crear otra en v0.0.1, incluyendo estados finales hasta aprobar una regla futura.

#### Scenario: Service line delivery

- **WHEN** la entrega o facturacion contiene una linea de producto no inventariable
- **THEN** el sistema SHALL mantener cantidades y totales comerciales y SHALL no exigir stock, lote, FEFO ni movimiento `OUT` para esa linea.

#### Scenario: Order flow remains unchanged for physical lines

- **WHEN** se entrega un pedido con productos inventariables
- **THEN** el sistema SHALL conservar validacion de stock, lotes, FEFO, locks y trazabilidad existentes.

## ADDED Requirements

### Requirement: Entrega mixta atomica

Una operacion de entrega o facturacion que mezcle productos fisicos y servicios SHALL mantener una frontera transaccional unica cuando el flujo actual la soporte.

#### Scenario: Error en linea fisica

- **WHEN** una linea inventariable falla por stock o lote
- **THEN** la operacion SHALL revertir sus efectos y SHALL no dejar completada parcialmente la parte de servicios.
