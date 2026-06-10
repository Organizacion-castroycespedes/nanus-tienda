# Evidencia QA - Peripheral integration contracts - Fase 6

Fecha: 2026-06-04

## Objetivo

Crear una capa reutilizable en Web para que ventas, compras, pedidos, scanner, balanza y caja puedan consumir `backend-perifericos` sin acoplarse al hardware ni modificar flujos transaccionales reales.

## Alcance

Incluido:

- `web/domains/peripherals/`
- `web/.env.example`
- `docs/`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`

Fuera de alcance confirmado:

- No integracion con ventas reales.
- No integracion con compras reales.
- No integracion con pedidos reales.
- No hardware real.
- No `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No Electron.
- No Capacitor.
- No `database/`.
- No `backend-reporteria/`.
- No core de negocio.

## Archivos modificados

- `web/domains/peripherals/types.ts`
- `web/domains/peripherals/api.ts`
- `web/domains/peripherals/ticket-builders.ts`
- `web/domains/peripherals/contracts.ts`
- `web/domains/peripherals/README.md`
- `web/.env.example`
- `openspec/changes/add-pos-peripherals-platform/tasks.md`
- `docs/evidencia-qa-peripheral-integration-contracts-fase-6.md`

## Contratos creados

Archivo:

```text
web/domains/peripherals/contracts.ts
```

Contratos:

- `getPeripheralAgentHealth()`
- `getPeripheralDevices()`
- `printSaleTicket(input)`
- `printPurchaseTicket(input)`
- `printOrderTicket(input)`
- `openCashDrawer(input)`
- `readCurrentWeight(input?)`
- `simulateScannerRead(input)`
- `subscribeScannerEvents(callback)`
- `subscribePeripheralEvents(callback)`

Los contratos retornan `PeripheralOperationResult<T>` para operaciones HTTP y no exponen errores crudos a componentes.

## Builders creados

Archivo:

```text
web/domains/peripherals/ticket-builders.ts
```

Builders:

- `buildSaleTicketPayload(sale)`
- `buildPurchaseTicketPayload(purchase)`
- `buildOrderTicketPayload(order)`

Estos builders generan payloads compatibles con `POST /printer/print-ticket`, sin guardar datos ni tocar flujos reales de venta, compra o pedido.

## Feature flags

Agregadas en `web/.env.example`:

```text
NEXT_PUBLIC_PERIPHERALS_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_PRINT_PURCHASE_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_PRINT_ORDER_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_SCALE_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED=true
```

Regla:

- Si `NEXT_PUBLIC_PERIPHERALS_ENABLED=false`, ningun contrato HTTP llama al agent.
- Si una bandera especifica esta en `false`, solo esa operacion queda bloqueada.

## Comportamiento offline

Si `backend-perifericos` esta offline, `requestPeripheral` conserva el error controlado existente y la capa de contratos lo normaliza a:

```text
success=false
error.code=AGENT_OFFLINE
```

El flujo de negocio debe seguir sin hardware local. La capa no modifica ventas, compras, pedidos, caja ni inventario.

## Proximos puntos de integracion

- Fase 7: ventas MOCK.
- Fase 8: compras MOCK.
- Fase 9: pedidos MOCK.
- Fase 10: scanner MOCK.
- Fase 11: balanza MOCK.

## Comandos ejecutados

```text
cd web
npm.cmd run build

cd backend-perifericos
npm.cmd run build
npm.cmd test

openspec.cmd validate add-pos-peripherals-platform --type change --strict
git diff --check
git status --short
```

## Resultados build/test

Web:

```text
npm.cmd run build: PASS
```

Notas:

- La ruta `/[tenant]/admin/peripherals` compilo.
- `web/package.json` no tiene script `test`, por eso no se ejecuto `npm.cmd test`.
- Persisten warnings existentes de hooks e imagenes en archivos fuera del alcance de esta fase.

backend-perifericos:

```text
npm.cmd run build: PASS
npm.cmd test: PASS - 33/33
```

## OpenSpec validate

```text
Change 'add-pos-peripherals-platform' is valid
```

## git diff --check

```text
PASS - exit 0
```

Nota:

- Git emitio warnings CRLF sobre archivos existentes del working tree. No hubo errores de whitespace.

## git status --short

Resultado:

```text
working tree dirty con cambios acumulados del cambio add-pos-peripherals-platform
```

Archivos nuevos de Fase 6:

- `web/domains/peripherals/contracts.ts`
- `web/domains/peripherals/ticket-builders.ts`
- `web/domains/peripherals/README.md`
- `docs/evidencia-qa-peripheral-integration-contracts-fase-6.md`

## Riesgos pendientes

- Los contratos quedan listos pero aun no estan conectados a ventas, compras ni pedidos reales.
- La seleccion de dispositivos por terminal/sucursal/tenant queda para fases futuras.
- WebSocket real depende de que `backend-perifericos` este levantado en el runtime browser.
- La capa no agrega autorizacion local nueva; usa los contratos existentes del agent.

## Restricciones cumplidas

- No se conecto hardware real.
- No se activo `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No se instalaron drivers.
- No se implemento USB real.
- No se implemento serial real.
- No se implemento HID real.
- No se integro Electron.
- No se integro Capacitor.
- No se tocaron `api/`, `database/`, `backend-reporteria/` ni core negocio.
