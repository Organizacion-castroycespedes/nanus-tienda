# Evidencia - Fase 5.1.1 Orders precio automatico del producto

## Resumen

Se ajusto el formulario de creacion/edicion de pedidos para que, al seleccionar un producto en un item, el campo `Precio` tome por defecto `product.price`.

El precio sigue editable para que operacion pueda corregirlo manualmente cuando aplique.

## Archivos modificados

- `web/modules/inventory/components/OrderForm.tsx`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`
- `docs/evidencia-orders-precio-producto-fase-5-1-1.md`

## Comportamiento implementado

- Al seleccionar producto, el item copia `ProductResponse.price` en `item.price`.
- Si el usuario cambia a otro producto, el precio se actualiza con el precio del nuevo producto.
- Cambios de cantidad u otros campos no sobrescriben el precio editado manualmente.
- Si el producto no tiene precio valido o `price <= 0`, el campo queda editable y se muestra aviso discreto.
- El subtotal y total se recalculan con el precio cargado.
- El payload de pedido mantiene el contrato actual y sigue enviando `price` por item.

## Fuente de precio

- Fuente usada: `products.price`.
- No se usa `products.cost`; ese valor queda reservado para compras.

## ConfirmDialog

- El submit de `OrderForm` usa `confirm-dialog.tsx` mediante `useConfirm` y `buildConfirmFromApiError` para errores criticos de crear/editar pedido.
- No se agregaron `alert()` ni `confirm()` nativos.

## Validaciones manuales

- Pendiente de validacion manual en navegador:
  - Crear pedido y seleccionar producto con precio.
  - Confirmar que `Precio` se autocompleta.
  - Editar precio manualmente y cambiar cantidad sin sobrescritura.
  - Cambiar producto y confirmar que cambia el precio.
  - Seleccionar producto sin precio y confirmar aviso discreto.

## Comandos ejecutados

- `cd web && npx.cmd tsc --noEmit --pretty false` - OK.
- `cd web && npm.cmd run build` - OK.
- `cd web && npm.cmd run lint` - bloqueado por prompt interactivo de configuracion ESLint de Next.js.
- `npx.cmd -y @fission-ai/openspec@1.3.1 validate fortalecer-productos-inventario --type change --strict --json` - OK.
- `git diff --check` - OK, solo advertencias de normalizacion LF/CRLF.

## Confirmaciones de alcance

- No se modifico `api/`.
- No se modifico `backend-reporteria/`.
- No se modifico SQL ni migraciones.
- No se modifico POS.
- No se modifico compras.
- No se modifico inventario backend.

## Riesgos vivos

- Validacion manual en navegador queda pendiente si no se levanta web/API local.
- `npm run lint` sigue requiriendo configuracion ESLint interactiva en este proyecto.
