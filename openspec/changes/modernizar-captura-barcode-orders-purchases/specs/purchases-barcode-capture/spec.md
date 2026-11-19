## ADDED Requirements

### Requirement: Captura de compras tipo factura de proveedor
El formulario de nueva compra SHALL presentarse como una factura de proveedor con cabecera (proveedor, sucursal, terminal, tipo) y tabla de líneas (código, producto, cantidad, costo unitario, subtotal), con barra de escaneo y búsqueda manual.

#### Scenario: Escaneo de un producto nuevo en la compra
- **WHEN** se escanea un producto que no está en la compra
- **THEN** se crea una línea con cantidad 1 y costo por defecto igual al costo del producto

#### Scenario: Escaneo repetido
- **WHEN** se escanea un producto que ya tiene línea
- **THEN** se incrementa la cantidad de esa línea y no se crea otra

#### Scenario: Costo editable
- **WHEN** el usuario cambia el costo unitario de una línea
- **THEN** el subtotal y el total se recalculan y escaneos posteriores no sobrescriben ese costo

### Requirement: Escanear no persiste ni mueve inventario
Escanear en la captura de compras SHALL NOT enviar solicitudes de escritura ni generar movimientos de inventario o pagos; la compra SHALL crearse solo con la acción de guardar existente, en estado `DRAFT`.

#### Scenario: Guardar la compra
- **WHEN** el usuario guarda la compra capturada por escaneo
- **THEN** se llama una sola vez a `POST /purchases` y no se registra ningún movimiento de inventario

### Requirement: Validaciones de la compra
El formulario SHALL exigir proveedor, sucursal, terminal y al menos una línea con cantidad mayor a 0 y costo mayor o igual a 0 antes de guardar.

#### Scenario: Línea con costo inválido
- **WHEN** una línea tiene costo negativo
- **THEN** el formulario no se envía y marca la línea con el error

### Requirement: Contexto y permisos
La captura de compras SHALL estar disponible solo para usuarios con la acción de crear compras habilitada y SHALL pedir confirmación y limpiar las líneas al cambiar la sucursal.

#### Scenario: Usuario sin permiso
- **WHEN** un usuario sin permiso de crear compras abre `/purchases`
- **THEN** no ve la acción de nueva compra ni la barra de escaneo

#### Scenario: Cambio de sucursal
- **WHEN** el usuario cambia la sucursal con líneas capturadas
- **THEN** el sistema pide confirmación y, si acepta, limpia las líneas
