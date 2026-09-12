## 1. Diseno y contrato

- [x] Confirmar roles y permisos actuales con datos de cada tenant.
- [x] Definir `OperationalSaleScope`, operaciones y errores de scope.
- [x] Definir politica exacta para cero/multiples turnos `OPEN`.

## 2. Backend

- [x] Implementar controller de lista y detalle.
- [x] Exponer retry FE seguro con POS WRITE, proyeccion backend y auditoria existente.
- [x] Implementar servicio de scope y autorizacion por operacion.
- [x] Implementar query paginada y filtros server-side.
- [x] Agregar tests tenant/branch/shift y Admin sin turno.
- [x] Agregar read model FE sin duplicar electronic billing.

## 3. Frontend

- [x] Agregar navegacion protegida por permiso existente o aprobado.
- [x] Implementar lista, filtros, badges y paginacion.
- [x] Implementar detalle operativo y navegacion fiscal del cliente.
- [x] Adaptar Web/Electron sin duplicar reglas.

## 4. Seguridad y operacion

- [x] Reusar auditoria existente para acciones aprobadas.
- [x] Probar UUID cross-tenant, branch manipulada y turno anterior.
- [x] Verificar no N+1 ni llamadas FactuCore por fila.
- [x] Exponer reimpresión de representación electrónica aceptada mediante el flujo de reportes existente.
- [x] Exponer refresh de estado del proveedor con contrato seguro y sin retransmisión.
- [x] Definir decisión de retry en el dominio y bloquear retry ciego/terminal.
- [ ] Certificar ejecución de recuperación técnica con contrato de un solo envío.

## 5. Validacion

- [x] Ejecutar tests API afectados.
- [x] Ejecutar lint/build Web y builds afectados.
- [x] Ejecutar OpenSpec change strict y all strict.
- [x] Ejecutar `git diff --check` y secret scan.

## 6. Cierre

- [x] Documentar evidencia QA por rol.
- [ ] Mantener abiertos QR, timestamp de validacion, workers y cualquier
  submodulo post-MVP.

## 7. Estado durable FE

## 8. Dashboard operativo MVP

- [x] Separar `/operations` como dashboard y `/operations/sales` como listado.
- [x] Exponer métricas reales agregadas con `OperationalSaleScope` y filtros de periodo/sucursal.
- [x] Renderizar KPIs, tendencia, distribución de estados y CTAs al listado filtrado.
- [x] Cubrir estados loading, error y periodo sin datos sin valores de demostración.

- [x] Agregar estado persistente de procesamiento con default fail-closed.
- [x] Persistir intentos de creación y transmisión antes de llamadas externas.
- [x] Definir matriz de transiciones y backfill conservador.
- [x] Implementar fixture PostgreSQL del agregado Billing y smoke tests del flujo real.
- [ ] Certificar escenarios de crash y ambigüedad con PostgreSQL local.
- [x] Phase 5.24: replace stale auth sessions through explicit password-first flow.
- [x] Phase 5.24: revoke old refresh token/session atomically and cover lifecycle tests.
