## ADDED Requirements

### Requirement: Registro único de series
El sistema SHALL registrar cada unidad de un producto con serie con un número de serie normalizado (sin espacios al inicio o al final, en mayúsculas), único por tenant y producto, y SHALL conservar el registro en cualquier estado posterior.

#### Scenario: Serie repetida en el mismo producto
- **WHEN** se intenta registrar una serie que ya existe para ese producto en el tenant, en cualquier estado
- **THEN** el sistema rechaza la operación completa sin crear series ni movimientos

#### Scenario: Misma serie en otro producto
- **WHEN** se registra una serie que ya existe en otro producto del mismo tenant
- **THEN** el sistema la acepta y la prevalidación muestra una advertencia que no bloquea

#### Scenario: Aislamiento entre tenants
- **WHEN** dos tenants registran la misma serie para sus productos
- **THEN** ambos registros son válidos y ninguno es visible para el otro tenant

### Requirement: Series en la recepción de compras
Al recibir un producto con serie, el sistema SHALL exigir exactamente tantas series como unidades se reciben en esa recepción y SHALL registrarlas como `AVAILABLE` en la sucursal de la compra, en la misma transacción que la entrada de inventario.

#### Scenario: Recepción completa
- **WHEN** se reciben 5 unidades con 5 series válidas
- **THEN** existen 5 series `AVAILABLE` con evento `RECEIVED` enlazado a la compra y el kardex sube 5

#### Scenario: Recepción parcial
- **WHEN** se reciben 7 de 20 unidades pedidas
- **THEN** el sistema exige 7 series y deja 13 pendientes

#### Scenario: Cantidad de series distinta
- **WHEN** se reciben 5 unidades con 4 series, o con una serie repetida en la misma carga
- **THEN** la recepción se rechaza sin efectos

#### Scenario: Reintento idempotente
- **WHEN** se repite la recepción con la misma `Idempotency-Key` y las mismas series
- **THEN** se devuelve el resultado guardado sin duplicar series

### Requirement: Ubicación de series
El sistema SHALL permitir asignar a cada serie una ubicación física activa de su misma sucursal, al recibirla o después, y SHALL registrar cada cambio de ubicación en el historial sin crear movimientos de inventario.

#### Scenario: Ubicación en la recepción
- **WHEN** se reciben 5 series indicando la ubicación "Bodega A" para la línea y "Vitrina" para una de ellas
- **THEN** 4 series quedan en "Bodega A" y 1 en "Vitrina"

#### Scenario: Ubicación de otra sucursal
- **WHEN** se indica una ubicación que pertenece a otra sucursal o está inactiva
- **THEN** la operación se rechaza sin efectos

#### Scenario: Mover ubicación
- **WHEN** un usuario mueve 3 series disponibles de "Bodega A" a "Vitrina"
- **THEN** las 3 series quedan en "Vitrina", cada una con el evento `LOCATION_CHANGED` y el kardex no cambia

#### Scenario: Ubicación visible al vender
- **WHEN** el cajero abre el selector de series de un producto
- **THEN** cada serie disponible muestra su ubicación

#### Scenario: Producto sin lote ni serie
- **WHEN** se recibe un producto sin lote ni serie indicando una ubicación
- **THEN** el sistema mantiene el rechazo actual

### Requirement: Captura masiva y prevalidación
El sistema SHALL permitir capturar series con escáner, pegado de varias líneas y archivo CSV/XLSX, y SHALL mostrar los errores (formato, duplicados en la carga, ya registradas, existentes en otro producto) antes de confirmar la recepción.

#### Scenario: Pegado de 200 series con errores
- **WHEN** se pegan 200 series de las cuales 3 están repetidas
- **THEN** la vista previa señala las 3 y la recepción no se habilita hasta corregirlas

### Requirement: Venta POS de productos con serie
Al confirmar una venta POS, el sistema SHALL exigir para cada línea de un producto con serie tantas series `AVAILABLE` de la sucursal de la venta como su cantidad, y SHALL pasarlas a `SOLD` en la misma transacción de la venta, sin modificar el cálculo de existencias ni la selección de lotes del proceso de venta existente.

#### Scenario: Venta con series
- **WHEN** se venden 3 unidades eligiendo 3 series disponibles
- **THEN** las 3 series quedan `SOLD` enlazadas a la venta, el ítem y el cliente, y el kardex baja 3

#### Scenario: Venta sin series suficientes
- **WHEN** se intenta vender 3 unidades de un producto con serie indicando 2 series
- **THEN** la venta se rechaza sin efectos

#### Scenario: Serie de otra sucursal
- **WHEN** se indica una serie que está en otra sucursal
- **THEN** la venta se rechaza sin efectos

#### Scenario: Venta concurrente de la misma serie
- **WHEN** dos terminales confirman a la vez ventas con la misma serie
- **THEN** una venta se completa y la otra se rechaza completa (sin pago, sin movimiento, sin factura)

#### Scenario: Productos sin serie
- **WHEN** se vende un producto sin serie
- **THEN** la venta se comporta exactamente igual que antes de este change

### Requirement: Series en la entrega de pedidos
Al entregar un pedido, el sistema SHALL exigir series `AVAILABLE` de la sucursal del pedido para cada línea entregada de un producto con serie y SHALL pasarlas a `SOLD` enlazadas al pedido y al movimiento de salida. El sistema SHALL NOT asignar ni reservar series al crear o confirmar el pedido.

#### Scenario: Entrega parcial
- **WHEN** se entregan 2 de 5 unidades con 2 series
- **THEN** esas 2 series quedan `SOLD` y la siguiente entrega no las ofrece

#### Scenario: Pedido confirmado
- **WHEN** se crea o confirma un pedido con un producto con serie
- **THEN** ninguna serie cambia de estado

### Requirement: Retorno por anulación e inspección
Al anular una venta con retorno de inventario, el sistema SHALL pasar sus series a `RETURNED`; sin retorno de inventario, SHALL mantenerlas `SOLD` y registrar el evento. El sistema SHALL ofrecer un flujo de inspección con motivo obligatorio que mueva una serie `RETURNED` o `BLOCKED` a `AVAILABLE`, `BLOCKED` o `WRITTEN_OFF`; `WRITTEN_OFF` SHALL registrar una salida de inventario de una unidad en la misma transacción.

#### Scenario: Anulación con retorno
- **WHEN** se anula una venta que tenía 2 series y se devuelve el inventario
- **THEN** las 2 series quedan `RETURNED`, no aparecen como disponibles para vender y el kardex sube 2

#### Scenario: Anulación sin retorno
- **WHEN** se anula una venta indicando que no se devuelve el inventario
- **THEN** las series siguen `SOLD` con el evento `VOIDED_NOT_RETURNED`

#### Scenario: Inspección aprobada
- **WHEN** un usuario autorizado inspecciona una serie `RETURNED` con resultado disponible y un motivo
- **THEN** la serie queda `AVAILABLE` y vuelve a ofrecerse en POS y entregas

#### Scenario: Inspección con baja
- **WHEN** la inspección da como resultado baja
- **THEN** la serie queda `WRITTEN_OFF` y el kardex baja 1 mediante un ajuste enlazado

### Requirement: Disponibilidad y búsqueda de series
El sistema SHALL listar las series `AVAILABLE` de un producto en una sucursal permitida al usuario, con búsqueda en el servidor por texto parcial y paginación, y SHALL permitir buscar una serie por su número exacto para el escaneo.

#### Scenario: Búsqueda
- **WHEN** el cajero escribe "0014" en el selector de un producto con 300 series disponibles
- **THEN** se muestran solo las series que contienen "0014", sin series vendidas, devueltas ni bloqueadas

### Requirement: Historial y conciliación
El sistema SHALL conservar un historial de solo inserción de cada transición (estado anterior y nuevo, documento, movimiento, sucursal, usuario, fecha, motivo) y SHALL ofrecer una conciliación de solo lectura donde, por producto con serie y sucursal, las series `AVAILABLE`, `RETURNED` y `BLOCKED` sumen la existencia del kardex.

#### Scenario: Consulta de trazabilidad
- **WHEN** se busca una serie vendida
- **THEN** se ve su recepción (compra y proveedor), su venta o entrega (documento y cliente) y cualquier anulación o inspección posterior

#### Scenario: Conciliación limpia
- **WHEN** todas las operaciones pasaron por los flujos de este change
- **THEN** la conciliación no muestra diferencias
