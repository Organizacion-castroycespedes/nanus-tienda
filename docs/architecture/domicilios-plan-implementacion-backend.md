# Domicilios - Plan de implementacion backend

## Resumen ejecutivo

Este documento definio el plan tecnico para implementar el backend futuro del modulo Domicilios. Fase 4 ya implementa una primera base runtime acotada con SQL DDL directo y NestJS; Fase 5 implementa state machine; Fase 6A activa permisos backend; Fase 6B integra creacion/consulta backend desde pedidos. Sigue sin Prisma, sin frontend, sin caja y sin facturacion.

El modulo debe nacer aislado en `/api/deliveries`, con `tenant_id` obligatorio, estado logistico controlado, auditoria minima, y reglas explicitas para no duplicar dinero entre factura, caja y domicilio.

## Alcance de implementacion backend futura

La implementacion futura debe cubrir:

- Migracion para `deliveries`.
- Migracion para `delivery_status_history` si se confirma auditoria desde v0.0.1.
- Tipos/enums backend para estados, fuente financiera y estado/metodo de pago.
- DTOs con validaciones.
- Servicio principal de domicilios.
- Servicio de maquina de estados.
- Generacion de consecutivo operativo.
- Controlador REST.
- Integracion con permisos existentes.
- Tests backend de modelo, servicio, controller/guards y caja conceptual.

## Fuera de alcance

- No usar Prisma.
- No crear modelos Prisma.
- No crear frontend.
- No crear integracion real con caja, facturacion electronica o reporteria.
- No modificar el flujo funcional existente de pedidos.
- No crear reportes avanzados.
- No aplicar SQL de permisos en produccion sin aprobacion.
- No modificar menus frontend reales.
- No modificar frontend funcional.
- No tocar produccion.
- No hacer commit sin aprobacion expresa.

## Archivos candidatos a crear

Backend futuro:

```text
api/src/modules/deliveries/deliveries.module.ts
api/src/modules/deliveries/deliveries.controller.ts
api/src/modules/deliveries/deliveries.service.ts
api/src/modules/deliveries/deliveries.repository.ts
api/src/modules/deliveries/deliveries.service.spec.ts
api/src/modules/deliveries/delivery-state-machine.service.ts
api/src/modules/deliveries/delivery-state-machine.service.spec.ts
api/src/modules/deliveries/delivery-number.service.ts
api/src/modules/deliveries/delivery-cash-integration.service.ts
api/src/modules/deliveries/delivery-audit.service.ts
api/src/modules/deliveries/entities/delivery.entity.ts
api/src/modules/deliveries/entities/delivery-status-history.entity.ts
api/src/modules/deliveries/dto/create-delivery.dto.ts
api/src/modules/deliveries/dto/update-delivery.dto.ts
api/src/modules/deliveries/dto/assign-delivery.dto.ts
api/src/modules/deliveries/dto/dispatch-delivery.dto.ts
api/src/modules/deliveries/dto/mark-delivery-delivered.dto.ts
api/src/modules/deliveries/dto/mark-delivery-not-delivered.dto.ts
api/src/modules/deliveries/dto/cancel-delivery.dto.ts
api/src/modules/deliveries/dto/delivery-filters.dto.ts
api/src/modules/deliveries/dto/delivery-response.dto.ts
api/src/modules/deliveries/dto/delivery-summary-report.dto.ts
```

Migraciones futuras:

```text
scripts/database/migrations/V0XX__create_deliveries.sql
scripts/database/rollbacks/V0XX__create_deliveries_rollback.sql
scripts/database/migrations/V0XY__create_delivery_status_history.sql
scripts/database/rollbacks/V0XY__create_delivery_status_history_rollback.sql
```

Solo ejemplos de nombres. El numero real debe seguir el orden vigente del repo al momento de implementar.

## Archivos candidatos a modificar

Backend futuro:

- `api/src/modules/inventory/inventory.module.ts` o modulo raiz equivalente, solo si se decide registrar `DeliveriesModule` desde ahi.
- `api/src/app.module.ts` o modulo agregador real, si aplica.
- Constantes backend de permisos/menu, si existen para `RequirePermission`.
- Seeds/migraciones de permisos, solo en fase aprobada.
- Documentacion de endpoints, si el repo mantiene tabla de endpoints.

Frontend futuro, no en backend fase:

- `web/domains/menu/constants.ts`.
- `web/lib/route-permissions.ts`.
- Menu seeds.

No modificar estos archivos en esta fase documental.

## Migraciones futuras

### Migracion 1: `deliveries`

Objetivo: crear la tabla principal de domicilios.

Columnas minimas:

- `id`
- `tenant_id`
- `customer_id`
- `order_id`
- `invoice_id`
- `cash_session_id`
- `delivery_number`
- `status`
- `contact_name`
- `contact_phone`
- `address_line`
- `address_reference`
- `neighborhood`
- `zone`
- `delivery_fee`
- `delivery_fee_source`
- `payment_status`
- `payment_method`
- `assigned_user_id`
- `dispatched_by_user_id`
- `delivered_by_user_id`
- `cancelled_by_user_id`
- `not_delivered_by_user_id`
- `created_by_user_id`
- `created_at`
- `updated_at`
- `dispatched_at`
- `delivered_at`
- `cancelled_at`
- `not_delivered_at`
- `cancellation_reason`
- `not_delivered_reason`
- `notes`

Nota: Fase 2 tambien documento `sale_id`. Para la primera migracion backend se debe decidir si se incluye desde el inicio. Recomendacion: incluir `sale_id` si la venta POS es el documento real de factura/venta en v0.0.1; dejar `invoice_id` nullable si el modelo fiscal separado sigue abierto.

### Migracion 2: `delivery_status_history`

Recomendada desde v0.0.1 para auditoria.

Columnas candidatas:

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

### Migraciones opcionales futuras

- `delivery_payment_events`: contraentrega, recaudo, diferencias, conciliacion.
- `customer_delivery_addresses`: libreta de direcciones por cliente.
- `delivery_assignments`: historial de asignaciones/reasignaciones.

## Restricciones futuras

- FK hacia `tenants`.
- FK opcional hacia `customers`.
- FK opcional hacia `orders`.
- FK opcional hacia `sales` o entidad fiscal que corresponda.
- FK opcional hacia `cash_sessions`.
- FK opcional hacia `users` para responsables y actores.
- Check constraint para `status`.
- Check constraint para `delivery_fee >= 0`.
- Check constraint para `delivery_fee_source`.
- Check constraint para `payment_status`.
- Check constraint para motivos obligatorios en `CANCELLED` y `NOT_DELIVERED`.
- Restriccion unica conceptual para maximo un domicilio activo por pedido.
- Validacion de tenant consistente entre delivery y entidades relacionadas.

Posible indice unico parcial futuro:

```text
(tenant_id, order_id)
WHERE order_id IS NOT NULL
  AND status IN ('DRAFT', 'CREATED', 'ASSIGNED', 'DISPATCHED')
```

## Indices futuros

- `(tenant_id, status, created_at)`
- `(tenant_id, customer_id)`
- `(tenant_id, order_id)`
- `(tenant_id, invoice_id)`
- `(tenant_id, cash_session_id)`
- `(tenant_id, delivery_number)`
- `(tenant_id, assigned_user_id, status)`
- `(tenant_id, created_at)`

Si se incluye `sale_id`:

- `(tenant_id, sale_id)`

## Entidades/modelos futuros

### `Delivery`

Modelo principal. Debe validar:

- UUIDs cuando aplique.
- `tenantId` obligatorio.
- `status` valido.
- `deliveryFee >= 0`.
- Direccion y telefono obligatorios.
- Motivo para cancelacion/no entrega segun estado.
- Fechas obligatorias segun estado.

### `DeliveryStatusHistory`

Modelo de auditoria de estado.

Debe representar:

- Estado anterior.
- Estado nuevo.
- Accion.
- Usuario actor.
- Fecha/hora.
- Motivo/notas.
- Caja relacionada si aplica.

### Opcionales

- `DeliveryPaymentEvent`.
- `CustomerDeliveryAddress`.
- `DeliveryAssignment`.

No crear estos modelos en esta fase.

## Enums futuros

### `DeliveryStatus`

```text
DRAFT
CREATED
ASSIGNED
DISPATCHED
DELIVERED
NOT_DELIVERED
CANCELLED
```

### `DeliveryFeeSource`

```text
INVOICE_INCLUDED
DELIVERY_SEPARATE
CASH_ON_DELIVERY
NO_FEE
```

Nota: Fase 2 uso nombres conceptuales `INVOICE`, `POS_SALE`, `OPERATIVE_SEPARATE`, `NONE`. Antes de migrar, elegir una sola nomenclatura. Recomendacion para backend: usar nombres de arriba si negocio acepta que `INVOICE_INCLUDED` cubre factura/POS, o agregar `POS_SALE_INCLUDED` si hace falta distinguir.

### `DeliveryPaymentStatus`

```text
NOT_REQUIRED
PENDING
PAID
CANCELLED
REFUNDED
```

### `DeliveryPaymentMethod`

```text
CASH
CARD
TRANSFER
MIXED
OTHER
```

Los nombres definitivos deben alinearse con los metodos de pago reales del modulo finance. Si existe `payment_methods`, preferir FK o codigo de metodo existente sobre enum fijo.

## DTOs futuros

### `CreateDeliveryDto`

Campos:

- `customerId?`
- `orderId?`
- `invoiceId?`
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
- `notes?`

Validaciones:

- Direccion obligatoria.
- Contacto minimo.
- Tenant derivado del contexto, no del body.
- `orderId`, `invoiceId` y `customerId` deben pertenecer al mismo tenant.
- No permitir mas de un domicilio activo por pedido.

### `UpdateDeliveryDto`

Campos editables:

- Contacto.
- Direccion.
- Barrio/zona.
- Valor/fuente de domicilio antes de despacho.
- Estado de pago antes de cierre.
- Notas.

Reglas:

- No permite editar estados finales.
- No cambia `status`; acciones separadas cambian estado.
- No debe permitir editar libremente dinero despues de recaudo o cierre.

### `AssignDeliveryDto`

- `assignedUserId`
- `notes?`

Valida que el usuario pertenezca al tenant/scope permitido.

### `DispatchDeliveryDto`

- `assignedUserId?`
- `dispatchedAt?`
- `notes?`

Marca salida a entrega desde `CREATED` o `ASSIGNED`.

### `MarkDeliveryDeliveredDto`

- `deliveredAt?`
- `collectedAmount?`
- `paymentMethod?`
- `cashSessionId?`
- `notes?`

Si hay contraentrega, debe registrar informacion de recaudo o dejar `PENDING_RECONCILIATION` segun regla final.

### `MarkDeliveryNotDeliveredDto`

- `notDeliveredReason`
- `notDeliveredAt?`
- `notes?`

Motivo obligatorio.

### `CancelDeliveryDto`

- `cancellationReason`
- `cancelledAt?`
- `notes?`

Motivo obligatorio.

### `DeliveryFiltersDto`

- `status?`
- `customerId?`
- `orderId?`
- `invoiceId?`
- `cashSessionId?`
- `assignedUserId?`
- `fromDate?`
- `toDate?`
- `limit?`
- `offset?`

Seguir patron `ListCashMovementsDto`: `class-validator`, `class-transformer`, `limit`, `offset`.

### `DeliveryResponseDto`

Debe devolver:

- Campos principales.
- Resumen de cliente.
- Resumen de pedido/factura.
- Resumen de caja si aplica.
- Historial opcional.
- Acciones disponibles si se decide calcularlas.

### `DeliverySummaryReportDto`

Debe devolver:

- Totales por estado.
- Total de domicilios.
- Total de delivery fee.
- Total esperado.
- Total recaudado.
- Diferencias.
- Promedio creacion-despacho.
- Promedio despacho-entrega.

## Servicios futuros

### `DeliveriesService`

Responsabilidades:

- Crear domicilio.
- Consultar listado.
- Consultar detalle.
- Actualizar datos permitidos.
- Asignar.
- Despachar.
- Marcar entregado.
- Marcar no entregado.
- Cancelar.
- Validar tenant.
- Validar vinculos con cliente/pedido/factura/caja.
- Validar maximo un domicilio activo por pedido.
- Aplicar reglas de estado mediante `DeliveryStateMachineService`.
- Registrar auditoria minima.

### `DeliveryStateMachineService`

Responsabilidades:

- Definir matriz de transicion.
- Definir estados finales.
- Rechazar transiciones invalidas.
- Exigir campos por transicion.

Matriz:

- `DRAFT` -> `CREATED`, `CANCELLED`.
- `CREATED` -> `ASSIGNED`, `CANCELLED`.
- `ASSIGNED` -> `DISPATCHED`, `CANCELLED`.
- `DISPATCHED` -> `DELIVERED`, `NOT_DELIVERED`.
- `DELIVERED`, `CANCELLED`, `NOT_DELIVERED` -> ninguno.

### `DeliveryNumberService`

Responsabilidades:

- Generar `delivery_number`.
- Definir si consecutivo es por tenant o tenant/sucursal.
- Evitar colisiones.
- Evaluar secuencia DB o calculo transaccional.

Recomendacion: usar mecanismo transaccional o secuencia por tenant/sucursal. Calcular `MAX + 1` sin lock es piedra en zapato.

### `DeliveryCashIntegrationService`

Responsabilidades:

- Validar fuente financiera unica.
- Evitar doble conteo.
- Preparar integracion futura con caja.
- No crear movimientos de caja hasta fase aprobada.
- Marcar contraentrega como pendiente/conciliable segun regla final.

### `DeliveryAuditService`

Responsabilidades:

- Crear registros en `delivery_status_history`.
- Registrar actor, fecha, estado anterior/nuevo, motivo y metadata.
- Centralizar trazabilidad de acciones sensibles.

## Controlador futuro

Controlador candidato:

```text
DeliveriesController
```

Ruta:

```text
@Controller("deliveries")
```

Guards esperados:

- `JwtAuthGuard`
- `RolesGuard`
- `PermissionsGuard`
- Guard/scope propio si se decide necesario para branch/caja.

Endpoints y permisos:

| Metodo | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/deliveries` | `DELIVERIES_VIEW` |
| POST | `/api/deliveries` | `DELIVERIES_CREATE` |
| GET | `/api/deliveries/:id` | `DELIVERIES_VIEW` |
| PATCH | `/api/deliveries/:id` | `DELIVERIES_UPDATE` |
| POST | `/api/deliveries/:id/assign` | `DELIVERIES_ASSIGN` |
| POST | `/api/deliveries/:id/dispatch` | `DELIVERIES_DISPATCH` |
| POST | `/api/deliveries/:id/mark-delivered` | `DELIVERIES_MARK_DELIVERED` |
| POST | `/api/deliveries/:id/mark-not-delivered` | `DELIVERIES_MARK_NOT_DELIVERED` |
| POST | `/api/deliveries/:id/cancel` | `DELIVERIES_CANCEL` |
| GET | `/api/deliveries/reports/summary` | `DELIVERIES_REPORTS` |

## Guards y permisos futuros

Cambios candidatos:

- Agregar constante/menu key futuro `DELIVERIES`.
- Agregar acciones `DELIVERIES_*`.
- Agregar seeds/migraciones de permisos de forma idempotente en fase aprobada.
- Agregar ruta frontend futura a `web/lib/route-permissions.ts`.
- Agregar menu visible `Domicilios`.
- Validar tenant desde JWT/contexto.
- Validar branch scope para roles no globales.
- Validar cash session autorizada solo para acciones con caja.

Matriz propuesta:

| Rol | Permisos propuestos |
| --- | --- |
| USER | `DELIVERIES_VIEW`, `DELIVERIES_CREATE`, `DELIVERIES_UPDATE`, `DELIVERIES_DISPATCH`, `DELIVERIES_MARK_DELIVERED`, `DELIVERIES_MARK_NOT_DELIVERED` |
| ADMIN | Todos los permisos operativos y reportes |
| SUPER_USER | Igual que ADMIN o superior dentro del tenant |
| SUPER_ADMIN | Acceso global segun patron actual |

Fase 6A aplica esta matriz en SQL local/QA y en metadata backend. No aplicar en produccion sin aprobacion.

## Tests backend futuros

### Migracion/modelo

- Crea domicilio valido.
- Rechaza estado invalido.
- Rechaza `delivery_fee` negativo.
- Permite vinculos opcionales.
- Respeta maximo un domicilio activo por pedido.
- Respeta tenant.

### Servicio

- Crear domicilio con cliente.
- Crear domicilio con pedido.
- Crear domicilio con factura.
- Rechazar cliente de otro tenant.
- Rechazar pedido de otro tenant.
- Rechazar factura de otro tenant.
- Rechazar segundo domicilio activo para el mismo pedido.
- Permitir nuevo domicilio si anterior esta final solo si regla final lo permite.
- Validar edicion por estado.
- Validar `DRAFT` -> `CREATED`.
- Validar `CREATED` -> `ASSIGNED`.
- Validar `ASSIGNED` -> `DISPATCHED`.
- Validar `DISPATCHED` -> `DELIVERED`.
- Validar `DISPATCHED` -> `NOT_DELIVERED`.
- Rechazar `DELIVERED` -> `CANCELLED`.
- Rechazar `CANCELLED` -> `DISPATCHED`.
- Rechazar `NOT_DELIVERED` -> `DISPATCHED`.
- Requerir motivo en cancelacion.
- Requerir motivo en no entregado.

### Controller/guards

- Bloquear sin token.
- Bloquear sin permiso.
- Permitir con permiso correcto.
- Validar filtros.
- Validar paginacion.
- Retornar errores consistentes.

### Caja

- No crea movimiento de caja si `deliveryFeeSource = INVOICE_INCLUDED`.
- No crea movimiento de caja si `deliveryFeeSource = NO_FEE`.
- Marca contraentrega como pendiente si aplica.
- No duplica ingreso.

No crear tests en esta fase.

## Contratos API futuros

### `GET /api/deliveries`

Entrada: `DeliveryFiltersDto`.

Salida: lista paginada de `DeliveryResponseDto`.

### `POST /api/deliveries`

Entrada: `CreateDeliveryDto`.

Salida: `DeliveryResponseDto`.

### `GET /api/deliveries/:id`

Salida: `DeliveryResponseDto`.

### `PATCH /api/deliveries/:id`

Entrada: `UpdateDeliveryDto`.

Salida: `DeliveryResponseDto`.

### Acciones

- `assign`: `AssignDeliveryDto`.
- `dispatch`: `DispatchDeliveryDto`.
- `mark-delivered`: `MarkDeliveryDeliveredDto`.
- `mark-not-delivered`: `MarkDeliveryNotDeliveredDto`.
- `cancel`: `CancelDeliveryDto`.

Salida: `DeliveryResponseDto` con estado actualizado.

### `GET /api/deliveries/reports/summary`

Entrada: filtros de fecha, estado, usuario, cliente, zona, caja.

Salida: `DeliverySummaryReportDto`.

## Fase 4 implementada con SQL DDL directo, no Prisma

### DDL creado

Archivo:

```text
scripts/database/migrations/V063__deliveries_base.sql
```

Tablas:

- `public.deliveries`
- `public.delivery_status_history`

La migracion usa:

- `CREATE TABLE IF NOT EXISTS`.
- `CREATE INDEX IF NOT EXISTS`.
- `CHECK` constraints para estados, montos no negativos, direccion no vacia y `metadata` como objeto JSON.
- Constraints protegidas con `DO $$` cuando aplica.
- IDs `uuid` con `gen_random_uuid()`.
- Schema `public`.
- Sin `DROP TABLE`.
- Sin `TRUNCATE`.
- Sin Prisma.

Estados runtime permitidos:

```text
DRAFT
CREATED
ASSIGNED
DISPATCHED
DELIVERED
NOT_DELIVERED
CANCELLED
```

### Backend creado

Archivos creados:

```text
api/src/modules/deliveries/deliveries.module.ts
api/src/modules/deliveries/deliveries.controller.ts
api/src/modules/deliveries/deliveries.service.ts
api/src/modules/deliveries/deliveries.constants.ts
api/src/modules/deliveries/dto/create-delivery.dto.ts
api/src/modules/deliveries/dto/update-delivery.dto.ts
api/src/modules/deliveries/dto/query-deliveries.dto.ts
api/src/modules/deliveries/services/delivery-number.service.ts
```

Archivo modificado:

```text
api/src/modules/app.module.ts
```

Endpoints implementados:

```text
GET    /api/deliveries
POST   /api/deliveries
GET    /api/deliveries/:id
PATCH  /api/deliveries/:id
```

No implementado en Fase 4:

- `assign`.
- `dispatch`.
- `mark-delivered`.
- `mark-not-delivered`.
- `cancel`.
- `reports/summary`.
- Caja.
- Facturacion electronica.
- Integracion real con pedidos.
- Frontend.
- Permisos reales `DELIVERIES_*`.

## Fase 5 implementada

### State machine

Servicio:

```text
api/src/modules/deliveries/services/delivery-state-machine.service.ts
```

Transiciones implementadas:

- `CREATED` -> `ASSIGNED`.
- `ASSIGNED` -> `DISPATCHED`.
- `DISPATCHED` -> `DELIVERED`.
- `DISPATCHED` -> `NOT_DELIVERED`.
- `CREATED` -> `CANCELLED`.
- `ASSIGNED` -> `CANCELLED`.

Estados finales:

- `DELIVERED`
- `NOT_DELIVERED`
- `CANCELLED`

Transiciones bloqueadas:

- `CREATED` -> `DISPATCHED`.
- `ASSIGNED` -> `DELIVERED`.
- `DISPATCHED` -> `CANCELLED`.
- Cualquier cambio desde un estado final.

### Endpoints de estado

```text
POST /api/deliveries/:id/assign
POST /api/deliveries/:id/dispatch
POST /api/deliveries/:id/mark-delivered
POST /api/deliveries/:id/mark-not-delivered
POST /api/deliveries/:id/cancel
```

Cada endpoint:

- Usa `JwtAuthGuard`.
- Busca `delivery` por `id` y `tenant_id`.
- Valida branch context cuando existe.
- Ejecuta `SELECT ... FOR UPDATE`.
- Actualiza `deliveries`.
- Inserta `delivery_status_history`.
- Usa una sola transaccion.
- No toca caja, facturacion, pedidos, ventas, inventario ni reporteria.

### DTOs creados

```text
api/src/modules/deliveries/dto/assign-delivery.dto.ts
api/src/modules/deliveries/dto/dispatch-delivery.dto.ts
api/src/modules/deliveries/dto/mark-delivered-delivery.dto.ts
api/src/modules/deliveries/dto/mark-not-delivered-delivery.dto.ts
api/src/modules/deliveries/dto/cancel-delivery.dto.ts
```

### Tests creados

```text
api/src/modules/deliveries/services/delivery-state-machine.service.spec.ts
api/src/modules/deliveries/deliveries.service.spec.ts
```

Cubren transiciones validas, saltos invalidos, estados finales, rollback e historial transaccional.

## Fase 6A implementada - permisos backend

### Backend

Se implementa control real de permisos sin cambiar state machine ni integrar caja, facturacion, pedidos, ventas, inventario o frontend.

Archivos clave:

```text
api/src/common/constants/menu-keys.ts
api/src/modules/deliveries/deliveries.constants.ts
api/src/modules/deliveries/deliveries.controller.ts
api/src/modules/deliveries/deliveries.module.ts
api/src/modules/deliveries/deliveries.controller.spec.ts
api/src/common/guards/permissions.guard.spec.ts
```

`DeliveriesController` usa:

```text
@UseGuards(JwtAuthGuard, PermissionsGuard)
```

### Mapeo de permisos

| Endpoint | Permiso |
| --- | --- |
| `GET /api/deliveries` | `DELIVERIES_VIEW` |
| `POST /api/deliveries` | `DELIVERIES_CREATE` |
| `GET /api/deliveries/:id` | `DELIVERIES_VIEW` |
| `PATCH /api/deliveries/:id` | `DELIVERIES_UPDATE` |
| `POST /api/deliveries/:id/assign` | `DELIVERIES_ASSIGN` |
| `POST /api/deliveries/:id/dispatch` | `DELIVERIES_DISPATCH` |
| `POST /api/deliveries/:id/mark-delivered` | `DELIVERIES_MARK_DELIVERED` |
| `POST /api/deliveries/:id/mark-not-delivered` | `DELIVERIES_MARK_NOT_DELIVERED` |
| `POST /api/deliveries/:id/cancel` | `DELIVERIES_CANCEL` |
| `GET /api/deliveries/reports/summary` | `DELIVERIES_REPORTS` |

`GET /api/deliveries/reports/summary` es placeholder protegido con `NotImplementedException`; no implementa reporte avanzado.

### SQL local/QA

Archivo:

```text
scripts/database/security/20260620_1730_deliveries_permissions_local_qa.sql
```

Este SQL es idempotente, crea/actualiza `menu_items` con key `DELIVERIES` visible `FALSE` y crea/actualiza `role_menu_permissions.actions` para `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`.

No se ejecuta automaticamente por `migrate_prd.sh` y no debe aplicarse en produccion sin aprobacion explicita.

### Tenant, branch y seguridad

- `tenant_id` se toma del JWT/contexto: `request.context.tenantId` o `request.user.tenantId`.
- `branch_id` se toma del contexto si existe; si no, del body/query.
- Si contexto trae branch y el body/query intenta otro branch, la API rechaza la operacion.
- Todas las consultas filtran por `tenant_id`.
- Se usa `JwtAuthGuard`.
- Fase 6A agrega `PermissionsGuard` y acciones `DELIVERIES_*`.

### Numero de domicilio

`DeliveryNumberService` genera un numero provisional:

```text
DOM-YYYYMMDD-<timestamp-base36>-<random>
```

La unicidad real queda garantizada por:

```text
UNIQUE (tenant_id, branch_id, delivery_number)
```

Este mecanismo queda reemplazable por un consecutivo formal por tenant/sucursal en fase posterior.

## Fase 6B implementada - integracion controlada con pedidos

### Alcance implementado

Se implementa solo integracion backend con pedidos:

```text
GET  /api/orders/:id/delivery
POST /api/orders/:id/delivery
```

No se modifica la creacion normal de pedidos, confirmacion, entrega, facturacion, caja, POS, inventario ni frontend.

### Patron aplicado

- `OrderController` expone endpoints de acceso desde pedido.
- `DeliveriesService` conserva la regla de negocio con `getByOrder` y `createFromOrder`.
- `InventoryModule` importa `DeliveriesModule` para inyectar `DeliveriesService`.
- `CreateOrderDeliveryDto` valida payload especifico de creacion desde pedido.

### Reglas implementadas

- Crear desde pedido requiere `DELIVERIES_CREATE`.
- Consultar domicilio de pedido requiere `DELIVERIES_VIEW`.
- La creacion desde pedido inicia en estado `CREATED`.
- Se valida `tenant_id` desde actor autenticado.
- Se valida branch desde auditoria de pedido, contexto o DTO.
- Se guarda snapshot de cliente/contacto/direccion desde `customers` cuando existe.
- Si no existe direccion suficiente, se exige `delivery_address`.
- Se rechaza cualquier delivery existente para el mismo pedido.
- El bloqueo de duplicado se ejecuta dentro de transaccion con lock del pedido.
- `POST /api/deliveries` tambien bloquea duplicado cuando trae `order_id`.
- `GET /api/deliveries` soporta filtro `order_id`.

### Tests agregados

```text
api/src/modules/deliveries/deliveries.service.spec.ts
api/src/modules/inventory/controllers/order.controller.spec.ts
```

Cubren:

- Crear domicilio desde pedido valido.
- Rechazar pedido inexistente.
- Rechazar pedido de otro tenant.
- Rechazar segundo domicilio para el mismo pedido.
- Consultar domicilio por pedido.
- Verificar permisos `DELIVERIES_VIEW` y `DELIVERIES_CREATE` en endpoints de pedido.
- Confirmar que crear pedido normal no llama `DeliveriesService`.
- Confirmar que no se consultan tablas de caja ni factura en la integracion.

## Fase 6C implementada - integracion controlada con facturacion

### Alcance implementado

Se implementa integracion backend controlada con ventas/facturacion sobre el documento operativo actual `sales`:

```text
GET  /api/sales/:id/delivery
POST /api/sales/:id/delivery
```

No se modifica la facturacion existente, la venta POS, impuestos, pagos, caja, `cash_session_id` ni frontend.

### Patron aplicado

- `SaleController` expone endpoints de acceso desde venta.
- `DeliveriesService` conserva la regla de negocio con `getBySale` y `createFromSale`.
- `InventoryModule` importa `DeliveriesModule` para inyectar `DeliveriesService`.
- `CreateSaleDeliveryDto` valida payload especifico de creacion desde venta.

### Reglas implementadas

- Crear desde factura/venta requiere `DELIVERIES_CREATE`.
- Consultar domicilio de factura/venta requiere `DELIVERIES_VIEW`.
- La creacion desde venta inicia en estado `CREATED`.
- Se valida `tenant_id` desde actor autenticado.
- Se valida branch desde la venta y contexto autenticado.
- Se guarda snapshot de cliente/contacto/direccion desde `customers` cuando existe.
- Si no existe direccion suficiente, se exige `delivery_address`.
- Se rechaza cualquier delivery existente para la misma venta/factura.
- Si la venta ya esta vinculada a un pedido con domicilio, se rechaza crear otro.
- `POST /api/deliveries` tambien bloquea duplicado cuando trae `sale_id`.
- `GET /api/deliveries` soporta filtro `sale_id`.
- No se toca `cash_session_id`.
- No se crean movimientos de caja.

### Fuente financiera unica

- La fuente de envio queda documentada como `INVOICE_INCLUDED` o `NO_FEE`.
- En esta fase no se registra recaudo.
- No se modifican totales, impuestos ni documentos electronicos.

### Tests agregados

```text
api/src/modules/deliveries/deliveries.service.spec.ts
api/src/modules/inventory/controllers/sale.controller.spec.ts
```

Cubren:

- Crear domicilio desde venta valida.
- Rechazar venta inexistente.
- Rechazar venta de otro tenant.
- Rechazar venta de otra branch.
- Rechazar segundo domicilio para la misma venta.
- Consultar domicilio por venta.
- Verificar permisos `DELIVERIES_VIEW` y `DELIVERIES_CREATE` en endpoints de venta.
- Confirmar que crear venta normal no llama `DeliveriesService`.
- Confirmar que no se consultan tablas de caja ni factura en la integracion.

## Secuencia recomendada de implementacion

1. Completado en Fase 4: crear migracion `deliveries` + `delivery_status_history` + check constraints + indices.
2. Completado en Fase 4: crear DTOs iniciales.
3. Completado en Fase 4: crear `DeliveryNumberService`.
4. Completado en Fase 4: crear `DeliveriesService`.
5. Completado en Fase 4: crear controlador CRUD minimo.
6. Completado en Fase 5: crear `DeliveryStateMachineService`.
7. Completado en Fase 5: implementar endpoints de acciones de estado.
8. Completado en Fase 5: agregar tests unitarios de state machine y transiciones.
9. Completado en Fase 6A: agregar guards/permisos backend `DELIVERIES_*`.
10. Completado en Fase 6A: crear SQL local/QA de permisos.
11. Completado en Fase 6B: integrar creacion/consulta backend desde pedidos.
12. Completado en Fase 6C: integrar creacion/consulta backend desde facturacion.
13. Pendiente Fase 7: integrar caja.
14. Pendiente Fase 8: disenar frontend runtime.

## Riesgos tecnicos

- Doble conteo de delivery fee entre factura, caja y domicilio.
- Relacion `invoice_id` como tabla estable no existe aun; el runtime actual usa `sales`.
- Un pedido con entregas parciales puede requerir mas de un domicilio.
- Contraentrega sin cash session autorizada puede descuadrar caja.
- Repartidor externo no encaja si solo se usa `users.id`.
- Consecutivo `delivery_number` puede colisionar si no es transaccional.
- Offline/Electron puede duplicar acciones si no hay idempotencia.
- Permisos amplios a USER pueden permitir cierre/cancelacion indebida.

## Criterios de aceptacion futuros

- OpenSpec sigue validando en strict.
- Migraciones aplican y rollback revierte.
- `deliveries` respeta tenant.
- Estados y transiciones invalidas se rechazan.
- Motivos obligatorios se exigen en cancelacion/no entrega.
- Un pedido no permite mas de un domicilio activo.
- Endpoints nuevos viven solo bajo `/api/deliveries`.
- Sin permisos, endpoints se bloquean.
- Con permisos correctos, endpoints responden.
- Caja no se toca cuando no hay dinero.
- Delivery fee no se duplica.
- Tests backend cubren servicio, estado, permisos y caja conceptual.

## Estrategia de rollback futura

- Migracion reversible para `delivery_status_history`.
- Migracion reversible para `deliveries`.
- Permisos agregados por SQL idempotente con rollback claro.
- Endpoints nuevos aislados en `/api/deliveries`.
- Ningun cambio debe romper pedidos existentes.
- Ningun cambio debe afectar facturacion existente.
- Ningun cambio debe afectar caja si no se usa domicilios.
- Si se detecta falla, desactivar menu/permisos antes de retirar datos.

## Checklist antes de tocar runtime

- [ ] Confirmar modelo fiscal real de `invoice_id`/`sale_id`.
- [ ] Confirmar nombre definitivo de enums.
- [ ] Confirmar si `delivery_status_history` va en v0.0.1.
- [ ] Confirmar si `delivery_payment_events` se aplaza.
- [ ] Confirmar rol real de repartidor.
- [ ] Confirmar matriz final de permisos.
- [ ] Confirmar si USER puede despachar y cerrar entregas.
- [ ] Confirmar generacion de `delivery_number`.
- [ ] Confirmar regla para pedido con domicilio final y reintento.
- [ ] Confirmar regla de caja para contraentrega.
- [ ] Confirmar si una futura fase fiscal separada necesitara `invoice_id` distinto de `sales.id`.

## Confirmacion de alcance

- Codigo backend tocado: SI, modulo `api/src/modules/deliveries` y wrappers backend en `OrderController`, `SaleController` e `InventoryModule`.
- Codigo frontend tocado: NO.
- SQL/migraciones reales creadas: SI, `scripts/database/migrations/V063__deliveries_base.sql`; SQL local/QA de permisos en `scripts/database/security`.
- Tablas reales creadas: SI, cuando se aplique la migracion: `deliveries` y `delivery_status_history`.
- Endpoints reales creados: SI, CRUD inicial, acciones de estado de Fase 5, placeholder protegido de summary y wrappers `GET/POST /api/orders/:id/delivery` y `GET/POST /api/sales/:id/delivery`.
- DTOs reales creados: SI, DTOs iniciales y DTOs de acciones de estado.
- Servicios reales creados: SI, `DeliveriesService`, `DeliveryNumberService` y `DeliveryStateMachineService`.
- Guards reales modificados: SI, `DeliveriesController` usa `PermissionsGuard`.
- Permisos backend modificados: SI, `DELIVERIES_*`.
- Menus frontend reales modificados: NO.
- SQL aplicado en produccion: NO.
- Logica de negocio existente modificada: NO; el flujo normal de pedidos y ventas no cambia.
- Commit realizado: NO.
