# Evidencia QA recepcion parcial de compras pendientes

## Estado

PASS tecnico. QA manual en navegador pendiente.

## Change OpenSpec

`mejorar-recepcion-parcial-compras-pendientes`

## Alcance

- Recepcion basada en cantidad pendiente por linea.
- Ocultar lineas completamente recibidas.
- Permitir confirmar recepcion parcial de solo algunas lineas pendientes.
- Enviar al API solo lineas con cantidad recibida mayor a cero.
- Mantener lotes, vencimientos, ubicaciones, costos, movimientos e inventario solo para lineas recibidas.

## Causa raiz

El backend ya procesa solo los items enviados y valida que la cantidad recibida no exceda el pendiente. El problema visible estaba en el frontend: `PurchaseReceiveForm` renderizaba todas las lineas de la compra, incluyendo productos con pendiente cero.

## Cambios realizados

- Se agrego helper frontend para calcular pendientes y filas recibibles.
- El formulario ahora muestra solo lineas con pendiente mayor a cero.
- El formulario conserva el indice original de cada linea para no romper el estado local.
- El submit usa solo filas con cantidad positiva y valida.
- Los campos de lote/vencimiento/ubicacion/costo solo aparecen cuando una linea loteada tiene cantidad a recibir.
- Se agregaron tests frontend del calculo de pendientes.
- Se agregaron tests backend multi-linea para recepcion parcial.

## QA manual sugerido

1. Crear o usar compra con dos productos.
2. Recibir completamente solo el primer producto.
3. Confirmar que el segundo producto queda pendiente.
4. Volver a abrir recepcion.
5. Confirmar que el primer producto no aparece.
6. Recibir el segundo producto.
7. Confirmar que la compra queda recibida.
8. Confirmar que no se pide lote para producto ya recibido.
9. Confirmar que no se bloquea la recepcion parcial.

## QA manual en navegador

NO EJECUTADO en esta pasada.

## Validaciones tecnicas

- `openspec.cmd validate mejorar-recepcion-parcial-compras-pendientes --type change --strict`: PASS.
- `openspec.cmd validate --all --strict`: PASS, 21 items.
- `npx.cmd tsx --test web\modules\inventory\components\purchase-receive-lines.spec.ts`: PASS, 7 tests.
- `cd api && npx.cmd tsx --test src\modules\inventory\services\purchase.service.spec.ts`: PASS, 44 tests.
- `cd api && npm.cmd run build`: PASS.
- `cd web && npm.cmd run lint`: PASS con warnings existentes.
- `cd web && npm.cmd run build`: PASS con warnings existentes.
- `git diff --check`: PASS con warnings LF/CRLF.
- `git status --short`: ejecutado.

## Confirmaciones

- Produccion tocada: NO.
- SQL tocado: NO.
- Permisos/guards tocados: NO.
- POS tocado: NO.
- Orders tocado: NO.
- Facturacion electronica tocada: NO.
- Deploy: NO.
- Commit: NO.
