# Guia para desarrolladores

## Convenciones observadas

- Frontend en App Router bajo `web/app`
- Dominios HTTP compartidos en `web/domains`
- UI de modulo en `web/modules`
- Estado global en Redux
- Backend por modulos NestJS
- SQL manual en repositorios/servicios

## Naming

- tablas en snake_case
- DTOs y services en TypeScript
- permisos canonicos por `MENU_KEYS`

## Como crear un modulo backend

1. Crear carpeta en `api/src/modules/<modulo>`.
2. Definir `*.module.ts`, controller y service.
3. Agregar imports/export si aplica.
4. Registrar en `AppModule`.
5. Si requiere auth, usar `JwtAuthGuard`.
6. Si requiere RBAC, agregar `@Roles` y opcionalmente `@RequirePermission`.

## Como crear un CRUD

1. Definir controller con rutas `/api`.
2. Crear DTOs o tipos de entrada.
3. Implementar service/repository SQL.
4. Validar tenant y branch scope.
5. Agregar manejo de errores y, si aplica, auditoria.

## Como registrar permisos y menu

1. Crear o ajustar `menu_items`.
2. Asociar roles en `role_menu_permissions`.
3. Si la ruta debe protegerse en backend, agregar `@RequirePermission`.
4. Si la ruta existe en frontend, registrar patron en `web/lib/route-permissions.ts` si corresponde.

## Como agregar migraciones

Actualmente el proyecto no tiene migrador automatico. La practica real es:

1. crear script SQL nuevo en `api/database/`
2. ejecutarlo manualmente en PostgreSQL
3. mantener seeds y alteraciones idempotentes con `IF NOT EXISTS` cuando sea posible
