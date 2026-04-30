# Backend overview

## Modulos NestJS

- `auth`
- `users`
- `tenants`
- `permissions`
- `branches`
- `locations`
- `roles`
- `menu`
- `inventory`
- `terminals`
- `pos-user-sessions`

## Shared layer

- `DatabaseModule`
- `CommonServicesModule`
- `AccessControlService`
- `AuditService`
- `CacheService`
- guards y decorators comunes

## Estilo de implementacion

- Controllers para capa HTTP
- Services con reglas de negocio
- Repositories SQL en algunos modulos
- Queries SQL directas en services de compras/pedidos
