# Estado y permisos UI

## Auth

`domains/auth/session-manager.ts`:

- hidrata sesion desde refresh token
- rota access token automaticamente
- limpia menu, auth y POS al cerrar sesion

## Menu y permisos

- `menuSlice`: menu cargado y cacheado
- `authSlice.permissions`: permisos efectivos
- `hasPermission()`: verifica acciones o menu keys
- `hasMenuAccess()`: verifica `READ`/`WRITE`

## Inventory scope

`useInventoryScope()`:

- para roles no super, fija tenant y branch desde estado global
- para `SUPER_ADMIN`/`SUPER_USER`, permite filtros amplios

## POS state

`store/pos.ts` persiste:

- `tenantId`
- `branchId`
- `terminalId`
- `posSessionId`

Cambios de tenant o sucursal invalidan la sesion POS local.
