# Evidencia backend inventory lots - Fase 3.4

## Fecha y ambiente

- Fecha/hora: 2026-05-28 01:12:35 -05:00
- Ambiente: local/dev
- Alcance: backend `api/`

## Archivos creados/modificados

| Archivo | Cambio |
| --- | --- |
| `api/src/modules/inventory/entities/inventory-lot.entity.ts` | Entity/model de lote de inventario. |
| `api/src/modules/inventory/repositories/inventory-lot.repository.ts` | Repository SQL parametrizado para `inventory_lots`. |
| `api/src/modules/inventory/services/inventory-lot.service.ts` | Reglas de negocio, validaciones multi-tenant y estados de lote. |
| `api/src/modules/inventory/controllers/inventory-lot.controller.ts` | Endpoints REST bajo `/api/inventory/lots`. |
| `api/src/modules/inventory/inventory.module.ts` | Registro de controller, service y repository. |
| `api/src/modules/inventory/services/inventory-lot.service.spec.ts` | Tests unitarios de reglas de lotes. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Fase 3.4 marcada como completada. |
| `docs/evidencia-backend-inventory-lots-fase-3-4.md` | Evidencia de esta fase. |

## Endpoints agregados

| Metodo | Ruta | Proposito |
| --- | --- | --- |
| `GET` | `/api/inventory/lots` | Listar lotes por tenant y filtros. |
| `GET` | `/api/inventory/lots/:lotId` | Obtener un lote. |
| `POST` | `/api/inventory/lots` | Crear lote basico. |
| `PUT` | `/api/inventory/lots/:lotId` | Actualizar datos editables del lote. |
| `PATCH` | `/api/inventory/lots/:lotId/block` | Cambiar lote a `BLOCKED`. |
| `PATCH` | `/api/inventory/lots/:lotId/cancel` | Cambiar lote a `CANCELLED`. |

## Reglas implementadas

- `tenant_id` se toma del contexto actual del request.
- `branch_id` debe pertenecer al tenant.
- `product_id` debe pertenecer al tenant.
- `supplier_id`, `purchase_id` y `purchase_item_id` son opcionales, pero si vienen deben pertenecer al tenant.
- Roles no globales quedan limitados a sucursales accesibles por `FinanceAccessRepository` o `context.branchId`.
- `lotCode` es requerido, se limpia con `trim()` y se guarda en uppercase.
- `unitCost` default es `0` y no puede ser negativo.
- `receivedAt` default es `now()`.
- `status` default es `ACTIVE`.
- `status` permitido: `ACTIVE`, `EXPIRED`, `BLOCKED`, `CONSUMED`, `CANCELLED`.
- `isLegacy` default es `false`.
- `lotCode` no puede repetirse dentro de `tenant_id + branch_id + product_id`.
- El mismo `lotCode` puede existir en otra sucursal o para otro producto.
- `expirationDate` es obligatorio si `products.requires_expiration = true`.
- `expirationDate` no puede ser anterior a `2000-01-01`.
- Un lote `ACTIVE` no puede crearse o quedar con fecha vencida.
- `branchId` y `productId` no son editables en esta fase.
- `cancel` rechaza lotes `CONSUMED`.
- No se borra fisicamente ningun lote.

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `cd api && npx tsx --test src/modules/inventory/services/inventory-lot.service.spec.ts` | Paso. `17/17` tests. |
| `cd api && npm run build` | Paso. |
| `cd api && npx tsx --test src/modules/inventory/services/product.service.spec.ts src/modules/inventory/services/product-barcode.service.spec.ts src/modules/inventory/services/inventory-location.service.spec.ts src/modules/inventory/services/inventory-lot.service.spec.ts` | Paso. `47/47` tests. |
| `openspec validate fortalecer-productos-inventario --type change --strict --json` | Paso. |
| `git diff --check` | Paso. Solo advertencias CRLF existentes en archivos TypeScript ya modificados. |

## Cobertura de tests

- Crear lote `ACTIVE` basico.
- Normalizar `lotCode` con trim/uppercase.
- Rechazar sucursal de otro tenant.
- Rechazar producto de otro tenant.
- Rechazar `lotCode` vacio.
- Rechazar `unitCost` negativo.
- Rechazar `status` invalido.
- Rechazar `lotCode` duplicado en el mismo tenant, sucursal y producto.
- Permitir mismo `lotCode` en otro producto o sucursal.
- Exigir `expirationDate` si el producto requiere vencimiento.
- No exigir `expirationDate` si el producto no requiere vencimiento.
- Rechazar `expirationDate` anterior a `2000-01-01`.
- Rechazar lote `ACTIVE` vencido.
- Bloquear lote.
- Cancelar lote.
- Rechazar cancelacion de lote `CONSUMED`.
- No operar lote de otro tenant.

## Compatibilidad

- No se modifico `web/`.
- No se modifico `backend-reporteria/`.
- No se modificaron endpoints de POS, compras, pedidos ni ventas.
- No se tocaron `stock_movements`, `stock_movement_lots` ni `inventory_lot_balances`.
- No se implemento FEFO.
- No se integraron lotes con recepcion de compras.
- No se tocaron migraciones, seeds ni funciones SQL criticas.

## Riesgos vivos

- RIESGO: No existe prueba HTTP e2e para los endpoints nuevos.
- RIESGO: `lotCode` puede cambiar porque todavia no hay saldos ni movimientos loteados; queda `TODO` para bloquearlo cuando existan relaciones.
- RIESGO: RBAC usa `INVENTORY` para lotes. Un menu dedicado queda para decision futura.
- RIESGO: Validacion de `purchase_item_id` confirma tenant por join con `purchases`, pero no exige que coincida con `purchase_id` o `product_id`; se debe endurecer al integrar compras.

## Proximos pasos

- Fase 3.5: definir si sigue historial de precios, saldos por lote o integracion controlada con compras.
- Agregar pruebas e2e cuando exista suite HTTP para inventory.
- Mantener lotes como catalogo basico hasta implementar `inventory_lot_balances` y `stock_movement_lots`.
