## ADDED Requirements

### Requirement: Nombre y SKU en el listado de lotes
`GET /inventory/lots` SHALL incluir en cada lote `productName` y `productSku` del producto del mismo tenant, o `null` si el producto no existe.

#### Scenario: Producto existente
- **WHEN** se listan lotes de un producto con nombre "Leche 1L" y SKU "LCH-1"
- **THEN** cada lote incluye `productName: "Leche 1L"` y `productSku: "LCH-1"`

#### Scenario: Producto inexistente
- **WHEN** un lote referencia un `productId` sin fila en `products` para el tenant
- **THEN** el lote se devuelve igual con `productName: null` y `productSku: null`

### Requirement: Nombre y SKU en el listado de saldos
`GET /inventory/lot-balances` SHALL incluir en cada saldo `productName` y `productSku` con las mismas reglas que el listado de lotes.

#### Scenario: Saldo de producto existente
- **WHEN** se listan saldos de un producto con SKU "LCH-1"
- **THEN** cada saldo incluye `productSku: "LCH-1"`

### Requirement: Contrato aditivo sin cambios de alcance ni permisos
Los campos nuevos SHALL ser aditivos y SHALL NOT alterar filtros, orden, cantidad de filas, permisos requeridos ni el aislamiento por tenant de ambos listados.

#### Scenario: Aislamiento por tenant
- **WHEN** un producto de otro tenant comparte el mismo `id` referenciado por un lote
- **THEN** el lote devuelve `productName: null` y no expone datos del otro tenant

#### Scenario: Misma cantidad de filas
- **WHEN** se lista con los mismos filtros antes y después del cambio
- **THEN** la cantidad y el orden de filas son iguales

#### Scenario: Permisos sin cambio
- **WHEN** un usuario con `INVENTORY:READ` y sin `INVENTORY_PRODUCTS:READ` lista lotes
- **THEN** recibe `productName` y `productSku` sin error de permisos

#### Scenario: Lecturas individuales sin cambio
- **WHEN** se consulta `GET /inventory/lots/:id`
- **THEN** la respuesta conserva sus campos previos y no requiere el `JOIN` con productos

### Requirement: Trazabilidad de solo lectura del lote
`GET /inventory/lots/:lotId/traceability` SHALL devolver los saldos del lote por ubicación, las compras que lo alimentaron (proveedor, factura, fecha, cantidad recibida, costo unitario, origen) y hasta 200 movimientos vinculados, con el mismo permiso (`INVENTORY:READ`) y alcance de sucursal que `GET /inventory/lots/:lotId`.

#### Scenario: Lote accesible
- **WHEN** un usuario con lectura de inventario consulta un lote de su sucursal
- **THEN** recibe `locations`, `purchases`, `movements` y `movementsTruncated`

#### Scenario: Lote de otro tenant o sucursal
- **WHEN** consulta un lote de otro tenant o de una sucursal fuera de su alcance
- **THEN** recibe el mismo error que en `GET /inventory/lots/:lotId` y no se ejecutan las consultas de trazabilidad

#### Scenario: Resumen de compra sin permiso de Compras
- **WHEN** el usuario no tiene `INVENTORY_PURCHASES:READ`
- **THEN** igual recibe proveedor, factura, fecha, cantidad y costo de las compras del lote, sin totales ni pagos (decisión del propietario, 2026-11-13)

#### Scenario: Muchos movimientos
- **WHEN** el lote tiene más de 200 movimientos
- **THEN** se devuelven los 200 más recientes y `movementsTruncated` es `true`
