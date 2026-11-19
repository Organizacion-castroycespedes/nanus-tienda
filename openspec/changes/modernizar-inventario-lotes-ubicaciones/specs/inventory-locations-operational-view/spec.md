## ADDED Requirements

### Requirement: Filtros de ubicaciones colapsables
La vista `/inventory/locations` SHALL mostrar Sucursal, Tipo, Estado y Filas en un panel colapsable oculto por defecto, con búsqueda compacta visible y chips de filtros aplicados.

#### Scenario: Primera visita
- **WHEN** el usuario abre `/inventory/locations` sin preferencia guardada
- **THEN** el panel está oculto, la búsqueda está visible y el estado "Activas" aplicado por defecto no cuenta como filtro activo

#### Scenario: Sin desbordamiento
- **WHEN** se abre en 1024×768 con el panel visible
- **THEN** los controles envuelven en varias filas sin desplazamiento horizontal global

### Requirement: Búsqueda única y Limpiar coherente
La búsqueda de ubicaciones SHALL resolverse en el servidor y "Limpiar" SHALL recargar con los filtros por defecto si ya existía una consulta.

#### Scenario: Limpiar tras consultar inactivas
- **WHEN** el usuario consultó Estado "Inactivas" y presiona "Limpiar"
- **THEN** se consulta de nuevo con Estado "Activas" y la tabla muestra ese resultado

### Requirement: Sucursal legible
La tabla SHALL mostrar el nombre de la sucursal o "Sucursal no disponible", y SHALL NOT mostrar el UUID de la sucursal.

#### Scenario: Sucursal no resuelta
- **WHEN** la carga de sucursales falla
- **THEN** la columna Sucursal muestra "Sucursal no disponible" y se ve el aviso de sucursales

### Requirement: Navegación a lotes
Cada ubicación SHALL ofrecer la acción "Ver lotes" que abre `/inventory/lots` filtrado por su sucursal y ubicación, disponible para cualquier usuario con lectura de inventario.

#### Scenario: Ver lotes de una ubicación
- **WHEN** el usuario elige "Ver lotes" en la ubicación L1 de la sucursal B1
- **THEN** navega a `/{tenant}/inventory/lots?branchId=B1&locationId=L1`

### Requirement: Aviso de saldo al inactivar
Antes de confirmar la inactivación, la vista SHALL consultar los saldos disponibles de la ubicación y SHALL informar su cantidad sin bloquear la acción.

#### Scenario: Ubicación con saldo
- **WHEN** el usuario pide inactivar una ubicación con 3 saldos y 40 unidades disponibles
- **THEN** la confirmación indica que 3 saldos con 40 unidades seguirán asociados a la ubicación y permite "Inactivar" o "Cancelar"

#### Scenario: Falla la consulta de saldos
- **WHEN** la consulta de saldos falla
- **THEN** la confirmación indica que no se pudo verificar el saldo y permite continuar o cancelar

### Requirement: Reactivación de ubicaciones
La vista SHALL ofrecer "Reactivar" en ubicaciones inactivas a usuarios con `inventory.update`, usando `PUT /inventory/locations/:id` con `isActive: true`.

#### Scenario: Reactivación exitosa
- **WHEN** un `ADMIN` reactiva una ubicación inactiva cuyo código no está en uso
- **THEN** se muestra "Ubicación reactivada correctamente." y la lista se recarga

#### Scenario: Código en uso
- **WHEN** otra ubicación activa de la misma sucursal usa el mismo código
- **THEN** se muestra el error devuelto por el backend y la ubicación sigue inactiva

#### Scenario: Usuario sin permiso
- **WHEN** un usuario sin `inventory.update` abre el menú de acciones de una ubicación inactiva
- **THEN** no ve "Reactivar"

### Requirement: Precarga desde el detalle de lote
La vista de ubicaciones SHALL precargar `branchId` y `search` recibidos en la URL sin consultar hasta que el usuario presione "Buscar", y SHALL ignorar una sucursal ajena para roles no super.

#### Scenario: Llegada desde "Ver ubicación"
- **WHEN** el usuario abre `/inventory/locations?branchId=B1&search=002`
- **THEN** la búsqueda muestra "002", la sucursal B1 queda seleccionada y el estado vacío dice "Filtros precargados. Presiona Buscar."
