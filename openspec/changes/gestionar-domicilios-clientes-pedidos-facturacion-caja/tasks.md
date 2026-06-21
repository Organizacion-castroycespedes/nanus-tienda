## 1. Fase 1 - OpenSpec y arquitectura funcional

- [ ] 1.1 Revisar y aprobar `proposal.md`, `design.md` y specs delta de Domicilios.
- [ ] 1.2 Revisar y aprobar `docs/arquitectura-modulo-domicilios-manus-pos.md`.
- [ ] 1.3 Resolver decisiones pendientes sobre valor de envio, repartidor, reintentos y recaudo.
- [ ] 1.4 Confirmar alcance v0.0.1 antes de habilitar implementacion funcional.

## 2. Fase 2 - Modelo de datos y migraciones

- [ ] 2.1 Disenar tabla futura de domicilios con `tenant_id`, `branch_id`, fuente asociada, cliente, direccion snapshot, estado, responsable, valores, timestamps y auditoria.
- [ ] 2.2 Disenar estrategia de historico de estados o eventos de domicilio.
- [ ] 2.3 Definir indices, restricciones multi-tenant y llaves hacia pedidos, ventas/facturas, usuarios y caja.
- [ ] 2.4 Crear migraciones y rollback solo despues de aprobacion de esta fase.

## 3. Fase 3 - Backend API y reglas de negocio

- [ ] 3.1 Crear modulo backend de domicilios con controller, service, repository/SQL y DTOs.
- [ ] 3.2 Implementar validaciones de estados y transiciones permitidas.
- [ ] 3.3 Implementar scope por tenant, sucursal, rol y permisos.
- [ ] 3.4 Implementar trazabilidad de cambios de estado y acciones sensibles.
- [ ] 3.5 Agregar tests backend unitarios y de autorizacion.

## 4. Fase 4 - Frontend modulo Domicilios

- [ ] 4.1 Crear ruta futura `/{tenant}/deliveries` y dominio frontend de domicilios.
- [ ] 4.2 Implementar listado con filtros por estado, cliente, fecha, pedido/factura, repartidor y caja/turno.
- [ ] 4.3 Implementar vista detalle con datos de cliente, direccion, fuente, estado, valores, timestamps y observaciones.
- [ ] 4.4 Implementar creacion manual y acciones por estado.
- [ ] 4.5 Verificar responsive movil sin overflow horizontal.

## 5. Fase 5 - Integraciones con pedidos, facturacion y caja

- [ ] 5.1 Integrar creacion/consulta de domicilio desde pedidos sin romper estados existentes.
- [ ] 5.2 Integrar vinculacion con ventas/facturas y definir fuente financiera del valor de envio.
- [ ] 5.3 Integrar reglas de pago contra entrega, recaudo por repartidor y asociacion a turno.
- [ ] 5.4 Implementar resolucion de cancelaciones, anulaciones y `NO_ENTREGADO` con trazabilidad.
- [ ] 5.5 Agregar tests de integracion para pedidos, facturacion y caja.

## 6. Fase 6 - Reporteria y auditoria

- [ ] 6.1 Implementar reportes de domicilios por estado, cliente, zona, repartidor y fecha.
- [ ] 6.2 Implementar reportes de recaudo por domicilio, repartidor y caja/turno.
- [ ] 6.3 Implementar metricas de tiempos de entrega.
- [ ] 6.4 Integrar auditoria operativa de cambios sensibles.

## 7. Fase 7 - QA integral y hardening

- [ ] 7.1 Ejecutar QA por rol `USER`, `ADMIN`, `SUPER_USER` y `SUPER_ADMIN`.
- [ ] 7.2 Ejecutar QA multi-tenant y multi-sucursal.
- [ ] 7.3 Ejecutar QA de caja con pago previo, contra entrega, cancelado y no entregado.
- [ ] 7.4 Ejecutar QA de responsive y navegacion.
- [ ] 7.5 Documentar evidencia y checklist de release.
