# Evidencia backend inventory locations - Fase 3.3

## Fecha y ambiente

- Fecha/hora: 2026-05-28 00:59:11 -05:00
- Ambiente: local/dev
- Alcance: backend `api/`

## Archivos creados/modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/entities/inventory-location.entity.ts` | Entity/model de ubicacion fisica. |
| `api/src/modules/inventory/repositories/inventory-location.repository.ts` | Repository SQL parametrizado para `inventory_locations`. |
| `api/src/modules/inventory/services/inventory-location.service.ts` | Reglas de negocio y validacion multi-tenant/sucursal. |
| `api/src/modules/inventory/controllers/inventory-location.controller.ts` | Endpoints REST bajo `/api/inventory/locations`. |
| `api/src/modules/inventory/inventory.module.ts` | Registro de controller, service y repository. |
| `api/src/modules/inventory/services/inventory-location.service.spec.ts` | Tests unitarios de reglas de ubicaciones. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Fase 3.3 marcada como completada. |
| `docs/evidencia-backend-inventory-locations-fase-3-3.md` | Evidencia de esta fase. |

## Endpoints agregados

| Metodo | Ruta | Proposito |
| --- | --- | --- |
| `GET` | `/api/inventory/locations` | Listar ubicaciones por tenant y sucursal. |
| `GET` | `/api/inventory/locations/:locationId` | Obtener una ubicacion. |
| `POST` | `/api/inventory/locations` | Crear ubicacion. |
| `PUT` | `/api/inventory/locations/:locationId` | Actualizar datos editables. |
| `PATCH` | `/api/inventory/locations/:locationId/deactivate` | Inactivar sin borrado fisico. |

## Reglas implementadas

- `tenant_id` se toma del contexto actual del request.
- `branch_id` debe pertenecer al tenant.
- Roles `SUPER_ADMIN` y `SUPER_USER` pueden consultar multiples sucursales del tenant.
- Roles no globales quedan limitados a sucursales accesibles por `FinanceAccessRepository` o `context.branchId`.
- `code` es requerido, se limpia con `trim()` y se guarda en uppercase.
- `name` es requerido y se limpia con `trim()`.
- `type` default es `OTHER`.
- `type` permitido: `WAREHOUSE`, `DISPLAY`, `SHELF`, `COLD_ROOM`, `COUNTER`, `OTHER`.
- `description` es opcional y se limpia; texto vacio queda `null`.
- `code` no puede repetirse dentro de `tenant_id + branch_id`.
- El mismo `code` puede existir en otra sucursal del mismo tenant.
- `branch_id` no se puede mover en update.
- Inactivar ubicacion usa `is_active = false`; no hay borrado fisico.
- La ubicacion sigue siendo opcional. No se conecto a productos, compras, ventas, lotes ni stock.

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `cd api && npx tsx --test src/modules/inventory/services/inventory-location.service.spec.ts` | Paso. `12/12` tests. |
| `cd api && npm run build` | Paso. |
| `cd api && npx tsx --test src/modules/inventory/services/product.service.spec.ts src/modules/inventory/services/product-barcode.service.spec.ts src/modules/inventory/services/inventory-location.service.spec.ts` | Paso. `30/30` tests. |
| `openspec validate fortalecer-productos-inventario --type change --strict --json` | Paso. |
| `git diff --check` | Paso. Solo advertencias CRLF existentes en archivos TypeScript ya modificados. |

## Cobertura de tests

- Crear ubicacion con `type` default `OTHER`.
- Crear ubicacion con `code` trim/uppercase.
- Rechazar sucursal de otro tenant.
- Rechazar `code` vacio.
- Rechazar `name` vacio.
- Rechazar `type` invalido.
- Rechazar `code` duplicado en la misma sucursal.
- Permitir mismo `code` en otra sucursal del mismo tenant.
- Actualizar `name`, `type` y `description`.
- Rechazar mover `branchId` en update.
- Inactivar ubicacion sin borrado fisico.
- No operar ubicacion de otro tenant.

## Compatibilidad

- No se modifico `web/`.
- No se modifico `backend-reporteria/`.
- No se modificaron endpoints de POS, compras, pedidos ni ventas.
- No se tocaron `stock_movements`, `inventory_lot_balances`, lotes, FEFO, alertas ni historial de precios.
- No se tocaron migraciones, seeds ni funciones SQL criticas.

## Riesgos vivos

- RIESGO: No se agrego prueba HTTP e2e; la cobertura actual es unitaria de service.
- RIESGO: El menu/RBAC usa `INVENTORY` para ubicaciones. Si negocio requiere menu dedicado, debe definirse en fase posterior.
- RIESGO: Reactivar ubicaciones queda soportado por `PUT` con `isActive`, pero no hay endpoint dedicado de activacion ni flujo web.

## Proximos pasos

- Fase 3.4: definir siguiente pieza backend aprobada, por ejemplo lotes o historial de precios.
- Mantener ubicacion como dato opcional hasta integrar compras, lotes y saldos por ubicacion.
- Agregar pruebas e2e cuando exista suite HTTP para inventory.
