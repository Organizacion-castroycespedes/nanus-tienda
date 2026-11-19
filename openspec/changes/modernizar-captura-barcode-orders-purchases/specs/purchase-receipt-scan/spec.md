## ADDED Requirements

### Requirement: Escaneo restringido a la compra
En la recepción de una compra el sistema SHALL resolver los códigos escaneados solo contra los productos de esa compra y SHALL tratar un producto ajeno como error sin modificar líneas.

#### Scenario: Producto de la compra
- **WHEN** se escanea un producto `UNIT` que pertenece a la compra y tiene pendiente
- **THEN** la cantidad preparada de su línea aumenta en 1

#### Scenario: Producto ajeno a la compra
- **WHEN** se escanea un producto que no pertenece a la compra
- **THEN** el sistema muestra "El producto no pertenece a esta compra" y ninguna línea cambia

#### Scenario: Producto repetido en varias líneas
- **WHEN** la compra tiene dos líneas del mismo producto y se escanea
- **THEN** la cantidad se suma a la primera línea con pendiente disponible

### Requirement: Cantidad preparada sin excedentes
La cantidad preparada de cada línea SHALL NOT superar su cantidad pendiente; cualquier intento de excederla SHALL rechazarse como error.

#### Scenario: Escaneo que excede el pendiente
- **WHEN** una línea tiene pendiente 3, ya hay 3 preparadas y se escanea otra vez
- **THEN** la cantidad preparada sigue en 3 y se muestra "Excede la cantidad pendiente"

#### Scenario: Pesable en recepción
- **WHEN** se escanea un producto de tipo `WEIGHT`
- **THEN** el sistema pide la cantidad y rechaza valores mayores al pendiente

### Requirement: Inventario solo al confirmar
Escanear y preparar cantidades SHALL NOT modificar stock, lotes ni costos; el inventario SHALL actualizarse únicamente al confirmar la recepción con `POST /purchases/:id/receive`, conservando el `Idempotency-Key` del formulario.

#### Scenario: Preparar sin confirmar
- **WHEN** el usuario escanea productos y cierra el formulario sin confirmar
- **THEN** no se registra ninguna recepción ni movimiento de inventario

#### Scenario: Doble confirmación
- **WHEN** se envía dos veces la misma confirmación con el mismo `Idempotency-Key`
- **THEN** el inventario se mueve una sola vez y la segunda respuesta reproduce la primera

### Requirement: Lotes, vencimientos y ubicaciones
La recepción SHALL conservar los datos de lote, vencimiento, ubicación y costo por línea, SHALL permitir dividir una línea en varios lotes cuya suma no supere el pendiente y SHALL conservar el número y la fecha de la factura del proveedor.

#### Scenario: Dividir una línea en dos lotes
- **WHEN** una línea con pendiente 10 se divide en lote A con 6 y lote B con 4
- **THEN** la confirmación envía dos entradas con el mismo `purchaseItemId` y el backend registra ambos lotes

#### Scenario: División que excede el pendiente
- **WHEN** la suma de los lotes de una línea supera su pendiente
- **THEN** el formulario no permite avanzar a la confirmación

#### Scenario: Producto que exige lote
- **WHEN** un producto con `requiresLot` tiene cantidad preparada sin lote
- **THEN** el formulario no permite avanzar a la confirmación

### Requirement: Factura ya registrada
Cuando la compra ya tiene número de factura de una recepción anterior, el sistema SHALL precargar el número y la fecha, SHALL iniciar la recepción en el paso de productos y SHALL permitir editarlos.

#### Scenario: Segunda recepción parcial
- **WHEN** se abre la recepción de una compra `PARTIAL` cuya factura se registró antes
- **THEN** el formulario inicia en "Productos" con la factura precargada y un aviso de que se puede editar

#### Scenario: Apertura por enlace directo
- **WHEN** se abre por enlace directo la recepción de una compra cuya factura se registró antes
- **THEN** el detalle de la compra incluye `supplierInvoiceNumber` y `supplierInvoiceDate` y el formulario inicia en "Productos" con la factura precargada

#### Scenario: Compra sin factura registrada
- **WHEN** se abre la recepción de una compra sin factura registrada
- **THEN** el formulario inicia en "Información" y exige el número de factura

### Requirement: Estados y permisos de recepción
La barra de escaneo de recepción SHALL estar disponible solo para compras recibibles (`DRAFT`, `PENDING` o `PARTIAL`) y para usuarios con la acción de recibir habilitada.

#### Scenario: Compra recibida o cancelada
- **WHEN** la compra está en `RECEIVED`, `CANCELLED` o `CERRADA_PARCIAL`
- **THEN** no se ofrece la recepción ni la barra de escaneo

#### Scenario: Usuario sin permiso
- **WHEN** un usuario con rol `USER` abre la compra
- **THEN** no ve la acción de recibir y el backend respondería 403 a la recepción
