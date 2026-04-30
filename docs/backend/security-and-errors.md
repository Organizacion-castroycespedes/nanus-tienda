# Seguridad y errores

## Guards

- `JwtAuthGuard`: valida bearer token, firma JWT y sesion activa.
- `RolesGuard`: compara roles requeridos contra `request.user.roles`.
- `PermissionsGuard`: compara `menuKey` y nivel `READ`/`WRITE`.

## Decorators

- `@Roles(...)`
- `@RequirePermission({ menuKey, level })`
- `@Tenant()` detectado como decorador comun, con poco uso operativo visible

## Manejo de errores observado

- `BadRequestException` para payload, tenant/branch/terminal y reglas de negocio
- `UnauthorizedException` para token o sesion invalida
- `ForbiddenException` para cruces de tenant o rol
- `NotFoundException` para recursos no encontrados
- `HttpException(409)` para sesion activa en login

## CORS

Configurado en `api/src/main.ts`:

- origenes permitidos por `CORS_ORIGIN`
- credenciales activas
- preflight explicito
