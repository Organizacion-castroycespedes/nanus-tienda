# Diseno tecnico `inventory_create_sale_v2` - Fase 3.11

Fecha de diseno: 2026-05-28

Ambiente: repositorio local/dev. No se ejecuto SQL contra base de datos.

## Resumen ejecutivo

La funcion actual `inventory_create_sale` debe quedar intacta. La integracion FEFO para POS debe disenarse como una funcion nueva `inventory_create_sale_v2`, con contrato compatible y activacion futura por flag interno apagado por defecto.

`inventory_create_sale_v2` debe mantener `stock_movements` como ledger principal y agregar trazabilidad loteada para productos `requires_lot=true` mediante:

- Descuento atomico de `inventory_lot_balances`.
- Insercion de `stock_movement_lots`.
- Seleccion FEFO dentro de SQL.
- Bloqueo con `FOR UPDATE` sin `SKIP LOCKED` en primera version.

Esta fase no implementa la funcion. Solo deja el contrato, algoritmo, pseudocodigo y criterios para Fase 3.12.

## Estado actual v1

Fuente principal revisada: `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql`.

Tambien existen definiciones/sync en:

- `scripts/database/sale/006_create_sale_function.sql`
- `scripts/database/migrations/V047__sync_dev_functions_to_prd.sql`

PREGUNTA ABIERTA: Confirmar el pipeline oficial que toma cambios de funciones POS hacia ambientes reales. La fuente de diseno recomendada para esta fase es `scripts/database/sale/`.

### Firma actual

```sql
inventory_create_sale(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_terminal_id UUID,
  p_user_id UUID,
  p_pos_session_id UUID,
  p_customer_id UUID,
  p_order_id UUID,
  p_type VARCHAR(20),
  p_items JSONB,
  p_payment_methods JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  customer_id UUID,
  order_id UUID,
  type VARCHAR(20),
  status VARCHAR(20),
  total NUMERIC(12, 2),
  balance NUMERIC(12, 2),
  created_at TIMESTAMPTZ
)
```

### Contrato JSON actual de items

```json
[
  {
    "product_id": "uuid",
    "quantity": 1,
    "price": 1000,
    "order_item_id": null
  }
]
```

### Contrato JSON actual de pagos legacy

```json
[
  {
    "payment_method": "CASH",
    "amount": 1000,
    "reference": null
  }
]
```

### Comportamiento actual observado

| Area | Comportamiento v1 |
| --- | --- |
| Venta | Inserta cabecera en `sales` con estado inicial `DRAFT`. |
| Items | Itera `p_items` via `jsonb_to_recordset`. |
| Producto | Valida producto activo por `tenant_id`. |
| Pedido | Si hay `order_item_id`, valida orden y cantidad pendiente con `FOR UPDATE OF oi`. |
| Stock | Calcula stock agregado por `stock_movements` con `tenant_id`, `branch_id`, `product_id`. |
| Insuficiente | Lanza `insufficient stock for product %`. |
| Taxes | Inserta `sale_item_taxes` cuando el producto tiene impuesto. |
| Ledger | Inserta un `stock_movements OUT` por item. |
| Pagos legacy | Inserta `sale_payment_methods`. |
| Totales | Actualiza `sales.total`, `balance`, `total_paid`, `balance_due`, `payment_status`. |
| Cash | Exige pagos y total exacto para `CASH`. |
| Retorno | Retorna fila de `sales`. |

Dependencia POS/caja:

- La funcion valida `tenant_branches`, `terminals`, `users`, `pos_user_sessions` y `customers`.
- `SaleService` crea pagos financieros reales despues de la funcion, dentro de la misma transaccion del API.
- La funcion no toca directamente el frontend ni tickets.

## Objetivo v2

`inventory_create_sale_v2` debe:

1. Conservar el contrato funcional de v1 para venta POS.
2. Mantener productos no loteados con comportamiento actual.
3. Para productos loteados, seleccionar lotes por FEFO dentro de la transaccion.
4. Bloquear balances elegibles con `FOR UPDATE`.
5. Insertar un `stock_movements OUT` por item, como ledger principal.
6. Crear uno o varios `stock_movement_lots` por movimiento loteado.
7. Descontar `inventory_lot_balances.quantity_on_hand`.
8. Bloquear venta de lotes vencidos, `BLOCKED`, `CANCELLED` o `CONSUMED`.
9. Rechazar inconsistencia si un producto `requires_expiration=true` tiene lote sin `expiration_date`.
10. No cambiar `sale_items`; el ticket no muestra lote en primera integracion.

## Firma propuesta

Opcion recomendada para primera version:

```sql
public.inventory_create_sale_v2(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_terminal_id UUID,
  p_user_id UUID,
  p_pos_session_id UUID,
  p_customer_id UUID,
  p_order_id UUID,
  p_type VARCHAR(20),
  p_items JSONB,
  p_payment_methods JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  customer_id UUID,
  order_id UUID,
  type VARCHAR(20),
  status VARCHAR(20),
  total NUMERIC(12, 2),
  balance NUMERIC(12, 2),
  created_at TIMESTAMPTZ
)
```

Motivo:

- Mantiene compatibilidad maxima con `SaleRepository.createSaleWithFunction`.
- No exige cambios de frontend.
- No exige allocations manuales.
- Permite que `SaleRepository` agregue un metodo gemelo `createSaleWithFunctionV2` con parametros iguales.

Campo opcional futuro, no recomendado para primera version:

```sql
p_options JSONB DEFAULT '{}'::JSONB
```

Uso futuro posible:

- `manual_lot_allocations`.
- modo diagnostico.
- politica de bloqueo.

SUPUESTO: La primera version FEFO usa seleccion automatica y no acepta lote manual desde POS.

## Contrato de entrada y salida

### Entrada

La entrada de `p_items` sigue igual que v1:

| Campo | Tipo conceptual | Regla |
| --- | --- | --- |
| `product_id` | UUID | Obligatorio. |
| `quantity` | numeric | Obligatorio, `> 0`. |
| `price` | numeric | Obligatorio, `>= 0`. |
| `order_item_id` | UUID/null | Opcional; obligatorio si `p_order_id` viene. |

No se agrega `lot_id`, `lot_code` ni `location_id` al POS en primera version.

### Salida

La salida debe ser la misma de v1:

| Campo | Regla |
| --- | --- |
| `id` | ID de venta creada. |
| `tenant_id` | Tenant de venta. |
| `customer_id` | Cliente de venta. |
| `order_id` | Pedido vinculado o null. |
| `type` | `CASH` o `CREDIT`. |
| `status` | Estado final devuelto por la funcion, antes de sincronizacion financiera del service. |
| `total` | Total venta. |
| `balance` | Saldo calculado. |
| `created_at` | Fecha de creacion. |

## Algoritmo paso a paso

### Paso 1: validaciones de contexto

Mismo comportamiento que v1:

1. Validar `p_type IN ('CASH','CREDIT')`.
2. Validar `p_branch_id`, `p_terminal_id`, `p_user_id`, `p_pos_session_id`.
3. Validar que `p_items` sea array no vacio.
4. Validar que `p_payment_methods` sea array cuando venga.
5. Validar `tenant_branches`.
6. Validar terminal activa por tenant/sucursal.
7. Validar usuario del tenant.
8. Validar sesion POS activa.
9. Validar cliente activo.
10. Validar pedido si `p_order_id` no es null.

### Paso 2: insertar cabecera de venta

Igual que v1:

- Insertar `sales` con `DRAFT`, totales en cero, contexto POS y `v_now`.

### Paso 3: iterar items

Para cada item:

1. Normalizar `product_id`, `quantity`, `price`, `order_item_id`.
2. Validar `quantity > 0`.
3. Validar `price >= 0`.
4. Obtener producto activo con:
   - `tax_id`
   - datos de impuesto
   - `requires_lot`
   - `requires_expiration`
5. Validar orden/pedido si aplica.
6. Calcular stock agregado desde `stock_movements`, como v1.
7. Si stock agregado es insuficiente, lanzar error.
8. Insertar `sale_items`.
9. Insertar `sale_item_taxes` si aplica.
10. Insertar `stock_movements OUT` con `RETURNING id`.
11. Si producto no requiere lote, terminar item.
12. Si producto requiere lote, ejecutar seleccion FEFO y descuento loteado.

### Paso 4: item no loteado

Si `product.requires_lot = false`:

- No consultar `inventory_lots`.
- No tocar `inventory_lot_balances`.
- No crear `stock_movement_lots`.
- Mantener `stock_movements OUT` como v1.

### Paso 5: item loteado

Si `product.requires_lot = true`:

1. Buscar balances elegibles para `tenant_id`, `branch_id`, `product_id`.
2. Solo `quantity_available > 0`.
3. Join con `inventory_lots`.
4. Exigir `lot.status = 'ACTIVE'`.
5. Excluir `expiration_date < CURRENT_DATE`.
6. Si `requires_expiration=true`, exigir `expiration_date IS NOT NULL`.
7. Ordenar por:
   - `expiration_date ASC NULLS LAST`
   - `received_at ASC`
   - `lot_code ASC`
   - `lot.id ASC`
8. Bloquear balances con `FOR UPDATE`.
9. Acumular lotes hasta cubrir `v_quantity`.
10. Si no alcanza, lanzar error y dejar que transaccion haga rollback total.
11. Por cada seleccion:
   - Decrementar `quantity_on_hand`.
   - Actualizar `last_movement_at`.
   - Insertar `stock_movement_lots` con el `stock_movement_id` real.

PREGUNTA ABIERTA: Si un balance tiene `quantity_reserved`, v2 debe consumir solo `quantity_available`, nunca `quantity_on_hand` completo.

### Paso 6: pagos y totales

Mantener comportamiento v1:

1. Iterar `p_payment_methods`.
2. Validar `payment_method IN ('CASH','CARD','TRANSFER','OTHER')`.
3. Validar `amount > 0`.
4. Insertar `sale_payment_methods`.
5. Para `CASH`, exigir pagos y total exacto.
6. Calcular `balance`, `total_paid`, `balance_due` y `payment_status`.
7. Actualizar `sales`.
8. Actualizar estado del pedido si aplica.
9. Retornar venta.

## Pseudocodigo SQL

El pseudocodigo completo no ejecutable queda tambien en:

`scripts/database/sale/drafts/202606XX_inventory_create_sale_v2_design.sql`

Fragmento conceptual:

```sql
-- NO EJECUTAR - DISENO CONCEPTUAL
-- La implementacion real debe vivir en una migracion futura revisada.

-- Dentro del loop de items, despues de insertar stock_movements OUT:
-- IF v_product.requires_lot THEN
--   v_remaining_lot_quantity := v_quantity;
--
--   FOR v_lot_balance IN
--     SELECT ...
--     FROM inventory_lot_balances balance
--     JOIN inventory_lots lot ON ...
--     WHERE balance.tenant_id = p_tenant_id
--       AND balance.branch_id = p_branch_id
--       AND balance.product_id = v_item.product_id
--       AND balance.quantity_available > 0
--       AND lot.status = 'ACTIVE'
--       AND (lot.expiration_date IS NULL OR lot.expiration_date >= CURRENT_DATE)
--       AND (NOT v_product.requires_expiration OR lot.expiration_date IS NOT NULL)
--     ORDER BY lot.expiration_date ASC NULLS LAST, lot.received_at ASC, lot.lot_code ASC, lot.id ASC
--     FOR UPDATE OF balance
--   LOOP
--     v_quantity_from_lot := LEAST(v_remaining_lot_quantity, v_lot_balance.quantity_available);
--     UPDATE inventory_lot_balances SET quantity_on_hand = quantity_on_hand - v_quantity_from_lot ...
--     INSERT INTO stock_movement_lots (...) VALUES (...);
--     v_remaining_lot_quantity := v_remaining_lot_quantity - v_quantity_from_lot;
--     EXIT WHEN v_remaining_lot_quantity <= 0;
--   END LOOP;
--
--   IF v_remaining_lot_quantity > 0 THEN
--     RAISE EXCEPTION 'insufficient FEFO lot stock for product %', v_item.product_id;
--   END IF;
-- END IF;
```

## Tablas afectadas

| Tabla | v2 accion |
| --- | --- |
| `sales` | Igual que v1. Inserta cabecera. |
| `sale_items` | Igual que v1. No agrega lote. |
| `sale_item_taxes` | Igual que v1. |
| `stock_movements` | Igual que v1 en concepto, pero debe capturar `id` con `RETURNING`. |
| `sale_payment_methods` | Igual que v1. |
| `order_items` | Igual que v1 cuando hay pedido vinculado. |
| `orders` | Igual que v1 para recalculo de estado. |
| `inventory_lots` | Lee y valida estado/vencimiento. |
| `inventory_lot_balances` | Lee con lock y decrementa `quantity_on_hand`. |
| `stock_movement_lots` | Inserta trazabilidad por lote para productos loteados. |

Tablas no afectadas directamente por la funcion:

- `payments`
- `payment_allocations`
- movimientos de caja financieros

SUPUESTO: Esas tablas siguen siendo responsabilidad de `SaleService` y modulo finance despues de retornar la venta, como hoy.

## Bloqueos y concurrencia

Decision aprobada:

- Usar `FOR UPDATE`.
- No usar `SKIP LOCKED` inicialmente.

Diseno:

1. Para cada producto loteado, bloquear filas de `inventory_lot_balances` elegibles que participen en FEFO.
2. El lock debe suceder dentro de la misma transaccion donde se crea la venta.
3. Si otra venta intenta consumir los mismos balances, esperara el lock.
4. Al liberarse el lock, la segunda venta debe recalcular disponibilidad y fallar si no alcanza.

RIESGO: `FOR UPDATE` puede generar espera perceptible en POS si dos cajeros venden el mismo producto loteado al mismo tiempo.

Mitigacion inicial:

- Mantener query por `tenant_id`, `branch_id`, `product_id`.
- Usar indices existentes:
  - `idx_inventory_lot_balances_available_fefo`.
  - indices de `inventory_lots` por FEFO.
- Definir timeout operacional en API o base si el negocio lo requiere.

PREGUNTA ABIERTA: Definir mensaje funcional para lock timeout si PostgreSQL o API cancela la espera.

## Manejo de errores

Errores esperados:

| Caso | Error recomendado |
| --- | --- |
| Tipo invalido | `type is invalid`. |
| Items vacios | `sale items are required`. |
| Producto no existe | `product not found for tenant`. |
| Stock agregado insuficiente | `insufficient stock for product %`. |
| Producto loteado sin saldo loteado suficiente | `insufficient FEFO lot stock for product %`. |
| Producto `requires_expiration=true` con lote sin fecha | `expiration date is required for lot-controlled product %`. |
| Solo lotes vencidos | `insufficient FEFO lot stock for product %`. |
| Solo lotes bloqueados/cancelados/consumidos | `insufficient FEFO lot stock for product %`. |
| Pago cash sin total exacto | Mantener error v1. |

Regla:

- Cualquier error debe abortar toda la funcion.
- `SaleService` debe hacer `ROLLBACK` como hoy.
- No deben quedar `sales`, `sale_items`, `stock_movements`, `stock_movement_lots`, balances ni pagos parciales.

## Compatibilidad

| Area | Decision |
| --- | --- |
| `inventory_create_sale` | No se modifica. |
| Productos sin lote | Pueden seguir por v1 o por rama no loteada de v2. |
| Productos loteados | V2 exige saldos loteados reales. |
| `sale_items` | No se agrega lote. |
| Ticket | No muestra lote en primera integracion. |
| Reporteria POS | Sigue leyendo `sales`, `sale_items`, `stock_movements`. |
| Frontend POS | No manda `lot_id` ni `lot_code`. |
| Pagos/caja | Siguen en `SaleService`/finance. |
| Pedidos | V2 puede soportar `order_item_id`, pero entrega/facturacion FEFO de pedidos se disena aparte. |

SUPUESTO: Para activar `requires_lot=true`, debe existir saldo en `inventory_lot_balances`; si no, la venta falla aunque el stock agregado legacy alcance.

RIESGO: Activar lote para producto con stock legacy no convertido puede bloquear ventas loteadas. Debe existir estrategia de lote legacy o agotamiento controlado.

## Cancelacion futura

La cancelacion actual crea movimiento reverso `IN` por `StockMovementService.createMovement` usando los `stock_movements OUT` de la venta.

Diseno para reverso loteado:

1. Bloquear venta con `FOR UPDATE`, como hoy.
2. Buscar movimientos `OUT` originales:
   - `tenant_id`
   - `reference_type = 'SALE'`
   - `reference_id = saleId`
   - `reference_table = 'sales'`
   - `type = 'OUT'`
3. Buscar `stock_movement_lots` asociados a cada movimiento.
4. Si no hay links, usar flujo legacy actual.
5. Si hay links:
   - Crear movimiento reverso `IN`.
   - Para cada link original:
     - Validar lote original.
     - Si lote `CANCELLED`, no reversar automaticamente.
     - Si lote `BLOCKED` o vencido, permitir reverso.
     - Incrementar `inventory_lot_balances.quantity_on_hand` del mismo `lot_id` y `location_id`.
     - Crear `stock_movement_lots` para el movimiento `IN` reverso.
6. Mantener reverso de pagos/caja como hoy.

Decision aprobada:

- Reversar a lote vencido o `BLOCKED` permitido.
- Reversar a lote `CANCELLED` no permitido automaticamente.

Error recomendado para lote cancelado:

```text
cannot reverse sale into cancelled lot; manual inventory adjustment required
```

PREGUNTA ABIERTA: Si el lote fue cancelado por error y se necesita reversar, quien autoriza el ajuste manual y como queda auditado?

## Plan de pruebas

| Caso | Datos | Esperado |
| --- | --- | --- |
| Venta producto no loteado | `requires_lot=false` | Venta confirma como hoy; no crea `stock_movement_lots`. |
| Venta loteada un lote | Un balance suficiente | Descuenta un lote, crea un link. |
| Venta loteada varios lotes | Dos balances disponibles | Consume primero menor `expiration_date`, luego `received_at`, `lot_code`, `id`. |
| Venta mixta | Item loteado + item no loteado | Venta completa atomica; solo item loteado crea links. |
| Stock loteado insuficiente | Stock agregado puede o no alcanzar | Lanza error y rollback total. |
| Lote vencido | Balance disponible con `expiration_date < CURRENT_DATE` | No consume; si no hay otro lote, falla. |
| Lote bloqueado | `status=BLOCKED` | No consume. |
| Lote cancelado | `status=CANCELLED` | No consume. |
| Lote consumido | `status=CONSUMED` | No consume. |
| Requires expiration sin fecha | Producto `requires_expiration=true`, lote sin fecha | Falla por inconsistencia. |
| Concurrencia | Dos ventas sobre mismo saldo | Una espera; la segunda recalcula y falla si no alcanza. |
| Rollback segundo item | Primer item valido, segundo falla | No quedan venta, movimientos ni descuentos parciales. |
| Cancelacion loteada | Venta v2 con links | Reintegra lote original y crea link reverso. |
| Cancelacion a lote vencido | Lote vencio despues de venta | Permite reverso. |
| Cancelacion a lote `BLOCKED` | Lote bloqueado despues de venta | Permite reverso. |
| Cancelacion a lote `CANCELLED` | Lote cancelado despues de venta | Falla con error funcional. |
| Reconciliacion | Venta y cancelacion v2 | Cero discrepancias nuevas. |
| Reportes/tickets | Venta v2 | Ticket actual sale sin lote y no falla. |

## Plan de rollback

Rollback de implementacion futura:

1. Mantener `inventory_create_sale` v1 intacta.
2. Apagar flag `INVENTORY_FEFO_POS_ENABLED`.
3. `SaleRepository` vuelve a llamar v1.
4. No borrar `stock_movement_lots` ni `inventory_lot_balances` ya creados.
5. Ejecutar reconciliacion para ventas v2 ya generadas.
6. Si hay migracion de funcion v2, rollback SQL solo debe hacer `DROP FUNCTION inventory_create_sale_v2(...)` despues de backup.
7. Si una venta v2 ya consumio lotes, no intentar convertirla a v1.

RIESGO: Apagar v2 permite seguir vendiendo productos loteados por v1 si el API no bloquea esa ruta. Fase de implementacion debe asegurar que el flag apagado no genere ventas sin lote para productos ya activados, o documentar politica temporal.

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Doble consumo concurrente | `FOR UPDATE` sobre balances dentro de SQL. |
| Venta parcial por error en segundo item | Una sola transaccion, rollback total. |
| Stock agregado y loteado difieren | Ejecutar reconciliacion antes y despues de activar v2. |
| Producto loteado con saldo legacy | Definir lote legacy o no activar `requires_lot` hasta migrar saldo. |
| POS lento por locks | Indices FEFO, mensajes claros y monitoreo de tiempos. |
| Ticket roto | No cambiar contrato de `sale_items` ni funciones de reporteria en primera integracion. |
| Multiples fuentes SQL | Definir pipeline oficial antes de Fase 3.12. |
| Reverso a lote cancelado | Error funcional y ajuste manual auditado. |

## Preguntas abiertas

1. PREGUNTA ABIERTA: Cual script sera fuente oficial para Fase 3.12: `scripts/database/sale/012...` o `scripts/database/migrations/V0XX...`?
2. PREGUNTA ABIERTA: El flag inicial sera variable de entorno global o configuracion en base por tenant/sucursal?
3. PREGUNTA ABIERTA: Debe v2 marcar `inventory_lots.status='CONSUMED'` cuando todos sus balances lleguen a cero?
4. PREGUNTA ABIERTA: Debe existir un flujo previo obligatorio para convertir stock legacy a lote antes de activar `requires_lot`?
5. PREGUNTA ABIERTA: Que timeout maximo acepta POS esperando locks `FOR UPDATE`?
6. PREGUNTA ABIERTA: La cancelacion a lote `CANCELLED` debe bloquear toda la cancelacion o permitir cancelar venta y dejar pendiente ajuste manual?

## Criterios de aceptacion para Fase 3.12

1. Se crea migracion SQL nueva con `inventory_create_sale_v2`.
2. La migracion no reemplaza ni modifica `inventory_create_sale`.
3. La firma de v2 es compatible con v1.
4. Productos no loteados conservan comportamiento actual.
5. Productos loteados descuentan por FEFO dentro de SQL.
6. V2 inserta `stock_movements OUT` y captura su `id`.
7. V2 inserta `stock_movement_lots` con cantidades exactas.
8. V2 decrementa `inventory_lot_balances` sin saldo negativo.
9. V2 usa `FOR UPDATE` sin `SKIP LOCKED`.
10. V2 bloquea lotes vencidos, `BLOCKED`, `CANCELLED` y `CONSUMED`.
11. Error en cualquier item hace rollback total.
12. No se toca frontend, ticket ni reporteria.
13. OpenSpec y `git diff --check` pasan.

## Resultado de esta fase

Diseno completado. No se creo funcion ejecutable. No se ejecuto SQL. No se modifico `inventory_create_sale`, `inventory_invoice_order`, `SaleService`, `SaleRepository`, POS, `web/` ni `backend-reporteria/`.
