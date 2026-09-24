# Compras, pedidos y ventas operativas AS-IS — B5.3.1

## Alcance

Esta ficha describe el código disponible en el commit `83266f361e0ef5c53219e19dbc8756f71b4fc7e6`.
No sustituye la ficha del motor POS de B4.1. En particular, `POST /sales` y
`/operations/sales` son contratos diferentes.

Estados usados:

- **Confirmado:** existe evidencia en controlador, servicio, repositorio, SQL o prueba versionada.
- **Configurado:** existe ruta o configuración, pero falta validar el ambiente.
- **Histórico:** la evidencia QA o release describe una ejecución anterior.
- **No verificado:** requiere ambiente, base, proveedor o prueba funcional.

## Mapa de responsabilidades

| Dominio | Entrada principal | Responsabilidad confirmada | No debe confundirse con |
|---|---|---|---|
| Compras | `POST /purchases` | Crear compra, proveedor, costos, cantidades y estado inicial | Venta POS o pedido de cliente |
| Recepción | `POST /purchases/:id/receive` | Recibir total o parcialmente, lotes, ubicación y movimiento de stock | Confirmación de pedido |
| Liquidación | `PATCH /purchases/:id/settle-partial` | Cerrar saldo parcial de compra y registrar trazabilidad | Pago POS |
| Pedidos | `POST /orders` | Crear pedido de cliente y sus líneas | Venta confirmada |
| Pedido confirmado | `POST /orders/:id/confirm` | Cambiar pedido DRAFT a CONFIRMED | Recepción de compra |
| Entrega | `POST /orders/:id/deliver` | Entregar cantidades y actualizar estado/inventario | Facturación del pedido |
| Facturación de pedido | `POST /orders/:id/invoice` | Crear venta desde pedido con pagos | `POST /sales` iniciado directamente desde POS |
| Ventas operativas | `GET /operations/sales` y `GET /operations/sales/:saleId` | Consulta, detalle y recuperación del estado fiscal | Creación de una venta |

Fuentes principales: `api/src/modules/inventory/controllers/purchase.controller.ts`,
`order.controller.ts`, `sale.controller.ts`, `api/src/modules/operational-sales/`
y los servicios Web en `web/modules/inventory/services/` y
`web/modules/operational-sales/services/`.

## Compras

### Ciclo observado

1. La Web envía proveedor, sucursal, tipo `CASH|CREDIT`, total e items.
2. `PurchaseController` exige JWT, roles y permiso `INVENTORY_PURCHASES`.
3. Las operaciones de escritura exigen `RequireOpenCashSession`.
4. `PurchaseService.createPurchase` crea la compra en estado `DRAFT`.
5. La actualización acepta `DRAFT` o `PENDING` según el servicio.
6. La recepción valida la compra, cantidades, lotes, vencimiento y ubicación.
7. La recepción crea movimientos de inventario y actualiza cantidades recibidas.
8. La liquidación parcial registra el cierre parcial cuando la compra está en estado permitido.
9. La cancelación exige acción `cancel` y registra motivo y auditoría.

Rutas verificadas:

| Método | Ruta | Control adicional |
|---|---|---|
| `POST` | `/purchases` | caja abierta, escritura de compras |
| `PUT` | `/purchases/:id` | caja abierta, escritura de compras |
| `GET` | `/purchases` | lectura de compras |
| `GET` | `/purchases/:id` | lectura de compras |
| `POST` | `/purchases/:id/receive` | caja abierta, escritura |
| `PATCH` | `/purchases/:id/cancel` | caja abierta, acción `cancel` |
| `PATCH` | `/purchases/:id/settle-partial` | caja abierta, acción `settle_partial` |

Evidencia: `purchase.controller.ts:128-280` y
`purchase.service.ts:731-822,837-973,1410-1711,1731-2209`.

### Inventario, pagos y caja

La recepción trabaja con `productId`, `purchaseItemId`, cantidad, lote,
vencimiento, ubicación y costo unitario. El servicio recibe un `PoolClient` y
usa consultas con `FOR UPDATE` en la lectura de compra antes de mutarla.

La compra se relaciona con pagos mediante `reference_type = 'PURCHASE'` y con
movimientos mediante `reference_type = 'PURCHASE'`, según las funciones de
reportería de `scripts/database/migrations/20260507_reporting_phase5_business_reports.sql`.
La exigencia de caja abierta está en el controlador y en las consultas de
alcance operativo; no se certifica equivalencia entre todas las rutas y una
única sesión de caja en producción.

### Frontera transaccional

`PurchaseService` muestra `BEGIN`, `COMMIT` y `ROLLBACK` para creación,
actualización, recepción, liquidación y cancelación. La recepción y las
operaciones de estado bloquean la fila de compra con `FOR UPDATE`.

Esto demuestra una frontera transaccional por operación de servicio. No
demuestra entrega exactamente una vez ni recuperación automática después de un
timeout del cliente.

## Pedidos

### Ciclo observado

1. La Web crea un pedido con cliente, sucursal, tipo y líneas.
2. El backend crea el pedido en `DRAFT` y pago `PENDING`.
3. El pedido DRAFT puede modificarse.
4. `confirmOrder` cambia el pedido a `CONFIRMED`.
5. `deliverOrder` procesa cantidades entregadas y puede dejar estado `PARTIAL`
   o `COMPLETED`.
6. `invoiceOrder` exige caja abierta y sesión POS; recibe tipo y pagos, pero
   solo permite pedidos `PARTIAL` o `COMPLETED` con cantidades entregables aún
   no facturadas.
7. `cancelOrder` solo opera sobre estados permitidos por el servicio y registra
   la cancelación.
8. La entrega puede crear una relación de domicilio mediante el contrato de
   `DeliveriesService`.

Rutas verificadas en `order.controller.ts:135-318`:

`POST /orders`, `GET /orders`, `GET /orders/:id`, `PUT /orders/:id`,
`POST /orders/:id/confirm`, `POST /orders/:id/deliver`,
`POST /orders/:id/invoice`, `POST /orders/:id/cancel`, además de las rutas de
consulta y creación de delivery.

Los controles incluyen JWT, roles, permisos `ORDERS`, caja abierta y,
específicamente para facturación del pedido, `RequirePosSession`.

### Precio y persistencia

El servicio recalcula precios cuando recibe líneas en las rutas de creación o
actualización que aplican `PricingService`. Las migraciones de snapshot de
precios de pedidos y de impuestos de líneas están en:

- `scripts/database/migrations/20260607_orders_pricing_snapshot_phase_6_7_1.sql`
- `scripts/database/migrations/V078__sale_item_taxes_multi_tax_snapshot.sql`

La evidencia QA histórica en `docs/evidencia-api-local-orders-pricing-fase-6-7-3.md`
indica que `price`, `subtotal` y `total` enviados por cliente no son la fuente
autoritativa en el flujo probado con líneas. Esa evidencia no sustituye una
ejecución actual.

### Frontera transaccional

`OrderService` usa `PoolClient`, `BEGIN`, `COMMIT` y `ROLLBACK` en creación,
actualización y entrega. La confirmación y la cancelación observadas ejecutan
una actualización condicional directa sobre `orders`; no se encontró un
`BEGIN` propio para esas dos operaciones. `invoiceOrder` valida el pedido y
delega la creación de la venta derivada a
`SaleService.createSaleFromOrderDelivery`, por lo que su frontera efectiva debe
leerse junto con B4.1.

No se encontró una clave `Idempotency-Key` equivalente a la de `POST /sales`
en el contrato de pedidos. No se debe extender al pedido la garantía de
idempotencia documentada para venta POS.

## Ventas operativas

Ventas operativas no es el creador primario de ventas. Su controlador expone:

| Método | Ruta | Función |
|---|---|---|
| `GET` | `/operations/sales` | Lista filtrada y autorizada |
| `GET` | `/operations/sales/:saleId` | Detalle |
| `POST` | `/operations/sales/:saleId/electronic-billing/refresh` | Refresca estado fiscal |
| `POST` | `/operations/sales/:saleId/electronic-billing/retry` | Reintenta procesamiento fiscal |
| `POST` | `/operations/sales/:saleId/electronic-billing/recover-provider-create-intent` | Recuperación de intención fiscal |

Evidencia: `api/src/modules/operational-sales/operational-sales.controller.ts:20-80`.

El actor se construye con tenant, usuario, roles, sucursal, terminal, sesión
POS y sesión de caja. El servicio usa repositorios de consulta y servicios
fiscales; no se observan `BEGIN/COMMIT` para crear una venta en este módulo.

La Web corresponde a:

- `web/modules/operational-sales/services/operational-sales.service.ts`
- `web/modules/operational-sales/components/OperationalSalesPage.tsx`
- `web/modules/operational-sales/components/OperationalSaleDetailPage.tsx`
- `web/app/[tenant]/operations/sales/`

La creación directa está en `POST /sales`, descrita en B4.1 y ejecutada por
`SaleService`. La consulta operativa puede mostrar estados fiscales
`PENDING`, `PROCESSING`, `ACCEPTED`, `REJECTED`, `TECHNICAL_ERROR`,
`MANUAL_REVIEW` o `CANCELLED`, pero no crea la venta comercial.

## Relaciones entre dominios

| Relación | Evidencia | Estado |
|---|---|---|
| Compra → inventario | recepción y movimientos en `PurchaseService` | Confirmado |
| Compra → pagos | `payments.reference_type = 'PURCHASE'` | Confirmado |
| Compra → caja | `RequireOpenCashSession`, `cashSessionId` y reportes | Confirmado en código; ambiente pendiente |
| Pedido → cliente | `customerId` en DTO y servicio | Confirmado |
| Pedido → inventario | confirmación, entrega y movimientos | Confirmado en servicio; flujo completo QA pendiente |
| Pedido → pagos | invoice recibe pagos y estado financiero | Confirmado |
| Pedido → venta | `invoiceOrder` crea la operación correspondiente | Confirmado por código; detalle de atomicidad requiere matriz específica |
| Pedido → domicilio | `DeliveriesService.createFromOrder` | Confirmado |
| Venta operativa → venta | repositorio consulta `sales` | Confirmado como lectura |
| Venta operativa → fiscal | refresh, retry y recovery | Confirmado |
| Compras/pedidos → `IntegrationOutbox` | no demostrado como productor automático en estos contratos | No verificado |

## Fallos y recuperación

- Compras y pedidos hacen rollback cuando falla una operación dentro de su
  transacción explícita.
- `FOR UPDATE` reduce carreras sobre la compra o pedido leído, pero no prueba
  que todas las rutas compartan el mismo bloqueo.
- La recepción parcial tiene estado y cantidades persistidas; no se certifica
  que todos los reintentos del cliente sean idempotentes.
- La facturación del pedido puede producir una respuesta incierta; no se
  observó una clave de idempotencia igual a la de ventas POS.
- Ventas operativas maneja estados fiscales ambiguos y expone recuperación,
  pero no revierte la venta comercial por un error fiscal.
- No se verificó reconciliación automática completa para timeout en compras,
  pedidos o recepción.
- No se ejecutaron pruebas funcionales, QA remoto ni consultas de base activa.

## OpenSpec relacionado

Se contrastaron, sin modificar:

- `homologar-pagos-compras-pedidos-pos`
- `homologar-paginacion-busqueda-reportes-ventas`
- `vincular-domicilios-con-ventas`
- `alinear-creacion-domicilio-desde-pedido`
- `add-electronic-invoicing-customer-backend`
- `mejoras-operativas-manus-pos`

Las especificaciones contienen requisitos y tareas históricas. Una tarea abierta
no se interpreta automáticamente como funcionalidad ausente; cada afirmación
de esta ficha se apoya en código o SQL observado.

## Límites del expediente técnico

Esta ficha solo registra implementación técnica. Licencias, procedencia de
drivers, SBOM, cesiones, titularidad, autoría, originalidad y patentabilidad
siguen fuera de esta fase.
