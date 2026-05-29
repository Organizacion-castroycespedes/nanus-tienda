# Evidencia Fase 3.17.1 - Hotfix pre-QA reconciliacion y contexto de venta

Fecha/hora: 2026-05-28 12:13:06 -05:00

## Objetivo

Corregir el bug del controller de reconciliacion que rechazaba UUID validos en query y aclarar el comportamiento de `SaleService.normalizeSaleContext` antes de piloto QA.

## Bug reproducido

Durante Fase 3.17, el endpoint real local:

```http
GET /api/inventory/lot-reconciliation/summary?branchId=91000000-0000-0000-0000-000000000002
```

respondio:

```json
{
  "message": "branchId must be a valid UUID",
  "error": "Bad Request",
  "statusCode": 400
}
```

El UUID era estandar y valido. El bicho estaba en casa.

## Causa

Archivo: `api/src/modules/inventory/controllers/inventory-lot-reconciliation.controller.ts`

El helper local `isUuid` usaba este patron:

```ts
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

Ese regex esperaba grupos `8-4-4-12`. Un UUID estandar usa grupos `8-4-4-4-12`. Por eso rechazaba `branchId`, y el mismo problema aplicaba a `productId` y `lotId`.

## Correccion aplicada

Se ajusto el regex a:

```ts
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

La validacion no se relajo: valores invalidos siguen fallando con `BadRequestException`.

## Tests agregados

Archivo: `api/src/modules/inventory/controllers/inventory-lot-reconciliation.controller.spec.ts`

Casos cubiertos:

| Caso | Resultado |
| --- | --- |
| `branchId` UUID valido aceptado | OK |
| `branchId` invalido rechazado | OK |
| `productId` UUID valido en filtros aceptado | OK |
| `productId` invalido rechazado | OK |
| `lotId` UUID valido en filtros aceptado | OK |
| `lotId` invalido rechazado | OK |
| `productId` route param valido aceptado | OK |
| `lotId` route param valido aceptado | OK |
| Filtros llegan al service con `onlyDiscrepancies` parseado | OK |

## Analisis `SaleService.normalizeSaleContext`

Archivo: `api/src/modules/inventory/services/sale.service.ts`

### Flujo observado

`SaleController` construye contexto desde `request.context` o `request.user`. Cuando usa `request.user`, conserva:

- `tenantId`
- `userId`
- `sessionId`
- `roles`

Luego `SaleService.normalizeSaleContext` resuelve:

- `tenantId`
- `userId`
- `branchId`
- `terminalId`
- `posSessionId`

Antes del hotfix, el retorno perdia:

- `roles`
- `sessionId`

Despues, `SaleService.createSale` llamaba:

```ts
this.buildFinanceActor(saleContext)
```

Como `saleContext.roles` ya no existia, `PaymentsService` recibia `roles: []`. Resultado: aunque el JWT trajera `SUPER_ADMIN`, finanzas no lo veia y exigia acceso por `persona_tenant_branches`.

### Decision

Se considero bug real porque:

- El controller si tenia roles.
- `buildFinanceActor` espera roles.
- La perdida ocurria dentro de `normalizeSaleContext`.
- El cambio es local, pequeno y no cambia contrato API.

### Correccion aplicada

`normalizeSaleContext` ahora preserva:

- `sessionId`
- `roles`

Tanto cuando el POS context llega explicito como cuando se resuelve desde `findCurrentPosContext`.

## Tests agregados de `SaleService`

Archivo: `api/src/modules/inventory/services/sale.service.spec.ts`

Casos cubiertos:

| Caso | Resultado |
| --- | --- |
| `normalizeSaleContext` conserva roles con POS context explicito | OK |
| `normalizeSaleContext` conserva `sessionId` con POS context explicito | OK |
| `normalizeSaleContext` conserva roles cuando resuelve POS context por repository | OK |
| `normalizeSaleContext` conserva `sessionId` cuando resuelve POS context por repository | OK |

## Comandos ejecutados

```bash
cd api && npx tsx --test src/modules/inventory/controllers/inventory-lot-reconciliation.controller.spec.ts src/modules/inventory/services/inventory-lot-reconciliation.service.spec.ts src/modules/inventory/services/sale.service.spec.ts
```

Resultado:

```text
1..32
# tests 32
# pass 32
# fail 0
```

```bash
cd api && npm run build
```

Resultado: OK.

## Confirmaciones

- `inventory_create_sale` v1 no fue modificada.
- `inventory_create_sale_v2` no fue modificada.
- `inventory_invoice_order` no fue modificada.
- `INVENTORY_SALE_V2_ENABLED` sigue apagado por defecto.
- No se tocaron `web/`.
- No se tocaron `backend-reporteria/`.
- No se toco POS UI.
- No se tocaron SQL functions ni migraciones.
- No se ejecuto PRD.

## Riesgos vivos

- RIESGO: Conviene ejecutar de nuevo la prueba API Fase 3.17 en QA local/staging controlado usando endpoint de reconciliacion, ya sin workaround por service.
- RIESGO: Roles conservados llegan ahora a finanzas; esto corrige SUPER_ADMIN/ADMIN esperado, pero QA debe validar permisos de USER con sucursal asignada.

## Proximos pasos

1. Preparar runbook QA de activacion temporal `INVENTORY_SALE_V2_ENABLED=true`.
2. Ejecutar Fase QA con tenant/sucursal piloto y endpoint real de reconciliacion.
3. Verificar permisos de venta/caja para SUPER_ADMIN, ADMIN y USER.
