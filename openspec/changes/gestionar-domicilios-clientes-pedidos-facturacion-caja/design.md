## Context

Manus POS ya tiene modulos operativos de clientes, pedidos, POS/ventas, facturacion, caja/turno, roles/permisos y reporteria. El modelo actual usa Next.js en `web/`, NestJS en `api/`, `backend-reporteria/` para reportes/PDF, PostgreSQL, JWT, `tenant_id`, sucursal, terminal, sesion POS y sesion de caja.

El modulo Domicilios cruza varios dominios. Un domicilio puede nacer desde un pedido, desde una venta/factura o manualmente, y puede afectar caja si el envio o el recaudo se cobran en turno. Las fases 1 a 3 fueron documentales. Fase 4 habilita una base runtime acotada con SQL DDL directo y backend NestJS inicial, sin frontend ni integraciones avanzadas.

Restricciones vigentes para Fase 4:
- Prisma: no usar.
- Frontend productivo: no tocar.
- Permisos reales/menu real: no tocar.
- Facturacion, caja, pedidos y clientes existentes: no tocar.
- Endpoints de acciones de estado: no crear todavia.
- Reporteria avanzada: no crear todavia.
- Commit: no hacer sin aprobacion expresa.

## Goals / Non-Goals

**Goals:**
- Definir el alcance v0.0.1 del modulo Domicilios.
- Establecer datos minimos, estados, transiciones y trazabilidad.
- Documentar integracion conceptual con clientes, pedidos, facturacion y caja.
- Proponer permisos, menu, UX, filtros, acciones, reportes futuros y consideraciones multi-tenant.
- Dejar decisiones pendientes claras para fases futuras de datos, backend, frontend e integraciones.

**Non-Goals:**
- No implementar frontend.
- No implementar caja, facturacion electronica, integracion real con pedidos ni reporteria avanzada.
- No modificar `customers`, `orders`, `sales`, pagos, caja o reporteria.
- No aplicar `DELIVERIES_*` en `menu_items` ni `role_menu_permissions`.
- No disenar sincronizacion offline detallada para Electron.

## Decisions

1. **Domicilios sera un modulo operativo propio**
   - Decision: tratar Domicilios como modulo top-level futuro, con menu `Domicilios` y ruta conceptual `/{tenant}/deliveries`.
   - Rationale: el flujo cruza pedidos, facturas y caja; meterlo dentro de un solo modulo existente esconderia responsabilidades.
   - Alternativa descartada: agregarlo solo como subpantalla de Pedidos. Eso no cubre ventas/facturas, recaudos ni reporterias de repartidor.

2. **Las specs quedan separadas por integracion**
   - Decision: usar siete capabilities: gestion, clientes, pedidos, facturacion, caja, permisos y reporteria.
   - Rationale: permite revisar cada contrato sin mezclar dinero, estado logistico y permisos.
   - Alternativa descartada: una spec unica gigante. Eso valida, pero hace mas dificil archivar o implementar por fases.

3. **Entidad conceptual `Delivery` con snapshot operativo**
   - Decision: el diseno futuro debe contemplar una entidad conceptual `Delivery` con `tenantId`, `branchId`, fuente asociada, datos de cliente, snapshot de direccion/contacto, estado, responsable, valor de envio, metodo/estado de pago, timestamps, usuario creador, caja/turno opcional y observaciones.
   - Rationale: el domicilio debe conservar lo que se prometio entregar aunque el cliente cambie sus datos despues.
   - Alternativa descartada: leer siempre la direccion actual del cliente. Eso rompe historico y trazabilidad.

4. **Estados v0.0.1 minimos, sin estados extra**
   - Decision Fase 4: usar estados runtime en ingles `DRAFT`, `CREATED`, `ASSIGNED`, `DISPATCHED`, `DELIVERED`, `NOT_DELIVERED`, `CANCELLED`.
   - Rationale: son suficientes para una primera version. Pago, asignacion y diferencias de caja deben ser campos/eventos, no estados mezclados.
   - Decision adicional: `DELIVERED`, `CANCELLED` y `NOT_DELIVERED` quedan como estados finales en v0.0.1. Un reintento futuro debe modelarse como nuevo intento o nuevo domicilio enlazado.
   - Alternativa descartada: agregar `REPROGRAMADO`, `REINTENTO`, `PAGADO`, `ASIGNADO`. Mezcla ejes distintos y complica caja antes de tener modelo de datos.

5. **Transiciones operativas**
   - `DRAFT` puede pasar a `CREATED` o `CANCELLED`.
   - `CREATED` puede pasar a `ASSIGNED` o `CANCELLED`.
   - `ASSIGNED` puede pasar a `DISPATCHED` o `CANCELLED`.
   - `DISPATCHED` puede pasar a `DELIVERED` o `NOT_DELIVERED`.
   - `DELIVERED`, `CANCELLED` y `NOT_DELIVERED` no cambian en v0.0.1.
   - Toda transicion debe registrar usuario, fecha/hora, estado anterior, estado nuevo y observacion/motivo cuando aplique.

6. **Clientes y direcciones**
   - Decision: permitir domicilio con cliente real o cliente generico cuando el flujo existente lo permita, pero exigir direccion y telefono de entrega en el domicilio.
   - Rationale: el modulo no debe bloquear ventas operativas con consumidor final, pero necesita datos minimos para entregar.
   - Decision: multiples direcciones de cliente quedan como capacidad futura; v0.0.1 debe aceptar direccion puntual escrita en el pedido/domicilio.

7. **Pedidos**
   - Decision: en v0.0.1 conceptual, un pedido puede tener maximo un domicilio activo.
   - Rationale: simplifica estado, UI y caja. Entregas parciales o multiples rutas requieren modelo de intentos/lineas.
   - Decision: el domicilio puede crearse manualmente o desde pedido confirmado; facturar no debe ser el unico momento de creacion.
   - Decision: el estado del domicilio se muestra en el pedido como informacion, pero no reemplaza estados del pedido.

8. **Facturacion**
   - Decision: el domicilio puede existir antes o despues de facturar.
   - Decision: si el cliente paga valor de envio, ese valor debe tener una fuente fiscal/financiera unica. Recomendacion futura: si es cobro al cliente, incluirlo en factura/POS como cargo/linea; si es costo interno, manejarlo como dato operativo separado.
   - Rationale: evita doble cobro o descuadre entre factura, domicilio y caja.
   - Decision: anular una factura no debe borrar ni reescribir el historico del domicilio; debe crear trazabilidad y resolver caja/nota credito segun estado.

9. **Caja / turno actual**
   - Decision: el domicilio solo se asocia a caja cuando hay recaudo o movimiento de dinero.
   - Decision: pago previo queda trazado a POS/factura; pago contra entrega requiere control de responsable/repartidor y conciliacion con turno.
   - Decision: `NOT_DELIVERED` con pago previo debe abrir decision operativa de reembolso, nota credito o reintento futuro; no debe ajustar caja automaticamente sin flujo aprobado.

10. **Permisos**
    - Decision: proponer permisos `DELIVERIES_VIEW`, `DELIVERIES_CREATE`, `DELIVERIES_UPDATE`, `DELIVERIES_ASSIGN`, `DELIVERIES_DISPATCH`, `DELIVERIES_MARK_DELIVERED`, `DELIVERIES_MARK_NOT_DELIVERED`, `DELIVERIES_CANCEL`, `DELIVERIES_REPORTS`.
    - Decision: `SUPER_ADMIN`, `SUPER_USER` y `ADMIN` pueden tener permisos amplios; `USER` debe tener permisos operativos limitados por tenant/sucursal/turno.
    - Rationale: despachar, cancelar y recaudar son acciones sensibles. Usuario basico puede operar, pero no debe tener administracion global.

11. **UX**
    - Decision: lista + filtros + detalle lateral/pagina, acciones por estado y creacion manual.
    - Rationale: coincide con patron operativo de modulos existentes y evita depender de una sola pantalla de pedido/factura.
    - Requisitos UX futuros: sin overflow horizontal, responsive movil, botones consistentes, estados vacios, confirmaciones y errores claros.

12. **Web/Electron**
    - Decision: documentar riesgos por tipos A, B y D, pero no disenar offline.
    - Rationale: domicilio puede operar en conectividad limitada, pero offline afecta estados, caja y facturacion. Eso necesita fase propia.

## Fase 2 - Diseno tecnico documental

Esta extension tecnica propone modelo de datos, contratos API, DTOs conceptuales, indices, restricciones, permisos y reglas de caja sin crear runtime. El documento principal es `docs/architecture/domicilios-modelo-datos-api-permisos.md`.

### Modelo de datos propuesto

La tabla principal futura sera `deliveries`. Debe concentrar el estado operativo actual del domicilio y campos de lectura rapida:
- Identidad y scope: `id`, `tenant_id`, `branch_id`, `delivery_number`.
- Vinculos: `customer_id`, `order_id`, `sale_id`, `invoice_id`, `cash_session_id`.
- Estado: `status`.
- Snapshot de entrega: `contact_name`, `contact_phone`, `address_line`, `address_reference`, `neighborhood`, `zone`.
- Dinero: `delivery_fee`, `delivery_fee_source`, `payment_status`, `payment_method`.
- Responsables: `assigned_user_id`, `dispatched_by_user_id`, `delivered_by_user_id`, `cancelled_by_user_id`, `not_delivered_by_user_id`, `created_by_user_id`.
- Timestamps: `created_at`, `updated_at`, `dispatched_at`, `delivered_at`, `cancelled_at`, `not_delivered_at`.
- Motivos y notas: `cancellation_reason`, `not_delivered_reason`, `notes`.

Tablas candidatas:
- `delivery_status_history`: recomendada desde el inicio para auditoria minima real.
- `delivery_payment_events`: recomendada cuando se active contraentrega o conciliacion compleja.
- `customer_delivery_addresses`: util para libreta de direcciones, no bloquea v0.0.1.
- `delivery_assignments`: util si se auditan reasignaciones multiples.

### Relaciones propuestas

- `deliveries.customer_id` referencia cliente cuando existe y siempre guarda snapshot de direccion/contacto.
- `deliveries.order_id` referencia pedido cuando aplica; en v0.0.1 se propone maximo un domicilio activo por pedido.
- `deliveries.sale_id` referencia venta POS cuando aplica.
- `deliveries.invoice_id` queda conceptual hasta confirmar si factura fiscal vive separada de `sales`.
- `deliveries.cash_session_id` solo aplica si hay recaudo, devolucion, ajuste o conciliacion.
- Todo vinculo debe pertenecer al mismo `tenant_id`; branch scope debe respetar reglas actuales de roles.

### Estados y transiciones tecnicas

Estados v0.0.1:
- `DRAFT`
- `CREATED`
- `ASSIGNED`
- `DISPATCHED`
- `DELIVERED`
- `NOT_DELIVERED`
- `CANCELLED`

Transiciones:
- `DRAFT` -> `CREATED`, `CANCELLED`.
- `CREATED` -> `ASSIGNED`, `CANCELLED`.
- `ASSIGNED` -> `DISPATCHED`, `CANCELLED`.
- `DISPATCHED` -> `DELIVERED`, `NOT_DELIVERED`.
- `DELIVERED`, `CANCELLED` y `NOT_DELIVERED` son finales en v0.0.1.

Campos obligatorios por accion futura:
- Despachar: responsable o usuario asignado, usuario que despacha y fecha/hora.
- Entregar: usuario responsable, fecha/hora y recaudo si aplica.
- Cancelar: motivo, usuario y fecha/hora.
- No entregado: motivo, usuario y fecha/hora.

### API futura propuesta

Endpoints conceptuales:
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

DTOs conceptuales:
- `CreateDeliveryDto`
- `UpdateDeliveryDto`
- `AssignDeliveryDto`
- `DispatchDeliveryDto`
- `MarkDeliveryDeliveredDto`
- `MarkDeliveryNotDeliveredDto`
- `CancelDeliveryDto`
- `DeliveryFiltersDto`
- `DeliveryResponseDto`
- `DeliverySummaryReportDto`

### Indices y restricciones sugeridas

Indices sugeridos:
- `tenant_id`, `customer_id`, `order_id`, `sale_id`, `invoice_id`, `cash_session_id`, `status`, `created_at`, `dispatched_at`, `delivered_at`.
- `(tenant_id, status, created_at)`, `(tenant_id, customer_id)`, `(tenant_id, order_id)`, `(tenant_id, sale_id)`, `(tenant_id, invoice_id)`, `(tenant_id, cash_session_id)`.
- `(tenant_id, assigned_user_id, status)` y `(tenant_id, zone, status)` para operacion/repartidor.

Restricciones conceptuales:
- Un pedido no debe tener mas de un domicilio activo en v0.0.1.
- `delivery_fee_source` debe evitar doble conteo financiero.
- Entidades vinculadas deben pertenecer al mismo tenant.
- Estados finales no deben cambiar por flujo normal.

### Permisos fase 2

La lista se consolida con accion separada para no entregado:
- `DELIVERIES_VIEW`
- `DELIVERIES_CREATE`
- `DELIVERIES_UPDATE`
- `DELIVERIES_ASSIGN`
- `DELIVERIES_DISPATCH`
- `DELIVERIES_MARK_DELIVERED`
- `DELIVERIES_MARK_NOT_DELIVERED`
- `DELIVERIES_CANCEL`
- `DELIVERIES_REPORTS`

No se aplican permisos reales en esta fase.

### Reglas de caja fase 2

- Pagado previamente no crea recaudo nuevo.
- Contraentrega requiere cash session o conciliacion futura.
- Si el envio esta en factura/POS, no se duplica como ingreso separado.
- Si el envio es operativo separado, debe quedar identificado y conciliado.
- `NOT_DELIVERED` o `CANCELLED` con dinero debe abrir resolucion financiera.

## Fase 3 - Plan de implementacion backend

Esta fase define el orden tecnico para implementar backend despues de aprobar modelo y permisos. El documento principal es `docs/architecture/domicilios-plan-implementacion-backend.md`.

No crea migraciones, tablas, endpoints, DTOs, servicios, guards, permisos reales ni tests ejecutables.

### Migraciones futuras

Migraciones candidatas:
- `deliveries`: tabla principal con tenant, cliente, pedido, factura/venta, caja, estado, direccion snapshot, valor, fuente financiera, pago, responsables, timestamps, motivos y notas.
- `delivery_status_history`: historial de estados recomendado desde v0.0.1.
- `delivery_payment_events`: opcional para contraentrega y conciliacion.
- `customer_delivery_addresses`: opcional para libreta de direcciones.
- `delivery_assignments`: opcional para historial de asignaciones.

Restricciones futuras:
- FK a tenant.
- FK opcional a customer, order, invoice/sale, cash session y usuarios responsables.
- Check constraints para estados, `delivery_fee >= 0`, fuente financiera y estado de pago.
- Restriccion unica conceptual para maximo un domicilio activo por pedido.
- Validacion de mismo tenant entre domicilio y entidades relacionadas.

### Backend futuro

Archivos candidatos:
- `api/src/modules/deliveries/deliveries.module.ts`
- `api/src/modules/deliveries/deliveries.controller.ts`
- `api/src/modules/deliveries/deliveries.service.ts`
- `api/src/modules/deliveries/deliveries.repository.ts`
- `api/src/modules/deliveries/entities/*`
- `api/src/modules/deliveries/dto/*`
- `api/src/modules/deliveries/*.spec.ts`

Servicios candidatos:
- `DeliveriesService`
- `DeliveryStateMachineService`
- `DeliveryNumberService`
- `DeliveryCashIntegrationService`
- `DeliveryAuditService`

### Endpoints backend futuros

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

### Tests backend futuros

El plan cubre tests de migracion/modelo, servicio, state machine, controller/guards y caja. Deben usar el patron actual de `node:test` y `assert/strict` cuando aplique.

### Orden recomendado

1. Migracion `deliveries`.
2. Migracion `delivery_status_history`.
3. Tipos/enums backend.
4. DTOs.
5. State machine.
6. Consecutivo.
7. Repository/SQL.
8. Servicio principal.
9. Auditoria.
10. Controller.
11. Guards/permisos codigo.
12. Tests.
13. Build/test/OpenSpec.
14. SQL de permisos para local/QA.
15. QA backend.
16. Frontend despues.

## Fase 4 - Implementacion base con SQL DDL directo

Fase 4 crea la primera base real del modulo sin Prisma y sin ORM nuevo.

### DDL implementado

Archivo:
- `scripts/database/migrations/V063__deliveries_base.sql`

Tablas:
- `public.deliveries`
- `public.delivery_status_history`

Decisiones tecnicas:
- IDs `uuid` con `gen_random_uuid()`.
- Scope obligatorio `tenant_id` y `branch_id`.
- Estados runtime en ingles: `DRAFT`, `CREATED`, `ASSIGNED`, `DISPATCHED`, `DELIVERED`, `NOT_DELIVERED`, `CANCELLED`.
- Estado inicial de API: `CREATED`.
- `CHECK` constraints para estado, montos no negativos, direccion no vacia y `metadata` como objeto JSON.
- Unique `tenant_id`, `branch_id`, `delivery_number`.
- Indices para tenant/sucursal/estado/fecha, cliente, pedido, venta, domiciliario e historial.
- FKs seguras a `tenants`, `tenant_branches`, `customers`, `orders`, `sales`, `payment_methods` y `users` cuando la tabla existe.

### Backend implementado

Archivos:
- `api/src/modules/deliveries/deliveries.module.ts`
- `api/src/modules/deliveries/deliveries.controller.ts`
- `api/src/modules/deliveries/deliveries.service.ts`
- `api/src/modules/deliveries/deliveries.constants.ts`
- `api/src/modules/deliveries/dto/create-delivery.dto.ts`
- `api/src/modules/deliveries/dto/update-delivery.dto.ts`
- `api/src/modules/deliveries/dto/query-deliveries.dto.ts`
- `api/src/modules/deliveries/services/delivery-number.service.ts`

Endpoints iniciales:
- `GET /api/deliveries`
- `POST /api/deliveries`
- `GET /api/deliveries/:id`
- `PATCH /api/deliveries/:id`

Seguridad:
- Usa `JwtAuthGuard`.
- `tenant_id` sale de `request.context.tenantId` o `request.user.tenantId`.
- `branch_id` usa contexto si existe; si no, body/query.
- No se aplican `DELIVERIES_*` todavia porque no hay seed/menu aprobado.

Fuera de Fase 4:
- State machine formal de `assign`, `dispatch`, `delivered`, `not_delivered` y `cancel`.
- Integracion con caja.
- Integracion con facturacion/electronica.
- Integracion real con pedidos.
- Frontend.
- Reporteria avanzada.

## Fase 5 - Maquina de estados backend

Fase 5 implementa la maquina de estados real del modulo Domicilios sin tocar caja, facturacion, pedidos, inventario, frontend, menus ni seeds de permisos.

### State machine implementada

Servicio:
- `api/src/modules/deliveries/services/delivery-state-machine.service.ts`

Estados:
- `DRAFT`
- `CREATED`
- `ASSIGNED`
- `DISPATCHED`
- `DELIVERED`
- `NOT_DELIVERED`
- `CANCELLED`

Transiciones implementadas:
- `CREATED` -> `ASSIGNED` por `ASSIGN`.
- `ASSIGNED` -> `DISPATCHED` por `DISPATCH`.
- `DISPATCHED` -> `DELIVERED` por `MARK_DELIVERED`.
- `DISPATCHED` -> `NOT_DELIVERED` por `MARK_NOT_DELIVERED`.
- `CREATED` -> `CANCELLED` por `CANCEL`.
- `ASSIGNED` -> `CANCELLED` por `CANCEL`.

Estados finales:
- `DELIVERED`
- `NOT_DELIVERED`
- `CANCELLED`

Transiciones bloqueadas:
- `CREATED` -> `DISPATCHED` sin asignacion.
- `ASSIGNED` -> `DELIVERED` sin despacho.
- Cualquier cambio desde `DELIVERED`, `NOT_DELIVERED` o `CANCELLED`.
- `DISPATCHED` -> `CANCELLED`, hasta que negocio apruebe esa excepcion.

### Endpoints implementados

- `POST /api/deliveries/:id/assign`
- `POST /api/deliveries/:id/dispatch`
- `POST /api/deliveries/:id/mark-delivered`
- `POST /api/deliveries/:id/mark-not-delivered`
- `POST /api/deliveries/:id/cancel`

Todos los endpoints:
- Usan `JwtAuthGuard`.
- Filtran por `tenant_id`.
- Validan branch context si existe.
- Ejecutan `SELECT ... FOR UPDATE`.
- Actualizan `deliveries` e insertan `delivery_status_history` en la misma transaccion.
- No tocan caja, facturacion, pedidos, ventas, inventario ni reporteria.

### DTOs implementados

- `assign-delivery.dto.ts`
- `dispatch-delivery.dto.ts`
- `mark-delivered-delivery.dto.ts`
- `mark-not-delivered-delivery.dto.ts`
- `cancel-delivery.dto.ts`

### Permisos

`DELIVERIES_*` sigue pendiente. No se agregan seeds ni menu real en Fase 5. Los endpoints quedan protegidos por `JwtAuthGuard` hasta que exista matriz aprobada.

### Tests

Se agregan tests unitarios de:
- Maquina de estados.
- Transiciones validas.
- Transiciones invalidas.
- Rollback sin historial cuando falla la transicion.
- Historial transaccional cuando la transicion es valida.

## Fase 6A - Permisos backend

Fase 6A activa control real de permisos backend para Domicilios sin tocar frontend, caja, facturacion, pedidos, ventas, inventario ni reporteria avanzada.

### Patron aplicado

- Se agrega `MENU_KEYS.DELIVERIES`.
- Se definen acciones `DELIVERIES_*` en `api/src/modules/deliveries/deliveries.constants.ts`.
- `DeliveriesController` usa `JwtAuthGuard` y `PermissionsGuard`.
- Cada metodo del controller usa `@RequirePermission` con `menuKey: MENU_KEYS.DELIVERIES`, nivel `READ` o `WRITE`, y accion `DELIVERIES_*`.
- `DeliveriesModule` importa `AccessControlModule` para resolver `PermissionsGuard`.

### Mapeo de endpoints

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

El endpoint `GET /api/deliveries/reports/summary` queda como placeholder protegido con `NotImplementedException`. No calcula reportes ni toca `backend-reporteria`.

### SQL local/QA

Archivo:
- `scripts/database/security/20260620_1730_deliveries_permissions_local_qa.sql`

Este SQL:
- Es idempotente.
- Crea/actualiza `menu_items` con key `DELIVERIES`, visible `FALSE` y metadata `backendOnly`.
- Crea/actualiza `role_menu_permissions` para `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`.
- No se ejecuta automaticamente por `migrate_prd.sh`.
- No debe aplicarse en produccion sin aprobacion explicita.

### Tests

Se agregan tests para:
- Metadata de guards en `DeliveriesController`.
- Mapeo de permisos por endpoint.
- `PermissionsGuard` permitiendo accion `DELIVERIES_*` cuando existe en `role_menu_permissions.actions`.
- `PermissionsGuard` bloqueando accion `DELIVERIES_*` faltante.

## Fase 6B - Integracion backend controlada con pedidos

Fase 6B agrega una integracion limitada Domicilios + Pedidos sin cambiar creacion normal de pedidos, state machine, caja, facturacion, POS, inventario, frontend ni reporteria.

### Decision tecnica

Se implementan endpoints wrapper en el controller de pedidos:

| Endpoint | Permiso | Responsable de reglas |
| --- | --- | --- |
| `GET /api/orders/:id/delivery` | `DELIVERIES_VIEW` | `DeliveriesService.getByOrder` |
| `POST /api/orders/:id/delivery` | `DELIVERIES_CREATE` | `DeliveriesService.createFromOrder` |

Motivo:
- El consumidor operativo puede navegar desde el pedido.
- `DeliveriesService` sigue siendo el duenio de reglas de domicilio.
- `OrderService` no asume state machine ni reglas internas de Domicilios.
- No se altera el flujo actual de creacion, confirmacion, despacho, factura o cancelacion de pedidos.

### Reglas implementadas

- El domicilio creado desde pedido inicia en `CREATED`.
- El sistema carga el pedido por `id` y `tenant_id`.
- Si el pedido tiene cliente, se usa snapshot de `customers.name`, `customers.phone` y `customers.address` cuando el payload no los trae.
- Si no hay direccion suficiente, `delivery_address` es obligatorio en el DTO.
- Se valida branch desde auditoria de pedido cuando existe; si no existe, se usa branch del contexto o del body.
- Se rechaza otro branch cuando el contexto autenticado ya trae una sucursal.
- Se rechaza cualquier segundo domicilio para el mismo pedido, incluso si el anterior esta en estado final, porque OpenSpec no habilita historico/reintentos en v0.0.1.
- `POST /api/deliveries` tambien respeta la regla de no duplicar `order_id`.
- `GET /api/deliveries` acepta filtro `order_id` como soporte operativo adicional.

### Fuera de alcance

- No se toca `invoice_id`.
- No se toca `cash_session_id`.
- No se crean movimientos financieros.
- No se cambia estado de pedido al crear o consultar domicilio.
- No se integran caja, facturacion, POS ni frontend.

## Risks / Trade-offs

- [Riesgo] Doble fuente de verdad entre factura, domicilio y caja. -> [Mitigacion] definir una fuente financiera unica para valor de envio antes de implementar.
- [Riesgo] `NOT_DELIVERED` necesita reintentos reales. -> [Mitigacion] dejarlo final en v0.0.1 y modelar intentos en fase posterior si negocio lo exige.
- [Riesgo] Cliente generico reduce trazabilidad. -> [Mitigacion] exigir direccion, telefono y observacion minima cuando no hay cliente identificado.
- [Riesgo] Caja puede descuadrar por pago contra entrega. -> [Mitigacion] exigir reglas de recaudo por repartidor y turno antes de tocar caja.
- [Riesgo] Multiples domicilios por pedido/factura pueden ser necesarios. -> [Mitigacion] v0.0.1 limita un domicilio activo; multiples entregas quedan pendientes.
- [Riesgo] Electron/offline puede crear conflictos de estado. -> [Mitigacion] no implementar offline sin cola, idempotencia y reconciliacion formal.
- [Riesgo] Permisos mal aplicados pueden exponer domicilios cross-tenant o cross-branch. -> [Mitigacion] toda fase tecnica debe validar tenant, sucursal, rol y permiso.

## Migration Plan

No hay migracion en esta fase.

Fases futuras recomendadas:
1. OpenSpec + arquitectura funcional.
2. Diseno tecnico documental de modelo, API y permisos.
3. Plan tecnico de implementacion backend.
4. Modelo de datos y migraciones.
5. Backend API y reglas de negocio.
6. Frontend modulo Domicilios.
7. Integracion con pedidos/facturacion/caja.
8. Reporteria y auditoria.
9. QA integral y hardening.

Rollback de esta fase: revertir solo archivos OpenSpec y documento de arquitectura.

## Open Questions

- El repartidor sera un `user` del tenant, un contacto externo o ambos?
- El valor de envio se factura siempre o puede ser cargo operativo no fiscal?
- `invoice_id` sera `sales.id`, documento fiscal separado o tabla futura?
- `delivery_number` sera consecutivo por tenant o por tenant/sucursal?
- Se requiere propina o pago extra al repartidor?
- `NOT_DELIVERED` debe permitir reintento en v0.0.2 con intentos separados?
- Un pedido debe soportar entregas parciales o multiples domicilios?
- La conciliacion de recaudo por repartidor entra al turno actual del cajero, a una caja del repartidor o a una liquidacion posterior?
- Que rol operativo real marcara `DELIVERED`: cajero, admin, repartidor o backend externo?
