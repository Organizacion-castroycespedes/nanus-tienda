# API principal: arquitectura interna AS-IS

## Identificación y fuentes

Esta ficha corresponde al commit `3dd5098f428e23daf31c750d638c0adb2fa8676a`.

Fuentes primarias:

- `api/src/main.ts`
- `api/src/modules/app.module.ts`
- `api/src/common/access-control.module.ts`
- `api/src/common/guards/jwt-auth.guard.ts`
- `api/src/common/guards/roles.guard.ts`
- `api/src/common/guards/permissions.guard.ts`
- controladores, DTO, servicios y repositorios bajo `api/src/modules/`

## Arranque y capas

`api/src/main.ts:75-162` carga variables, valida el entorno de auth, configura parsers JSON, establece el prefijo global `/api`, configura CORS y escucha en `PORT` o `4000`.

La estructura observada es:

```text
HTTP controller
  -> guard / pipe / actor context
  -> service
  -> repository o DatabaseService
  -> PostgreSQL
```

No hay ORM general. La API usa `pg`, SQL parametrizado y repositorios propios.

## Módulos importados

Fuente: `api/src/modules/app.module.ts:1-46`.

| Módulo | Responsabilidad observable |
|---|---|
| `auth` | login, refresh, logout, perfil, contexto y recuperación de contraseña |
| `users` | usuarios, perfil y contraseñas |
| `tenants` | tenant, configuración y detalles de empresa |
| `parameters` | parámetros y configuración tenant |
| `permissions` | consulta de permisos de menú |
| `branches` | sucursales y estado |
| `locations` | países, departamentos y municipios |
| `roles` | roles por tenant |
| `menu` | menú dinámico y administración de permisos |
| `inventory` | catálogo, clientes, proveedores, compras, pedidos, ventas, lotes y movimientos |
| `terminals` | terminales operativas |
| `pos-user-sessions` | contexto POS por usuario, sucursal y terminal |
| `finance` | caja, pagos, métodos, instituciones y movimientos |
| `system` | versión del sistema |
| `electronic-invoicing` | datos fiscales y clientes/proveedores fiscales dentro de API |
| `integration-outbox` | eventos de integración hacia facturación |
| `pricing` | preview de precios y promociones |
| `pos-terminals` | terminales POS y configuración de periféricos |
| `deliveries` | domicilios, conductores y estados de despacho |
| `operational-sales` | listados, detalle y acciones operativas de ventas |

## Contrato HTTP

El prefijo efectivo de la API es `/api` (`api/src/main.ts:97`). Los controladores se agrupan así:

| Grupo | Controladores y rutas principales |
|---|---|
| Auth | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/menu`, `/auth/context` |
| Administración | `/users`, `/roles`, `/tenants`, `/branches`, `/terminals`, `/permissions`, `/admin/menu-items` |
| POS | `/pos/session`, `/pos-terminals`, `/sales`, `/orders`, `/operations/sales` |
| Inventario | `/products`, `/inventory/products`, `/inventory/lots`, `/inventory/locations`, `/stock-adjustments`, `/units`, `/taxes` |
| Terceros | `/customers`, `/suppliers`, `/electronic-invoicing/customers`, `/electronic-invoicing/suppliers` |
| Compras y domicilios | `/purchases`, `/deliveries`, `/delivery-drivers` |
| Finanzas | `/finance/cash-registers`, `/finance/cash-sessions`, `/finance/cash-movements`, `/finance/payments`, `/finance/payment-methods` |
| Precios | `/pricing`, `/pricing/promotions` |
| Operación | `/operations/dashboard`, `/operations/sales` |

El catálogo completo de métodos está en [docs/api/endpoints.md](endpoints.md). Esta ficha resume contratos sin inventar payloads no expuestos por DTO o controlador.

## Exposición y autenticación

### Rutas públicas demostradas

En `auth.controller.ts:46-86` están sin `@UseGuards`:

- `POST /api/auth/login`
- `POST /api/auth/login/replace-session`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`

`logout` revoca el refresh token mediante `AuthService` y limpia cookie `access_token`, pero su método no declara guard.

### Rutas autenticadas

`GET /api/auth/me` y `GET /api/auth/menu` extraen Bearer y delegan validación al servicio (`auth.controller.ts:88-108`).
Perfil, contraseña y contexto usan `JwtAuthGuard` explícito (`auth.controller.ts:110-142`).

Los controladores de negocio suelen declarar `JwtAuthGuard`, `RolesGuard` y `PermissionsGuard` a nivel de clase. No se encontró `APP_GUARD` global en `api/src/`; la cobertura depende del controlador y método.

No se identificó un namespace HTTP interno genérico dentro de la API principal. Las llamadas internas de facturación deben considerarse un contrato configurado, no automáticamente una ruta pública sin autenticación.

## Guard de JWT y contexto operativo

`JwtAuthGuard` (`api/src/common/guards/jwt-auth.guard.ts:48-200`):

1. Lee `Authorization: Bearer`.
2. Verifica firma con `resolveJwtSecret()`.
3. Exige `sub`, `tenant_id` y `session_id`.
4. Consulta `auth_sessions` con usuario y tenant.
5. Rechaza sesiones inactivas.
6. Coloca `id`, `roles`, `tenantId` y `sessionId` en `request.user`.
7. Resuelve `x-pos-session-id` si existe.
8. Valida que la sesión POS coincida con usuario, tenant, sucursal, terminal y estado activo.
9. Si el endpoint requiere caja, busca una `cash_session` abierta compatible.

Los decoradores son:

- `@Roles(...)`: `api/src/common/decorators/roles.decorator.ts`.
- `@RequirePermission(...)`: `api/src/common/decorators/require-permission.decorator.ts`.
- `@RequirePosSession()`: `api/src/common/decorators/require-pos-session.decorator.ts`.
- `@RequireOpenCashSession()`: `api/src/common/decorators/require-open-cash-session.decorator.ts`.

## Autorización y tenant

`AccessControlService` (`api/src/common/services/access-control.service.ts`) consulta `role_menu_permissions`, `menu_items` y `user_roles` usando `tenant_id`.

Reglas observadas:

- `SUPER_ADMIN` puede resolver tenant solicitado.
- Otros roles usan el tenant del actor.
- `SUPER_ADMIN` y `SUPER_USER` pueden resolver sucursales activas del tenant.
- Otros usuarios se limitan por `persona_tenant_branches`.
- Branches, terminales y contexto POS se validan con tenant coincidente.

Esto demuestra controles de aislamiento en los componentes inspeccionados. No demuestra revisión exhaustiva de todas las consultas de todos los módulos.

## DTO y validación

Hay DTO con `class-validator` en módulos de auth, usuarios, finanzas, domicilios, terminales y otros dominios.

No se encontró `ValidationPipe` global en `api/src/main.ts`.

Se observaron pipes locales, por ejemplo:

- `deliveries.controller.ts:50-58`: `transform`, `whitelist`, `forbidNonWhitelisted`.
- `finance-validation.pipe.ts:1-7`: la misma política para finanzas.

Conclusión: la validación existe, pero su cobertura es por controlador/módulo, no una política global demostrada.

## Transacciones

`DatabaseService` (`api/src/common/db/database.service.ts:1-49`) administra un `pg.Pool`, entrega clientes y ejecuta SQL parametrizado.

Hay transacciones explícitas con `BEGIN`, `COMMIT` y `ROLLBACK` en:

- `auth.service.ts`
- `users.service.ts`
- `branches.service.ts`
- `terminals.service.ts`
- `pos-user-sessions.service.ts`
- servicios de finanzas y pagos
- `product.service.ts`
- `menu-admin.service.ts`
- `terminal-devices.service.ts`

Hay también bloqueos `FOR UPDATE` en pagos (`api/src/modules/finance/payments/payments.repository.ts:104-108`).

No existe una unidad transaccional global para todos los servicios. La atomicidad depende del servicio y repositorio concreto.

## Evidencia y límites

| Afirmación | Evidencia | Estado |
|---|---|---|
| API modular NestJS | `api/src/modules/app.module.ts:1-46` | Confirmado |
| Prefijo `/api` | `api/src/main.ts:97` | Confirmado |
| JWT + sesión activa | `jwt-auth.guard.ts:58-100` | Confirmado |
| Tenant y branch scope | `access-control.service.ts` y guard | Confirmado en componentes inspeccionados |
| Validación global | ausencia de `ValidationPipe` en `main.ts` | No evidenciada |
| Transacciones locales | servicios con `BEGIN/COMMIT/ROLLBACK` | Confirmado |
| Contrato de producción | sin acceso a infraestructura | No verificado |
| Cobertura exhaustiva de tenant | no se revisó cada query | Pendiente |
