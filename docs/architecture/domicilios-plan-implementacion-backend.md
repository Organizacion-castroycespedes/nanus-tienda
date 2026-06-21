# Domicilios - Plan de implementacion backend

## Resumen ejecutivo

Este documento define el plan tecnico para implementar el backend futuro del modulo Domicilios. No implementa runtime. Sirve como guia para migraciones, modelos, DTOs, servicios, controladores, permisos, tests, orden de trabajo, rollback y criterios de aceptacion.

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

- No crear migraciones reales en esta fase.
- No crear tablas reales en esta fase.
- No crear entidades, servicios, controladores, DTOs o tests ejecutables.
- No modificar guards reales.
- No modificar permisos reales.
- No modificar menus reales.
- No modificar backend funcional.
- No modificar frontend funcional.
- No modificar SQL aplicado.
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
- Check constraint para motivos obligatorios en `CANCELADO` y `NO_ENTREGADO`.
- Restriccion unica conceptual para maximo un domicilio activo por pedido.
- Validacion de tenant consistente entre delivery y entidades relacionadas.

Posible indice unico parcial futuro:

```text
(tenant_id, order_id)
WHERE order_id IS NOT NULL
  AND status IN ('PENDIENTE', 'EN_PREPARACION', 'DESPACHADO')
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
PENDIENTE
EN_PREPARACION
DESPACHADO
ENTREGADO
CANCELADO
NO_ENTREGADO
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

Marca salida a entrega desde `PENDIENTE` o `EN_PREPARACION`.

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

- `PENDIENTE` -> `EN_PREPARACION`, `DESPACHADO`, `CANCELADO`.
- `EN_PREPARACION` -> `DESPACHADO`, `CANCELADO`.
- `DESPACHADO` -> `ENTREGADO`, `NO_ENTREGADO`.
- `ENTREGADO`, `CANCELADO`, `NO_ENTREGADO` -> ninguno.

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

No aplicar esta matriz en esta fase.

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
- Validar `PENDIENTE` -> `EN_PREPARACION`.
- Validar `PENDIENTE` -> `DESPACHADO`.
- Validar `EN_PREPARACION` -> `DESPACHADO`.
- Validar `DESPACHADO` -> `ENTREGADO`.
- Validar `DESPACHADO` -> `NO_ENTREGADO`.
- Rechazar `ENTREGADO` -> `CANCELADO`.
- Rechazar `CANCELADO` -> `DESPACHADO`.
- Rechazar `NO_ENTREGADO` -> `DESPACHADO`.
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

## Secuencia recomendada de implementacion

1. Crear migracion `deliveries` + enums/check constraints + indices.
2. Crear migracion `delivery_status_history`.
3. Crear tipos/enums backend.
4. Crear DTOs con validaciones.
5. Crear `DeliveryStateMachineService`.
6. Crear `DeliveryNumberService`.
7. Crear repository/SQL.
8. Crear `DeliveriesService`.
9. Crear `DeliveryAuditService`.
10. Crear controlador CRUD minimo.
11. Agregar guards/permisos en codigo, sin seed productivo hasta aprobacion.
12. Agregar tests unitarios y de autorizacion.
13. Validar build/test/OpenSpec.
14. Preparar SQL idempotente de permisos para local/QA.
15. Hacer QA backend con curl/Postman.
16. Solo despues disenar frontend runtime.

## Riesgos tecnicos

- Doble conteo de delivery fee entre factura, caja y domicilio.
- Relacion `invoice_id` puede no existir aun como tabla estable.
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

## Confirmacion de alcance

- Codigo backend tocado: NO.
- Codigo frontend tocado: NO.
- SQL/migraciones reales creadas: NO.
- Tablas reales creadas: NO.
- Endpoints reales creados: NO.
- DTOs reales creados: NO.
- Servicios reales creados: NO.
- Guards reales modificados: NO.
- Permisos reales modificados: NO.
- Menus reales modificados: NO.
- Logica de negocio modificada: NO.
- Commit realizado: NO.
