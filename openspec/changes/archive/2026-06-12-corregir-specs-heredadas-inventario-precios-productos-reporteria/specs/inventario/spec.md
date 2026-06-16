## MODIFIED Requirements

### Requirement: Existencias por sucursal

El sistema SHALL calcular y consultar existencias por tenant, sucursal y producto.

#### Scenario: Consultar stock por sucursal

- **WHEN** se consulta inventario por sucursal para un producto con movimientos en varias sucursales
- **THEN** el sistema SHALL mostrar solo el stock de la sucursal autorizada.

#### Scenario: Usuario sin permiso de sucursal

- **WHEN** un usuario sin acceso a una sucursal intenta consultar inventario de esa sucursal
- **THEN** el sistema SHALL rechazar la consulta.

### Requirement: Existencias por lote

El sistema SHALL soportar existencias por lote para productos que lo requieran.

#### Scenario: Stock por lote

- **WHEN** se consulta detalle de inventario para un producto con dos lotes en la misma sucursal
- **THEN** el sistema SHALL mostrar cantidad disponible por lote.

#### Scenario: Producto sin lote

- **WHEN** se consulta inventario de un producto que no requiere lote
- **THEN** el sistema SHALL seguir mostrando stock agregado compatible con el flujo actual.

### Requirement: Vencimientos

El sistema SHALL asociar vencimiento a lotes cuando aplique.

#### Scenario: Producto proximo a vencer

- **WHEN** se consulta inventario o alertas para un lote con vencimiento dentro de la ventana configurada
- **THEN** el sistema SHALL marcarlo como proximo a vencer.

#### Scenario: Producto vencido

- **WHEN** se intenta vender un lote con fecha de vencimiento anterior a la fecha operativa
- **THEN** el sistema SHALL bloquear la salida normal del lote.

### Requirement: Ubicacion fisica

El sistema SHALL permitir asociar inventario a una ubicacion fisica dentro de una sucursal.

#### Scenario: Recepcion con ubicacion

- **WHEN** el usuario registra ubicacion fisica durante la recepcion de una compra
- **THEN** el sistema SHALL asociar esa ubicacion al stock recibido.

#### Scenario: Ubicacion opcional

- **WHEN** se recibe inventario sin ubicacion para un producto sin ubicacion obligatoria
- **THEN** el sistema SHALL permitir la operacion si la configuracion lo autoriza.

### Requirement: Alertas

El sistema SHALL generar o exponer alertas operativas de inventario.

#### Scenario: Alerta de stock bajo

- **WHEN** se consulta dashboard para un producto con stock disponible bajo umbral
- **THEN** el sistema SHALL mostrar alerta de stock bajo.

#### Scenario: Alerta de vencimiento

- **WHEN** se consulta dashboard o reporte para un lote proximo a vencer o vencido
- **THEN** el sistema SHALL mostrar alerta con severidad.

### Requirement: Rotacion

El sistema SHALL clasificar o reportar rotacion de inventario.

#### Scenario: Baja rotacion

- **WHEN** se genera analisis de rotacion para un producto con pocas salidas en el periodo configurado
- **THEN** el sistema SHALL marcarlo como baja rotacion segun regla definida.

### Requirement: Reglas FEFO

El sistema SHALL usar FEFO para productos perecederos o loteados cuando descuente inventario.

#### Scenario: Venta con multiples lotes

- **WHEN** se vende un producto con varios lotes disponibles
- **THEN** el sistema SHALL descontar primero el lote con vencimiento mas cercano no vencido.

#### Scenario: Sin lote suficiente

- **WHEN** se intenta vender un producto loteado sin cantidad suficiente
- **THEN** el sistema SHALL rechazar la venta con mensaje de stock insuficiente.

### Requirement: Ajustes de inventario

El sistema SHALL permitir ajustes `IN` y `OUT` con trazabilidad.

#### Scenario: Ajuste con motivo

- **WHEN** un usuario autorizado confirma un ajuste de stock
- **THEN** el sistema SHALL exigir motivo y persistirlo junto con la trazabilidad.

#### Scenario: Ajuste de producto loteado

- **WHEN** se ajusta inventario de un producto con lote obligatorio
- **THEN** el sistema SHALL exigir lote y, si aplica, ubicacion.

### Requirement: Entradas desde compras

El sistema SHALL crear inventario desde recepcion de compras.

#### Scenario: Compra recibida parcialmente

- **WHEN** se recibe una parte de una compra con cantidades pedidas
- **THEN** el sistema SHALL crear stock solo por cantidad recibida.

#### Scenario: Compra liquidada parcial

- **WHEN** se liquida una compra parcial
- **THEN** el sistema SHALL NOT crear inventario por cantidades no recibidas.

### Requirement: Salidas desde ventas

El sistema SHALL descontar inventario desde ventas POS y pedidos.

#### Scenario: Venta POS

- **WHEN** se confirma una venta POS de un producto con stock disponible
- **THEN** el sistema SHALL crear salida de inventario y guardar trazabilidad de venta.

#### Scenario: Cancelacion de venta

- **WHEN** se cancela o reembolsa una venta con salida de inventario
- **THEN** el sistema SHALL revertir la salida contra los lotes o movimientos correctos.
