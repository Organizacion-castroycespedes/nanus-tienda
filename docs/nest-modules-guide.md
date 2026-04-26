# Guía interna para nuevos módulos NestJS

## Estructura de carpetas
Cada módulo debe vivir en `api/src/modules/<modulo>/` con esta estructura:

- `<modulo>.module.ts`
- `<modulo>.controller.ts`
- `<modulo>.service.ts`
- `<modulo>.repository.ts` cuando exista acceso a datos relevante o reutilizable
- `dto/`

Ejemplos habituales dentro de `dto/`:
- `create-<modulo>.dto.ts`
- `update-<modulo>.dto.ts`
- `list-<modulo>-query.dto.ts`
- `<modulo>-response.dto.ts`
- `update-<modulo>-status.dto.ts`

## Responsabilidades por capa

### Controller
- Define rutas y verbos HTTP.
- Aplica guards y decorators.
- Recibe `@Body`, `@Param`, `@Query`, `@Req`.
- Construye el `actor` desde `request.user`.
- Delega toda la lógica al service.

### Service
- Contiene reglas de negocio.
- Resuelve `tenantId`.
- Valida permisos de contexto.
- Coordina transacciones.
- Orquesta repositories y servicios comunes como auditoría.

### Repository
- Encapsula SQL del módulo.
- Implementa consultas reutilizables y operaciones CRUD.
- Puede aceptar `client?: PoolClient` para participar en transacciones abiertas por el service.

### DTO
- Define contratos de entrada y salida.
- En este proyecto se modelan como `type` de TypeScript.
- No reemplazan una entidad ORM porque el proyecto no usa ORM.

## Cómo manejar SQL
- Preferir `repository` para SQL reutilizable, largo o claramente persistente.
- Dejar SQL en `service` solo si la operación es pequeña y muy específica del caso de uso.
- Mantener reglas de negocio en `service`, no dentro del query.
- Usar siempre queries parametrizadas.

## Cómo manejar transacciones con `pg Pool`
El patrón actual es:

1. Obtener cliente con `this.db.getClient()`.
2. Ejecutar `BEGIN`.
3. Reutilizar el mismo `client` en todas las operaciones.
4. Ejecutar `COMMIT` si todo sale bien.
5. Ejecutar `ROLLBACK` en `catch`.
6. Liberar con `client.release()` en `finally`.

El service debe controlar la transacción. El repository solo participa si recibe el `client`.

## Cómo pasar `tenantId` y `actor`

### En controller
Construir un objeto `actor` desde `request.user`, normalmente con:
- `roles`
- `tenantId`
- `userId`
- opcionalmente `ip`
- opcionalmente `userAgent`

### En service
- Resolver el tenant real con un helper tipo `resolveTenantId(actor, tenantId?)`.
- `SUPER_ADMIN` puede operar sobre otros tenants si el caso lo permite.
- Usuarios no `SUPER_ADMIN` deben quedar restringidos a `actor.tenantId`.
- Si falta tenant en un flujo obligatorio, lanzar `BadRequestException` o `ForbiddenException` según el contexto.

## Convenciones de nombres de archivos
- Usar `kebab-case` para archivos.
- Usar nombres como:
  - `users.controller.ts`
  - `users.service.ts`
  - `branches.repository.ts`
  - `create-user.dto.ts`
  - `update-branch-status.dto.ts`
- Usar clases en `PascalCase`:
  - `UsersController`
  - `BranchesService`
  - `BranchesRepository`
- Usar sufijo `Dto` para tipos de entrada/salida.
- Mantener recursos REST en plural dentro de `@Controller("users")`, `@Controller("branches")`.

## Regla práctica
- `controller` recibe y delega.
- `service` decide y coordina.
- `repository` consulta y persiste.
- `dto` define contratos.
