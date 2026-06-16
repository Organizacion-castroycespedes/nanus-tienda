## Why

El flujo actual permite entrar a POS o al selector de contexto de forma manual sin garantizar tenant, sucursal, terminal y sesion de caja validos. Ademas, la matriz real de permisos no coincide con la operacion esperada para `USER`, `ADMIN` y `SUPER_USER`, causando `403` en pedidos, clientes, caja, roles e inventario.

## What Changes

- Resolver el contexto operativo despues del login segun rol: tenant, sucursal, terminal y sesion de caja.
- Bloquear `/pos` sin contexto operativo valido y hacer que `/pos/select-context` sea un paso controlado.
- Validar en backend que `branchId`, `terminalId` y `x-pos-session-id` pertenezcan al usuario o a su alcance permitido.
- Alinear permisos funcionales para `USER`, `ADMIN` y `SUPER_USER` en caja, pedidos, clientes, roles asignables e inventario.
- Ajustar menu, rutas y acciones frontend para reflejar la matriz real por perfil.
- Crear SQL idempotente solo si faltan permisos configurados en base de datos.
- Agregar pruebas backend y evidencia QA para los flujos criticos.

## Capabilities

### New Capabilities

- `operational-context`: Resolucion y persistencia validada del contexto operativo por rol desde el login.
- `profile-permissions`: Matriz funcional por perfil para pedidos, clientes, caja, roles asignables, inventario y configuracion.
- `pos-terminal-context`: Seleccion y validacion de sucursal, terminal y sesion POS/caja para operar POS y modulos dependientes.

### Modified Capabilities

- Ninguna. La spec archivada `access-role-audit` documenta el modelo oficial; este cambio introduce capacidades operativas ejecutables para aplicar ese modelo.

## Impact

- Frontend: `web/app`, `web/modules/pos`, `web/modules/auth`, `web/modules/session`, `web/components`, `web/lib`, `web/hooks`, `web/middleware.ts`, `web/lib/route-permissions.ts`.
- Backend: `api/src/modules/auth`, `api/src/modules/users`, `api/src/modules/branches`, `api/src/modules/terminals`, `api/src/modules/peripherals`, `api/src/modules/finance/cash-sessions`, `api/src/modules/pos`, `api/src/modules/orders`, `api/src/modules/inventory`, `api/src/modules/electronic-invoicing`, `api/src/modules/customers`, `api/src/modules/roles`.
- Database/scripts: `scripts/database`, tablas reales de roles, menu, permisos, sucursales, terminales, sesiones POS/caja y asignaciones de usuario a sucursal.
- Docs/evidencia: `docs/evidencia-mejora-contexto-operativo-perfiles.md` y `docs/database-runbook.md` si se agrega SQL.
