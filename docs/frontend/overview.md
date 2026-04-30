# Frontend overview

## Estructura

- `app/`: rutas Next.js
- `components/`: design system y landing
- `domains/`: APIs, DTOs y logica transversal
- `modules/`: UI por dominio, especialmente POS e inventario
- `store/`: slices Redux globales

## Providers globales

`app/providers.tsx` monta:

- Redux Provider
- `AuthSessionManager`
- persistencia de POS context en `localStorage`
- `InventoryScopeManager`
- `ConfirmProvider`
- branding dinamico aplicado en CSS variables

## Estado global real

- `auth`
- `menu`
- `branding`
- `company`
- `inventoryScope`
- `pos`

## Hallazgos

- El branding del tenant se aplica en runtime desde `tenants.config`.
- El POS persiste contexto de tenant/sucursal/terminal/sesion.
- El layout del tenant mezcla carga de perfil, menu, permisos y company details.
