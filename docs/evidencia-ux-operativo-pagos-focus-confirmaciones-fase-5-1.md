# Evidencia Fase 5.1 - UX operativo pagos, foco y confirmaciones

## Resumen ejecutivo

Se ajusto `web/` para agilizar operacion en POS, pedidos y compras. No se modifico `api/`, `backend-reporteria/`, SQL, migraciones ni funciones de venta.

## Archivos modificados

- `web/modules/pos/components/PosScreen.tsx`
- `web/app/[tenant]/orders/page.tsx`
- `web/modules/inventory/components/OrderDeliverForm.tsx`
- `web/modules/inventory/components/OrderInvoiceForm.tsx`
- `web/modules/inventory/components/PurchaseForm.tsx`
- `web/app/[tenant]/purchases/page.tsx`
- `web/components/design-system/confirm-dialog.tsx`
- `web/providers/confirm-provider.tsx`
- `web/lib/api-messages.ts`
- `web/modules/shared/payments/payment-allocation.helper.ts`
- `openspec/changes/fortalecer-productos-inventario/tasks.md`

## Cambios POS

- `Cobrar venta` inicia con metodo EFECTIVO/CASH por defecto si existe en catalogo.
- El monto de efectivo se inicializa con el total de la venta.
- Al agregar o cambiar otro medio de pago, efectivo se recalcula automaticamente como restante.
- Si otros medios cubren todo, efectivo queda en `0`.
- Si pagos no efectivos superan el total, se muestra error y se bloquea la confirmacion.
- Se evita pago negativo y metodo duplicado.
- El modal de cobro ahora tiene `max-height` y `overflow-y-auto` para pantallas pequenas.
- Si no existe metodo efectivo, se mantiene operacion manual con advertencia clara.

## Cambios Orders

- La pagina `/orders` ahora oculta filtros/listado cuando hay accion activa.
- Acciones con focus mode:
  - crear pedido
  - editar pedido
  - entregar pedido
  - facturar pedido
  - registrar abono
- Se muestra encabezado de accion con titulo, pedido/cliente si existe y boton `Volver al listado`.
- Entrega de pedido muestra errores API con `confirm-dialog.tsx`.
- Facturacion/Crear venta usa efectivo por defecto y rebalanceo automatico.
- Facturacion muestra errores API con `confirm-dialog.tsx`.
- Entrega y facturacion muestran confirmacion de exito con `confirm-dialog.tsx`.

## Cambios Purchases

- En crear compra, al seleccionar producto se toma `product.cost` y se llena el costo del item.
- Si el producto no tiene costo o es `0`, el costo queda editable y se muestra aviso discreto.
- Cambiar producto actualiza el costo al costo del nuevo producto.
- Cambiar cantidad u otros campos no sobrescribe costo manual.
- Errores criticos de crear compra y recibir compra se muestran con `confirm-dialog.tsx`.
- Recepcion de compras con lotes no fue alterada en payload.

## Helper de pagos

Se creo:

```text
web/modules/shared/payments/payment-allocation.helper.ts
```

Funciones:

- `findCashPaymentMethod`
- `createDefaultCashPayment`
- `rebalanceCashPayment`
- `validatePaymentAllocation`
- `parsePaymentAmount`

Regla de efectivo:

- Primero busca `tipo === "CASH"`.
- Luego busca codigo/nombre `CASH` o `EFECTIVO`.
- No usa UUID hardcodeado.

## Uso de confirm-dialog.tsx

Se extendio `ConfirmDialog` con `hideCancel` para mensajes de solo lectura.

Usos nuevos:

- Error entrega pedido.
- Error facturar pedido / crear venta.
- Exito entrega pedido.
- Exito facturar pedido / crear venta.
- Error crear compra.
- Error recepcion compra.

Tambien se agrego `buildConfirmFromApiError` en `web/lib/api-messages.ts` para convertir respuestas como:

```json
{
  "message": "insufficient stock for delivery",
  "error": "Bad Request",
  "statusCode": 400
}
```

en mensaje visual con titulo, descripcion y detalle tecnico.

## Reglas de focus mode

- En Orders, accion activa oculta listado principal.
- El usuario conserva contexto minimo del pedido.
- `Volver al listado` restaura filtros/listado sin recargar forzosamente.
- No se cambio logica backend.

## Validaciones manuales

Validacion funcional en navegador queda pendiente para sesion con API/web local activos y datos operativos. Se valido por codigo y build:

- POS: apertura de modal inicializa efectivo con total.
- POS: agregar otro medio rebalancea efectivo.
- Orders: `formMode` oculta filtros/listado.
- Orders: entrega/facturacion usan `ConfirmDialog` para respuestas.
- Purchases: selector de producto copia `product.cost` al item.

## Comandos ejecutados

```powershell
cd web
npx.cmd tsc --noEmit --pretty false
```

Resultado: OK.

```powershell
cd web
npm.cmd run build
```

Resultado: OK.

```powershell
cd web
npm.cmd run lint
```

Resultado: bloqueado por prompt interactivo de Next:

```text
? How would you like to configure ESLint?
```

```powershell
npx.cmd -y @fission-ai/openspec@1.3.1 validate fortalecer-productos-inventario --type change --strict --json
```

Resultado: OK, `valid=true`.

```powershell
git diff --check
```

Resultado: OK. Git mostro avisos LF -> CRLF, sin errores de whitespace.

## Resultado build/lint

- TypeScript: OK.
- Build Next.js: OK.
- Lint: no ejecutable en modo automatico porque `next lint` pide configurar ESLint.

## Confirmacion de alcance

- No se toco `api/`.
- No se toco `backend-reporteria/`.
- No se toco SQL.
- No se tocaron migraciones.
- No se modifico `inventory_create_sale` v1/v2.
- No se modifico FEFO backend.
- No se modifico estructura de base de datos.

## Riesgos vivos

- Falta prueba visual con navegador y datos reales de caja/metodos de pago.
- Si no existe metodo EFECTIVO/CASH activo, POS y Orders quedan en modo manual con advertencia.
- `next lint` sigue requiriendo configuracion interactiva.

## Proximos pasos

- Ejecutar validacion visual local de POS, Orders y Purchases con API activa.
- Decidir si se configura ESLint no interactivo para CI.
- Continuar con despliegue controlado cuando operacion apruebe UX.
