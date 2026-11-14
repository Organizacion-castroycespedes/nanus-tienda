## ADDED Requirements

### Requirement: Producto con serie obligatoria
El sistema SHALL permitir marcar al crear un producto que requiere número de serie por unidad, solo si es inventariable, de venta por unidad (`UNIT` con unidad `UND`) y no requiere lote. El sistema SHALL tratar la marca como configuración estructural que no se puede cambiar después de la creación.

#### Scenario: Creación válida
- **WHEN** se crea un producto inventariable de venta por unidad, sin lote, con "requiere serie"
- **THEN** el producto queda creado con `requires_serial = true`

#### Scenario: Combinación no permitida
- **WHEN** se intenta crear un producto con "requiere serie" que se vende por peso, no es inventariable o requiere lote
- **THEN** el sistema rechaza la creación con un mensaje claro

#### Scenario: Activación en un producto existente
- **WHEN** se intenta activar o desactivar "requiere serie" en un producto ya creado
- **THEN** el sistema rechaza el cambio por ser configuración estructural
