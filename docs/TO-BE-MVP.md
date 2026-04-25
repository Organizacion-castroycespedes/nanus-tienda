# MVP Técnico TO-BE (Base)

Este documento define la base técnica inicial (TO-BE) para el MVP del sistema multi-tenant. Se centra exclusivamente en autenticación, autorización, multi-tenant, configuración visual por compañía, dashboard inicial, migración de usuarios y SUPER ADMIN multi-empresa.

## 1) Estructura de carpetas Frontend (Next.js App Router)

```
/apps/web
  /app
    /login
      page.tsx
    /forgot-password
      page.tsx
    /[tenant]
      /dashboard
        page.tsx
      layout.tsx
    layout.tsx
    page.tsx
  /domains
    /auth
      api.ts
      dtos.ts
      hooks.ts
      store.ts
      types.ts
    /users
      api.ts
      dtos.ts
      types.ts
    /tenants
      api.ts
      dtos.ts
      types.ts
  /components
    /design-system
      Button.tsx
      Input.tsx
      Select.tsx
      Modal.tsx
  /config
    theme.ts
  /lib
    http.ts
    jwt.ts
  /store
    auth.ts
    tenant.ts
    permissions.ts
  /styles
    globals.css
  /types
    index.ts
```

## 2) Estructura de carpetas Backend (NestJS)

```
/apps/api
  /src
    /modules
      /auth
        auth.controller.ts
        auth.service.ts
        auth.module.ts
        dto
          login.dto.ts
          forgot-password.dto.ts
          reset-password.dto.ts
      /users
        users.controller.ts
        users.service.ts
        users.module.ts
        dto
          create-user.dto.ts
      /tenants
        tenants.controller.ts
        tenants.service.ts
        tenants.module.ts
      /permissions
        permissions.controller.ts
        permissions.service.ts
        permissions.module.ts
    /common
      /guards
        jwt-auth.guard.ts
        roles.guard.ts
      /decorators
        roles.decorator.ts
        tenant.decorator.ts
      /middleware
        tenant.middleware.ts
      /db
        pool.ts
        queries.ts
    main.ts
```

## 3) Modelo SQL inicial (DDL PostgreSQL)

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'PENDING_RESET',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  UNIQUE (tenant_id, email)
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  PRIMARY KEY (user_id, role_id, tenant_id)
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  module TEXT NOT NULL,
  route TEXT NOT NULL,
  label TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL
);

CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant_email ON users (tenant_id, email);
CREATE INDEX idx_permissions_role_tenant ON permissions (role_id, tenant_id);
CREATE INDEX idx_password_resets_user_tenant ON password_resets (user_id, tenant_id);
```

## 4) Flujo de autenticación (paso a paso)

1. Usuario navega a `/login`.
2. Frontend envía `POST /auth/login` con `email` y `password`.
3. Backend:
   - Normaliza email.
   - Busca usuario por `tenant_id` (resuelto por URL o contexto previo).
   - Verifica `password_hash` con bcrypt.
   - Devuelve `access_token` (JWT) y `refresh_token` (estructura base).
4. Frontend guarda tokens y consulta:
   - `GET /auth/me` para perfil.
   - `GET /auth/menu` para menú dinámico.
5. Redirección a `/{tenant}/dashboard`.

## 5) Ejemplo de payload JWT

```json
{
  "sub": "b1f3b7f6-5a4f-4b32-a4b2-7d9f0baf2f11",
  "tenant_id": "7b62a3a1-0b1c-4ce3-9a85-0e6d9c0d0c77",
  "roles": ["ADMIN"],
  "iat": 1710000000,
  "exp": 1710003600
}
```

## 6) Ejemplo de respuesta de menú dinámico

```json
{
  "items": [
    {
      "module": "dashboard",
      "label": "Dashboard",
      "route": "/{tenant}/dashboard",
      "visible": true
    },
    {
      "module": "users",
      "label": "Usuarios",
      "route": "/{tenant}/users",
      "visible": true
    }
  ]
}
```

## 7) Descripción del flujo multi-tenant

- **Resolución por URL**: el frontend usa `/{tenant}/...` y el backend valida `tenant` contra `tenants.slug` mediante middleware.
- **Resolución por JWT**: el `tenant_id` viaja en el JWT. El backend cruza `tenant_id` con `slug` activo.
- **SUPER_ADMIN**: no queda restringido por `tenant_id`, puede consultar todos los tenants.
- Todas las consultas SQL deben incluir `tenant_id` excepto en operaciones explícitas de SUPER_ADMIN.

## 8) Lista de endpoints iniciales

**Auth**
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `GET /auth/menu`

**Tenants**
- `GET /tenants/:id/config`

**Users**
- `POST /users` (solo SUPER_ADMIN o ADMIN)

## 9) Pasos para levantar el proyecto localmente

1. Crear base de datos en PostgreSQL.
2. Ejecutar DDL del punto 3.
3. Crear roles base: `SUPER_ADMIN`, `ADMIN`, `ASESOR`, `PRODUCCION`, `CONTABILIDAD`.
4. Crear tenant inicial:
   - slug: `star-glass`
   - config: `{ "colors": {"primary": "#1A73E8"}, "font": "Inter", "logo": "" }`
5. Crear SUPER ADMIN (sin restricción de tenant) y asignar rol.
6. Configurar variables de entorno:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`
7. Iniciar backend (NestJS) y frontend (Next.js).

## Decisiones razonables (por falta de detalle del legacy)

- **Normalización de email**: se aplicará `lowercase + trim` antes de persistir o autenticar.
- **Reset de contraseña**: se registra `password_resets` con `token_hash` y expiración; el email se simula con log.
- **Menú dinámico**: se almacena en `permissions` por rol/tenant y se entrega ya filtrado al frontend.
- **Config por tenant**: se define en `tenants.config` como JSONB para permitir extensiones de diseño sin migraciones.
