## Context

Manus POS ya tiene modulos operativos de clientes, pedidos, POS/ventas, facturacion, caja/turno, roles/permisos y reporteria. El modelo actual usa Next.js en `web/`, NestJS en `api/`, `backend-reporteria/` para reportes/PDF, PostgreSQL, JWT, `tenant_id`, sucursal, terminal, sesion POS y sesion de caja.

El modulo Domicilios cruza varios dominios. Un domicilio puede nacer desde un pedido, desde una venta/factura o manualmente, y puede afectar caja si el envio o el recaudo se cobran en turno. Por eso esta fase queda como diseno funcional OpenSpec: no crea tablas, endpoints, componentes, migraciones, seeds, permisos reales ni cambios de reglas productivas.

Restricciones de esta fase:
- Backend productivo: no tocar.
- Frontend productivo: no tocar.
- SQL/migraciones/seeds: no tocar.
- Permisos reales/menu real: no tocar.
- Facturacion, caja, pedidos y clientes existentes: no tocar.
- Commit: no hacer sin aprobacion expresa.

## Goals / Non-Goals

**Goals:**
- Definir el alcance v0.0.1 del modulo Domicilios.
- Establecer datos minimos, estados, transiciones y trazabilidad.
- Documentar integracion conceptual con clientes, pedidos, facturacion y caja.
- Proponer permisos, menu, UX, filtros, acciones, reportes futuros y consideraciones multi-tenant.
- Dejar decisiones pendientes claras para fases futuras de datos, backend, frontend e integraciones.

**Non-Goals:**
- No implementar codigo funcional.
- No definir SQL final ni crear migraciones.
- No agregar endpoints ni DTOs.
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
   - Decision: usar `PENDIENTE`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `CANCELADO`, `NO_ENTREGADO`.
   - Rationale: son suficientes para una primera version. Pago, asignacion y diferencias de caja deben ser campos/eventos, no estados mezclados.
   - Decision adicional: `ENTREGADO`, `CANCELADO` y `NO_ENTREGADO` quedan como estados finales en v0.0.1. Un reintento futuro debe modelarse como nuevo intento o nuevo domicilio enlazado.
   - Alternativa descartada: agregar `REPROGRAMADO`, `REINTENTO`, `PAGADO`, `ASIGNADO`. Mezcla ejes distintos y complica caja antes de tener modelo de datos.

5. **Transiciones operativas**
   - `PENDIENTE` puede pasar a `EN_PREPARACION`, `DESPACHADO` o `CANCELADO`.
   - `EN_PREPARACION` puede pasar a `DESPACHADO` o `CANCELADO`.
   - `DESPACHADO` puede pasar a `ENTREGADO` o `NO_ENTREGADO`.
   - `ENTREGADO`, `CANCELADO` y `NO_ENTREGADO` no cambian en v0.0.1.
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
   - Decision: `NO_ENTREGADO` con pago previo debe abrir decision operativa de reembolso, nota credito o reintento futuro; no debe ajustar caja automaticamente sin flujo aprobado.

10. **Permisos**
    - Decision: proponer permisos `DELIVERIES_VIEW`, `DELIVERIES_CREATE`, `DELIVERIES_UPDATE`, `DELIVERIES_ASSIGN`, `DELIVERIES_DISPATCH`, `DELIVERIES_MARK_DELIVERED`, `DELIVERIES_CANCEL`, `DELIVERIES_REPORTS`.
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
- `PENDIENTE`
- `EN_PREPARACION`
- `DESPACHADO`
- `ENTREGADO`
- `CANCELADO`
- `NO_ENTREGADO`

Transiciones:
- `PENDIENTE` -> `EN_PREPARACION`, `DESPACHADO`, `CANCELADO`.
- `EN_PREPARACION` -> `DESPACHADO`, `CANCELADO`.
- `DESPACHADO` -> `ENTREGADO`, `NO_ENTREGADO`.
- `ENTREGADO`, `CANCELADO` y `NO_ENTREGADO` son finales en v0.0.1.

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
- `NO_ENTREGADO` o `CANCELADO` con dinero debe abrir resolucion financiera.

## Risks / Trade-offs

- [Riesgo] Doble fuente de verdad entre factura, domicilio y caja. -> [Mitigacion] definir una fuente financiera unica para valor de envio antes de implementar.
- [Riesgo] `NO_ENTREGADO` necesita reintentos reales. -> [Mitigacion] dejarlo final en v0.0.1 y modelar intentos en fase posterior si negocio lo exige.
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
3. Modelo de datos y migraciones.
4. Backend API y reglas de negocio.
5. Frontend modulo Domicilios.
6. Integracion con pedidos/facturacion/caja.
7. Reporteria y auditoria.
8. QA integral y hardening.

Rollback de esta fase: revertir solo archivos OpenSpec y documento de arquitectura.

## Open Questions

- El repartidor sera un `user` del tenant, un contacto externo o ambos?
- El valor de envio se factura siempre o puede ser cargo operativo no fiscal?
- `invoice_id` sera `sales.id`, documento fiscal separado o tabla futura?
- `delivery_number` sera consecutivo por tenant o por tenant/sucursal?
- Se requiere propina o pago extra al repartidor?
- `NO_ENTREGADO` debe permitir reintento en v0.0.2 con intentos separados?
- Un pedido debe soportar entregas parciales o multiples domicilios?
- La conciliacion de recaudo por repartidor entra al turno actual del cajero, a una caja del repartidor o a una liquidacion posterior?
- Que rol operativo real marcara `ENTREGADO`: cajero, admin, repartidor o backend externo?
