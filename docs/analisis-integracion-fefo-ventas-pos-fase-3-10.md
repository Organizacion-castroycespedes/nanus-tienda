# Analisis integracion FEFO en ventas POS - Fase 3.10

Fecha de analisis: 2026-05-28

Ambiente: repositorio local/dev. No se ejecuto SQL contra base de datos.

## Resumen ejecutivo

El flujo POS actual esta concentrado en `SaleService.createSale`, `SaleRepository.createSaleWithFunction` y la funcion SQL `inventory_create_sale`. La funcion SQL crea la venta, items, impuestos, movimientos `OUT` en `stock_movements`, medios de pago legacy y actualiza totales/estado. Despues, `SaleService` crea pagos financieros reales dentro de la misma transaccion de API.

FEFO no debe injertarse directamente sobre la funcion actual sin una ruta de compatibilidad. La opcion recomendada es crear una funcion nueva `inventory_create_sale_v2` o equivalente, mantener `inventory_create_sale` intacta, y activar v2 de forma controlada cuando una venta contenga productos `requires_lot=true`.

RIESGO: Si FEFO se aplica fuera de la misma transaccion que crea `stock_movements`, se puede romper la reconciliacion entre `stock_movements`, `stock_movement_lots` e `inventory_lot_balances`.

## Flujo actual de venta POS

| Capa | Archivo | Responsabilidad observada |
| --- | --- | --- |
| Controller | `api/src/modules/inventory/controllers/sale.controller.ts` | `POST /api/sales` recibe `customerId`, `orderId`, `type`, `items` y `payments`; toma contexto tenant/usuario/POS y delega al service. |
| Service | `api/src/modules/inventory/services/sale.service.ts` | Normaliza contexto POS, valida sesion POS, cliente y pedido, normaliza pagos, abre transaccion, llama funcion SQL de venta, crea pagos financieros, sincroniza estado financiero y confirma la venta. |
| Repository | `api/src/modules/inventory/repositories/sale.repository.ts` | Convierte items/pagos al JSON esperado y ejecuta `inventory_create_sale(...)`. |
| SQL | `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql` | Crea `sales`, `sale_items`, `sale_item_taxes`, `stock_movements OUT`, `sale_payment_methods` y actualiza totales/estado. |
| SQL sync | `scripts/database/migrations/V047__sync_dev_functions_to_prd.sql` | Contiene version sincronizada de `inventory_create_sale`, `inventory_cancel_sale`, `inventory_invoice_order` y reportes relacionados. |

Flujo resumido:

1. `SaleController.create` recibe payload POS.
2. `SaleService.createSale` resuelve `tenantId`, `branchId`, `terminalId`, `userId` y `posSessionId`.
3. Abre transaccion con `BEGIN`.
4. Valida sesion POS activa, cliente y pedido opcional.
5. Normaliza pagos y traduce metodos a formato legacy.
6. `SaleRepository.createSaleWithFunction` llama `inventory_create_sale`.
7. SQL inserta venta, items, impuestos y `stock_movements OUT`.
8. `SaleService` crea registros financieros en `payments` y allocations.
9. `SaleService.finalizeSale` sincroniza estado financiero y pasa venta a `CONFIRMED`.
10. Hace `COMMIT`.

SUPUESTO: El flujo activo de POS usa `SaleService.createSale` y no la funcion SQL `inventory_cancel_sale` para cancelar. La funcion existe en scripts, pero no se encontro uso directo desde el API.

## Firma y comportamiento de `inventory_create_sale`

Firma observada en `scripts/database/sale/012_sale_financial_sync_and_pos_function.sql`:

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

JSON de items esperado por `SaleRepository.createSaleWithFunction`:

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

JSON de pagos legacy esperado:

```json
[
  {
    "payment_method": "CASH",
    "amount": 1000,
    "reference": null
  }
]
```

Validaciones actuales dentro de la funcion:

| Area | Comportamiento actual |
| --- | --- |
| Tipo de venta | Solo `CASH` o `CREDIT`. |
| Contexto POS | Exige `branch_id`, `terminal_id`, `user_id` y `pos_session_id`. |
| Tenant/sucursal | Valida `tenant_branches`. |
| Terminal | Valida terminal activa del tenant y sucursal. |
| Usuario | Valida usuario del tenant. |
| Sesion POS | Valida `pos_user_sessions` activa para tenant/sucursal/terminal/usuario. |
| Cliente | Valida cliente activo del tenant. |
| Pedido | Si `p_order_id` viene, valida pedido del tenant. |
| Items | Exige array no vacio, `product_id`, `quantity > 0`, `price >= 0`. |
| Producto | Valida producto activo del tenant. |
| Stock | Calcula stock agregado por `stock_movements` con `tenant_id`, `branch_id`, `product_id`. |
| Movimiento | Inserta un `stock_movements OUT` por item. |
| Pagos legacy | Inserta `sale_payment_methods`. |
| Venta cash | Exige pagos y total exacto. |
| Pedido vinculado | Actualiza `delivered_quantity` y `billed_quantity`. |

Transaccionalidad:

- La funcion SQL corre dentro de la transaccion abierta por `SaleService`.
- Si la funcion falla, `SaleService` hace `ROLLBACK`.
- Los pagos financieros creados despues tambien quedan dentro de la misma transaccion API.

PREGUNTA ABIERTA: Definir fuente unica de verdad para scripts de funcion POS. Hay definiciones en `sale/006_create_sale_function.sql`, `sale/012_sale_financial_sync_and_pos_function.sql` y `migrations/V047__sync_dev_functions_to_prd.sql`.

## Tablas afectadas por venta POS actual

| Tabla | Uso actual |
| --- | --- |
| `sales` | Cabecera de venta. |
| `sale_items` | Items vendidos. |
| `sale_item_taxes` | Impuestos por item cuando aplica. |
| `stock_movements` | Ledger principal de inventario; se inserta `OUT`. |
| `sale_payment_methods` | Registro legacy de medios de pago. |
| `payments` | Pagos financieros creados por `PaymentsService`. |
| `payment_allocations` | Asignacion financiera a `SALE`. |
| `cash_movements` o equivalente financiero | Se crea por pagos/caja via modulo finance cuando aplica. |
| `order_items` | Se actualiza si la venta viene de pedido. |
| `orders` | Se recalcula estado si hay pedido. |

Tablas loteadas que hoy no participan en venta POS:

| Tabla | Estado frente a POS |
| --- | --- |
| `inventory_lots` | No se lee ni valida en venta POS. |
| `inventory_lot_balances` | No se descuenta en venta POS. |
| `stock_movement_lots` | No se crea en venta POS. |

## Cancelacion y refund actual

`SaleController.cancel` llama `SaleService.cancelSale`.

Comportamiento observado:

1. Abre transaccion.
2. Bloquea la venta con `FOR UPDATE`.
3. Valida tenant/sucursal y estado `DRAFT` o `CONFIRMED`.
4. Lee `sale_items`.
5. Busca movimientos `OUT` en `stock_movements` con:
   - `tenant_id`
   - `reference_type = 'SALE'`
   - `reference_id = saleId`
   - `reference_table = 'sales'`
   - `type = 'OUT'`
6. Agrupa movimientos por producto.
7. Por cada item, crea movimiento reverso `IN` con `StockMovementService.createMovement`.
8. Si la venta venia de pedido, revierte `billed_quantity` y a veces `delivered_quantity`.
9. Reversa allocations/pagos y crea refund financiero si aplica.
10. Actualiza estado final a `CANCELLED` o `REFUNDED`.

RIESGO: La cancelacion actual empareja item y movimiento por `product_id` y orden. Para lotes, debe usar `stock_movement_lots.stock_movement_id` del movimiento original, no solo producto.

## `inventory_invoice_order`

Firma observada:

```sql
public.inventory_invoice_order(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_terminal_id uuid,
  p_user_id uuid,
  p_pos_session_id uuid,
  p_order_id uuid,
  p_type varchar(20),
  p_payments jsonb DEFAULT '[]'::jsonb
)
```

La funcion factura items ya entregados y pendientes de facturar. En el archivo analizado no se observo insercion de `stock_movements` dentro de `inventory_invoice_order`; el descuento de stock de pedidos parece pertenecer al flujo de entrega, no a facturacion.

PREGUNTA ABIERTA: Confirmar con pruebas de pedido si todos los descuentos de stock ocurren en entrega y no en `inventory_invoice_order`.

## Reportes y tickets actuales

`backend-reporteria` consulta funciones SQL:

| Reporte/ticket | Funcion SQL | Observacion |
| --- | --- | --- |
| Lista POS | `report_pos_sales` | Lee `sales`, totales, pagos y caja. No requiere lotes. |
| Ticket venta POS | `report_pos_sale_ticket` | Lee `sale_items` y `products`. No muestra lote. |
| Ticket cancelacion | `report_pos_sale_cancel_ticket` | Lee pagos/refunds y movimientos relacionados. No muestra lote. |

Los tickets pueden seguir funcionando si FEFO v2 mantiene `sales`, `sale_items`, `payments` y `stock_movements` con el contrato actual.

SUPUESTO: En la primera implementacion FEFO no se mostrara lote en ticket. Mostrar lotes seria una mejora futura de `backend-reporteria`.

## Opciones de integracion FEFO

### Opcion A: modificar `inventory_create_sale` actual

Consiste en reemplazar la funcion existente para que seleccione FEFO y actualice lotes.

| Criterio | Evaluacion |
| --- | --- |
| Riesgo tecnico | Alto. Toca la funcion critica actual. |
| Atomicidad | Alta si todo queda dentro de SQL. |
| Compatibilidad | Riesgosa; cualquier bug rompe POS existente. |
| Complejidad | Media-alta por mezclar legacy y loteado en una funcion viva. |
| Pruebas | Muy amplias: POS, pagos, caja, pedidos, cancelacion, reporteria. |
| Rollback | Dificil si se reemplaza la funcion en sitio. |
| Productos no loteados | Deben comportarse igual, pero regresion es probable. |
| Productos loteados | Puede resolver bien si bloquea balances. |

RIESGO: Si la funcion actual se rompe, no hay fallback limpio para POS.

### Opcion B: resolver FEFO en API antes de llamar `inventory_create_sale`

Consiste en usar `InventoryFefoService.selectLotsForConsumption` antes de vender y pasar allocations.

| Criterio | Evaluacion |
| --- | --- |
| Riesgo tecnico | Medio. Reusa servicio FEFO actual, pero no garantiza concurrencia por si solo. |
| Atomicidad | Incompleta si SQL no revalida y bloquea balances. |
| Compatibilidad | Buena si se mantiene v1, pero necesita contrato nuevo para allocations. |
| Complejidad | Media en API, alta en validacion SQL. |
| Pruebas | FEFO API, carrera concurrente, venta mixta, rollback. |
| Rollback | Bueno si esta detras de flag. |
| Riesgo de doble descuento | Medio si el preview API se toma como verdad sin bloqueo SQL. |

Recomendacion parcial: usar FEFO API solo como preview/debug. La seleccion definitiva debe validarse dentro de SQL transaccional.

### Opcion C: crear venta con v1 y despues crear lot links/balances

Consiste en dejar `inventory_create_sale` como esta y, despues de crear `stock_movements OUT`, crear `stock_movement_lots` y descontar `inventory_lot_balances`.

| Criterio | Evaluacion |
| --- | --- |
| Riesgo tecnico | Alto aunque parezca pequeno. |
| Atomicidad | Puede ser transaccional si ocurre antes del `COMMIT`, pero queda mal separada de la validacion de stock. |
| Compatibilidad | Buena para v1, mala para consistencia loteada. |
| Complejidad | Media en API. |
| Pruebas | Muchas pruebas de rollback y concurrencia. |
| Rollback | Simple a nivel codigo, pero datos pueden quedar inconsistentes si falla despues del movimiento. |
| Riesgo de doble descuento | Alto si dos ventas pasan stock agregado antes de bloquear lotes. |

RIESGO: `stock_movements OUT` se crea antes de confirmar que hay lote disponible. Aunque la transaccion pueda revertir, la ventana logica y la concurrencia quedan delicadas.

### Opcion D: crear `inventory_create_sale_v2` y dejar v1 intacta

Consiste en crear una nueva funcion para ventas con lotes, mantener v1 para ventas legacy y activar v2 de forma controlada.

| Criterio | Evaluacion |
| --- | --- |
| Riesgo tecnico | Medio-bajo comparado con tocar v1. |
| Atomicidad | Alta si v2 selecciona/actualiza lotes dentro de SQL. |
| Compatibilidad | Alta; v1 queda intacta para fallback. |
| Complejidad | Alta en SQL, controlada por separacion. |
| Pruebas | Amplias, pero aisladas contra v2. |
| Rollback | Bueno: apagar flag y volver a v1. |
| Productos no loteados | Pueden seguir por v1 o por rama legacy dentro de v2. |
| Productos loteados | v2 puede exigir FEFO, lot links y balances. |

Esta es la estrategia recomendada.

## Comparativa de opciones

| Opcion | Riesgo | Atomicidad | Compatibilidad | Rollback | Recomendacion |
| --- | --- | --- | --- | --- | --- |
| A. Modificar v1 | Alto | Alta | Media-baja | Dificil | No recomendada para primera fase. |
| B. FEFO API previo | Medio | Media | Media | Bueno | Usar solo como preview o con revalidacion SQL fuerte. |
| C. Post-proceso despues de v1 | Alto | Media | Media | Medio | No recomendada por riesgo de inconsistencia. |
| D. Nueva v2 | Medio | Alta | Alta | Bueno | Recomendada. |

## Recomendacion tecnica

Crear `inventory_create_sale_v2` con el mismo contrato de retorno de v1 y mantener `inventory_create_sale` intacta.

Estrategia recomendada:

1. `SaleRepository` mantiene `createSaleWithFunction` para v1.
2. Se agrega metodo futuro `createSaleWithFunctionV2`.
3. `SaleService` o `SaleRepository` decide v1/v2 bajo flag interno, por ejemplo `INVENTORY_FEFO_POS_ENABLED=false` por defecto.
4. Si el flag esta apagado, todo sigue por v1.
5. Si el flag esta encendido y la venta contiene productos `requires_lot=true`, usar v2 para toda la venta.
6. Si la venta es solo de productos no loteados, mantener v1 al inicio para minimizar riesgo.
7. La seleccion FEFO final debe ocurrir dentro de v2 con locks de base de datos.
8. `InventoryFefoService` queda como preview/debug, no como fuente final de consumo.

Para productos loteados, v2 debe:

- Validar producto del tenant.
- Validar `requires_lot`.
- Validar stock agregado actual como proteccion compatible.
- Seleccionar balances elegibles por FEFO:
  1. `expiration_date ASC NULLS LAST`.
  2. `received_at ASC`.
  3. `lot_code ASC`.
  4. `id ASC`.
- Excluir lotes `BLOCKED`, `CANCELLED`, `CONSUMED`.
- Excluir lotes vencidos.
- Rechazar lote sin `expiration_date` cuando `requires_expiration=true`.
- Bloquear filas de balance con `FOR UPDATE` durante el consumo.
- Insertar `stock_movements OUT`.
- Insertar `stock_movement_lots` por cada lote consumido.
- Decrementar `inventory_lot_balances.quantity_on_hand`.
- Actualizar `last_movement_at`.
- Mantener `quantity_reserved` sin cambios.

PREGUNTA ABIERTA: Decidir si v2 debe usar `FOR UPDATE` esperando locks o `FOR UPDATE SKIP LOCKED` para fallar rapido en POS concurrido.

## Plan incremental propuesto

| Paso futuro | Accion |
| --- | --- |
| 3.11 | Disenar contrato tecnico de `inventory_create_sale_v2` y payload opcional de allocations. |
| 3.12 | Crear migracion SQL con `inventory_create_sale_v2` sin reemplazar v1. |
| 3.13 | Agregar repository/service bajo flag interno, sin activar por defecto. |
| 3.14 | Agregar tests unitarios e integracion local para venta loteada. |
| 3.15 | Adaptar cancelacion para revertir lotes usando `stock_movement_lots`. |
| 3.16 | Ejecutar reconciliacion loteada despues de ventas y cancelaciones. |
| 3.17 | Activar piloto por tenant/sucursal si negocio lo aprueba. |

## Cambios SQL futuros

Cambios recomendados:

1. Crear nueva funcion `public.inventory_create_sale_v2`.
2. Mantener mismos parametros base que v1.
3. Evaluar parametro opcional:

```sql
p_lot_allocations JSONB DEFAULT NULL
```

4. Mantener mismo `RETURNS TABLE` que v1 para no romper `SaleRepository`.
5. Dentro de v2, insertar `stock_movements` con `RETURNING id`.
6. Insertar `stock_movement_lots` usando ese `stock_movement_id`.
7. Decrementar `inventory_lot_balances` con validacion de saldo disponible.
8. Bloquear balances elegibles dentro de la misma transaccion.
9. No tocar `inventory_create_sale` v1.
10. Crear funcion o bloque de soporte para cancelacion loteada solo si la implementacion elige mover la cancelacion a SQL.

RIESGO: Hay multiples scripts que definen o sincronizan funciones POS. La implementacion debe actualizar el script fuente y el script de sync/deploy que use produccion.

## Cambios API futuros

Cambios esperados en `api/`:

| Archivo/zona | Cambio futuro |
| --- | --- |
| `SaleRepository` | Agregar llamada a `inventory_create_sale_v2`. |
| `SaleService` | Decidir v1/v2 por flag y productos loteados; mantener transaccion actual. |
| `ProductRepository` o query local | Consultar `requires_lot` para decidir si usa v2. |
| `InventoryFefoService` | Mantener como preview; no mutar datos. |
| `StockMovementLotService` | Podria no ser usado si v2 crea links en SQL; si se usa desde API, debe correr con el mismo client/transaccion. |
| `InventoryLotBalanceService` | Podria no ser usado si v2 descuenta en SQL; evitar doble logica. |

SUPUESTO: Para atomicidad fuerte, la mutacion de balances y links de venta debe vivir en SQL v2. El API puede decidir ruta, pero no debe consumir lotes fuera de la transaccion SQL.

## Cambios tests futuros

Pruebas minimas para fase de implementacion:

| Caso | Resultado esperado |
| --- | --- |
| Venta no loteada | Sigue igual por v1 o rama legacy. |
| Venta loteada con un lote suficiente | Consume ese lote y crea `stock_movement_lots`. |
| Venta loteada con varios lotes | Consume en orden FEFO. |
| Venta loteada sin stock por lote | Falla y no crea venta parcial. |
| Venta loteada con stock agregado suficiente pero loteado insuficiente | Falla y no crea venta. |
| Lote vencido | No se consume. |
| Lote `BLOCKED`, `CANCELLED` o `CONSUMED` | No se consume. |
| Producto `requires_expiration=true` con lote sin fecha | Falla por inconsistencia. |
| Venta mixta | Crea movimientos para productos loteados y no loteados sin doble descuento. |
| Dos ventas concurrentes | No consumen el mismo saldo por lote. |
| Error a mitad de venta | Rollback total de venta, pagos, stock y lotes. |
| Cancelacion | Reintegra al lote original usando `stock_movement_lots`. |
| Reconciliacion | Queda sin discrepancias para ventas nuevas. |
| Reportes/tickets | Siguen leyendo `sales` y `sale_items` sin cambio contractual. |

No se encontraron tests `sale*.spec.ts` en `api/src/modules/inventory` durante este analisis.

## Impacto en cancelacion

La cancelacion futura debe detectar si los movimientos originales tienen links loteados.

Regla propuesta:

1. Buscar movimientos `OUT` originales de la venta.
2. Buscar `stock_movement_lots` por cada `stock_movement_id`.
3. Si hay links:
   - Crear movimiento reverso `IN`.
   - Crear `stock_movement_lots` reverso contra los mismos `lot_id` y `location_id`.
   - Incrementar `inventory_lot_balances.quantity_on_hand`.
4. Si no hay links:
   - Mantener flujo legacy actual.
5. Mantener pagos/refunds/caja como hoy.

Politica recomendada:

- Permitir reintegro por cancelacion aunque el lote ya este vencido, porque es reverso operativo y no venta nueva.
- No vender lote vencido en v2.
- Para lote `BLOCKED`, permitir reintegro si el lote era el original de la venta y documentar que queda bloqueado con saldo.
- Para lote `CANCELLED`, abrir decision de negocio.

PREGUNTA ABIERTA: Si un lote fue `CANCELLED` despues de la venta, la cancelacion debe reabrir saldo en ese lote, bloquear la cancelacion o crear un lote de reverso especial?

## Impacto en reportes/tickets

Sin mostrar lotes:

- `report_pos_sales` no requiere cambio.
- `report_pos_sale_ticket` no requiere cambio si `sale_items` conserva contrato.
- `report_pos_sale_cancel_ticket` no requiere cambio si `stock_movements` conserva contrato.
- `backend-reporteria` no necesita cambios inmediatos.

Mostrando lotes en el futuro:

- Agregar dataset opcional desde `stock_movement_lots` + `inventory_lots`.
- No cambiar campos existentes; agregar arreglo `lots` por item o por movimiento.
- Actualizar templates PDF solo si negocio exige trazabilidad visible.

RIESGO: Mostrar lote en ticket puede exponer informacion operativa no requerida por cliente final. Debe validarlo negocio.

## Impacto en frontend/POS

Para primera implementacion:

- No se requiere cambiar POS si v2 calcula FEFO automaticamente.
- Los errores nuevos deben ser funcionales y claros: stock por lote insuficiente, lote vencido, lote bloqueado.
- El preview FEFO existente puede servir a futuro para depuracion o pantalla administrativa.

PREGUNTA ABIERTA: El cajero debe poder seleccionar lote manualmente o siempre sera FEFO automatico?

## Criterios de aceptacion para implementacion futura

1. `inventory_create_sale` v1 queda intacta.
2. `inventory_create_sale_v2` existe y retorna contrato compatible.
3. Flag interno permite apagar v2 y volver a v1.
4. Venta no loteada sigue funcionando como hoy.
5. Venta loteada descuenta `inventory_lot_balances`.
6. Venta loteada crea `stock_movement_lots`.
7. `stock_movements` sigue siendo ledger principal.
8. FEFO se resuelve de forma atomica y con locks.
9. Venta no consume lotes vencidos, `BLOCKED`, `CANCELLED` ni `CONSUMED`.
10. Cancelacion repone al lote original.
11. Error intermedio hace rollback total.
12. Reconciliacion loteada no reporta discrepancias para ventas nuevas.
13. Reportes/tickets existentes siguen funcionando.
14. POS/web no requiere cambio obligatorio para vender productos loteados.

## Plan rollback

Rollback operativo recomendado:

1. Apagar flag `INVENTORY_FEFO_POS_ENABLED`.
2. `SaleRepository` vuelve a llamar v1.
3. Mantener tablas loteadas sin borrar.
4. Ejecutar reconciliacion para detectar ventas v2 ya creadas.
5. No borrar `stock_movement_lots` ni `inventory_lot_balances` si ya hay ventas loteadas.
6. Si la migracion de v2 debe revertirse, hacer `DROP FUNCTION inventory_create_sale_v2(...)` solo despues de backup.

RIESGO: Si ya existen ventas loteadas, volver a v1 no borra trazabilidad; solo detiene nuevos consumos loteados.

## Preguntas abiertas

1. PREGUNTA ABIERTA: Cual sera el script fuente de verdad para funciones POS: `sale/012`, `migrations/V047` u otro pipeline?
2. PREGUNTA ABIERTA: Se usara flag global, por tenant o por sucursal para activar FEFO POS?
3. PREGUNTA ABIERTA: v2 debe resolver FEFO siempre en SQL o aceptar allocations manuales validadas?
4. PREGUNTA ABIERTA: Como manejar cancelacion si el lote original fue `CANCELLED` despues de la venta?
5. PREGUNTA ABIERTA: El POS debe mostrar lote consumido en el ticket o solo en reporteria interna?
6. PREGUNTA ABIERTA: Se debe marcar `inventory_lots.status = CONSUMED` cuando la disponibilidad total del lote llegue a cero?
7. PREGUNTA ABIERTA: Se permitira venta de producto loteado con saldo legacy no convertido a lote?
8. PREGUNTA ABIERTA: Que nivel de aislamiento se usara para ventas concurrentes: lock con espera o `SKIP LOCKED`?

## Resultado de esta fase

Analisis completado. No se implemento FEFO en ventas. No se modificaron servicios de venta, repositorios de venta, funciones SQL, migraciones, frontend ni reporteria.
