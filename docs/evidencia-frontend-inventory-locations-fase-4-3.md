# Evidencia frontend inventory locations - Fase 4.3

## Resumen

Se agrego gestion web para ubicaciones fisicas de inventario bajo la ruta:

- `web/app/[tenant]/inventory/locations/page.tsx`

La fase solo modifica frontend, documentacion y OpenSpec. No se modifico `api/`, `backend-reporteria/`, SQL, POS, compras, pedidos ni reportes.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `web/app/[tenant]/inventory/locations/page.tsx` | Nueva pantalla de catalogo para ubicaciones fisicas. |
| `web/modules/inventory/components/InventoryLocationForm.tsx` | Nuevo formulario modal para crear y editar ubicaciones. |
| `web/modules/inventory/services/inventory-location.service.ts` | Nuevo cliente API y tipos frontend. |
| `web/lib/route-permissions.ts` | Se agrego permiso de lectura para `/[tenant]/inventory/locations`. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Se marco Fase 4.3 como completada. |
| `docs/evidencia-frontend-inventory-locations-fase-4-3.md` | Evidencia de esta fase. |

## Ruta creada

- `/[tenant]/inventory/locations`

## Endpoints consumidos

| Metodo | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/api/inventory/locations` | Listar ubicaciones con filtros. |
| `GET` | `/api/inventory/locations/:locationId` | Cliente disponible para detalle futuro. |
| `POST` | `/api/inventory/locations` | Crear ubicacion. |
| `PUT` | `/api/inventory/locations/:locationId` | Editar ubicacion. |
| `PATCH` | `/api/inventory/locations/:locationId/deactivate` | Inactivar ubicacion. |

## Componentes agregados

- `InventoryLocationForm`: formulario reusable para crear/editar.
- Catalogo en `locations/page.tsx` con tabla, filtros, modal y confirmacion.
- Confirmacion con `NoticeDialog`.
- Modal con `Modal`.
- Controles existentes: `Button`, `Input`, `Select`, `Toast`.

## Tipos frontend

- `InventoryLocationResponse`
- `InventoryLocationType`
- `ListInventoryLocationsParams`
- `CreateInventoryLocationPayload`
- `UpdateInventoryLocationPayload`

Tipos soportados:

- `WAREHOUSE`
- `DISPLAY`
- `SHELF`
- `COLD_ROOM`
- `COUNTER`
- `OTHER`

## Reglas UX implementadas

- `branchId` requerido en creacion.
- `code` requerido.
- `code` se normaliza a uppercase en el formulario.
- `name` requerido.
- `type` debe estar en la lista permitida.
- `description` es opcional.
- `branchId` no se puede editar al actualizar una ubicacion.
- Inactivar usa confirmacion y no borra fisicamente.
- Errores del backend se muestran como mensaje visible, incluyendo duplicados de `code`.
- Badges visibles para tipo y estado activo/inactivo.

## Compatibilidad

- La ubicacion no queda obligatoria para productos.
- La ubicacion no queda obligatoria para compras.
- La ubicacion no queda obligatoria para ventas.
- No se modifica POS.
- No se modifica dashboard de inventario.
- No se modifica flujo de stock actual.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `cd web && npx tsc --noEmit --pretty false` | OK |
| Build en copia temporal completa de `web/` con `npm run build` | OK |
| `cd web && npm run lint` con `CI=1` | Bloqueado por setup interactivo de Next ESLint. |
| `npx --yes @fission-ai/openspec validate fortalecer-productos-inventario --type change --strict --json` | OK |

## Resultado build

Build de Next.js aprobado en copia temporal. La ruta nueva aparece en la salida:

- `/[tenant]/inventory/locations`

La copia temporal fue eliminada despues del build.

## Validacion manual

Pendiente con API levantada:

- Abrir `/[tenant]/inventory/locations`.
- Listar ubicaciones por sucursal.
- Crear ubicacion con codigo nuevo.
- Editar nombre, tipo y descripcion.
- Intentar codigo duplicado y validar error claro.
- Inactivar ubicacion y confirmar que desaparece del filtro de activas.

## Riesgos vivos

- `npm run lint` sigue siendo interactivo porque no hay configuracion ESLint persistente.
- Si el endpoint de sucursales no retorna opciones para el usuario actual, la pantalla usa fallback de `currentBranch` como "Sucursal actual".
- La UI no agrega aun acceso desde menu backend si el menu dinamico no tiene entrada para locations.

## Proximos pasos

- Fase futura: administrar lotes desde web.
- Fase futura: usar ubicacion en recepcion de compras.
- Fase futura: usar ubicacion en ajustes de inventario.
- Fase futura: reporteria por ubicacion.
