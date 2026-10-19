## MODIFIED Requirements

### Requirement: Producto enriquecido

El sistema SHALL permitir que un producto tenga informacion operativa adicional sin romper los campos actuales (`name`, `sku`, `price`, `cost`, `unitId`, `taxId`, `isActive`).

#### Scenario: Producto existente sin campos nuevos

- **WHEN** se consulta desde `api` o `web` un producto creado antes del cambio
- **THEN** el producto SHALL seguir siendo valido y los campos nuevos SHALL tener defaults compatibles o valores nulos permitidos.

#### Scenario: Producto nuevo con configuracion operativa

- **WHEN** un usuario autorizado crea un producto con atributos operativos
- **THEN** el sistema SHALL guardar si el producto es perecedero, si requiere lote, si requiere vencimiento, su clasificacion operativa y su estado.

#### Scenario: Edicion de atributos no estructurales

- **WHEN** un usuario autorizado edita clasificacion, estado, umbrales u otros atributos permitidos de un producto existente
- **THEN** el sistema SHALL guardar esos cambios sin alterar su configuracion estructural.

## ADDED Requirements

### Requirement: Configuracion estructural inmutable del producto

El sistema SHALL permitir definir `unitId`, `saleType`, `measurementUnit`, `isPerishable`, `requiresLot` y `requiresExpiration` durante la creacion y SHALL impedir cambios reales en esos campos despues del primer guardado.

#### Scenario: Creacion con configuracion estructural valida

- **WHEN** un usuario autorizado crea un producto con una combinacion valida de los seis campos estructurales
- **THEN** el sistema SHALL persistir la configuracion seleccionada.

#### Scenario: Edicion web de producto existente

- **WHEN** un usuario abre la edicion de un producto existente
- **THEN** los controles estructurales SHALL estar deshabilitados y la interfaz SHALL explicar que solo pueden definirse al crear.

#### Scenario: Cambio estructural por API directa

- **WHEN** una actualizacion parcial o completa contiene un valor estructural diferente al persistido
- **THEN** el backend SHALL rechazar toda la solicitud antes de persistir cambios.

#### Scenario: Reenvio de valores estructurales identicos

- **WHEN** un cliente historico envia valores estructurales iguales a los persistidos junto con cambios permitidos
- **THEN** el backend SHALL aceptar la actualizacion permitida.

#### Scenario: Producto sin movimientos

- **WHEN** se intenta cambiar la configuracion estructural de un producto que aun no tiene movimientos
- **THEN** el backend SHALL rechazar el cambio de la misma forma que para un producto con movimientos.

#### Scenario: Aislamiento por tenant

- **WHEN** se actualiza un producto
- **THEN** la lectura de baseline y la escritura SHALL estar limitadas al `tenantId` autorizado.

#### Scenario: Producto historico

- **WHEN** se edita un atributo permitido de un producto creado antes de esta regla
- **THEN** el sistema SHALL conservar su configuracion estructural actual sin exigir una migracion de datos.
