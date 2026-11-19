## ADDED Requirements

### Requirement: Entrega de pedido consume lotes por FEFO
Al entregar un pedido, el sistema SHALL descontar las unidades de productos con lote de los lotes `ACTIVE` no vencidos con saldo disponible, en orden de vencimiento, y SHALL registrar un vínculo movimiento–lote por cada lote consumido, en la misma transacción que la salida.

#### Scenario: Un lote alcanza
- **WHEN** se entregan 3 unidades y el lote con vencimiento más próximo tiene 5 disponibles
- **THEN** ese lote queda en 2, se crea un vínculo de 3 unidades y el kardex baja 3

#### Scenario: Varios lotes
- **WHEN** se entregan 7 unidades y los dos lotes vigentes más próximos tienen 5 y 4
- **THEN** el primero queda en 0, el segundo en 2 y existen dos vínculos (5 y 2)

#### Scenario: Kardex y lotes coinciden después de entregar
- **WHEN** termina una entrega de un producto con lote
- **THEN** la suma de saldos de lote del producto en la sucursal disminuye en la misma cantidad que el kardex

### Requirement: Stock entregable de productos con lote
Para productos con lote, el sistema SHALL validar la entrega contra la suma de lotes vendibles y SHALL rechazarla sin efectos cuando no alcance.

#### Scenario: Lotes vencidos o bloqueados
- **WHEN** el kardex muestra 10 unidades pero solo 2 están en lotes `ACTIVE` no vencidos y se intentan entregar 5
- **THEN** la entrega se rechaza con un error de stock de lote insuficiente y no se crea ningún movimiento

### Requirement: Entregas concurrentes
El sistema SHALL bloquear el producto antes de validar el stock de una entrega para que dos entregas simultáneas no sobregiren el kardex ni los lotes.

#### Scenario: Dos entregas simultáneas
- **WHEN** dos usuarios entregan a la vez 4 unidades de un producto con 5 vendibles
- **THEN** una entrega se completa y la otra se rechaza por stock insuficiente

### Requirement: Productos sin lote sin cambios
Para productos sin control de lote, la entrega SHALL conservar el comportamiento actual y SHALL NOT crear vínculos de lote.

#### Scenario: Producto sin lote
- **WHEN** se entrega un producto sin `requires_lot`
- **THEN** se crea solo el movimiento OUT, como hoy

### Requirement: Ventas POS sin cambios
La corrección SHALL NOT modificar el flujo de venta POS: la función `inventory_create_sale_v2`, `SaleService.createSale`, `SaleService.cancelSale`, sus contratos ni su consumo FEFO.

#### Scenario: Revisión del diff
- **WHEN** se revisa el diff del cambio
- **THEN** no contiene cambios en `scripts/database/**`, `sale.service.ts`, `sale.repository.ts`, `operational-sales/**` ni `web/modules/pos/**`

#### Scenario: Regresión de ventas
- **WHEN** se ejecutan las pruebas de `sale.service.spec.ts`, `sale.repository.spec.ts` y `sale-stock-rejection.spec.ts`
- **THEN** todas pasan sin modificarlas

#### Scenario: Venta POS después de la corrección
- **WHEN** se vende en `/pos` un producto con lote después del despliegue
- **THEN** la venta consume lotes por FEFO igual que antes y kardex y lotes bajan la misma cantidad
