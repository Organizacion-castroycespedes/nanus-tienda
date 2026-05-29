# Delta spec: inventario

## ADDED Requirements

### Requirement: Existencias por sucursal y lote

El sistema SHALL manejar existencias por tenant, sucursal, producto y lote cuando aplique.

#### Scenario: Producto loteado con stock por lote

- GIVEN un producto con dos lotes en una sucursal
- WHEN se consulta inventario
- THEN el sistema SHALL mostrar cantidad disponible por lote y stock total.

#### Scenario: Producto no loteado

- GIVEN un producto sin lote obligatorio
- WHEN se consulta inventario
- THEN el sistema SHALL mantener stock agregado compatible con `stock_movements`.

### Requirement: Vencimientos y bloqueo operativo

El sistema SHALL identificar lotes proximos a vencer y vencidos.

#### Scenario: Lote proximo a vencer

- GIVEN un lote dentro de la ventana de alerta
- WHEN se consulta inventario
- THEN el sistema SHALL marcarlo como proximo a vencer.

#### Scenario: Lote vencido en venta

- GIVEN un lote vencido
- WHEN POS intenta vender el producto
- THEN el sistema SHALL excluir o bloquear ese lote segun regla aprobada.

PREGUNTA ABIERTA: Se permitira vender vencidos con permiso especial o nunca?

### Requirement: Configuracion de proximo a vencer por tenant

El sistema SHALL permitir configurar por tenant la ventana de productos proximos a vencer.

#### Scenario: Default de vencimiento

- GIVEN un tenant sin configuracion personalizada
- WHEN se calculan alertas de vencimiento
- THEN el sistema SHALL usar 30 dias como ventana preventiva.

#### Scenario: Severidades de vencimiento

- GIVEN un lote con fecha de vencimiento futura
- WHEN faltan 7 dias o menos
- THEN el sistema SHALL clasificar la alerta como `CRITICA`.
- AND cuando faltan 15 dias o menos SHALL clasificarla como `ALTA`.
- AND cuando faltan 30 dias o menos SHALL clasificarla como `PREVENTIVA`.

### Requirement: Ubicacion fisica

El sistema SHALL asociar stock a ubicacion fisica cuando se configure.

#### Scenario: Ubicacion en recepcion

- GIVEN una recepcion de compra
- WHEN el usuario informa ubicacion
- THEN el sistema SHALL asociar esa ubicacion a la existencia recibida.

### Requirement: Alertas operativas

El sistema SHALL exponer alertas de inventario para operacion diaria.

#### Scenario: Stock bajo

- GIVEN un producto bajo umbral
- WHEN se consulta dashboard
- THEN SHALL aparecer alerta de stock bajo.

#### Scenario: Vencimiento

- GIVEN un lote vencido o proximo a vencer
- WHEN se consulta dashboard o reporte
- THEN SHALL aparecer alerta con severidad.

### Requirement: Rotacion

El sistema SHALL permitir clasificar o reportar rotacion por periodo.

#### Scenario: Baja rotacion

- GIVEN un producto con salidas bajas en el periodo
- WHEN se calcula rotacion
- THEN SHALL marcarse como baja rotacion segun umbral.

### Requirement: FEFO para salidas

El sistema SHALL descontar primero lotes con fecha de vencimiento mas cercana no vencida.

#### Scenario: Venta POS usa FEFO

- GIVEN varios lotes disponibles de un producto perecedero
- WHEN se confirma venta POS
- THEN el sistema SHALL descontar primero el lote con vencimiento mas proximo.

#### Scenario: Cancelacion revierte lote

- GIVEN una venta que desconto lotes
- WHEN se cancela
- THEN el sistema SHALL revertir las cantidades a los lotes correctos.

### Requirement: Ajustes con trazabilidad

El sistema SHALL exigir y persistir motivo de ajustes de inventario.

#### Scenario: Ajuste sin motivo

- GIVEN un usuario autorizado intenta ajustar inventario
- WHEN no informa motivo
- THEN el sistema SHALL rechazar la operacion.

### Requirement: Entradas desde compras

El sistema SHALL crear existencias loteadas desde recepcion de compras.

#### Scenario: Recepcion parcial

- GIVEN una compra parcial
- WHEN se recibe una cantidad
- THEN el sistema SHALL crear existencia solo por cantidad recibida.

### Requirement: Salidas desde ventas y pedidos

El sistema SHALL aplicar la misma regla de salida para ventas POS, cancelaciones y entregas de pedidos.

#### Scenario: Entrega de pedido

- GIVEN un pedido con producto loteado
- WHEN se entrega
- THEN el sistema SHALL descontar por FEFO igual que POS.

RIESGO: FEFO fuera de transaccion puede causar doble consumo de lote.

### Requirement: Ledger principal y saldos derivados

El sistema SHALL mantener `stock_movements` como ledger principal y SHALL usar saldos por lote como proyeccion operativa.

#### Scenario: Movimiento loteado

- GIVEN un producto que requiere lote
- WHEN una compra, venta, cancelacion, pedido o ajuste genera `stock_movements`
- THEN el sistema SHALL registrar el detalle correspondiente en `stock_movement_lots`.

#### Scenario: Reconciliacion

- GIVEN movimientos lotificados existentes
- WHEN se ejecuta una validacion de consistencia
- THEN la suma de `stock_movement_lots` SHALL coincidir con `stock_movements`.
- AND los saldos de `inventory_lot_balances` SHALL coincidir con entradas menos salidas por lote.

### Requirement: Compatibilidad legacy sin lote

El sistema SHALL permitir operar productos sin lote durante la transicion gradual.

#### Scenario: Producto existente no loteado

- GIVEN un producto existente con stock calculado desde `stock_movements`
- WHEN se consulta o vende el producto
- THEN el sistema SHALL mantener el comportamiento actual si `requires_lot = false`.

#### Scenario: Activacion gradual de lote

- GIVEN un producto legacy con saldo existente
- WHEN se active `requires_lot`
- THEN el sistema SHALL permitir una estrategia explicita de consumo legacy o lote legacy antes de exigir trazabilidad completa.
