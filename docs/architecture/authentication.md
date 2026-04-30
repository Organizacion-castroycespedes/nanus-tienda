# Autenticacion

## Componentes

- Login: `POST /api/auth/login`
- Force login: `POST /api/auth/login/force`
- Refresh: `POST /api/auth/refresh`
- Logout: `POST /api/auth/logout`
- Perfil: `GET /api/auth/me`
- Contexto POS: `GET /api/auth/context`

## Flujo real

1. El backend valida email, estado del usuario y tenant.
2. Si ya existe una sesion activa en `auth_sessions`, responde `409 SESSION_ACTIVE`.
3. El frontend puede invocar `login/force` para invalidar la sesion anterior.
4. El backend crea `auth_sessions` y emite JWT con `sub`, `tenant_id`, `roles` y `session_id`.
5. El frontend guarda refresh token y programa rotacion automatica.
6. Cada request protegida pasa por `JwtAuthGuard`, que valida firma y sesion activa.

## Sesiones

- `auth_sessions`: sesion de autenticacion
- `pos_user_sessions`: sesion operativa POS

## Recuperacion de password

Existen endpoints y DTOs para:

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

La tabla `password_resets` esta versionada en SQL.
