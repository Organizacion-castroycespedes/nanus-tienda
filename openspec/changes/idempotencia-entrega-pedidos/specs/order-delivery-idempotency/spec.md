## ADDED Requirements

### Requirement: Clave de idempotencia obligatoria en la entrega de pedidos
El sistema SHALL exigir el encabezado `Idempotency-Key` en `POST /orders/:id/deliver` y SHALL rechazar la petición sin efectos cuando falte.

#### Scenario: Entrega sin clave
- **WHEN** se envía una entrega sin encabezado `Idempotency-Key`
- **THEN** el sistema responde 400 y no crea movimientos ni cambia el pedido

### Requirement: Reintento de una entrega
El sistema SHALL devolver el resultado guardado, sin volver a entregar, cuando recibe de nuevo la misma clave con la misma petición, y SHALL responder 409 cuando la clave se reutiliza con una petición distinta.

#### Scenario: Doble clic o reintento de red
- **WHEN** un pedido de 10 unidades recibe dos veces la entrega de 5 con la misma clave y el mismo contenido
- **THEN** existe una sola salida de 5, el pendiente queda en 5 y ambas respuestas son iguales

#### Scenario: Misma clave con otro contenido
- **WHEN** se reutiliza una clave ya completada con cantidades distintas
- **THEN** el sistema responde 409 y no crea movimientos

### Requirement: Entregas concurrentes del mismo pedido
El sistema SHALL serializar las entregas de un mismo pedido para que la suma entregada nunca supere la cantidad pedida.

#### Scenario: Dos usuarios entregan a la vez
- **WHEN** dos usuarios entregan simultáneamente 6 unidades de un pedido con 10 pendientes, con claves distintas
- **THEN** una entrega se completa y la otra se rechaza porque excede la cantidad pendiente, sin movimientos

#### Scenario: Comportamiento actual intacto
- **WHEN** se entrega un pedido con una clave nueva
- **THEN** la salida, el consumo FEFO de lotes y el cambio de estado son los mismos que antes de este change
