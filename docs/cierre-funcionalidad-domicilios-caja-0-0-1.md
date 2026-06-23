# Cierre funcional Domicilios + Caja 0.0.1

## Rama

`feat/develop/cierre-funcionalidad-de-domicilios`

## Alcance cerrado

- Domicilios visible en menu.
- Creacion rapida de domicilio.
- Creacion desde pedido.
- Vinculo con venta.
- Gestion de estados.
- Repartidores CRUD/asignacion.
- Ticket de domicilio.
- Integracion con caja actual.
- Cierre de caja con domicilios.
- Arqueo de caja y desglose por medios de pago.
- Caja abierta requerida para mutaciones operativas.
- Filtro operativo por caja actual en pedidos/compras.
- Mejoras responsive de modales y resumen de caja.

## Estado OpenSpec

### Archivados en este cierre

- `gestionar-estados-domicilios` -> `openspec/changes/archive/2026-06-23-gestionar-estados-domicilios/`.
- `cerrar-operacion-despacho-domicilios` -> `openspec/changes/archive/2026-06-23-cerrar-operacion-despacho-domicilios/`.

### Abiertos con implementacion completa y QA tecnico PASS

- `vincular-domicilios-con-ventas`
- `gestionar-repartidores-domicilios`
- `definir-flujo-funcional-creacion-domicilios`
- `integrar-domicilios-con-caja-actual`
- `implementar-arqueo-caja-y-desglose-medios-pago`
- `exigir-caja-abierta-operaciones-operativas`
- `filtrar-pedidos-compras-por-caja-actual`
- `alinear-domicilios-pedido-con-caja-actual`
- `alinear-creacion-domicilio-desde-pedido`
- `corregir-scroll-modal-detalle-domicilio`
- `corregir-scroll-modal-cierre-caja`
- `corregir-visibilidad-menu-domicilios`
- `mejorar-responsive-caja-sesiones-resumen`

### Abiertos con QA manual pendiente documentado

- `mejorar-creacion-rapida-domicilios`
- `implementar-frontend-domicilios-menu`

No se archivaron changes con QA manual pendiente.

## QA manual PASS registrado

- Gestion de estados de domicilios: QA MANUAL PASS reportado por usuario y registrado el 2026-06-23.
- Operacion de despacho de domicilios: QA MANUAL PASS reportado por usuario y registrado el 2026-06-23.

## Validaciones

- `openspec.cmd validate gestionar-estados-domicilios --type change --strict`: PASS antes de archivar.
- `openspec.cmd validate cerrar-operacion-despacho-domicilios --type change --strict`: PASS antes de archivar.
- `openspec.cmd validate --all --strict`: PASS, 64 items.
- `api npm.cmd run build`: PASS.
- `backend-reporteria npm.cmd run build`: PASS.
- `web npm.cmd run lint`: PASS con warnings preexistentes.
- `web npm.cmd run build`: PASS con warnings preexistentes.
- `api npx.cmd tsx --test src\common\guards\jwt-auth.guard.spec.ts`: PASS, 10 tests.
- `git diff --check`: PASS con warnings CRLF de Git.

## Migraciones

- `V064__deliveries_menu_visible.sql`
- `V065__deliveries_operational_state_timestamps.sql`
- `V066__delivery_drivers.sql`
- `V067__deliveries_current_cash_session.sql`
- `V068__cash_session_audits_breakdown.sql`
- `V069__orders_purchases_current_cash_scope.sql`

Detalle: `docs/evidencia-qa-migraciones-domicilios-caja-0-0-1.md`.

## Fuera de alcance

- Deploy AWS.
- Ejecucion de migraciones en PRD desde esta tarea.
- Recaudo avanzado por repartidor.
- Liquidacion de repartidores.
- Geolocalizacion/rutas.
- App movil de repartidor.
- Integracion fiscal/electronica nueva.
- ESC/POS, gaveta y bascula.

## Plan de merge/deploy

1. Revisar diff final de rama feature.
2. Commit documental/OpenSpec con aprobacion.
3. Push de rama feature con aprobacion.
4. PR hacia `develop`.
5. Merge a `develop` despues de aprobacion/review.
6. Actualizar rama `release/evolutivo/0.0.1` desde `develop`.
7. Ejecutar CI/build.
8. Backup BD AWS antes de migrar.
9. Ejecutar `scripts/database/migrate_prd.sh` en entorno controlado.
10. Reiniciar servicios.
11. Smoke QA AWS:
    - login
    - caja actual
    - pedidos/compras filtrados
    - domicilios
    - cierre de caja
    - ticket cierre
    - arqueo
12. Registrar evidencia deploy.

## Confirmaciones

- SQL destructivo: NO.
- Deploy ejecutado: NO.
- Migraciones PRD ejecutadas: NO.
- Merge ejecutado: NO.
- Push ejecutado: NO.
- Commit realizado: NO.
