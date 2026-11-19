## ADDED Requirements

### Requirement: Información operativa primero
El modal de detalle de lote SHALL presentar primero producto, SKU, lote, estado, vencimiento con días restantes, cantidades y ubicación, y SHALL NOT mostrar identificadores técnicos (UUID).

#### Scenario: Apertura del modal
- **WHEN** el usuario abre el detalle de un lote
- **THEN** la cabecera muestra nombre de producto, SKU, código de lote, estado y vencimiento

#### Scenario: Sin identificadores técnicos
- **WHEN** se revisa el contenido del modal
- **THEN** no aparecen `lotId`, `balanceId`, `productId`, `branchId`, `locationId`, `purchaseId` ni `purchaseItemId`

### Requirement: Ubicaciones, compras y movimientos en el mismo modal
El modal SHALL mostrar, sin salir de Lotes, todas las ubicaciones con saldo del lote, todas las compras que lo alimentaron y sus movimientos vinculados, cargados desde `GET /inventory/lots/:lotId/traceability`.

#### Scenario: Lote recibido en dos compras
- **WHEN** el lote llegó en la compra de origen y en una segunda compra
- **THEN** "Compras de este lote" lista ambas con fecha de recepción, proveedor, factura, cantidad y costo unitario, y marca la de origen

#### Scenario: Lote en dos ubicaciones
- **WHEN** el lote tiene saldo en "002 - Licores" y "QA-DEMO - QA Demo"
- **THEN** "Ubicaciones de este lote" muestra ambas con sus cantidades y marca la de la fila abierta

#### Scenario: Movimientos legibles
- **WHEN** el lote tiene una entrada de compra y una salida por venta POS
- **THEN** "Movimientos del lote" muestra "Entrada · Compra" con su factura y "Salida · Venta POS" con cantidad negativa

#### Scenario: Proveedor no resoluble
- **WHEN** el proveedor de una compra no se puede resolver
- **THEN** se muestra "Proveedor no disponible" sin UUID

#### Scenario: Falla la trazabilidad
- **WHEN** `GET /inventory/lots/:lotId/traceability` falla
- **THEN** las existencias y discrepancias siguen visibles y cada sección de trazabilidad ofrece "Reintentar"

### Requirement: Discrepancias del lote
El modal SHALL listar las discrepancias de conciliación ya cargadas para ese lote con tipo, severidad y mensaje.

#### Scenario: Lote con discrepancias
- **WHEN** existen dos discrepancias para el lote
- **THEN** el modal muestra ambas con su severidad en texto

### Requirement: Modal de solo lectura
El modal SHALL NOT ofrecer acciones que modifiquen lote, saldo o estado, ni enlaces que saquen al usuario del módulo de Lotes.

#### Scenario: Acciones disponibles
- **WHEN** un `ADMIN` con permiso de escritura abre el modal
- **THEN** solo ve "Reintentar" en caso de error y cerrar
