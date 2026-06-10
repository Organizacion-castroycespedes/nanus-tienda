# Evidencia frontend cambio de precio - Fase 6.2

## Objetivo

Implementar UI en `web/` para cambiar precio de producto con motivo obligatorio y consultar historial de precios desde el modulo de productos.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `web/domains/products/dtos.ts` | Agrega tipos de historial y respuesta de cambio de precio. |
| `web/modules/inventory/services/product.service.ts` | Agrega `getProductPriceHistory` y `changeProductPrice`. |
| `web/modules/inventory/components/ProductPriceChangeModal.tsx` | Nuevo modal para cambiar precio con validaciones UX. |
| `web/modules/inventory/components/ProductPriceHistoryPanel.tsx` | Nuevo panel para consultar historial de precios. |
| `web/modules/inventory/components/ProductForm.tsx` | Mantiene edicion directa por compatibilidad y agrega ayuda para usar cambio trazable. |
| `web/app/[tenant]/inventory/products/page.tsx` | Integra boton `Cambiar precio`, modal, historial, refresco y dialogs de resultado. |
| `openspec/changes/fortalecer-productos-inventario/tasks.md` | Registra Fase 6.2 completada. |

## Componentes creados

### `ProductPriceChangeModal`

Muestra:

- precio actual.
- nuevo precio.
- diferencia.
- motivo obligatorio.
- boton confirmar.
- boton cancelar.

Validaciones UX:

- `newPrice >= 0`.
- `reason` obligatorio.
- `reason` minimo 5 caracteres.
- bloquea envio si `newPrice` es igual al precio actual.
- no envia si el formulario es invalido.

### `ProductPriceHistoryPanel`

Muestra:

- fecha de creacion.
- `validFrom`.
- precio anterior.
- precio nuevo.
- motivo.
- usuario si viene como `changedBy`.
- estado.
- estado vacio amigable cuando no hay historial.

## Endpoints consumidos

- `GET /api/products/:id/price-history`
- `POST /api/products/:id/change-price`

Payload enviado:

```json
{
  "newPrice": 12000,
  "reason": "Ajuste por nuevo costo de proveedor"
}
```

## Flujo UX implementado

1. Usuario entra a `/{tenant}/inventory/products`.
2. En una fila de producto usa `Cambiar precio`.
3. La pantalla entra en focus mode de precio e historial.
4. El modal abre con precio actual precargado.
5. Usuario informa nuevo precio y motivo.
6. Frontend valida antes de enviar.
7. Si backend responde bien:
   - muestra `ConfirmDialog` de exito.
   - refresca precio en lista local.
   - refresca historial.
   - vuelve a consultar productos si ya habia busqueda.
8. Si backend responde error:
   - usa `buildConfirmFromApiError`.
   - muestra `ConfirmDialog` con `message`, `error` y `statusCode` cuando vienen.

## Decision sobre `ProductForm`

Se mantiene `price` editable en `ProductForm` por compatibilidad con crear/editar producto actual.

Se agrega ayuda en modo edicion:

> Para trazabilidad use Cambiar precio desde el listado.

Riesgo vivo: una fase posterior debe decidir si `PUT /api/products/:id` deja de aceptar `price` o si el frontend lo vuelve solo lectura en edicion.

## Validaciones ejecutadas

```bash
cd web && npx.cmd tsc --noEmit --pretty false
```

Resultado: pasa.

```bash
cd web && npm.cmd run build
```

Resultado: pasa.

```bash
cd web && npm.cmd run lint
```

Resultado: pasa con warnings existentes de hooks e imagenes en archivos no tocados por esta fase.

```bash
openspec.cmd validate fortalecer-productos-inventario --type change --strict --json
```

Resultado: pasa con `valid = true`.

```bash
git diff --check
```

Resultado: pasa. Solo se observaron warnings CRLF de Git en archivos existentes/modificados.

## Validaciones manuales

- Se verifico por inspeccion de codigo que la tabla de productos incluye accion `Cambiar precio`.
- Se verifico por inspeccion de codigo que el focus mode muestra `ProductPriceHistoryPanel`.
- Se verifico por inspeccion de codigo que el modal valida `newPrice`, `reason` e igualdad contra precio actual antes de enviar.
- Se verifico por inspeccion de codigo que al guardar se refresca lista local, historial y productos si ya habia busqueda.
- No se ejecuto prueba manual con navegador/API local en esta fase; queda como validacion local recomendada antes de entregar a usuario final.

## Confirmacion de alcance

- No se modifico `api/` en esta fase.
- No se modifico `backend-reporteria/`.
- No se modifico SQL ni migraciones.
- No se modifico POS.
- No se modifico Orders.
- No se modifico compras.
- No se modifico `inventory_create_sale_v2`.
- No se hizo commit.

## Riesgos vivos

- `ProductForm` aun permite editar precio directo por compatibilidad.
- No hay prueba E2E automatizada de navegador para el modal.
- El historial muestra `changedBy` como UUID si backend no envia nombre de usuario.
- La validacion final de igualdad de precio vive en frontend; backend 6.1 permite mismo valor.

## Proximos pasos

- Probar manualmente con API local levantada y usuario con permiso `INVENTORY_PRODUCTS`.
- Definir bloqueo futuro de edicion directa de `price` en `ProductForm`.
- Fase posterior: `PricingService` base sin promociones.
- Fase posterior: promociones simples con snapshot.
