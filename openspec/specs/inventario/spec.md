# Spec: inventario

## Proposito

Definir el comportamiento esperado para inventario avanzado: existencias por sucursal, lote, vencimiento, ubicacion, alertas, rotacion, FEFO, ajustes, entradas desde compras y salidas desde ventas.

SUPUESTO: El ledger actual `stock_movements` se mantiene como base de trazabilidad.

## Requirements

### Requirement: Existencias por sucursal

El sistema SHALL calcular y consultar existencias por tenant, sucursal y producto.

#### Scenario: Consultar stock por sucursal

- GIVEN un producto con movimientos en varias sucursales
- WHEN se consulta inventario por sucursal
- THEN el sistema SHALL mostrar solo el stock de la sucursal autorizada.

#### Scenario: Usuario sin permiso de sucursal

- GIVEN un usuario sin acceso a una sucursal
- WHEN intenta consultar inventario de esa sucursal
- THEN el sistema SHALL rechazar la consulta.

### Requirement: Existencias por lote

El sistema SHALL soportar existencias por lote para productos que lo requieran.

#### Scenario: Stock por lote

- GIVEN un producto con dos lotes en la misma sucursal
- WHEN se consulta detalle de inventario
- THEN el sistema SHALL mostrar cantidad disponible por lote.

#### Scenario: Producto sin lote

- GIVEN un producto que no requiere lote
- WHEN se consulta inventario
- THEN el sistema SHALL seguir mostrando stock agregado compatible con el flujo actual.

### Requirement: Vencimientos

El sistema SHALL asociar vencimiento a lotes cuando aplique.

#### Scenario: Producto proximo a vencer

- GIVEN un lote con vencimiento dentro de la ventana configurada
- WHEN se consulta inventario o alertas
- THEN el sistema SHALL marcarlo como proximo a vencer.

#### Scenario: Producto vencido

- GIVEN un lote con fecha de vencimiento anterior a la fecha operativa
- WHEN se intenta vender
- THEN el sistema SHALL bloquear la salida normal del lote.

PREGUNTA ABIERTA: La fecha operativa sera fecha del servidor, fecha local de sucursal o fecha de caja?

### Requirement: Ubicacion fisica

El sistema SHALL permitir asociar inventario a una ubicacion fisica dentro de una sucursal.

#### Scenario: Recepcion con ubicacion

- GIVEN una compra recibida
- WHEN el usuario registra ubicacion fisica
- THEN el sistema SHALL asociar esa ubicacion al stock recibido.

#### Scenario: Ubicacion opcional

- GIVEN un producto sin ubicacion obligatoria
- WHEN se recibe inventario sin ubicacion
- THEN el sistema SHALL permitir la operacion si la configuracion lo autoriza.

### Requirement: Alertas

El sistema SHALL generar o exponer alertas operativas de inventario.

#### Scenario: Alerta de stock bajo

- GIVEN un producto con stock disponible bajo umbral
- WHEN se consulta dashboard
- THEN el sistema SHALL mostrar alerta de stock bajo.

#### Scenario: Alerta de vencimiento

- GIVEN un lote proximo a vencer o vencido
- WHEN se consulta dashboard o reporte
- THEN el sistema SHALL mostrar alerta con severidad.

### Requirement: Rotacion

El sistema SHALL clasificar o reportar rotacion de inventario.

#### Scenario: Baja rotacion

- GIVEN un producto con pocas salidas en el periodo configurado
- WHEN se genera analisis de rotacion
- THEN el sistema SHALL marcarlo como baja rotacion segun regla definida.

PREGUNTA ABIERTA: La rotacion se medira por unidades, valor vendido, margen, dias sin movimiento o combinacion?

### Requirement: Reglas FEFO

El sistema SHALL usar FEFO para productos perecederos/loteados cuando descuente inventario.

#### Scenario: Venta con multiples lotes

- GIVEN un producto con varios lotes disponibles
- WHEN se vende el producto
- THEN el sistema SHALL descontar primero el lote con vencimiento mas cercano no vencido.

#### Scenario: Sin lote suficiente

- GIVEN un producto loteado sin cantidad suficiente
- WHEN se intenta vender
- THEN el sistema SHALL rechazar la venta con mensaje de stock insuficiente.

### Requirement: Ajustes de inventario

El sistema SHALL permitir ajustes `IN` y `OUT` con trazabilidad.

#### Scenario: Ajuste con motivo

- GIVEN un usuario autorizado ajusta stock
- WHEN confirma el ajuste
- THEN el sistema SHALL exigir motivo
- AND SHALL persistir el motivo junto con la trazabilidad.

#### Scenario: Ajuste de producto loteado

- GIVEN un producto con lote obligatorio
- WHEN se ajusta inventario
- THEN el sistema SHALL exigir lote y, si aplica, ubicacion.

### Requirement: Entradas desde compras

El sistema SHALL crear inventario desde recepcion de compras.

#### Scenario: Compra recibida parcialmente

- GIVEN una compra con cantidades pedidas
- WHEN se recibe una parte
- THEN el sistema SHALL crear stock solo por cantidad recibida.

#### Scenario: Compra liquidada parcial

- GIVEN una compra parcial
- WHEN se liquida la compra
- THEN el sistema SHALL NOT crear inventario por cantidades no recibidas.

### Requirement: Salidas desde ventas

El sistema SHALL descontar inventario desde ventas POS y pedidos.

#### Scenario: Venta POS

- GIVEN una venta POS confirmada
- WHEN el producto tiene stock disponible
- THEN el sistema SHALL crear salida de inventario y guardar trazabilidad de venta.

#### Scenario: Cancelacion de venta

- GIVEN una venta con salida de inventario
- WHEN se cancela o reembolsa
- THEN el sistema SHALL revertir la salida contra los lotes/movimientos correctos.

## Riesgos

RIESGO: Si FEFO no se ejecuta dentro de la misma transaccion de venta, dos cajas podrian consumir el mismo lote.

RIESGO: Si saldos por lote y `stock_movements` divergen, los reportes y POS mostraran datos distintos.

