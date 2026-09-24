# Motor transaccional POS AS-IS — B4.1

## Alcance

Este documento describe la venta directa desde `web/[tenant]/pos` hasta la API
NestJS. Separa esa ruta de la facturación de pedidos y de ventas operativas.
La fuente auditada es el commit publicado `06f4c143f0f4aac466b2817ef7cde22e6dc2dfac`;
el código funcional se inspeccionó en la rama actual sin modificarlo.

Estados usados en este documento:

- **Confirmado:** existe evidencia en código o SQL versionado.
- **Configurado:** aparece en configuración, pero no prueba operación del ambiente.
- **No verificado:** requiere ejecución funcional, ambiente o hardware.
- **Futuro:** no pertenece a la implementación demostrada.

## Componentes y responsabilidades

| Componente | Responsabilidad confirmada | Evidencia |
|---|---|---|
| `PosScreen` | Valida datos de interfaz, arma pagos, crea clave de intento y llama `POST /sales`. | `web/modules/pos/components/PosScreen.tsx:2410-2515` |
| `pos.service.ts` | Cliente Web para catálogo, vista previa de precio, creación y reconciliación de venta. | `web/modules/pos/services/pos.service.ts:85-125` |
| `SaleController` | Protege rutas, construye contexto y expone creación, consulta y cancelación. | `api/src/modules/inventory/controllers/sale.controller.ts:76-245` |
| `SaleService` | Orquesta validación, precio, pagos, persistencia, outbox, idempotencia y rollback. | `api/src/modules/inventory/services/sale.service.ts:2541-2745` |
| `PricingService` | Calcula precio, impuestos y promoción para canal `POS`. | `api/src/modules/pricing/pricing.service.ts:35-621` |
| `SaleRepository` | Valida contexto y ejecuta `inventory_create_sale_v2` con `PoolClient`. | `api/src/modules/inventory/repositories/sale.repository.ts:252-553` |
| `PaymentsService` | Valida método, caja, referencias, crea pago y movimiento de caja. | `api/src/modules/finance/payments/payments.service.ts:406-683` |
| `IntegrationOutboxService` | Encola el evento fiscal dentro de la transacción cuando la política lo habilita. | `api/src/modules/inventory/services/sale.service.ts:1246-1393` |
| `inventory_create_sale_v2` | Inserta venta y líneas, valida stock, registra `OUT`, aplica FEFO y calcula estado financiero base. | `scripts/database/migrations/V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql:200-900` |

## Flujo directo confirmado

1. Web conserva carrito y contexto POS local. Esto es UX; no es reserva de stock.
2. `PosScreen` valida cliente, pagos, referencias, caja para efectivo y total.
3. Web envía `POST /sales` con `Idempotency-Key` y `includePosSession`.
4. `SaleController` exige JWT, rol, permiso `POS WRITE`, caja abierta y sesión POS.
5. `SaleService` normaliza tenant, sucursal, terminal, usuario, `posSessionId` y
   `cashSessionId`. Si falta sesión POS, rechaza o resuelve la sesión activa válida.
6. Abre `BEGIN` con un `PoolClient` y reserva la clave de idempotencia.
7. `PricingService` calcula cada línea con canal `POS`, impuestos y promoción.
8. `inventory_create_sale_v2` persiste la venta, líneas y snapshot; valida producto,
   stock, lote y contexto. Registra salida de inventario y FEFO cuando aplica.
9. `PaymentsService.createInTransaction` registra pagos, asignaciones y movimiento
   de caja para pagos completados en efectivo.
10. Se sincroniza estado financiero, se encola el evento fiscal si la política lo
    indica, se completa idempotencia y se ejecuta `COMMIT`.
11. La auditoría `SALE_CREATED` ocurre después del commit. La respuesta vuelve a Web.

La atomicidad anterior está confirmada para esta ruta cuando todos los pasos usan
el mismo `PoolClient`. No se extiende automáticamente a llamadas posteriores,
reportería, hardware o despacho remoto del evento.

## Precio, impuesto y promoción

El backend es autoritativo para el total final. El frontend muestra una vista
previa y envía también sus valores de línea; `SaleService` vuelve a calcularlos
antes de persistir. El SQL exige snapshot POS completo cuando
`pricing_source = POS_PRICING_SERVICE`.

`PricingService` usa producto, sucursal, cliente opcional, fecha y canal. Ordena
impuestos por `calculationOrder`, soporta impuestos incluidos/excluidos y reglas
específicas de alcohol. Las promociones candidatas se filtran por tenant,
producto, sucursal y ventana de vigencia. La selección usa prioridad, descuento,
fecha de creación e identificador como desempates. El dinero se redondea a dos
decimales; tasas se normalizan con mayor precisión interna.

Para una venta `CASH`, el total de pagos debe coincidir con el total calculado por
backend. Para `CREDIT`, el código permite pago parcial y calcula saldo. La UI
clasifica la venta según el monto pagado; esa validación visual no sustituye la
validación de backend.

## Caja, pagos e inventario

El flujo exige sesión POS y, por guard, caja abierta. Un pago en efectivo requiere
sesión de caja abierta, misma sucursal y usuario autorizado. El método puede exigir
referencia. El backend valida método de pago, institución, documento y saldo.

La función SQL calcula existencias por `stock_movements`. Para lotes bloquea filas
de `inventory_lot_balances`, ordena FEFO por vencimiento/recepción/código y crea
`stock_movement_lots`. Una insuficiencia produce excepción y rollback. El inventario
mostrado por Web no equivale a una reserva previa.

## Idempotencia y errores

`sale_creation_idempotency` usa clave `(tenant_id, idempotency_key)`, guarda hash de
solicitud y bloquea la fila existente con `FOR UPDATE`. La misma clave con hash
distinto se rechaza. Una venta completada puede reconciliarse con
`GET /sales/idempotency/:key`. Una reserva incompleta requiere reconciliación y no
se presenta como venta confirmada.

La ruta captura errores, ejecuta `ROLLBACK` y libera conexión. No se encontró una
garantía de entrega exactamente una vez para el outbox. El despacho fiscal puede
reintentar según B2.3; eso es posterior al commit de la venta.

## Cancelación

`POST /sales/:id/cancel` bloquea la venta con `FOR UPDATE`. Solo permite estados
cancelables demostrados por el servicio. Revierte stock con movimientos `IN`,
revierte lotes, restaura cantidades de pedido y crea reembolso para pagos
completados. Puede crear movimiento de caja de devolución. El estado final es
`CANCELLED` o `REFUNDED` según pagos reembolsados. Todo el flujo usa transacción.

No se identificó un endpoint independiente de devolución parcial. No se afirma que
exista esa capacidad.

## Outbox y facturación

La venta puede construir un snapshot fiscal con cliente, líneas, impuestos, pagos,
tenant y correlación. Si la política automática está activa, el evento se encola
con el mismo `PoolClient` antes del commit. El consumidor, inbox, reintentos y
garantías están en [Integration Outbox AS-IS](integration-outbox-as-is.md) y la
[matriz B2.3](event-state-matrix-b23.md). La transmisión real a DIAN no queda
demostrada por este flujo.

## Persistencia relacionada

| Objeto | Uso observado | Fuente |
|---|---|---|
| `sales`, `sale_items`, `sale_item_taxes` | Cabecera, líneas, snapshot, impuestos y estados. | `V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql` |
| `stock_movements`, `stock_movement_lots` | Salida y trazabilidad de lotes. | `V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql` |
| `inventory_lots`, `inventory_lot_balances` | Disponibilidad y FEFO. | `V051__inventory_create_sale_v2_pos_pricing_snapshot_phase_6_8_3.sql` |
| `payments`, asignaciones y movimientos de caja | Pagos y efecto financiero. | `api/src/modules/finance/payments/` |
| `sale_creation_idempotency` | Reserva y reconciliación de creación. | `scripts/database/migrations/V086__sale_creation_idempotency.sql` |
| `integration_outbox_events` | Evento fiscal posterior a venta. | `docs/architecture/integration-outbox-as-is.md` |

La equivalencia entre migraciones versionadas, dump QA y esquemas desplegados por
ambiente sigue pendiente. No se consultaron bases activas.

## Límites y riesgos

- Confirmado: atomicidad de la ruta directa cuando todos los pasos usan el mismo
  `PoolClient`.
- No verificado: ejecución en QA/producción, proveedor fiscal autorizado, DIAN,
  reportería posterior, hardware y recuperación con conexión caída.
- Riesgo: el carrito Web persiste localmente, pero no reserva inventario.
- Riesgo: respuestas inciertas después de red o timeout requieren reconciliación;
  no se afirma que el cliente pueda resolver todos los casos automáticamente.
- Riesgo: las versiones de la función SQL instaladas por ambiente pueden diferir.

## Documentos relacionados

[Arquitectura Web AS-IS](web-as-is.md), [Persistencia AS-IS](../database/persistence-as-is.md),
[Contratos frontend-backend](frontend-contract-matrix.md), [Outbox AS-IS](integration-outbox-as-is.md),
[diagramas](diagrams.md).
