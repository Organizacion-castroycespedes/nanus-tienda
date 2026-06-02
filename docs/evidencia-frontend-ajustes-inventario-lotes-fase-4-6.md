# Evidencia frontend ajustes de inventario con lotes - Fase 4.6

## Resumen

Se actualizo el formulario web de ajustes manuales de inventario para soportar productos loteados.

La UI mantiene el flujo actual para productos no loteados. Para productos `requiresLot=true`, permite capturar lote en ajustes `IN` y seleccionar lote disponible en ajustes `OUT`.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `web/modules/inventory/components/StockAdjustmentForm.tsx` | Agrega UI loteada para ajustes `IN/OUT`, carga ubicaciones, lotes y saldos disponibles, badges y validaciones UX. |
| `web/modules/inventory/services/stock-adjustment.service.ts` | Extiende payload frontend con campos opcionales de lote. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 4.6 como completada. |

## Payload nuevo

### Ajuste IN loteado

```json
{
  "productId": "<PRODUCT_ID>",
  "branchId": "<BRANCH_ID>",
  "type": "IN",
  "quantity": 5,
  "reason": "Ajuste por conteo fisico",
  "lotCode": "L-2026-001",
  "expirationDate": "2026-12-31",
  "locationId": "<LOCATION_ID>",
  "unitCost": 1200
}
```

### Ajuste OUT loteado

```json
{
  "productId": "<PRODUCT_ID>",
  "branchId": "<BRANCH_ID>",
  "type": "OUT",
  "quantity": 2,
  "reason": "Salida por correccion fisica",
  "lotId": "<LOT_ID>",
  "lotCode": "L-2026-001",
  "expirationDate": "2026-12-31",
  "locationId": "<LOCATION_ID>"
}
```

NOTA: El backend actual usa `lotCode` para resolver el lote de salida. `lotId` queda en el payload frontend como dato auxiliar compatible.

### Producto no loteado

No se envian `lotCode`, `lotId`, `expirationDate`, `locationId` ni `unitCost`.

## Reglas UX implementadas

- Muestra badges `Perecedero`, `Requiere lote` y `Requiere vencimiento`.
- Ajuste `IN` loteado exige `lotCode`.
- Ajuste `IN` con `requiresExpiration=true` exige `expirationDate`.
- `expirationDate` de entrada no puede ser anterior al dia local actual.
- `unitCost` no puede ser negativo.
- `locationId` debe venir de ubicaciones activas cargadas por sucursal.
- Ajuste `OUT` loteado no permite lote libre.
- Ajuste `OUT` loteado carga saldos con `onlyAvailable=true`.
- Ajuste `OUT` exige seleccionar un balance/lote disponible.
- Ajuste `OUT` bloquea cantidad mayor a `quantityAvailable`.
- Cambiar sucursal o tipo limpia campos loteados incompatibles.

## Endpoints consumidos

| Endpoint | Uso |
| --- | --- |
| `POST /api/stock-adjustments` | Crear ajuste manual compatible. |
| `GET /api/inventory/locations` | Cargar ubicaciones activas por sucursal. |
| `GET /api/inventory/lots` | Obtener metadata de lotes para salida. |
| `GET /api/inventory/lot-balances` | Obtener saldos disponibles para salida loteada. |

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `cd web && npx tsc --noEmit --pretty false` | Pasa. |
| `cd web && npm run build` en copia temporal completa sin `.next` | Pasa. |
| `cd web && npm run lint` | Bloqueado por prompt interactivo de configuracion de ESLint de Next.js. |
| `npx --yes @fission-ai/openspec validate fortalecer-productos-inventario --type change --strict --json` | Pasa. |
| `git diff --check` | Pasa. Solo muestra advertencias LF/CRLF existentes. |

## Validacion manual pendiente

- Ajuste `IN` producto no loteado funciona igual.
- Ajuste `IN` producto loteado sin `lotCode` bloquea.
- Ajuste `IN` producto con vencimiento sin `expirationDate` bloquea.
- Ajuste `OUT` producto loteado sin lote bloquea.
- Ajuste `OUT` con cantidad mayor al disponible bloquea.
- Ajuste `OUT` loteado valido envia `lotCode` y `locationId` del balance seleccionado.
- Inventario por lote refleja el cambio despues del ajuste.

## Confirmaciones de alcance

- No se modifico `api/`.
- No se modifico `backend-reporteria/`.
- No se modifico `scripts/database/`.
- No se modifico SQL ni migraciones.
- No se modifico POS de ventas.
- No se modificaron compras, pedidos ni reportes.

## Riesgos vivos

- La pantalla depende de que el producto venga con flags enriquecidos desde el listado de productos.
- Para `OUT`, el backend resuelve por `lotCode`; la UI selecciona balance y envia el `lotCode` del lote asociado.
- La validacion manual requiere API y saldos loteados disponibles.

## Proximos pasos

- Validar manualmente ajustes loteados contra API local/QA.
- Reconciliar inventario por lote despues de ajustes de prueba.
- Mantener POS sin cambios hasta fases especificas de venta.
