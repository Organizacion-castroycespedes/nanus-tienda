## 1. Fase 1 - OpenSpec y arquitectura funcional

- [ ] 1.1 Revisar y aprobar `proposal.md`, `design.md` y specs delta de Domicilios.
- [ ] 1.2 Revisar y aprobar `docs/arquitectura-modulo-domicilios-manus-pos.md`.
- [ ] 1.3 Resolver decisiones pendientes sobre valor de envio, repartidor, reintentos y recaudo.
- [ ] 1.4 Confirmar alcance v0.0.1 antes de habilitar implementacion funcional.

## 2. Fase 2 - Diseno tecnico documental

- [x] 2.1 Documentar modelo de datos propuesto para `deliveries` y tablas candidatas.
- [x] 2.2 Documentar relaciones conceptuales con clientes, pedidos, ventas/facturas y caja.
- [x] 2.3 Documentar contratos API y DTOs conceptuales.
- [x] 2.4 Documentar permisos propuestos, indices, restricciones, auditoria y reglas de caja.
- [x] 2.5 Crear `docs/architecture/domicilios-modelo-datos-api-permisos.md`.
- [x] 2.6 Actualizar specs OpenSpec relevantes para la fase tecnica documental.

## 3. Fase 3 - Plan de implementacion backend documental

- [x] 3.1 Crear `docs/architecture/domicilios-plan-implementacion-backend.md`.
- [x] 3.2 Documentar migraciones futuras, restricciones e indices.
- [x] 3.3 Documentar entidades/modelos, enums y DTOs futuros.
- [x] 3.4 Documentar servicios, controlador/endpoints y permisos futuros.
- [x] 3.5 Documentar tests backend futuros, orden recomendado, criterios de aceptacion y rollback.
- [x] 3.6 Actualizar `design.md`, docs base y specs OpenSpec relevantes.

## 4. Fase 4 - SQL DDL directo y backend inicial

- [x] 4.1 Confirmar que el proyecto usa SQL DDL directo, `DatabaseService` con `pg.Pool`, UUID, `tenant_id`, `branch_id`, schema `public` y `CHECK` constraints.
- [x] 4.2 Crear `scripts/database/migrations/V063__deliveries_base.sql` sin Prisma, sin ORM nuevo y sin SQL destructivo.
- [x] 4.3 Crear tablas `deliveries` y `delivery_status_history` con constraints, indices y FKs seguras hacia tablas existentes UUID.
- [x] 4.4 Implementar modulo backend inicial `DeliveriesModule` con controller, service, DTOs y `DeliveryNumberService`.
- [x] 4.5 Implementar endpoints iniciales `GET /api/deliveries`, `POST /api/deliveries`, `GET /api/deliveries/:id` y `PATCH /api/deliveries/:id`.
- [x] 4.6 Aplicar `JwtAuthGuard`, tenant desde `request.user.tenantId`/contexto y branch scope desde contexto o body/query.
- [x] 4.7 Crear historial inicial `CREATED` en la misma transaccion de alta de domicilio.
- [x] 4.8 Documentar que permisos reales `DELIVERIES_*`, frontend, caja, facturacion, pedidos y reportes quedan fuera de esta fase.

## 5. Fase 5 - State machine, permisos reales y reglas de negocio

- [x] 5.1 Implementar endpoints `assign`, `dispatch`, `mark-delivered`, `mark-not-delivered` y `cancel`.
- [x] 5.2 Implementar validaciones de estados y transiciones permitidas.
- [x] 5.3 Implementar permisos reales `DELIVERIES_*` cuando existan menu/seed aprobados.
- [x] 5.4 Implementar trazabilidad de cambios de estado y acciones sensibles mas alla del historial inicial.
- [x] 5.5 Agregar tests backend unitarios para state machine y transiciones.
- [x] 5.6 Agregar tests de autorizacion/permisos cuando `DELIVERIES_*` existan en menu/seed aprobados.

## 6A. Fase 6A - Permisos backend Domicilios

- [x] 6A.1 Definir `MENU_KEYS.DELIVERIES` y acciones backend `DELIVERIES_*`.
- [x] 6A.2 Proteger endpoints existentes de Domicilios con `PermissionsGuard` y `@RequirePermission`.
- [x] 6A.3 Agregar endpoint protegido `GET /api/deliveries/reports/summary` como placeholder sin logica de reportes avanzados.
- [x] 6A.4 Crear SQL idempotente local/QA para menu backend-only y matriz por roles.
- [x] 6A.5 Agregar tests de metadata controller y `PermissionsGuard` para acciones `DELIVERIES_*`.
- [x] 6A.6 Documentar que el SQL no se aplica en produccion sin aprobacion.

## 6B. Fase 6B - Integracion backend controlada con pedidos

- [x] 6B.1 Documentar decision tecnica: usar endpoints wrapper `GET /api/orders/:id/delivery` y `POST /api/orders/:id/delivery`.
- [x] 6B.2 Mantener `DeliveriesService` como duenio de reglas de domicilio y no mover state machine a pedidos.
- [x] 6B.3 Implementar creacion de domicilio desde pedido con snapshot de cliente/contacto/direccion cuando existe.
- [x] 6B.4 Implementar consulta de domicilio asociado a pedido.
- [x] 6B.5 Validar `tenant_id`, branch del pedido/contexto y bloqueo de segundo domicilio para el mismo pedido.
- [x] 6B.6 Proteger endpoints de pedido/domicilio con `DELIVERIES_VIEW` y `DELIVERIES_CREATE`.
- [x] 6B.7 Agregar tests backend para creacion, consulta, duplicados, tenant y permisos.
- [x] 6B.8 Documentar evidencia QA backend en `docs/architecture/domicilios-integracion-pedidos-qa.md`.

## 6. Fase 6 - Frontend modulo Domicilios

- [ ] 6.1 Crear ruta futura `/{tenant}/deliveries` y dominio frontend de domicilios.
- [ ] 6.2 Implementar listado con filtros por estado, cliente, fecha, pedido/factura, repartidor y caja/turno.
- [ ] 6.3 Implementar vista detalle con datos de cliente, direccion, fuente, estado, valores, timestamps y observaciones.
- [ ] 6.4 Implementar creacion manual y acciones por estado.
- [ ] 6.5 Verificar responsive movil sin overflow horizontal.

## 7. Fase 7 - Integraciones con pedidos, facturacion y caja

- [x] 7.1 Integrar creacion/consulta backend de domicilio desde pedidos sin romper estados existentes.
- [ ] 7.2 Integrar vinculacion con ventas/facturas y definir fuente financiera del valor de envio.
- [ ] 7.3 Integrar reglas de pago contra entrega, recaudo por repartidor y asociacion a turno.
- [ ] 7.4 Implementar resolucion de cancelaciones, anulaciones y `NOT_DELIVERED` con trazabilidad.
- [ ] 7.5 Agregar tests de integracion para pedidos, facturacion y caja.

## 8. Fase 8 - Reporteria y auditoria

- [ ] 8.1 Implementar reportes de domicilios por estado, cliente, zona, repartidor y fecha.
- [ ] 8.2 Implementar reportes de recaudo por domicilio, repartidor y caja/turno.
- [ ] 8.3 Implementar metricas de tiempos de entrega.
- [ ] 8.4 Integrar auditoria operativa de cambios sensibles.

## 9. Fase 9 - QA integral y hardening

- [ ] 9.1 Ejecutar QA por rol `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`.
- [ ] 9.2 Ejecutar QA multi-tenant y multi-sucursal.
- [ ] 9.3 Ejecutar QA de caja con pago previo, contra entrega, cancelado y no entregado.
- [ ] 9.4 Ejecutar QA de responsive y navegacion.
- [ ] 9.5 Documentar evidencia y checklist de release.
