## 1. Prerrequisitos y gobernanza

- [x] 1.1 Verificar que el target es `origin/develop`, crear una rama `feature/develop/control-center-foundation` y confirmar el siguiente `V###` libre según las reglas del runner.
- [x] 1.2 Registrar en `scripts/governance/openspec-scope.json` el ownership de las rutas de este change.
- [x] 1.3 Redactar `docs/runbook-control-center-db-role.md` (creación de `manus_control_center_app`, `manus_cc_qa` y `manus_cc_prd`; rotación de credenciales; sin secretos).
- [ ] 1.4 Confirmar con el DBA que el usuario de migraciones tiene `REFERENCES` sobre `public.tenants` y puede ejecutar `ALTER DEFAULT PRIVILEGES` en `control_center`.

## 2. Base de datos

- [x] 2.1 Crear `V###__control_center_foundation.sql`: verificar el rol, crear el esquema, `REVOKE` a `PUBLIC`, grants al grupo, `SELECT` por columnas en `public` y la tabla `admin_audit_events` con un trigger de inmutabilidad. Sin `BEGIN`/`COMMIT`.
- [x] 2.2 Incluir el seed del ítem de menú del Control Center solo para el tenant plataforma, de forma idempotente.
- [x] 2.3 Crear el rollback en `scripts/database/rollbacks/`.
- [ ] 2.4 Dry-run en LOCAL y diagnóstico de gobernanza en modo STRICT. Si falla por el esquema no-`public`, detener el trabajo y escalar. Estado 2026-11-08: gobernanza STRICT PASS; por decisión del propietario V111 se aplicó directamente sobre `manus_prd_local_test` (el guard LOCAL del runner exige `manus_tienda_qa`). El dry-run y la aplicación con el runner oficial quedan para QA.
- [x] 2.5 Agregar la prueba de contrato `scripts/database/tests/test_v111_control_center_foundation_migration.py` (privilegios por columna, auditoría solo inserción, chequeo transaccional del runner).
- [x] 2.6 Verificar privilegios contra PostgreSQL real tras aplicar V111: el usuario operativo es denegado, el dedicado es permitido y las columnas bancarias son denegadas (readiness `READY`).

## 3. API

- [x] 3.1 Implementar `ControlCenterDatabaseService` (pool dedicado y desactivación segura) y las variables en `api/.env.example`.
- [x] 3.2 Implementar `PlatformTenantGuard` con revalidación en BD, más pruebas `node:test` para los casos válido, otro tenant, rol revocado, usuario inactivo y tenant plataforma inactivo.
- [x] 3.3 Implementar `ControlCenterAuditService.record(tx, event)` con validación del motivo para acciones críticas.
- [x] 3.4 Implementar `GET /api/admin/control-center/readiness`.
- [x] 3.5 Implementar la prueba de inventario de guards del módulo.
- [x] 3.6 Registrar `ControlCenterModule` en `app.module.ts`.

## 4. Web

- [x] 4.1 Crear la ruta `/{tenant}/control-center` con la pantalla de readiness y la visibilidad condicionada.
- [x] 4.2 Agregar pruebas de visibilidad (`node:test`, patrón de la web) (SUPER_ADMIN del tenant plataforma frente a otros perfiles).

## 5. Verificación y evidencia

- [x] 5.1 Pasar `openspec validate habilitar-plataforma-control-center --strict`.
- [x] 5.2 Ejecutar las pruebas de la API (`npx tsx --test`) y de la web (lint y pruebas de visibilidad). Resultado 2026-11-07: API typecheck OK, 980/983 pruebas OK (1 falla preexistente por dependencia de `web/node_modules`), lint web OK; los errores `tsc` de la web son preexistentes en otros `*.spec.ts`.
- [x] 5.3 QA manual en LOCAL con cuatro perfiles (SUPER_ADMIN plataforma, SUPER_ADMIN de otro tenant, ADMIN, USER) y el flag apagado/encendido.
- [x] 5.4 Documentar la evidencia en `docs/evidencia-control-center-foundation.md`.
