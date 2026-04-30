# Modulo auth

## Proposito

Gestiona login, logout, refresh tokens, perfil autenticado, recuperacion de password y contexto POS.

## Endpoints

- `POST /api/auth/login`
- `POST /api/auth/login/force`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `PATCH /api/auth/me/password`
- `GET /api/auth/context`

## Reglas de negocio

- solo una `auth_session` activa por usuario/tenant
- `login/force` invalida sesiones previas
- JWT debe incluir `session_id`
- perfil y cambio de password requieren sesion activa

## UI

- login con conflicto de sesion resuelto por modal
- bootstrap automatico con refresh token

## Errores comunes

- `401` credenciales invalidas
- `409` sesion activa existente
