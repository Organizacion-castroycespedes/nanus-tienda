# Evidencia frontend POS pricing Fase 6.9

## Objetivo

Integrar el POS frontend con el preview de pricing para que el carrito muestre precio final, descuento, promocion y total de linea antes de confirmar la venta.

## Archivos modificados

- `web/modules/pos/services/pos.service.ts`
- `web/modules/pos/components/PosScreen.tsx`
- `web/store/posCart.ts`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-frontend-pos-pricing-fase-6-9.md`

## Integracion implementada

`pos.service.ts` agrega `previewPosLinePrice`, que llama:

```ts
apiClient<PosLinePricePreviewResponse>("/pricing/preview-line", {
  method: "POST",
  body: JSON.stringify(payload),
});
```

El payload enviado por POS es:

```ts
{
  branchId,
  productId,
  quantity,
  channel: "POS",
  customerId,
}
```

`tenantId` no se envia desde frontend. El backend lo toma del JWT.

## Flujo POS

Al agregar producto o cambiar cantidad, el item pasa a `pricingStatus = "PENDING"` y se consulta `POST /api/pricing/preview-line`.

Cuando el preview responde, el carrito guarda:

- `baseUnitPrice`
- `finalUnitPrice`
- `discountAmount`
- `discountPercent`
- `appliedPromotionId`
- `appliedPromotionName`
- `taxBase`
- `taxAmount`
- `lineSubtotal`
- `lineTotal`

El POS usa `lineTotal` para totales del carrito y usa `finalUnitPrice` como `price` compatible al llamar `POST /api/sales`. El backend sigue recalculando y validando como fuente de verdad.

## Visualizacion

En el carrito se muestra:

- Precio unitario final.
- Precio base tachado cuando existe descuento.
- Nombre de promocion aplicada cuando existe.
- Descuento total de la linea.
- `Total linea` usando `lineTotal`.
- Resumen de descuentos aplicados.

## Errores

Si preview falla, el POS muestra toast y mensaje en el item. La pantalla no queda bloqueada completa. La accion de cobrar queda deshabilitada hasta que el item tenga pricing resuelto, para evitar confirmar una venta con total frontend desalineado.

## Validaciones

- `cd web && npm run lint`: exitoso con warnings preexistentes fuera de POS.
- `cd web && npm run build`: exitoso con warnings preexistentes fuera de POS.
- `openspec validate fortalecer-productos-inventario --type change --strict --json`: exitoso.
- `git diff --check`: exitoso; solo warnings de CRLF esperados por Git en Windows.
- Smoke local: `http://localhost:3029/default/pos` respondio HTTP 200 con servidor Next local.
- Smoke visual con Browser: no completado por falla de arranque del conector en sandbox.

## Riesgos pendientes

- Si el backend pricing preview no esta disponible, no se puede cobrar hasta reintentar mediante cambio de cantidad o recarga del carrito.
- El backend sigue siendo la fuente de verdad; el frontend solo muestra preview y no debe usarse para auditoria final.
- No se agrego visualizacion avanzada de promociones; solo datos minimos utiles para caja.

## Confirmacion de alcance

No se tocaron backend, SQL, pagos/caja, stock/FEFO, Orders, facturacion electronica, DIAN/GetAcquirer, suppliers, PRD real, remoto ni commits.
