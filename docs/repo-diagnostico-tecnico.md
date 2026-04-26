# Diagnóstico técnico del repositorio

## 1. Stack backend
- `NestJS 10`
- `Node.js + TypeScript`
- `@nestjs/platform-express`
- ejecución dev con `tsx`

## 2. Stack frontend
- `Next.js 14` con `App Router`
- `React 18`
- `TypeScript`
- `Redux Toolkit + React Redux`
- `Tailwind CSS 4`
- `lucide-react`

## 3. ORM o capa de persistencia
- No usa ORM.
- La persistencia está implementada con `pg` (`Pool` de PostgreSQL).
- El acceso a datos se hace con SQL manual, queries parametrizadas y transacciones explícitas.
- El esquema y cambios de base están en `api/database/*.sql`.

## 4. Estructura de carpetas

### Backend
- `api/src/common`: base de datos, guards, decorators, servicios comunes.
- `api/src/modules`: módulos funcionales como `auth`, `users`, `roles`, `permissions`, `branches`, `tenants`, `locations`, `menu`.
- `api/database`: schema inicial, alter scripts, seeds y dumps.

### Frontend
- `web/app`: rutas y layouts del App Router.
- `web/domains`: lógica por dominio.
- `web/store`: slices y configuración Redux.
- `web/components`: componentes UI y design system.
- `web/lib`, `web/hooks`, `web/providers`, `web/types`: utilidades transversales.

## 5. Sistema de autenticación y autorización
- Autenticación con `JWT` de acceso + `refresh token`.
- Validación de sesión activa contra tabla `auth_sessions`.
- Autorización por roles con `@Roles(...)` y `RolesGuard`.
- Autorización fina por permisos con `@RequirePermission(...)` y `PermissionsGuard`.
- En frontend, el `accessToken` vive en Redux y el `refreshToken` en memoria/sessionStorage con refresh automático.

## 6. Convenciones actuales
- Módulos Nest por dominio.
- Archivos típicos: `*.module.ts`, `*.controller.ts`, `*.service.ts`, y en algunos módulos `*.repository.ts`.
- DTOs en carpeta `dto/` como tipos TypeScript.
- No hay entidades ORM decoradas; la forma de datos se modela con DTOs y tipos internos.
- Controladores delgados: reciben request, arman actor y delegan al service.
- Services concentran reglas de negocio, validaciones, tenant y transacciones.
- Rutas REST consistentes con recursos en plural.

## 7. Rama recomendada para iniciar desarrollo
- Rama recomendada: `develop`
- Motivo: es la rama activa local y sigue `origin/develop`; `main` parece reservarse como línea estable.
