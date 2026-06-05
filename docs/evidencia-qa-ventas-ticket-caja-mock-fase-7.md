# Evidencia QA - Ventas ticket MOCK y caja MOCK - Fase 7

Fecha: 2026-06-04

## Objetivo

Integrar los contratos funcionales de Fase 6 en el flujo de ventas Web POS para imprimir ticket MOCK y abrir caja MOCK despues de una venta confirmada correctamente.

## Alcance

Incluido:

- `web/modules/pos/components/PosScreen.tsx`
- `web/domains/peripherals/`
- `docs/`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`

Fuera de alcance confirmado:

- No hardware real.
- No `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No cambios en reglas contables/fiscales.
- No cambios en inventario core.
- No cambios en facturacion electronica.
- No migraciones.
- No `database/`.
- No `backend-reporteria/`.
- No Electron.
- No Capacitor.

## Flujo de venta identificado

Ruta POS:

```text
/[tenant]/pos
```

Archivo:

```text
web/modules/pos/components/PosScreen.tsx
```

Punto de confirmacion:

```text
submitSale() -> await createSale(...) -> setSaleStatus("CONFIRMED")
```

La integracion de perifericos se ejecuta solo despues de que `createSale()` responde exitosamente.

## Datos disponibles para ticket

Desde el snapshot del POS antes de limpiar carrito:

- Tenant/negocio: `authUser.tenantName`
- Sucursal: `authUser.branchName`
- Terminal: `state.pos.terminalId`
- Cajero: `authUser.name` o `authUser.email`
- Cliente: `selectedCustomer.name`
- Items: `cartWithDerivedValues`
- Subtotal, impuestos, descuentos y total: `summary`
- Pagos efectivos: `effectivePayments`
- Respuesta venta: `sale.id`, `sale.createdAt`, `sale.total`

Si un dato no existe, se usa fallback seguro.

## Archivos modificados

- `web/modules/pos/components/PosScreen.tsx`
- `web/domains/peripherals/pos-sale-integration.ts`
- `web/domains/peripherals/README.md`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`
- `docs/evidencia-qa-ventas-ticket-caja-mock-fase-7.md`

## Feature flags usadas

Se respetan:

```text
NEXT_PUBLIC_PERIPHERALS_ENABLED
NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED
NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED
```

Comportamiento:

- Si `NEXT_PUBLIC_PERIPHERALS_ENABLED=false`, no se llama al agent y no se muestra error.
- Si `NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED=false`, no se imprime ticket y no se muestra error.
- Si `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED=false`, no se abre caja y no se muestra error.

## Criterios para pago efectivo

Se considera efectivo cuando:

```text
PaymentMethod.tipo === "CASH"
```

La caja MOCK solo se abre si el pago efectivo efectivo tiene monto mayor a cero despues de descontar cambio.

No abre caja para:

- Pago solo tarjeta.
- Pago banco/digital.
- Credito.
- Transferencia.
- Venta fallida.
- Venta cancelada.

## Comportamiento offline

Si el agent local esta offline:

- La venta ya esta guardada.
- No se revierte venta.
- No se borra carrito antes de guardar; el carrito se limpia solo luego de venta exitosa.
- Se muestra warning no bloqueante:

```text
Venta guardada, pero no se pudo contactar el agente de perifericos
```

No se muestran stack traces.

## Pruebas realizadas

Validado por build TypeScript/Next:

- `createSale()` se espera antes de ejecutar `runSalePeripheralOperations`.
- `printSaleTicket()` solo se ejecuta despues de venta exitosa.
- `openCashDrawer()` solo se ejecuta si hay pago efectivo.
- Si los feature flags estan apagados, el helper retorna sin llamadas.
- Los errores controlados del contrato no se propagan al flujo de venta.

No se agregaron tests unitarios web porque `web/package.json` no define script `test` ni infraestructura de tests frontend.

Smoke manual POS completo queda pendiente de ambiente con API principal, sesion POS y datos de catalogo activos.

## Resultado build web

```text
npm.cmd run build: PASS
```

Notas:

- La ruta `/[tenant]/pos` compilo.
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

## Resultado git status --short

```text
working tree dirty con cambios acumulados del cambio add-pos-peripherals-platform
```

Archivos nuevos de Fase 7:

- `web/domains/peripherals/pos-sale-integration.ts`
- `docs/evidencia-qa-ventas-ticket-caja-mock-fase-7.md`

## Riesgos pendientes

- La seleccion de dispositivo por tenant/sucursal/terminal aun usa defaults MOCK `mock-printer-001` y `mock-cashdrawer-001`.
- Smoke end-to-end de venta requiere API principal, sesion POS y datos de catalogo.
- El feedback POS se muestra como toast discreto; no hay panel dedicado de resultado de venta.
- Fase 8 debe integrar compras por separado, sin reutilizar assumptions de venta.

## Restricciones cumplidas

- No se conecto hardware real.
- No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No se modifico `backend-perifericos`.
- No se modificaron reglas contables/fiscales.
- No se modifico inventario core.
- No se modifico facturacion electronica.
- No se crearon migraciones.
- No se toco `database/`.
- No se toco `backend-reporteria/`.
- No se integro Electron.
- No se integro Capacitor.
