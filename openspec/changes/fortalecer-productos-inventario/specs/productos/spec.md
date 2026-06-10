# Delta spec: productos

## ADDED Requirements

### Requirement: Producto enriquecido

El sistema SHALL extender el producto actual para manejar atributos operativos sin romper productos existentes.

#### Scenario: Producto existente sigue valido

- GIVEN un producto creado con el modelo actual
- WHEN se consulta o se vende
- THEN el sistema SHALL conservar compatibilidad con los campos actuales
- AND los nuevos atributos SHALL ser opcionales o tener defaults seguros.

#### Scenario: Producto nuevo con atributos operativos

- GIVEN un usuario con permiso de escritura en productos
- WHEN crea o edita un producto
- THEN SHALL poder definir si es perecedero, si exige lote, si exige vencimiento, su estado operativo y clasificacion.

### Requirement: Producto perecedero o no perecedero

El sistema SHALL distinguir productos perecederos y no perecederos.

#### Scenario: Perecedero requiere reglas de vencimiento

- GIVEN un producto marcado como perecedero
- WHEN ingresa inventario
- THEN el sistema SHALL aplicar reglas de vencimiento segun configuracion.

#### Scenario: No perecedero conserva flujo actual

- GIVEN un producto no perecedero
- WHEN ingresa o sale inventario
- THEN el sistema SHALL permitir operar sin vencimiento.

### Requirement: Lote obligatorio por producto

El sistema SHALL permitir exigir lote por producto.

#### Scenario: Recepcion sin lote rechazada

- GIVEN un producto con lote obligatorio
- WHEN se recibe una compra sin lote
- THEN el sistema SHALL rechazar la recepcion.

#### Scenario: Producto sin lote obligatorio

- GIVEN un producto sin lote obligatorio
- WHEN se opera compra o venta
- THEN el sistema SHALL mantener el comportamiento actual.

### Requirement: Vencimiento obligatorio por producto

El sistema SHALL permitir exigir fecha de vencimiento por producto.

#### Scenario: Lote sin vencimiento rechazado

- GIVEN un producto con vencimiento obligatorio
- WHEN se registra lote sin fecha de vencimiento
- THEN el sistema SHALL rechazar la operacion.

### Requirement: Codigos de barras multiples

El sistema SHALL soportar multiples codigos de barras por producto sin reemplazar `sku`.

#### Scenario: Busqueda por barcode

- GIVEN un producto con barcode
- WHEN el usuario escanea o busca el barcode
- THEN el sistema SHALL resolver el producto dentro del tenant autorizado.

#### Scenario: Barcode unico por tenant

- GIVEN dos productos del mismo tenant
- WHEN se intenta asignar el mismo barcode activo a ambos
- THEN el sistema SHALL rechazar la operacion.

#### Scenario: Barcode repetido en tenant diferente

- GIVEN dos tenants distintos
- WHEN ambos usan el mismo barcode
- THEN el sistema MAY permitirlo porque la unicidad es por tenant.

#### Scenario: Barcode principal

- GIVEN un producto con varios barcodes activos
- WHEN se marca uno como principal
- THEN el sistema SHALL garantizar solo un barcode principal activo por producto.

SUPUESTO: El formato especifico de `EAN13`, `EAN8`, `UPC`, `QR`, `INTERNAL` u `OTHER` se validara en `api/`; la base de datos garantizara unicidad y no vacio.

### Requirement: Defaults legacy de producto

El sistema SHALL migrar productos existentes con defaults seguros.

#### Scenario: Producto actual migrado

- GIVEN un producto existente antes de Fase 3
- WHEN se apliquen migraciones futuras
- THEN el producto SHALL quedar con `is_perishable = false`, `requires_lot = false`, `requires_expiration = false` y `operational_status = ACTIVE`.

#### Scenario: Vencimiento exige lote

- GIVEN un producto con `requires_expiration = true`
- WHEN se guarda la configuracion
- THEN el sistema SHALL exigir tambien `requires_lot = true`.

### Requirement: Estado y clasificacion operativa

El sistema SHALL permitir estados y clasificaciones operativas mas ricas que `is_active`.

#### Scenario: Producto bloqueado para POS

- GIVEN un producto con estado no vendible
- WHEN POS carga catalogo
- THEN el producto SHALL no estar disponible para venta.

#### Scenario: Clasificacion visible

- GIVEN un producto clasificado
- WHEN se lista en inventario o reporteria
- THEN el sistema SHALL mostrar su clasificacion.

RIESGO: Nuevos estados mal definidos pueden bloquear ventas o compras legitimas.
