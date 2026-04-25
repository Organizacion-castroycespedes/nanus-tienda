# Agent.md - TenantCore Platform

## 1. Resumen del Proyecto
Proyecto SaaS multi-tenant con backend en NestJS (`apps/api`) y frontend en Next.js (`apps/web`). El core incluye autenticacion JWT, RBAC por roles y permisos de menu, y catalogo de menu por tenant.

Ejemplos reales:
- Backend NestJS: `apps/api/src/modules/auth`, `apps/api/src/modules/users`, `apps/api/src/modules/menu`.
- Frontend Next.js: `apps/web/app/login/page.tsx`, `apps/web/domains/auth/session-manager.ts`.
- Esquema multi-tenant: tablas `tenants`, `users`, `menu_items`, `role_menu_permissions` en `apps/api/database/initial_schema.sql` y `apps/api/database/2025_03_07_menu_management.sql`.

## 2. Arquitectura General
Diagrama textual (alto nivel):
```
[Web Next.js] -> [API NestJS /api] -> [PostgreSQL]
   app/*            controllers         tablas multi-tenant
   domains/*        services            (tenants, users, roles, menu)
   store/*          common/guards
```

Componentes principales (ejemplos reales):
- Controllers: `AuthController`, `UsersController`, `MenuAdminController`.
- Services: `AuthService`, `UsersService`, `MenuService`, `MenuAdminService`.
- Capa DB: `DatabaseService` y consultas SQL directas.
- Acceso/Permisos: `PermissionsGuard`, `AccessControlService`.

Separacion por capas (actual):
- Controllers -> Services -> DB (SQL directo con `pg`).
- Ejemplo: `apps/api/src/modules/users/users.controller.ts` -> `users.service.ts` -> `DatabaseService`.

## 3. Convenciones de Nombres
Carpetas y modulos:
- Modulos backend por dominio: `auth`, `users`, `roles`, `tenants`, `menu`, `branches`, `locations`.
- Frontend por dominio: `apps/web/domains/auth`, `apps/web/domains/menu`.

Clases/DTOs (ejemplos reales):
- DTOs: `CreateUserDto`, `UpdateUserDto`, `UpdateProfileDto`, `CreateRoleDto`.
- Responses: `UserResponseDto` en `apps/api/src/modules/users/dto/user-response.dto`.

Variables estandar:
- `tenantId`, `userId`, `roleId`, `permissionId` (usadas en DTOs y servicios).
- Timestamps DB: `created_at`, `updated_at`, `deleted_at` (ver `initial_schema.sql`).

Endpoints:
- Prefijo global: `/api` (`apps/api/src/main.ts`).
- Ejemplos reales: `/api/auth/login`, `/api/auth/me`, `/api/users`, `/api/admin/menu-items`.

Formato de DTOs:
- `CreateXDto`, `UpdateXDto`, `XResponseDto` (ej.: `CreateUserDto`, `UpdateRoleDto`).

## 4. Multi-Tenant Strategy
Estandar actual observado:
- El `tenant_id` viaja en el JWT (`AuthService.login` incluye `tenant_id`).
- Frontend usa el claim `tenant_id` para routing (`apps/web/domains/auth/session-manager.ts`).
- Existe middleware `tenantMiddleware` que lee `x-tenant` o `:tenant`, pero no esta aplicado en la app.

Reglas de seguridad obligatorias (recomendadas como estandar oficial):
1. Para usuarios autenticados, el `tenant_id` se obtiene del JWT (claim `tenant_id`).
2. Para admin global (SUPER_ADMIN), se permite `tenantId` en query/body solo para operaciones globales.
3. Toda query debe filtrar por `tenant_id` (ej.: `users.service.ts` usa `users.tenant_id = $1`).
4. Evitar `tenant_id` enviado manualmente desde frontend si el token ya lo define.

Tenant default:
- Frontend usa fallback `"default"` si el token no tiene `tenant_id` (ver `buildUserFromToken`).

## 5. RBAC / Permisos
Modelo actual:
- Roles por usuario/tenant: tabla `user_roles`.
- SUPER_ADMIN y ADMIN usados en guards (`@Roles("SUPER_ADMIN", "ADMIN")`).
- Permisos por menu y nivel READ/WRITE en `role_menu_permissions`.

Validacion:
- `PermissionsGuard` valida permisos por menu (`RequirePermission`).
- `AccessControlService` centraliza permisos por usuario/tenant.

Ejemplos reales:
- `UsersController` requiere `MENU_KEYS.CONFIG_USUARIOS`.
- `MenuAdminController` restringido a SUPER_ADMIN.

## 6. Autenticacion y Sesion
Estado actual:
- JWT access token generado en `/api/auth/login` con expiracion `JWT_EXPIRES_IN` (default `1h`).
- Refresh token se genera pero no se persiste ni existe endpoint `/auth/refresh` en backend.
- Frontend espera `/auth/refresh` y maneja refresh en `session-manager.ts`.

Recomendacion de almacenamiento:
- Ideal: refresh token en cookie HttpOnly (ver `docs/auth-session.md`).
- Actual: refresh token en `sessionStorage` (opt-in con `NEXT_PUBLIC_REFRESH_TOKEN_STORAGE=session`).

Flujo real en frontend:
- Login -> `startSessionFromLogin` -> rehidrata perfil y menu (`/auth/me`, `/me/menu`).

## 7. Base de Datos
Motor: PostgreSQL (lib `pg`).

Esquema principal (ejemplos reales):
- `tenants`, `users`, `roles`, `user_roles`, `personas`, `tenant_branches`.
- Menu y permisos: `menu_items`, `role_menu_permissions` (migracion `2025_03_07_menu_management.sql`).
- Auditoria: `security_audit_logs`.

Migraciones:
- SQL legado en `apps/api/database/*.sql`.
- Nuevo flujo automatizado en `apps/scripts/database`:
  - `migrate.sh` (crea DB si no existe + migraciones idempotentes + `migrations_history`).
  - `seed.sh` (datos generales, roles/permisos y SUPER_ADMIN).
  - `backup.sh` / `rollback.sh`.
- Deploy remoto por SSH: `apps/scripts/ssh/deploy-db.sh`.

Indices recomendados ya presentes:
- `menu_items_tenant_key_unique`, `role_menu_permissions_unique`.
- Indices en `tenant_branches`, `personas` y geografia.

## 8. Estructura Recomendada del Proyecto
Estructura actual:
- `apps/api` (NestJS)
- `apps/web` (Next.js)
- `apps/docs` (documentacion)

Si se quiere escalar, propuesta:
```
apps/
  api/
  web/
packages/
  shared/
  types/
  ui/
  config/
database/
  migrations/
  seeds/
docs/
```

Pasos de refactor sugeridos:
1. Mover migraciones desde `apps/api/database` a `database/migrations`.
2. Crear `packages/types` para DTOs compartidos (auth/menu/usuarios).
3. Centralizar config (`eslint`, `tsconfig`, `prettier`) en `packages/config`.

## 9. Estandares de Desarrollo
Linting/Formatting:
- Web: `next lint` configurado.
- API: sin lint/format scripts.

Convenciones recomendadas:
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`).
- Branching: `feature/`, `release/`, `hotfix/`.
- PR checklist: tests, lint, migraciones, seguridad.
- Definition of Done: tests pasados, endpoints con guardas, migracion aplicada.

## 10. Scripts de Arranque (Runbook)
Backend (`apps/api`):
- Instalar: `npm install`
- Dev: `npm run start:dev`
- Build: `npm run build`
- Start prod: `npm run start`

Frontend (`apps/web`):
- Instalar: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start prod: `npm run start`
- Lint: `npm run lint`

Migraciones:
- Script disponible: `scripts/database/migrate.sh`.
- Ejecuta SQL versionados en `scripts/database/00x_*.sql`.
- Crea base automaticamente si no existe (requiere `DB_ADMIN_USER`/`DB_ADMIN_PASSWORD` o usuario con `CREATEDB`).

Seeds:
- Script disponible: `scripts/database/seed.sh`.
- Orden actual:
  - `005_seed_general_data.sql` (paises, departamentos, municipios, tenants, tenants_detalles, tenant_branches, personas).
  - `006_seed_menu_items.sql` (menu inicial).
  - `003_seed_roles.sql`.
  - `007_seed_role_menu_permissions.sql`.
  - `004_seed_super_admin.sql`.

## 11. Checklist de Seguridad
- CORS: configurado en `main.ts` pero con origen unico (falta lista/regex).
- JWT: `JWT_SECRET` tiene default `changeme` (riesgo si falta env).
- Refresh token: falta endpoint `/auth/refresh` y persistencia segura.
- Rate limiting: no se encontro.
- Headers de seguridad (CSP, HSTS): no se encontraron.
- Validacion DTOs (class-validator): no se encontro en API.
- Guards: `JwtAuthGuard` no valida JWT (usa headers `x-user-role/x-tenant-id`).
- Logging/auditoria: solo `security_audit_logs` para menu, no global.

## 12. Roadmap Tecnico (MVP -> Escalable)
- v0: auth + tenant + roles + users (ya parcial).
- v1: permisos dinamicos + menu dinamico (parcial en `menu_admin`).
- v2: auditoria + logs + multi-empresa + multi-sucursal (auditoria parcial).
- v3: metricas + colas + cache (pendiente).

## Diagnostico (Estado Actual)
Que esta bien:
- Separacion clara de modulos en API (`modules/*`).
- SQL multi-tenant con filtros en `users.service.ts`.
- Menu RBAC con cache y auditoria (`menu-admin.service.ts`).

Que se puede mejorar:
- Unificar estrategia de tenant (JWT vs headers vs middleware no usado).
- Agregar DTO validation global en NestJS.
- Integrar `scripts/database/*.sh` en pipeline CI/CD (staging/prod) con gates de aprobacion.

Riesgos tecnicos y de seguridad:
- `JwtAuthGuard` no valida JWT (permite falsificar roles/tenant via headers).
- Endpoints sin guardas (ej.: `tenants`, `permissions`, `locations`).
- Refresh token sin persistencia ni rotacion (frontend depende de `/auth/refresh`).
- Secretos hardcodeados y `.env` en repo.

## 13. Runbook DB Multi-OS

Referencia principal:
- `docs/database-runbook.md`

Resumen operativo:
1. Crear `scripts/config/db.env` desde `scripts/config/db.env.example`.
2. Definir `DB_*` y `DB_ADMIN_*` para creacion automatica de base.
3. Ejecutar migracion:
   - Windows (Git Bash): `bash scripts/database/migrate.sh scripts/config/db.env`
   - Linux/macOS: `./scripts/database/migrate.sh scripts/config/db.env`
4. Ejecutar seed:
   - Windows: `bash scripts/database/seed.sh scripts/config/db.env`
   - Linux/macOS: `./scripts/database/seed.sh scripts/config/db.env`
5. Deploy remoto SSH:
   - Windows: `bash scripts/ssh/deploy-db.sh scripts/config/db.env`
   - Linux/macOS: `./scripts/ssh/deploy-db.sh scripts/config/db.env`
