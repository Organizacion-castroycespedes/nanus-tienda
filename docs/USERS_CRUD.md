# Gestión de usuarios (CRUD)

## Migraciones
1. Ejecuta la migración nueva para crear `personas` y su vínculo con sucursales:
   - `apps/api/database/2024_10_04_add_personas.sql`
2. Si estás creando una base desde cero, la misma estructura ya quedó reflejada en:
   - `apps/api/database/initial_schema.sql`

## Backend
- Endpoints principales:
  - `GET /users`
  - `GET /users/:id`
  - `POST /users` (wizard)
  - `PATCH /users/:id`
  - `PATCH /users/:id/password`
- Requiere encabezados de autenticación simulados:
  - `x-user-role: SUPER_ADMIN | ADMIN`
  - `x-tenant-id: <tenant_uuid>`
  - `x-user-id: <user_uuid>`

## Frontend
- Ruta: `/{tenant}/usuarios`
- Wizard por pasos:
  1. Credenciales
  2. Persona
  3. Cargo y funciones
  4. Organización
  5. Rol
  6. Resumen

## Pruebas rápidas manuales
1. Inicia el backend (`apps/api`) y frontend (`apps/web`).
2. Ingresa con un usuario SUPER_ADMIN y crea un usuario en cualquier tenant.
3. Ingresa con un usuario ADMIN y valida que solo vea usuarios de su tenant.
4. Verifica que la creación genera:
   - `users`
   - `personas`
   - `user_roles`
   - `persona_tenant_branches`
