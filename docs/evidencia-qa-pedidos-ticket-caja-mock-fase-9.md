# Evidencia QA - Pedidos ticket MOCK y caja MOCK - Fase 9

Fecha: 2026-06-04

## Objetivo

Integrar los contratos funcionales de Fase 6 en el flujo Web de pedidos para imprimir ticket MOCK y abrir caja MOCK despues de guardar, entregar o abonar un pedido correctamente.

## Alcance

Incluido:

- `web/app/[tenant]/orders/page.tsx`
- `web/modules/inventory/components/OrderForm.tsx`
- `web/modules/inventory/components/OrderDeliverForm.tsx`
- `web/modules/finance/components/DocumentPaymentForm.tsx`
- `web/domains/peripherals/`
- `docs/`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`

Fuera de alcance confirmado:

- No hardware real.
- No `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No cambios en reglas contables.
- No cambios en inventario core.
- No cambios en logica de pedidos.
- No cambios en facturacion electronica.
- No cambios en persistencia de pedidos.
- No migraciones.
- No `database/`.
- No `backend-reporteria/`.
- No Electron.
- No Capacitor.

## Flujo de pedidos identificado

Ruta principal:

```text
/[tenant]/orders
```

Archivo de pantalla:

```text
web/app/[tenant]/orders/page.tsx
```

Creacion/edicion:

```text
OrderForm.handleSubmit() -> await createOrder(...) o updateOrder(...) -> onSuccess(response, peripheralContext)
```

Entrega:

```text
OrderDeliverForm.handleSubmit() -> await deliverOrder(...) -> onSuccess(response, peripheralContext)
```

Abono:

```text
DocumentPaymentForm.handleSubmit() -> await createPayment(...) -> onSuccess(paymentContext)
```

La integracion de perifericos se ejecuta solo despues de que el endpoint de negocio responde exitosamente.

## Archivos modificados

- `web/app/[tenant]/orders/page.tsx`
- `web/modules/inventory/components/OrderForm.tsx`
- `web/modules/inventory/components/OrderDeliverForm.tsx`
- `web/domains/peripherals/order-integration.ts`
- `web/domains/peripherals/README.md`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`
- `docs/evidencia-qa-pedidos-ticket-caja-mock-fase-9.md`

## Feature flags usadas

Se respetan:

```text
NEXT_PUBLIC_PERIPHERALS_ENABLED
NEXT_PUBLIC_PERIPHERALS_PRINT_ORDER_ENABLED
NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED
```

Comportamiento:

- Si `NEXT_PUBLIC_PERIPHERALS_ENABLED=false`, no se llama al agent y no se muestra error.
- Si `NEXT_PUBLIC_PERIPHERALS_PRINT_ORDER_ENABLED=false`, no se imprime ticket y no se muestra error.
- Si `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED=false`, no se abre caja y no se muestra error.

## Criterios para pago efectivo

Se considera efectivo cuando:

```text
PaymentMethod.tipo === "CASH"
```

La caja MOCK se abre solo si el pago nuevo tiene monto mayor a cero.

No abre caja para:

- Pedido pendiente sin pago.
- Pedido parcial sin pago efectivo.
- Pedido con pago electronico.
- Pedido `CREDIT` sin abono efectivo.
- Pedido cancelado.
- Pedido fallido.

## Ticket de pedido

El helper `order-integration.ts` construye `OrderTicketInput` con fallbacks seguros:

- negocio/sucursal: `tenantName`, `branchName` o `authUser`
- numero/documento: `order.id`
- fecha: `createdAt`
- usuario/cajero: `authUser.name` o `authUser.email`
- cliente: response o cliente seleccionado
- estado: `status`
- items: producto, cantidad, precio unitario y total
- subtotal, impuestos, descuentos y total
- pagos disponibles
- saldo pendiente en notas
- footer: `Pedido registrado`

## Comportamiento offline

Si el agent local esta offline:

- El pedido ya esta guardado.
- No se revierte pedido.
- No se bloquea navegacion ni cierre del formulario.
- Se muestra warning no bloqueante:

```text
Pedido guardado, pero no se pudo contactar el agente de perifericos
```

No se muestran stack traces.

## Pruebas realizadas

Validado por build TypeScript/Next:

- `createOrder()` y `updateOrder()` se esperan antes de ejecutar `runOrderPeripheralOperations`.
- `deliverOrder()` se espera antes de ejecutar `runOrderPeripheralOperations`.
- `createPayment()` se espera antes de evaluar ticket/caja para abonos.
- `printOrderTicket()` solo se ejecuta despues de pedido o abono exitoso.
- `openCashDrawer()` solo se ejecuta si hay pago efectivo nuevo.
- Pago no efectivo no abre caja porque `PaymentMethod.tipo !== "CASH"`.
- Pedido pendiente sin pago no abre caja.
- Si los feature flags estan apagados, el helper retorna sin llamadas.
- Los errores controlados del contrato no se propagan al flujo de pedido.

No se agregaron tests unitarios web porque `web/package.json` no define script `test` ni infraestructura de tests frontend.

Smoke manual completo queda pendiente de ambiente con API principal, sesion, cliente, productos y caja activa.

## Resultado build web

```text
npm.cmd run build: PASS
```

Notas:

- La ruta `/[tenant]/orders` compilo.
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
- El smoke end-to-end de pedidos requiere API principal, sesion, cliente, productos y caja activa.
- En entregas se imprime ticket de pedido pero no se abre caja porque no hay pago nuevo.
- En abonos se intenta recargar detalle de pedido para incluir items; si falla esa recarga, el flujo de pago no se revierte.
- No hay infraestructura de tests frontend para cubrir mocks unitarios automaticos.

## Restricciones cumplidas

- No se conecto hardware real.
- No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No se modifico `backend-perifericos`.
- No se modificaron reglas contables.
- No se modifico inventario core.
- No se modifico logica de pedidos.
- No se modifico facturacion electronica.
- No se modifico persistencia de pedidos.
- No se crearon migraciones.
- No se toco `api/`.
- No se toco `database/`.
- No se toco `backend-reporteria/`.
- No se integro Electron.
- No se integro Capacitor.
