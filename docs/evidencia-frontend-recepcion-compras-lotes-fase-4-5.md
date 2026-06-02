# Evidencia frontend recepcion de compras con lotes - Fase 4.5

## Resumen

Se actualizo el flujo web de recepcion de compras para capturar datos de lote cuando el producto lo requiere.

Esta fase solo toca frontend `web/`, documentacion y OpenSpec. No cambia backend, SQL, POS, pedidos ni reporteria.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `web/modules/inventory/components/PurchaseReceiveForm.tsx` | Agrega carga de productos y ubicaciones, badges por item, captura de lote/vencimiento/ubicacion/costo y validaciones UX. |
| `web/modules/inventory/services/purchase.service.ts` | Extiende tipos de item de compra y payload de recepcion para datos loteados compatibles. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Marca Fase 4.5 como completada y documenta tareas. |

## Payload nuevo

Para productos `requiresLot=true`, el frontend puede enviar por item:

```json
{
  "product_id": "<PRODUCT_ID>",
  "productId": "<PRODUCT_ID>",
  "purchaseItemId": "<PURCHASE_ITEM_ID>",
  "quantity": 10,
  "receivedQuantity": 10,
  "lotCode": "L-2026-001",
  "expirationDate": "2026-12-31",
  "locationId": "<LOCATION_ID>",
  "unitCost": 1200
}
```

Para productos `requiresLot=false`, el frontend solo envia datos legacy de producto y cantidad. No envia `lotCode`, `expirationDate`, `locationId` ni `unitCost`.

## Reglas UX implementadas

- La recepcion no loteada conserva el comportamiento actual.
- Los items muestran badges discretos: `Perecedero`, `Requiere lote`, `Requiere vencimiento`.
- Si el producto requiere lote, se muestra captura de `Lote`, `Fecha de vencimiento`, `Ubicacion` y `Costo unitario`.
- Si el producto requiere vencimiento, la fecha queda requerida.
- `lotCode` se normaliza a uppercase en la UI.
- `expirationDate` no puede ser anterior al dia local actual.
- `unitCost` no puede ser negativo.
- `locationId` debe venir de la lista cargada de ubicaciones activas de la sucursal.
- Los errores se muestran antes de enviar al backend.

## Endpoints consumidos

| Endpoint | Uso |
| --- | --- |
| `GET /api/purchases/:id` | Cargar detalle de compra y cantidades pendientes. |
| `POST /api/purchases/:id/receive` | Registrar recepcion con payload compatible. |
| `GET /api/inventory/products` | Obtener flags operativos de producto cuando el detalle de compra no los trae. |
| `GET /api/inventory/locations` | Cargar ubicaciones activas por sucursal de la compra. |

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `cd web && npx tsc --noEmit --pretty false` | Pasa. |
| `cd web && npm run build` en copia temporal completa sin `.next` | Pasa. |
| `cd web && npm run lint` | Bloqueado por prompt interactivo de configuracion de ESLint de Next.js. |
| `npx --yes @fission-ai/openspec validate fortalecer-productos-inventario --type change --strict --json` | Pasa. |
| `git diff --check` | Pasa. Solo muestra advertencias de conversion LF/CRLF existentes. |

## Validacion manual

Pendiente con API levantada:

- Recibir compra con producto no loteado y confirmar que funciona como antes.
- Intentar recibir producto loteado sin `lotCode` y confirmar bloqueo de UI.
- Intentar recibir producto `requiresExpiration=true` sin `expirationDate` y confirmar bloqueo de UI.
- Recibir producto loteado con `locationId` y confirmar que inventario por lote muestra nuevo saldo.
- Recibir compra parcial y confirmar que solo se envia lote para cantidad recibida.

## Confirmaciones de alcance

- No se modifico `api/`.
- No se modifico `backend-reporteria/`.
- No se modifico `scripts/database/`.
- No se modifico SQL ni migraciones.
- No se modifico POS de ventas.
- No se modificaron pedidos ni reportes.

## Riesgos vivos

- El detalle actual de compra puede no traer flags de producto; la UI consulta catalogo de productos como complemento. Si esa consulta falla, el backend sigue siendo la validacion final.
- `next lint` sigue sin poder ejecutarse en modo no interactivo hasta que se configure ESLint.
- La validacion manual requiere API y datos de compra loteada disponibles.

## Proximos pasos

- Validar manualmente recepcion loteada contra API local/QA.
- Conectar en fases futuras la UI de compras con seleccion asistida de ubicacion si el flujo operativo lo exige.
- Mantener POS sin cambios hasta fases especificas de venta.
