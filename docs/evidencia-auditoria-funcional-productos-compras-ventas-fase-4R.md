# Evidencia Fase 4.R - Auditoria funcional producto-compras-ventas

Fecha: 2026-05-28  
Estado: PARCIAL / BLOQUEADA PARA CIERRE END-TO-END

## Resumen ejecutivo

Se detuvieron nuevas funcionalidades y se audito el cierre funcional entre frontend, backend y base para producto enriquecido, compras con lotes, ajustes con lotes y ventas FEFO.

Se encontraron y corrigieron dos vacios reales de integracion:

1. `GET /api/inventory/products` no devolvia campos de producto enriquecido.
2. `GET /api/purchases/:id` no devolvia flags operativos por item de compra.

Las pruebas unitarias backend y compilacion API pasan. TypeScript frontend pasa. El build directo de `web/` quedo bloqueado por `EPERM` sobre `web/.next/trace`, no por error TypeScript.

La fase no queda marcada como completada porque no se ejecuto aun la validacion UI/API/DB real de punta a punta exigida por 4.R.

## Bugs encontrados

### Bug 1: listado de productos no traia campos enriquecidos

Ruta afectada:
- `GET /api/inventory/products`

Causa:
- `InventoryRepository.listInventoryProducts` no seleccionaba:
  - `is_perishable`
  - `requires_lot`
  - `requires_expiration`
  - `operational_status`
  - `rotation_class`
  - `min_stock`
  - `max_stock`
- `InventoryService.mapInventoryRow` tampoco exponia esos campos en camelCase.

Impacto:
- `web/app/[tenant]/inventory/products/page.tsx` usa `listProducts`, que consume `/inventory/products`.
- El listado no podia mostrar badges confiables.
- Al editar desde una fila incompleta, `ProductForm` podia inicializar defaults y pisar configuracion operativa existente.

Correccion:
- `api/src/modules/inventory/repositories/inventory.repository.ts`
- `api/src/modules/inventory/services/inventory.service.ts`
- `api/src/modules/inventory/services/inventory.service.spec.ts`

### Bug 2: detalle de compra no traia flags operativos del producto

Ruta afectada:
- `GET /api/purchases/:id`

Causa:
- La query de items solo devolvia `product_name`.
- No devolvia `product_sku`, `is_perishable`, `requires_lot`, `requires_expiration`.

Impacto:
- `PurchaseReceiveForm` dependia de un lookup adicional a productos.
- Si el lookup fallaba, la recepcion podia no saber que un producto requiere lote/vencimiento.

Correccion:
- `api/src/modules/inventory/services/purchase.service.ts`
- `api/src/modules/inventory/services/purchase.service.spec.ts`

## Correcciones realizadas

- Se extendio `InventoryProductRow` con campos enriquecidos.
- Se agregaron columnas enriquecidas al SELECT de `InventoryRepository.listInventoryProducts`.
- Se mapearon los campos a camelCase en `InventoryService.mapInventoryRow`.
- Se agrego test unitario para validar que `/inventory/products` conserva los campos enriquecidos.
- Se extendio `PurchaseItemRow` con `product_sku`, `is_perishable`, `requires_lot`, `requires_expiration`.
- Se agregaron esos campos al SELECT de detalle de compra.
- Se mapearon esos flags en `mapPurchaseWithItems`.
- Se agrego test unitario para validar que detalle de compra expone flags operativos.

## Flujos probados

### Producto enriquecido

Probado por unidad:
- Creacion con defaults compatibles.
- Validacion de perecedero sin lote/vencimiento.
- Validacion de vencimiento sin lote.
- Validacion de stock minimo/maximo.
- Mapping enriquecido de `/inventory/products`.

Pendiente end-to-end:
- Crear producto desde UI y confirmar INSERT real en DB.
- Editar producto desde UI y confirmar UPDATE real en DB.
- Recargar listado y verificar badges contra datos persistidos.

### Compras con lotes

Probado por unidad:
- Compra no loteada recibe como antes.
- Producto no loteado rechaza datos de lote.
- Producto loteado exige `lotCode`.
- Producto con vencimiento exige `expirationDate`.
- Recepcion loteada crea/reutiliza lote.
- Incrementa `inventory_lot_balances`.
- Crea `stock_movement_lots`.
- Rechaza ubicacion invalida.
- Detalle de compra devuelve flags operativos.

Pendiente end-to-end:
- Recibir compra desde UI con producto loteado y validar DB.
- Confirmar que `/inventory/lots` muestra saldo creado.

### Ajustes con lotes

Probado por unidad:
- Ajuste no loteado mantiene flujo.
- Ajuste loteado `IN` crea/reutiliza lote.
- Ajuste loteado `OUT` exige lote existente.
- Rechaza saldo insuficiente.
- Decrementa balance y crea `stock_movement_lots`.
- Permite salida de lote vencido como correccion fisica.

Pendiente end-to-end:
- Ejecutar ajuste desde UI y validar DB/reconciliacion.

### Ventas FEFO

Probado por unidad:
- `INVENTORY_SALE_V2_ENABLED` apagado usa v1.
- Flag raro usa v1.
- Env true + tenant/sucursal no habilitado usa v1.
- Env true + tenant/sucursal habilitado usa v2.
- Payload y respuesta no cambian en repositorio.

Pendiente end-to-end 4.R:
- Venta real local/API/UI con v2 habilitado.
- Validar descuento FEFO en balances.

### Cancelacion loteada

Probado por unidad:
- Venta no loteada cancela sin mutar lotes.
- Venta loteada devuelve al lote original.
- Crea `stock_movement_lots` de reverso.
- Permite reverso a lote `BLOCKED`.
- Rechaza reverso automatico a lote `CANCELLED`.
- No duplica reverso si ya esta cancelada.

Pendiente end-to-end 4.R:
- Cancelar venta loteada real y validar DB/reconciliacion.

### Reconciliacion

No se re-ejecuto contra DB real en esta fase.

Pendiente:
- Ejecutar summary/discrepancies sobre datos creados en prueba 4.R.
- Confirmar `criticalCount=0` y `highCount=0`.

## Comandos ejecutados

```powershell
cd api
npx tsx --test src/modules/inventory/services/inventory.service.spec.ts src/modules/inventory/services/product.service.spec.ts src/modules/inventory/services/purchase.service.spec.ts src/modules/inventory/services/stock-adjustment.service.spec.ts src/modules/inventory/services/sale.service.spec.ts src/modules/inventory/repositories/sale.repository.spec.ts
```

Resultado: OK, 75 tests pass.

```powershell
cd api
npx tsx --test src/modules/inventory/services/inventory.service.spec.ts src/modules/inventory/services/purchase.service.spec.ts
```

Resultado: OK, 36 tests pass.

```powershell
cd api
npm run build
```

Resultado: OK.

```powershell
cd web
npx tsc --noEmit --pretty false
```

Resultado: OK.

```powershell
cd web
npm run build
```

Resultado: BLOQUEADO por entorno local:

```text
EPERM: operation not permitted, open 'D:\Profe\manus-tienda\web\.next\trace'
```

Intento de limpieza segura de `web/.next` tambien fue bloqueado por permisos sobre `web/.next/trace`.

## Queries de validacion pendientes

No se ejecutaron contra DB en esta fase.

Queries sugeridas para cierre end-to-end:

```sql
SELECT
  id,
  name,
  sku,
  is_perishable,
  requires_lot,
  requires_expiration,
  operational_status,
  rotation_class,
  min_stock,
  max_stock
FROM products
WHERE id = '<PRODUCT_ID>';
```

```sql
SELECT *
FROM inventory_lots
WHERE tenant_id = '<TENANT_ID>'
  AND product_id = '<PRODUCT_ID>';
```

```sql
SELECT *
FROM inventory_lot_balances
WHERE tenant_id = '<TENANT_ID>'
  AND product_id = '<PRODUCT_ID>';
```

```sql
SELECT sml.*
FROM stock_movement_lots sml
JOIN stock_movements sm ON sm.id = sml.stock_movement_id
WHERE sml.tenant_id = '<TENANT_ID>'
  AND sml.product_id = '<PRODUCT_ID>';
```

## Riesgos vivos

- Fase 4.R no esta cerrada funcionalmente hasta probar UI/API/DB real.
- `web/.next/trace` esta bloqueado por permisos/proceso local; build directo no pudo terminar.
- Hay muchas fases previas en worktree sin commit; no se revirtio nada.
- Productos legacy `requires_lot=true` sin balances seguiran fallando correctamente en ventas v2.
- La validacion de UI de producto enriquecido necesita prueba real de persistencia.
- La recepcion de compra ahora tiene fallback mejorado, pero falta prueba real con API y DB.
- Reconciliacion debe ejecutarse sobre datos de prueba de esta auditoria.

## Pendientes reales antes de Fase 5

- Resolver bloqueo local de `.next/trace` o ejecutar build en copia limpia.
- Levantar API/web local con usuario de prueba.
- Crear producto enriquecido desde UI y validar DB.
- Editar producto enriquecido desde UI y validar DB.
- Recibir compra no loteada y loteada desde UI.
- Ejecutar ajuste loteado `IN` y `OUT` desde UI.
- Ejecutar venta FEFO v2 y cancelacion loteada.
- Ejecutar reconciliacion sobre datos de prueba.
- Actualizar esta evidencia con IDs sanitizados y resultados.
- Solo entonces marcar Fase 4.R como completada.
