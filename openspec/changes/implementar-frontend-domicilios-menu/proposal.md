## Why

El backend de Domicilios ya esta integrado y protegido con permisos, pero Manus POS no tiene una pantalla operativa para consultar y mover domicilios. Esta fase agrega el frontend inicial para operar el modulo sin tocar caja, POS, facturacion electronica, SQL ni backend.

## What Changes

- Crear la ruta tenant `/{tenant}/deliveries` con pantalla "Domicilios".
- Agregar dominio frontend de Domicilios con tipos, servicio API y helpers de estado.
- Implementar listado, filtros soportados por backend, detalle operativo, creacion manual basica y acciones por estado.
- Mostrar acciones segun estado real y permiso frontend disponible.
- Agregar entrada de ruta/permisos frontend para `DELIVERIES`.
- Mantener UX consistente con paginas existentes de pedidos, clientes, inventario y finanzas.
- Documentar QA, pendientes y limites: sin caja, sin movimientos financieros, sin facturacion electronica, sin POS y sin SQL.

## Capabilities

### New Capabilities
- `deliveries-frontend`: Frontend operativo inicial para listar, filtrar, detallar, crear y accionar domicilios desde el menu tenant.

### Modified Capabilities

## Impact

- `web/app/[tenant]/deliveries/page.tsx`: nueva ruta tenant.
- `web/modules/deliveries/**`: nuevos tipos, servicio, helpers, componentes y tests enfocados.
- `web/domains/menu/constants.ts` y `web/lib/route-permissions.ts`: clave/ruta frontend para permisos.
- `docs/evidencia-qa-frontend-domicilios-menu.md`: evidencia y pendientes QA.
- Sin cambios backend, SQL, POS, caja, movimientos financieros ni facturacion electronica.
