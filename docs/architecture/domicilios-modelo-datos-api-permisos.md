# Domicilios - Modelo de datos, API y permisos

## Resumen ejecutivo

Esta fase extiende el diseno OpenSpec del modulo Domicilios con una propuesta tecnica documental. El modulo sigue sin implementacion runtime: no hay migraciones, entidades reales, endpoints reales, permisos reales ni cambios en frontend/backend productivo.

La recomendacion tecnica es crear una entidad principal futura `deliveries`, acompanada desde el inicio por `delivery_status_history` para auditoria de estados. `delivery_payment_events`, `customer_delivery_addresses` y `delivery_assignments` quedan como tablas candidatas, pero no todas son obligatorias para v0.0.1.

Piedra grande aqui: dinero. Si el valor de domicilio se cobra al cliente, debe tener una sola fuente financiera. Si entra en factura/POS, no debe duplicarse como ingreso separado en caja. Si es contraentrega, debe quedar por recaudar y conciliar.

## Fuera de alcance

- No crear SQL.
- No crear migraciones.
- No crear entidades TypeScript.
- No crear DTOs TypeScript.
- No crear endpoints reales.
- No modificar backend funcional.
- No modificar frontend funcional.
- No modificar permisos reales.
- No modificar menus reales.
- No modificar pedidos, facturacion, POS, caja o reporteria.
- No tocar produccion.
- No hacer commit sin aprobacion expresa.

## Compatibilidad con patrones actuales

Patrones observados:

- Backend NestJS usa modulos por dominio, controllers, services, repositories o SQL directo.
- DTOs siguen nombres `CreateXDto`, `UpdateXDto`, `XResponseDto` y filtros tipo `ListXDto`.
- Rutas API actuales usan prefijo global `/api` y controllers como `orders`, `customers`, `sales`, `finance/*`.
- Permisos combinan `@Roles(...)`, `@RequirePermission(...)`, `RolesGuard`, `PermissionsGuard` y alcance por tenant/sucursal.
- Frontend usa rutas tenant-aware como `/{tenant}/orders`, `/{tenant}/customers`, `/{tenant}/finance/*`.
- Menu y rutas usan `MENU_KEYS` y `web/lib/route-permissions.ts`.
- Entidades operativas usan `tenant_id`, timestamps y relaciones por UUID.
- Finanzas separa POS session de cash session. Esto debe conservarse.

## Modelo de datos propuesto

### Tabla principal: `deliveries`

Tabla futura para el domicilio operativo.

| Columna | Tipo conceptual | Requerido | Notas |
| --- | --- | --- | --- |
| `id` | uuid | Si | Identificador del domicilio. |
| `tenant_id` | uuid | Si | Aislamiento multi-tenant obligatorio. |
| `branch_id` | uuid | Recomendado | Sucursal operativa cuando aplique. |
| `customer_id` | uuid | Opcional | Cliente asociado cuando existe. |
| `order_id` | uuid | Opcional | Pedido asociado cuando existe. |
| `sale_id` | uuid | Opcional | Venta POS asociada cuando existe. |
| `invoice_id` | uuid | Opcional | Factura/documento fiscal si el modelo lo separa de `sales`. |
| `cash_session_id` | uuid | Opcional | Solo cuando hay recaudo, movimiento o conciliacion de caja. |
| `delivery_number` | text/int | Si | Consecutivo operativo por tenant o tenant/sucursal. |
| `status` | enum/text | Si | Estado logistico. |
| `contact_name` | text | Opcional | Obligatorio si cliente generico no aporta nombre. |
| `contact_phone` | text | Si | Telefono de entrega. |
| `address_line` | text | Si | Direccion snapshot. |
| `address_reference` | text | Opcional | Punto de referencia. |
| `neighborhood` | text | Opcional | Barrio. |
| `zone` | text | Opcional | Zona/ruta. |
| `delivery_fee` | numeric | Opcional | Valor del domicilio/envio. Default recomendado `0`. |
| `delivery_fee_source` | enum/text | Si | Fuente financiera: `INVOICE`, `POS_SALE`, `OPERATIVE_SEPARATE`, `NONE`. |
| `payment_status` | enum/text | Si | `NOT_REQUIRED`, `PREPAID`, `COLLECT_ON_DELIVERY`, `COLLECTED`, `PENDING_RECONCILIATION`, `REFUND_PENDING`. |
| `payment_method` | text/uuid | Opcional | Metodo de pago si aplica. |
| `assigned_user_id` | uuid | Opcional | Repartidor/responsable actual. |
| `dispatched_by_user_id` | uuid | Opcional | Usuario que despacha. |
| `delivered_by_user_id` | uuid | Opcional | Usuario que marca entrega. |
| `cancelled_by_user_id` | uuid | Opcional | Usuario que cancela. |
| `not_delivered_by_user_id` | uuid | Opcional | Usuario que marca no entregado. |
| `created_by_user_id` | uuid | Si | Usuario que registra. |
| `created_at` | timestamptz | Si | Fecha de creacion. |
| `updated_at` | timestamptz | Si | Fecha de ultima actualizacion. |
| `dispatched_at` | timestamptz | Opcional | Fecha de despacho. |
| `delivered_at` | timestamptz | Opcional | Fecha de entrega. |
| `cancelled_at` | timestamptz | Opcional | Fecha de cancelacion. |
| `not_delivered_at` | timestamptz | Opcional | Fecha de no entrega. |
| `cancellation_reason` | text | Opcional | Obligatorio al cancelar. |
| `not_delivered_reason` | text | Opcional | Obligatorio al marcar no entregado. |
| `notes` | text | Opcional | Observaciones operativas. |

### Estados de `deliveries.status`

- `PENDIENTE`
- `EN_PREPARACION`
- `DESPACHADO`
- `ENTREGADO`
- `CANCELADO`
- `NO_ENTREGADO`

### Fuentes de `delivery_fee_source`

- `NONE`: no hay cobro de envio.
- `INVOICE`: el envio esta incluido en factura/documento fiscal.
- `POS_SALE`: el envio esta incluido en venta POS.
- `OPERATIVE_SEPARATE`: cargo operativo separado pendiente de definicion fiscal/financiera.

Regla: esta columna existe para que dinero no se cuente dos veces. Plata duplicada se ve bonita en papel, pero caja muerde.

### Estados de `payment_status`

- `NOT_REQUIRED`: no hay pago del domicilio.
- `PREPAID`: ya esta pagado en POS/factura.
- `COLLECT_ON_DELIVERY`: se cobra contraentrega.
- `COLLECTED`: recaudado.
- `PENDING_RECONCILIATION`: recaudado o esperado, pero falta conciliacion.
- `REFUND_PENDING`: requiere devolucion o nota credito.

## Entidades candidatas adicionales

### `delivery_status_history`

Recomendada desde v0.0.1 tecnica. Guarda cambios de estado y acciones sensibles.

Campos candidatos:
- `id`
- `tenant_id`
- `delivery_id`
- `from_status`
- `to_status`
- `action`
- `actor_user_id`
- `occurred_at`
- `reason`
- `notes`
- `cash_session_id`
- `metadata`

Razon: los campos directos en `deliveries` sirven para consulta rapida, pero no bastan para auditoria completa.

### `delivery_payment_events`

Opcional para cuando haya contraentrega o conciliacion compleja.

Campos candidatos:
- `id`
- `tenant_id`
- `delivery_id`
- `cash_session_id`
- `event_type`
- `expected_amount`
- `collected_amount`
- `difference_amount`
- `payment_method`
- `actor_user_id`
- `occurred_at`
- `notes`

Recomendacion: no crear esta tabla hasta cerrar reglas de caja. Si Fase 3 decide contraentrega real, conviene crearla.

### `customer_delivery_addresses`

Opcional para libreta de direcciones de cliente.

Campos candidatos:
- `id`
- `tenant_id`
- `customer_id`
- `label`
- `address_line`
- `address_reference`
- `neighborhood`
- `zone`
- `contact_name`
- `contact_phone`
- `is_default`
- `created_at`
- `updated_at`
- `deleted_at`

Recomendacion: no bloquear v0.0.1 por esta tabla. `deliveries` debe guardar snapshot siempre.

### `delivery_assignments`

Opcional si se requiere historial multiple de asignaciones.

Campos candidatos:
- `id`
- `tenant_id`
- `delivery_id`
- `assigned_user_id`
- `assigned_by_user_id`
- `assigned_at`
- `unassigned_at`
- `notes`

Recomendacion: para v0.0.1 puede bastar `assigned_user_id` mas `delivery_status_history`, salvo que negocio necesite reasignaciones auditadas.

## Relaciones propuestas

### Clientes

- `deliveries.customer_id` referencia `customers.id` cuando existe cliente identificado.
- Un cliente puede tener muchos domicilios.
- El domicilio pertenece a un tenant.
- `tenant_id` del domicilio debe coincidir con `customers.tenant_id`.
- El domicilio guarda snapshot de contacto/direccion aunque el cliente cambie.
- Cliente generico/final consumer requiere `contact_name` o referencia, `contact_phone` y `address_line`.

### Pedidos

- `deliveries.order_id` referencia `orders.id` cuando nace o se vincula a pedido.
- En v0.0.1 un pedido debe tener maximo un domicilio activo.
- Domicilios activos para esta regla: `PENDIENTE`, `EN_PREPARACION`, `DESPACHADO`.
- Estados finales: `ENTREGADO`, `CANCELADO`, `NO_ENTREGADO`.
- El tenant de domicilio y pedido debe coincidir.
- Cancelar pedido antes de despacho debe cancelar/bloquear domicilio con motivo.
- Cancelar pedido despues de despacho requiere resolucion supervisada.

### Facturacion / POS / ventas

- `deliveries.sale_id` referencia `sales.id` cuando la venta POS es fuente.
- `deliveries.invoice_id` queda como referencia conceptual si el sistema separa factura fiscal de venta.
- El domicilio puede existir antes o despues de facturar.
- Anular factura no borra domicilio.
- Si el envio se cobra al cliente, `delivery_fee_source` debe indicar si fue facturado/POS o separado.

### Caja / turno actual

- `deliveries.cash_session_id` solo se llena si hay recaudo, devolucion, ajuste o conciliacion.
- No todo domicilio tiene caja.
- Contraentrega necesita cash session o flujo de conciliacion.
- Si el valor esta en factura/POS y ya fue pagado, el domicilio no crea ingreso nuevo.
- `NO_ENTREGADO` o `CANCELADO` con plata debe generar resolucion financiera, no magia.

## Transiciones de estado

| Estado actual | Puede pasar a | Campos obligatorios |
| --- | --- | --- |
| `PENDIENTE` | `EN_PREPARACION` | actor, fecha/hora |
| `PENDIENTE` | `DESPACHADO` | `assigned_user_id` o responsable, `dispatched_by_user_id`, `dispatched_at` |
| `PENDIENTE` | `CANCELADO` | `cancelled_by_user_id`, `cancelled_at`, `cancellation_reason` |
| `EN_PREPARACION` | `DESPACHADO` | `assigned_user_id` o responsable, `dispatched_by_user_id`, `dispatched_at` |
| `EN_PREPARACION` | `CANCELADO` | `cancelled_by_user_id`, `cancelled_at`, `cancellation_reason` |
| `DESPACHADO` | `ENTREGADO` | `delivered_by_user_id`, `delivered_at`, recaudo si aplica |
| `DESPACHADO` | `NO_ENTREGADO` | `not_delivered_by_user_id`, `not_delivered_at`, `not_delivered_reason` |
| `ENTREGADO` | Ninguno | final |
| `CANCELADO` | Ninguno | final |
| `NO_ENTREGADO` | Ninguno en v0.0.1 | final |

## Contratos API propuestos

Endpoints conceptuales futuros:

```text
GET    /api/deliveries
POST   /api/deliveries
GET    /api/deliveries/:id
PATCH  /api/deliveries/:id
POST   /api/deliveries/:id/assign
POST   /api/deliveries/:id/dispatch
POST   /api/deliveries/:id/mark-delivered
POST   /api/deliveries/:id/mark-not-delivered
POST   /api/deliveries/:id/cancel
GET    /api/deliveries/reports/summary
```

Reglas generales:
- Todos requieren JWT.
- Todos filtran por `tenant_id`.
- Acciones con sucursal usan scope de `branch_id`.
- Acciones con caja validan cash session autorizada.
- `SUPER_ADMIN` requiere reglas explicitas para seleccionar tenant/contexto.

## DTOs conceptuales

### `CreateDeliveryDto`

Campos:
- `customerId?`
- `orderId?`
- `saleId?`
- `invoiceId?`
- `branchId?`
- `contactName?`
- `contactPhone`
- `addressLine`
- `addressReference?`
- `neighborhood?`
- `zone?`
- `deliveryFee?`
- `deliveryFeeSource`
- `paymentStatus`
- `paymentMethod?`
- `assignedUserId?`
- `notes?`

Reglas:
- Debe tener `addressLine` y `contactPhone`.
- Si no hay cliente identificado, debe tener `contactName` o referencia suficiente.
- Si `deliveryFee > 0`, `deliveryFeeSource` no puede ser `NONE`.

### `UpdateDeliveryDto`

Campos:
- `contactName?`
- `contactPhone?`
- `addressLine?`
- `addressReference?`
- `neighborhood?`
- `zone?`
- `deliveryFee?`
- `deliveryFeeSource?`
- `paymentStatus?`
- `paymentMethod?`
- `assignedUserId?`
- `notes?`

Reglas:
- Solo permite datos basicos antes de `DESPACHADO`, salvo permiso/admin especial.
- No debe cambiar estado. Estado va por endpoints de accion.

### `AssignDeliveryDto`

Campos:
- `assignedUserId`
- `notes?`

Reglas:
- Usuario asignado debe pertenecer al tenant y scope operativo permitido.

### `DispatchDeliveryDto`

Campos:
- `assignedUserId?`
- `dispatchedAt?`
- `notes?`

Reglas:
- Si no hay responsable previo, debe enviarse `assignedUserId`.
- Solo aplica desde `PENDIENTE` o `EN_PREPARACION`.

### `MarkDeliveryDeliveredDto`

Campos:
- `deliveredAt?`
- `collectedAmount?`
- `paymentMethod?`
- `cashSessionId?`
- `notes?`

Reglas:
- Solo aplica desde `DESPACHADO`.
- Si `paymentStatus = COLLECT_ON_DELIVERY`, debe registrar recaudo o marcar conciliacion.

### `MarkDeliveryNotDeliveredDto`

Campos:
- `notDeliveredReason`
- `notDeliveredAt?`
- `notes?`

Reglas:
- Solo aplica desde `DESPACHADO`.
- Motivo obligatorio.

### `CancelDeliveryDto`

Campos:
- `cancellationReason`
- `cancelledAt?`
- `notes?`

Reglas:
- Solo aplica desde `PENDIENTE` o `EN_PREPARACION`.
- Motivo obligatorio.

### `DeliveryFiltersDto`

Campos:
- `status?`
- `customerId?`
- `orderId?`
- `saleId?`
- `invoiceId?`
- `cashSessionId?`
- `assignedUserId?`
- `branchId?`
- `fromDate?`
- `toDate?`
- `zone?`
- `neighborhood?`
- `page?`
- `pageSize?`

### `DeliveryResponseDto`

Campos:
- Datos principales de `deliveries`.
- Resumen de cliente.
- Resumen de pedido/venta/factura.
- Resumen de caja cuando aplique.
- Historial de estado opcional.
- Acciones disponibles segun estado/permisos.

### `DeliverySummaryReportDto`

Campos:
- Totales por estado.
- Total de domicilios.
- Total valor de envio.
- Total esperado por recaudar.
- Total recaudado.
- Diferencias.
- Promedio creacion-despacho.
- Promedio despacho-entrega.
- Agrupaciones por repartidor, zona, cliente y cash session.

## Permisos propuestos

Permisos:
- `DELIVERIES_VIEW`
- `DELIVERIES_CREATE`
- `DELIVERIES_UPDATE`
- `DELIVERIES_ASSIGN`
- `DELIVERIES_DISPATCH`
- `DELIVERIES_MARK_DELIVERED`
- `DELIVERIES_MARK_NOT_DELIVERED`
- `DELIVERIES_CANCEL`
- `DELIVERIES_REPORTS`

Matriz sugerida:

| Permiso | USER | ADMIN | SUPER_USER | SUPER_ADMIN |
| --- | --- | --- | --- | --- |
| `DELIVERIES_VIEW` | Si, scope operativo | Si | Si | Si global segun reglas |
| `DELIVERIES_CREATE` | Si, flujo operativo | Si | Si | Si |
| `DELIVERIES_UPDATE` | Datos basicos antes de despacho | Si | Si | Si |
| `DELIVERIES_ASSIGN` | No por defecto | Si | Si | Si |
| `DELIVERIES_DISPATCH` | Opcional negocio | Si | Si | Si |
| `DELIVERIES_MARK_DELIVERED` | Opcional negocio | Si | Si | Si |
| `DELIVERIES_MARK_NOT_DELIVERED` | Opcional negocio | Si | Si | Si |
| `DELIVERIES_CANCEL` | No por defecto | Si | Si | Si |
| `DELIVERIES_REPORTS` | No o limitado | Si | Si | Si |

No aplicar permisos reales en esta fase.

## Indices sugeridos

Indices individuales:
- `tenant_id`
- `customer_id`
- `order_id`
- `sale_id`
- `invoice_id`
- `cash_session_id`
- `status`
- `created_at`
- `dispatched_at`
- `delivered_at`

Indices compuestos:
- `(tenant_id, status, created_at)`
- `(tenant_id, customer_id)`
- `(tenant_id, order_id)`
- `(tenant_id, sale_id)`
- `(tenant_id, invoice_id)`
- `(tenant_id, cash_session_id)`
- `(tenant_id, assigned_user_id, status)`
- `(tenant_id, zone, status)`

Restriccion conceptual:
- Un pedido no debe tener mas de un domicilio activo en v0.0.1.
- Se recomienda indice unico parcial futuro sobre `(tenant_id, order_id)` donde `order_id IS NOT NULL AND status IN ('PENDIENTE', 'EN_PREPARACION', 'DESPACHADO')`.

## Restricciones sugeridas

- `tenant_id` obligatorio.
- `status` solo permite estados validos.
- `delivery_fee >= 0`.
- Si `delivery_fee = 0`, `delivery_fee_source` debe ser `NONE` o equivalente aprobado.
- Si `delivery_fee > 0`, `delivery_fee_source` debe ser distinto de `NONE`.
- `cancellation_reason` obligatorio cuando `status = CANCELADO`.
- `not_delivered_reason` obligatorio cuando `status = NO_ENTREGADO`.
- `dispatched_at` obligatorio cuando `status` es `DESPACHADO`, `ENTREGADO` o `NO_ENTREGADO`.
- `delivered_at` obligatorio cuando `status = ENTREGADO`.
- `cancelled_at` obligatorio cuando `status = CANCELADO`.
- `not_delivered_at` obligatorio cuando `status = NO_ENTREGADO`.
- Cliente, pedido, venta/factura y caja asociados deben pertenecer al mismo tenant.
- Estados finales no deben permitir cambios operativos normales.

## Reglas de caja

- Domicilio pagado previamente no crea recaudo nuevo.
- Contraentrega debe asociarse a caja/turno al momento de recaudo o quedar pendiente de conciliacion.
- Si el envio esta dentro de factura/POS, no debe duplicarse como ingreso separado.
- Si el envio es operativo separado, debe quedar identificado por `delivery_fee_source = OPERATIVE_SEPARATE`.
- `NO_ENTREGADO` con pago previo debe definir reembolso, nota credito o reintento futuro.
- `NO_ENTREGADO` contraentrega normalmente no recauda; si hubo recaudo parcial, debe quedar evento y diferencia.
- `CANCELADO` con envio cobrado requiere reverso futuro o ajuste manual aprobado.
- Cierre de caja futuro debe poder identificar recaudos de domicilios y diferencias.

## Auditoria

Auditoria minima recomendada:
- `created_by_user_id` y `created_at`.
- `assigned_user_id` y evento de asignacion si se re-asigna.
- `dispatched_by_user_id` y `dispatched_at`.
- `delivered_by_user_id` y `delivered_at`.
- `cancelled_by_user_id`, `cancelled_at`, `cancellation_reason`.
- `not_delivered_by_user_id`, `not_delivered_at`, `not_delivered_reason`.
- `updated_at`.
- `delivery_status_history` para cada cambio de estado y accion sensible.

Conclusion: campos directos en `deliveries` son buenos para leer rapido. `delivery_status_history` debe existir desde el diseno inicial para auditoria decente. Auditoria sin historia es cuento contado por caja cerrada.

## UX tecnica futura

Pantallas:
- Listado `/{tenant}/deliveries`.
- Detalle `/{tenant}/deliveries/[id]`.
- Crear domicilio.
- Acciones por estado.
- Integracion desde pedido.
- Integracion desde factura/venta.
- Filtros operativos.
- Reporte resumen.

Rutas frontend conceptuales:
- `web/app/[tenant]/deliveries/page.tsx`
- `web/app/[tenant]/deliveries/[id]/page.tsx`

Dominio frontend conceptual:
- `web/domains/deliveries/api.ts`
- `web/domains/deliveries/types.ts`
- `web/domains/deliveries/dtos.ts`

No crear estos archivos en esta fase.

## Riesgos tecnicos

- Doble conteo de `delivery_fee`.
- Recaudo contraentrega sin cash session autorizada.
- `NO_ENTREGADO` necesita reintento real en futuras versiones.
- Unico domicilio activo por pedido puede quedarse corto para entregas parciales.
- `invoice_id` puede no existir como tabla separada de `sales`; se debe confirmar modelo fiscal real.
- `assigned_user_id` puede no representar repartidores externos.
- Offline/Electron requiere idempotencia, cola local y reconciliacion.
- Permisos demasiado amplios pueden permitir cancelar/entregar sin control.

## Decisiones pendientes

- Confirmar si `invoice_id` sera `sales.id`, documento fiscal externo o tabla futura.
- Confirmar si `delivery_number` sera por tenant o por tenant/sucursal.
- Confirmar si repartidor siempre es `users.id` o si se permiten terceros.
- Confirmar si `customer_delivery_addresses` entra en v0.0.1 o despues.
- Confirmar si `delivery_payment_events` entra desde primera implementacion de contraentrega.
- Confirmar si USER puede despachar y marcar entregado/no entregado.
- Confirmar regla final para envio cobrado: factura/POS vs operativo separado.

## Plan de implementacion futura

1. Validar este diseno tecnico con negocio y equipo.
2. Revisar `docs/architecture/domicilios-plan-implementacion-backend.md`.
3. Crear OpenSpec o delta para modelo SQL.
4. Crear migraciones y rollback.
5. Implementar backend `deliveries` con reglas de estado y permisos.
6. Implementar frontend modulo Domicilios.
7. Integrar con pedidos y ventas/facturas.
8. Integrar caja/contraentrega solo cuando reglas de dinero esten cerradas.
9. Implementar reporteria y auditoria operativa.
10. Ejecutar QA multi-rol, multi-tenant, caja y responsive.

## Confirmacion de alcance

- Codigo backend tocado: NO.
- Codigo frontend tocado: NO.
- SQL/migraciones tocadas: NO.
- Endpoints reales creados: NO.
- Permisos reales modificados: NO.
- Menus reales modificados: NO.
- Logica de negocio modificada: NO.
- Commit realizado: NO.
