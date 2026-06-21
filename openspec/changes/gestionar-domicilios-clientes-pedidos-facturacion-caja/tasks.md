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

## 4. Fase 4 - Modelo de datos y migraciones futuras

- [ ] 4.1 Disenar tabla futura de domicilios con `tenant_id`, `branch_id`, fuente asociada, cliente, direccion snapshot, estado, responsable, valores, timestamps y auditoria.
- [ ] 4.2 Disenar estrategia SQL de historico de estados o eventos de domicilio.
- [ ] 4.3 Definir indices, restricciones multi-tenant y llaves hacia pedidos, ventas/facturas, usuarios y caja.
- [ ] 4.4 Crear migraciones y rollback solo despues de aprobacion de esta fase.

## 5. Fase 5 - Backend API y reglas de negocio

- [ ] 5.1 Crear modulo backend de domicilios con controller, service, repository/SQL y DTOs.
- [ ] 5.2 Implementar validaciones de estados y transiciones permitidas.
- [ ] 5.3 Implementar scope por tenant, sucursal, rol y permisos.
- [ ] 5.4 Implementar trazabilidad de cambios de estado y acciones sensibles.
- [ ] 5.5 Agregar tests backend unitarios y de autorizacion.

## 6. Fase 6 - Frontend modulo Domicilios

- [ ] 6.1 Crear ruta futura `/{tenant}/deliveries` y dominio frontend de domicilios.
- [ ] 6.2 Implementar listado con filtros por estado, cliente, fecha, pedido/factura, repartidor y caja/turno.
- [ ] 6.3 Implementar vista detalle con datos de cliente, direccion, fuente, estado, valores, timestamps y observaciones.
- [ ] 6.4 Implementar creacion manual y acciones por estado.
- [ ] 6.5 Verificar responsive movil sin overflow horizontal.

## 7. Fase 7 - Integraciones con pedidos, facturacion y caja

- [ ] 7.1 Integrar creacion/consulta de domicilio desde pedidos sin romper estados existentes.
- [ ] 7.2 Integrar vinculacion con ventas/facturas y definir fuente financiera del valor de envio.
- [ ] 7.3 Integrar reglas de pago contra entrega, recaudo por repartidor y asociacion a turno.
- [ ] 7.4 Implementar resolucion de cancelaciones, anulaciones y `NO_ENTREGADO` con trazabilidad.
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
