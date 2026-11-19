# Evidencia: MANUS Control Center, fase 0.5 (base de la plataforma)

OpenSpec: `habilitar-plataforma-control-center` · Rama: `feature/develop/control-center-foundation` · Fecha: 2026-11-07/08

## Alcance verificado

- Migración `V111__control_center_foundation.sql` (esquema `control_center`, auditoría inmutable, privilegios por columna, menú del tenant plataforma).
- Módulo API `control-center` (pool dedicado, `PlatformTenantGuard`, guard de módulo habilitado, auditoría transaccional, `GET /api/admin/control-center/readiness`).
- Ruta web `/{tenant}/control-center` con el design system de MANUS (`ReportLayout`, `ReportSummary`, `Toast`, `Button`).

## Validación estática y automatizada (Windows, Node 24.21.0)

| Verificación | Resultado |
|---|---|
| `openspec validate habilitar-plataforma-control-center --strict` (CLI 1.4.0) | Válido |
| `openspec validate crear-control-center-cuentas-contratos --strict` | Válido |
| Gobernanza STRICT equivalente a CI | `REPOSITORY_GATE_STATUS=PASS`; todos los archivos `CURRENT_SINGLE_MATCH` |
| API `tsc --noEmit` | OK |
| API pruebas del módulo y guards | OK |
| API suite completa | 980/983 OK, 2 omitidas, 1 falla preexistente ajena (`operational-sales/on-demand-billing-validation.spec.ts` importa código web sin `web/node_modules` instalado) |
| Web lint | OK |
| Web prueba de visibilidad `domains/control-center/access.spec.ts` | OK |
| Web `tsc --noEmit` | 26 errores preexistentes en 12 `*.spec.ts` de otros módulos; ninguno en archivos del Control Center |
| Prueba de contrato SQL `test_v111_control_center_foundation_migration.py` | 8/8 OK (en Windows la verificación con `bash` se omite; corre en CI Ubuntu) |

## Aplicación local de prueba

Por decisión del propietario, V111 se aplicó **directamente** sobre la base local `manus_prd_local_test` (PostgreSQL 16.12) con un script Node, **sin** el runner gobernado `apply_single_migration.sh` (su guard LOCAL solo acepta `manus_tienda_qa`) y **sin** registro en `migrations_history`. Esta base es un entorno de prueba local; no constituye evidencia del flujo oficial de migración, que queda pendiente para QA.

- Roles creados según el runbook: `manus_control_center_app` (NOLOGIN) y `manus_cc_local` (LOGIN, contraseña generada, no registrada aquí).
- V111 aplicada en una transacción. SHA-256 del archivo: `0a8b560c7594dd9279a17eeaa48ca84884e95d156e4421e491a82f44c1851ef8`.
- Menú `CONTROL_CENTER` creado solo en el tenant `00000000-0000-0000-0000-000000000001`, permiso `WRITE` para `SUPER_ADMIN`.

### Privilegios reales del usuario dedicado (`manus_cc_local`)

Pruebas ejecutadas dentro de una transacción revertida (la auditoría quedó vacía).

| Prueba | Esperado | Resultado |
|---|---|---|
| SELECT `control_center.admin_audit_events` | Permitido | OK |
| INSERT en auditoría | Permitido | OK |
| UPDATE / DELETE en auditoría | Denegado | OK (42501) |
| SELECT `tenants(id, slug, nombre, activo)` | Permitido | OK |
| SELECT `tenants_detalles(razon_social, nit)` | Permitido | OK |
| SELECT `tenants_detalles.numero_cuenta` | Denegado | OK (42501) |
| SELECT `tenants.config` | Denegado | OK (42501) |
| SELECT `pos_terminals`, `taxes` | Permitido | OK |
| SELECT `sales` | Denegado | OK (42501) |
| UPDATE `tenants` | Denegado | OK (42501) |

## QA manual (navegador)

API del worktree en el puerto 4120 y web en el 3100.

| Caso | Resultado |
|---|---|
| Readiness sin token | 401 |
| SUPER_ADMIN del tenant plataforma | Ve el menú y la pantalla; todos los chequeos en verde excepto el aislamiento (ver hallazgo) |
| Otros perfiles | Sin acceso, según lo reportado por el propietario |

## Hallazgos

1. **Aislamiento en local:** la API operativa local se conecta como `postgres` (superusuario), que tiene acceso al esquema `control_center`. Readiness lo detecta correctamente (`OPERATIONAL_ROLE_HAS_SCHEMA_ACCESS` → `DEGRADED`). En QA y PRD la API operativa debe usar un usuario sin superusuario y sin membresía en `manus_control_center_app`.
2. **Modelo de impuestos:** `public.taxes.rate` se guarda como fracción (`0.1900` = 19%). El diseño de la fase 1 se ajusta en consecuencia.
3. **Decisión de acceso:** se mantiene el acceso solo para el SUPER_ADMIN del tenant plataforma (`PLATFORM_TENANT_ID`), por el riesgo de que un SUPER_ADMIN asignado en el tenant de un cliente vea información comercial de todos.

## Pendiente

- Confirmación del DBA (tarea 1.4) y aplicación de V111 con el runner oficial en QA, seguida de readiness `READY` con un usuario operativo no privilegiado.
