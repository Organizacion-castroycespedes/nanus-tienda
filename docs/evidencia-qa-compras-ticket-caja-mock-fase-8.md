# Evidencia QA - Compras ticket MOCK y caja MOCK - Fase 8

Fecha: 2026-06-04

## Objetivo

Integrar los contratos funcionales de Fase 6 en el flujo Web de compras para imprimir ticket MOCK y abrir caja MOCK despues de una compra guardada correctamente o de un egreso efectivo registrado.

## Alcance

Incluido:

- `web/app/[tenant]/purchases/page.tsx`
- `web/app/[tenant]/inventory/purchases/page.tsx`
- `web/modules/inventory/components/PurchaseForm.tsx`
- `web/modules/finance/components/DocumentPaymentForm.tsx`
- `web/domains/peripherals/`
- `docs/`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`

Fuera de alcance confirmado:

- No hardware real.
- No `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No cambios en reglas contables.
- No cambios en inventario core.
- No cambios en proveedores core.
- No cambios en persistencia de compras.
- No migraciones.
- No `database/`.
- No `backend-reporteria/`.
- No Electron.
- No Capacitor.

## Flujo de compra identificado

Ruta principal:

```text
/[tenant]/inventory/purchases
```

Esa ruta reexporta:

```text
web/app/[tenant]/purchases/page.tsx
```

Punto de creacion:

```text
PurchaseForm.handleSubmit() -> await createPurchase(...) -> onSuccess(response, peripheralContext)
```

La integracion de perifericos se ejecuta solo despues de que `createPurchase()` responde exitosamente.

Punto de pago/egreso posterior:

```text
DocumentPaymentForm.handleSubmit() -> await createPayment(...) -> onSuccess(paymentContext)
```

En pagos posteriores no se reimprime ticket de compra; solo se evalua apertura de caja si el egreso fue efectivo.

## Archivos modificados

- `web/app/[tenant]/purchases/page.tsx`
- `web/modules/inventory/components/PurchaseForm.tsx`
- `web/modules/finance/components/DocumentPaymentForm.tsx`
- `web/domains/peripherals/purchase-integration.ts`
- `web/domains/peripherals/README.md`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`
- `docs/evidencia-qa-compras-ticket-caja-mock-fase-8.md`

## Feature flags usadas

Se respetan:

```text
NEXT_PUBLIC_PERIPHERALS_ENABLED
NEXT_PUBLIC_PERIPHERALS_PRINT_PURCHASE_ENABLED
NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED
```

Comportamiento:

- Si `NEXT_PUBLIC_PERIPHERALS_ENABLED=false`, no se llama al agent y no se muestra error.
- Si `NEXT_PUBLIC_PERIPHERALS_PRINT_PURCHASE_ENABLED=false`, no se imprime ticket y no se muestra error.
- Si `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED=false`, no se abre caja y no se muestra error.

## Criterios para pago/egreso efectivo

Compra creada:

```text
PurchaseResponse.type === "CASH" && totalPaid > 0
```

Pago/egreso posterior:

```text
PaymentMethod.tipo === "CASH"
```

La caja MOCK no se abre para:

- Compra `CREDIT`.
- Compra sin pago inmediato.
- Pago no efectivo.
- Transferencia/banco/tarjeta/digital.
- Compra fallida.
- Compra cancelada.

## Ticket de compra

El helper `purchase-integration.ts` construye `PurchaseTicketInput` con fallbacks seguros:

- negocio/sucursal: `tenantName`, `branchName` o `authUser`
- numero/documento: `purchase.id`
- fecha: `createdAt`
- usuario/cajero: `authUser.name` o `authUser.email`
- proveedor: response o proveedor seleccionado
- items: producto, cantidad, costo unitario y total
- subtotal, impuestos, descuentos y total
- medios de pago disponibles
- footer: `Compra registrada`

## Comportamiento offline

Si el agent local esta offline:

- La compra ya esta guardada.
- No se revierte compra.
- No se bloquea navegacion ni cierre del formulario.
- Se muestra warning no bloqueante:

```text
Compra guardada, pero no se pudo contactar el agente de perifericos
```

No se muestran stack traces.

## Pruebas realizadas

Validado por build TypeScript/Next:

- `createPurchase()` se espera antes de ejecutar `runPurchasePeripheralOperations`.
- `printPurchaseTicket()` solo se ejecuta despues de compra exitosa.
- `openCashDrawer()` solo se ejecuta si hay compra/pago efectivo.
- Pago no efectivo no abre caja porque `PaymentMethod.tipo !== "CASH"`.
- Compra `CREDIT` o sin pago inmediato no abre caja.
- Si los feature flags estan apagados, el helper retorna sin llamadas.
- Los errores controlados del contrato no se propagan al flujo de compra.

No se agregaron tests unitarios web porque `web/package.json` no define script `test` ni infraestructura de tests frontend.

Smoke manual completo queda pendiente de ambiente con API principal, sesion, proveedor, productos y caja activa.

## Resultado build web

```text
npm.cmd run build: PASS
```

Notas:

- Las rutas `/[tenant]/inventory/purchases` y `/[tenant]/purchases` compilaron.
- Persisten warnings existentes de hooks e imagenes fuera del alcance de esta fase.
- `web/package.json` no tiene script `test`.

## Resultado backend-perifericos build/test

```text
npm.cmd run build: PASS
npm.cmd test: PASS - 33/33
```

## Resultado OpenSpec validate

```text
Change 'add-pos-peripherals-platform' is valid
```

## Resultado git diff --check

```text
PASS - exit 0
```

Nota:

- Git emitio warnings CRLF sobre archivos existentes del working tree. No hubo errores de whitespace.

## Riesgos pendientes

- La seleccion de dispositivo por tenant/sucursal/terminal aun usa defaults MOCK `mock-printer-001` y `mock-cashdrawer-001`.
- El smoke end-to-end de compra requiere API principal, sesion, proveedor, productos y caja activa.
- En pagos posteriores se abre caja si el pago creado es efectivo; no se reimprime ticket de compra en esa accion.
- No hay infraestructura de tests frontend para cubrir mocks unitarios automaticos.

## Restricciones cumplidas

- No se conecto hardware real.
- No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No se modifico `backend-perifericos`.
- No se modificaron reglas contables.
- No se modifico inventario core.
- No se modifico proveedores core.
- No se modifico persistencia de compras.
- No se crearon migraciones.
- No se toco `api/`.
- No se toco `database/`.
- No se toco `backend-reporteria/`.
- No se integro Electron.
- No se integro Capacitor.
