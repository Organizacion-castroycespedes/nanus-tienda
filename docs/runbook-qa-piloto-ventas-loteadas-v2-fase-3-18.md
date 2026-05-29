# Runbook QA - Piloto ventas loteadas con `inventory_create_sale_v2`

Fase: 3.18

Estado: documento operativo, no ejecutado en QA.

## 1. Resumen ejecutivo

Este runbook define como preparar y validar en QA un piloto controlado de ventas POS loteadas usando `inventory_create_sale_v2`.

Se va a probar:

| Area | Alcance QA |
| --- | --- |
| Venta POS no loteada | Debe seguir funcionando por v1/v2 sin `stock_movement_lots`. |
| Venta POS loteada | Debe descontar lotes por FEFO con `inventory_lot_balances` y `stock_movement_lots`. |
| Cancelacion | Debe devolver saldo al lote original y crear `stock_movement_lots` de reverso. |
| Activacion controlada | Solo tenant/sucursal piloto usa v2. |
| Fallback | Sucursal no habilitada sigue usando v1. |
| Reconciliacion | Debe quedar sin discrepancias `CRITICAL` ni `HIGH`. |

No se va a probar:

| Fuera de alcance | Motivo |
| --- | --- |
| Activacion PRD | Este runbook es solo QA. |
| Cambios de POS UI | La UI no cambia en esta fase. |
| Reportes/PDF con lote visible | Tickets/reportes siguen sin mostrar lote. |
| Pedidos/facturacion loteada | `inventory_invoice_order` no se toca. |
| Migraciones nuevas | Las migraciones ya deben estar aplicadas. |

Alcance:

- Ambiente: QA.
- Tenant: `<TENANT_ID_QA>`.
- Sucursal piloto: `<BRANCH_ID_QA>`.
- Sucursal control v1: `<BRANCH_ID_CONTROL_QA>`.
- `inventory_create_sale` v1 sigue como fallback absoluto.

## 2. Precondiciones tecnicas

Antes de iniciar, confirmar:

| Precondicion | Comando/validacion | Esperado |
| --- | --- | --- |
| Backup QA tomado | Procedimiento de backup QA vigente | Backup completo y restaurable |
| PostgreSQL 16 | `SELECT version();` | Version inicia con `PostgreSQL 16` |
| Migracion lotes aplicada | Verificar archivo/historial `20260601_inventory_products_lots_phase_1.sql` | Aplicada |
| Funcion v2 aplicada | Verificar archivo/historial `20260602_inventory_create_sale_v2.sql` | Aplicada |
| v1 existe | Query `to_regprocedure` abajo | `true` |
| v2 existe | Query `to_regprocedure` abajo | `true` |
| `inventory_invoice_order` existe | Query abajo | `true` |
| API actualizada | Build/deploy contiene cambios hasta Fase 3.17.1 | Confirmado |
| Flag global inicial | `INVENTORY_SALE_V2_ENABLED` | `false` o no definido |

Query de funciones:

```sql
SELECT
  to_regprocedure(
    'public.inventory_create_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)'
  ) IS NOT NULL AS inventory_create_sale_exists,
  to_regprocedure(
    'public.inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)'
  ) IS NOT NULL AS inventory_create_sale_v2_exists,
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'inventory_invoice_order'
  ) AS inventory_invoice_order_exists;
```

SUPUESTO: QA tiene un mecanismo de backup/restore validado fuera de este documento.

## 3. Precondiciones funcionales

Preparar datos QA controlados:

| Dato | Requisito |
| --- | --- |
| Tenant piloto | `<TENANT_ID_QA>` definido y activo. |
| Sucursal piloto | `<BRANCH_ID_QA>` activa. |
| Sucursal control | `<BRANCH_ID_CONTROL_QA>` activa y no incluida en `saleV2Branches`. |
| Usuario QA | Permisos POS, inventario, compras, caja/pagos. |
| Caja/sesion POS | Abierta si el flujo de QA lo exige. |
| Producto no loteado control | `requires_lot=false`, stock disponible. |
| Producto loteado | `is_perishable=true`, `requires_lot=true`, `requires_expiration=true`. |
| Proveedor prueba | Disponible para recepcion de compra. |
| Metodo de pago prueba | Activo y usable en POS. |

RIESGO: productos legacy cambiados a `requires_lot=true` sin balances loteados fallaran en venta v2. Elegir productos piloto con balances coherentes.

## 4. Activacion controlada

### Paso 1: desplegar API con v2 disponible y env false

Desplegar backend `api` en QA con codigo hasta Fase 3.17.1.

Confirmar:

```text
INVENTORY_SALE_V2_ENABLED=false
```

o variable ausente.

### Paso 2: validar que v1 sigue funcionando

Ejecutar una venta no loteada de control en sucursal piloto antes de activar v2.

Esperado:

- Venta creada.
- `stock_movements OUT` creado.
- No hay `stock_movement_lots`.
- Pagos/caja sin error.

### Paso 3: habilitar tenant config

Actualizar `tenants.config` solo para tenant piloto.

NO EJECUTAR SIN REVISION - QA:

```sql
UPDATE tenants
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{inventory}',
  jsonb_build_object(
    'saleV2Enabled',
    TRUE,
    'saleV2Branches',
    jsonb_build_array('<BRANCH_ID_QA>')
  ),
  TRUE
)
WHERE id = '<TENANT_ID_QA>'::uuid;
```

Validar:

```sql
SELECT
  id,
  config -> 'inventory' AS inventory_config
FROM tenants
WHERE id = '<TENANT_ID_QA>'::uuid;
```

Esperado:

```json
{
  "saleV2Enabled": true,
  "saleV2Branches": ["<BRANCH_ID_QA>"]
}
```

### Paso 4: activar flag global solo en QA

Configurar solo en proceso API QA:

```text
INVENTORY_SALE_V2_ENABLED=true
```

No cambiar PRD.

### Paso 5: reiniciar API QA

Reiniciar proceso API QA segun procedimiento del ambiente.

Validar logs:

```text
Using inventory_create_sale_v2 for POS sale creation
```

solo cuando la venta sea de tenant/sucursal piloto.

### Paso 6: validar fallback v1

En sucursal control `<BRANCH_ID_CONTROL_QA>`, ejecutar venta no loteada.

Esperado:

```text
Using inventory_create_sale for POS sale creation
```

## 5. Pruebas QA obligatorias

| Caso | Accion | Resultado esperado |
| --- | --- | --- |
| A. Venta no loteada | Vender producto `requires_lot=false` en sucursal piloto | Venta OK, `stock_movements OUT`, sin `stock_movement_lots`. |
| B. Recepcion compra con lote | Recibir compra de producto loteado con `lotCode`, vencimiento futuro y costo | Crea/reutiliza `inventory_lots`, incrementa `inventory_lot_balances`, crea `stock_movement_lots IN`. |
| C. Venta loteada un lote | Vender cantidad menor o igual a un lote disponible | Descuenta balance del lote, crea `stock_movement_lots OUT`. |
| D. Venta loteada varios lotes FEFO | Vender cantidad que use dos lotes | Consume primero vencimiento mas cercano, luego siguiente. |
| E. Venta mixta | Vender producto loteado y no loteado en una venta | Solo loteado crea links; no loteado queda igual. |
| F. Stock insuficiente loteado | Vender mas de disponible loteado | Falla, rollback total, sin saldos alterados. |
| G. Lote vencido no se vende | Intentar venta con solo lote vencido disponible | Falla, no muta datos. |
| H. Lote `BLOCKED`/`CANCELLED` no se vende | Intentar venta con lote bloqueado/cancelado | Falla, no muta datos. |
| I. Cancelacion venta loteada | Cancelar venta caso C | Crea `stock_movements IN`, `stock_movement_lots IN`, balance vuelve al lote original. |
| J. Cancelacion venta mixta | Cancelar venta caso E | No loteado revierte como antes; loteado vuelve a lote original. |
| K. Sucursal no habilitada usa v1 | Vender en sucursal control | Usa v1, no crea `stock_movement_lots`. |
| L. Reconciliacion | Consultar summary/discrepancies | `critical=0`, `high=0`. |
| M. Ticket/venta contrato | Generar ticket/consulta venta normal | No rompe contrato actual; lote no aparece en ticket en esta fase. |

PREGUNTA ABIERTA: definir nombres concretos de productos/lotes QA antes de ejecutar.

## 6. Queries de validacion

Todas las queries son de lectura salvo la activacion controlada ya marcada.

### Ver tenant config

```sql
SELECT
  id,
  slug,
  config -> 'inventory' AS inventory_config
FROM tenants
WHERE id = '<TENANT_ID_QA>'::uuid;
```

### Ver flags de productos

```sql
SELECT
  id,
  sku,
  name,
  is_perishable,
  requires_lot,
  requires_expiration,
  operational_status
FROM products
WHERE tenant_id = '<TENANT_ID_QA>'::uuid
  AND id IN (
    '<PRODUCT_ID_NO_LOT_QA>'::uuid,
    '<PRODUCT_ID_LOTTED_QA>'::uuid
  );
```

### Ver lotes

```sql
SELECT
  id,
  branch_id,
  product_id,
  lot_code,
  expiration_date,
  received_at,
  unit_cost,
  status
FROM inventory_lots
WHERE tenant_id = '<TENANT_ID_QA>'::uuid
  AND product_id = '<PRODUCT_ID_LOTTED_QA>'::uuid
ORDER BY expiration_date ASC NULLS LAST, received_at ASC, lot_code ASC;
```

### Ver balances loteados

```sql
SELECT
  ilb.id,
  ilb.branch_id,
  ilb.product_id,
  il.lot_code,
  il.expiration_date,
  ilb.location_id,
  ilb.quantity_on_hand,
  ilb.quantity_reserved,
  ilb.quantity_available,
  ilb.last_movement_at
FROM inventory_lot_balances AS ilb
INNER JOIN inventory_lots AS il
  ON il.id = ilb.lot_id
 AND il.tenant_id = ilb.tenant_id
WHERE ilb.tenant_id = '<TENANT_ID_QA>'::uuid
  AND ilb.branch_id = '<BRANCH_ID_QA>'::uuid
  AND ilb.product_id = '<PRODUCT_ID_LOTTED_QA>'::uuid
ORDER BY il.expiration_date ASC NULLS LAST, il.received_at ASC, il.lot_code ASC;
```

### Ver movimientos de stock de una venta

```sql
SELECT
  id,
  product_id,
  type,
  quantity,
  reference_type,
  reference_id,
  branch_id,
  stock_before,
  stock_after,
  created_at
FROM stock_movements
WHERE tenant_id = '<TENANT_ID_QA>'::uuid
  AND reference_type = 'SALE'
  AND reference_id = '<SALE_ID_QA>'::uuid
ORDER BY created_at ASC, id ASC;
```

### Ver vinculos movimiento-lote

```sql
SELECT
  sml.id,
  sm.type,
  sm.reference_id AS sale_id,
  sml.stock_movement_id,
  sml.product_id,
  il.lot_code,
  sml.location_id,
  sml.quantity,
  sml.created_at
FROM stock_movement_lots AS sml
INNER JOIN stock_movements AS sm
  ON sm.id = sml.stock_movement_id
 AND sm.tenant_id = sml.tenant_id
LEFT JOIN inventory_lots AS il
  ON il.id = sml.lot_id
 AND il.tenant_id = sml.tenant_id
WHERE sml.tenant_id = '<TENANT_ID_QA>'::uuid
  AND sm.reference_id = '<SALE_ID_QA>'::uuid
ORDER BY sml.created_at ASC, sml.id ASC;
```

### Ver discrepancias de reconciliacion

Endpoint recomendado:

```http
GET /api/inventory/lot-reconciliation/summary?branchId=<BRANCH_ID_QA>
GET /api/inventory/lot-reconciliation/discrepancies?branchId=<BRANCH_ID_QA>
```

Esperado:

```json
{
  "criticalCount": 0,
  "highCount": 0
}
```

### Ver funciones v1/v2

```sql
SELECT
  to_regprocedure(
    'public.inventory_create_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)'
  ) IS NOT NULL AS inventory_create_sale_exists,
  to_regprocedure(
    'public.inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)'
  ) IS NOT NULL AS inventory_create_sale_v2_exists;
```

## 7. Criterios de exito

El piloto QA se considera aprobado si:

- Pruebas A-M pasan.
- Reconciliacion queda con `criticalCount=0` y `highCount=0`.
- No hay rollback parcial.
- No hay errores POS repetidos.
- No hay saldos negativos.
- `quantity_reserved <= quantity_on_hand`.
- Pagos/caja cierran sin inconsistencia.
- v1 sigue funcionando para sucursal no habilitada.
- Tickets/consulta de venta no rompen contrato actual.

## 8. Criterios de abortar

Abortar piloto si ocurre cualquiera:

- Error en venta loteada.
- Error en cancelacion loteada.
- Reconciliacion muestra `CRITICAL` o `HIGH`.
- Stock negativo.
- `quantity_reserved > quantity_on_hand`.
- Payments/caja quedan inconsistentes.
- POS no puede vender productos no loteados.
- API lanza errores repetitivos con v2.
- Venta en sucursal no habilitada intenta usar v2.

## 9. Plan rollback QA

Ejecutar de menor a mayor impacto.

### Paso 1: desactivar tenant config

NO EJECUTAR SIN REVISION - QA:

```sql
UPDATE tenants
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{inventory,saleV2Enabled}',
  'false'::jsonb,
  TRUE
)
WHERE id = '<TENANT_ID_QA>'::uuid;
```

### Paso 2: quitar branch de allowlist

NO EJECUTAR SIN REVISION - QA:

```sql
UPDATE tenants
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{inventory,saleV2Branches}',
  '[]'::jsonb,
  TRUE
)
WHERE id = '<TENANT_ID_QA>'::uuid;
```

### Paso 3: apagar flag global QA

```text
INVENTORY_SALE_V2_ENABLED=false
```

### Paso 4: reiniciar API QA

Reiniciar proceso API QA segun procedimiento del ambiente.

### Paso 5: validar v1

Ejecutar venta no loteada de control.

Esperado:

- Venta OK.
- `inventory_create_sale` usado.
- No crea `stock_movement_lots` para producto no loteado.

### Paso 6: rollback funcion v2 solo si es necesario

Solo si hay error grave asociado a existencia de v2:

```sql
-- Revisar y ejecutar solo con backup y aprobacion.
-- scripts/database/migrations/20260602_inventory_create_sale_v2_rollback.sql
```

No borrar tablas loteadas salvo decision mayor aprobada.

No ejecutar rollback destructivo sin backup.

## 10. Evidencia esperada

Guardar evidencia sin secretos:

| Evidencia | Detalle |
| --- | --- |
| Logs API | Sin JWT, passwords ni tokens. |
| Comandos ejecutados | Sanitizados con placeholders. |
| IDs de ventas prueba | `<SALE_ID_QA>` por caso. |
| Conteos antes/despues | `sales`, `sale_items`, `stock_movements`, `stock_movement_lots`, balances. |
| Reconciliacion | Summary/discrepancies antes y despues. |
| Rollback | Solo si aplica, registrar paso exacto y resultado. |
| Capturas | POS/ticket sin datos sensibles. |

Plantilla de tabla:

| Caso | Venta/Operacion | Resultado | Evidencia |
| --- | --- | --- | --- |
| A | `<SALE_ID_QA>` | OK/FALLA | Link/log/query |

## 11. Riesgos vivos

- RIESGO: v2 no ha sido probado todavia en QA real.
- RIESGO: v2 depende de `inventory_lot_balances`; productos loteados sin balances fallaran.
- RIESGO: productos legacy con `requires_lot=true` y stock agregado sin `stock_movement_lots` pueden generar inconsistencia.
- RIESGO: pagos/caja deben observarse en QA, especialmente permisos y sesiones.
- RIESGO: reportes/tickets no muestran lote aun.
- RIESGO: `FOR UPDATE` puede esperar bajo concurrencia.
- RIESGO: cancelacion hacia lote `CANCELLED` no revierte automaticamente; requiere ajuste manual controlado.

## 12. Proximos pasos si QA pasa

1. Fase 3.19: ejecutar piloto QA y documentar evidencia.
2. Fase 3.20: corregir hallazgos QA si aplica.
3. Fase 3.21: preparar runbook PRD.
4. Fase futura frontend: UI de productos/lotes/vencimientos.
5. Fase futura reporteria: reportes de inventario loteado y vencimientos.
