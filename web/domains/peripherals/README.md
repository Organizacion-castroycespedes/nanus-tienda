# Web Peripherals Contracts

Fase 6 crea una capa reutilizable para consumir `backend-perifericos` desde Web POS sin acoplar ventas, compras, pedidos, scanner, balanza o caja al hardware real.

## Contratos

Archivo principal:

```text
web/domains/peripherals/contracts.ts
```

Contratos disponibles:

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

Todos los contratos devuelven errores controlados mediante `PeripheralOperationResult` o callbacks de eventos. No deben lanzar errores crudos hacia componentes de POS.

## Endpoint del agent

La URL del `backend-perifericos` se resuelve solo en `web/domains/peripherals/api.ts`.

Desarrollo local puede omitir variables y usar defaults:

```text
NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL=http://localhost:4050
NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL=ws://localhost:4050/peripherals
```

Produccion debe configurar una URL publica segura:

```text
NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL=https://peripherals.example.com
NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL=wss://peripherals.example.com/peripherals
```

Si `NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL` no existe, la web deriva `wss://<host>/peripherals` desde la URL HTTPS. En produccion la web bloquea `http://`, `localhost` y `127.0.0.1` antes de hacer `fetch`, para evitar mixed content y llamadas al equipo del usuario.

Codigos controlados de configuracion/conexion:

- `MISSING_CONFIG`: falta `NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL` en produccion.
- `INVALID_CONFIG`: URL insegura, local o mal formada.
- `AGENT_OFFLINE`: agent local de desarrollo no disponible.
- `NETWORK_ERROR`: error de red, CORS o TLS contra URL publica.
- `HTTP_ERROR`: el backend respondio HTTP no exitoso.

## Builders

Archivo:

```text
web/domains/peripherals/ticket-builders.ts
```

Builders disponibles:

- `buildSaleTicketPayload(sale)`
- `buildPurchaseTicketPayload(purchase)`
- `buildOrderTicketPayload(order)`

Los builders generan payloads compatibles con `POST /printer/print-ticket` del agent local. No persisten datos ni modifican ventas, compras o pedidos.

## Feature Flags Frontend

Defaults documentados en `web/.env.example`:

```text
NEXT_PUBLIC_PERIPHERALS_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_PRINT_PURCHASE_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_PRINT_ORDER_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_SCALE_ENABLED=true
NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED=true
```

Si una bandera esta en `false`, el contrato responde error controlado y no llama al agent.

## Offline

Si `backend-perifericos` no esta disponible, los contratos responden:

```text
success=false
error.code=AGENT_OFFLINE
```

El flujo de negocio debe continuar sin depender de hardware local.

## Integracion POS ventas MOCK

Fase 7 agrega un helper no transaccional:

```text
web/domains/peripherals/pos-sale-integration.ts
```

Uso:

- Construye `SaleTicketInput` desde el snapshot de venta confirmada.
- Llama `printSaleTicket(input)` solo despues de `createSale()` exitoso.
- Llama `openCashDrawer(input)` solo si existe pago efectivo.
- Respeta `NEXT_PUBLIC_PERIPHERALS_ENABLED`, `NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED` y `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED`.
- Devuelve feedback discreto para POS y no revierte la venta si falla el agent.

Mensajes esperados:

- `Ticket MOCK enviado`
- `Caja MOCK abierta`
- `Venta guardada, pero no se pudo contactar el agente de perifericos`
- `Venta guardada, pero fallo la impresion MOCK`

## Integracion compras MOCK

Fase 8 agrega un helper no transaccional:

```text
web/domains/peripherals/purchase-integration.ts
```

Uso:

- Construye `PurchaseTicketInput` desde la compra guardada en inventario.
- Llama `printPurchaseTicket(input)` solo despues de `createPurchase()` exitoso.
- Llama `openCashDrawer(input)` solo si existe pago o egreso efectivo.
- Identifica efectivo por `PaymentMethod.tipo === "CASH"` o por compra `type === "CASH"` con `totalPaid > 0`.
- Respeta `NEXT_PUBLIC_PERIPHERALS_ENABLED`, `NEXT_PUBLIC_PERIPHERALS_PRINT_PURCHASE_ENABLED` y `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED`.
- Devuelve feedback discreto y no revierte la compra si falla el agent.

Mensajes esperados:

- `Ticket MOCK de compra enviado`
- `Caja MOCK abierta`
- `Compra guardada, pero no se pudo contactar el agente de perifericos`
- `Compra guardada, pero fallo la impresion MOCK`
- `Compra guardada, pero fallo la apertura de caja MOCK`

## Restricciones

- No integra pedidos reales.
- No cambia reglas transaccionales de ventas.
- No cambia reglas transaccionales de compras.
- No cambia inventario, impuestos ni facturacion electronica.
- No cambia proveedores ni reglas contables.
- No activa hardware real.
- No habilita `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
- No usa USB, serial, HID, Electron ni Capacitor.

## Integracion pedidos MOCK

Fase 9 agrega un helper no transaccional:

```text
web/domains/peripherals/order-integration.ts
```

Uso:

- Construye `OrderTicketInput` desde el pedido guardado, entregado o abonado.
- Llama `printOrderTicket(input)` solo despues de `createOrder()`, `updateOrder()`, `deliverOrder()` o `createPayment()` exitoso.
- Llama `openCashDrawer(input)` solo si el pago nuevo es efectivo.
- Identifica efectivo por `PaymentMethod.tipo === "CASH"`.
- Respeta `NEXT_PUBLIC_PERIPHERALS_ENABLED`, `NEXT_PUBLIC_PERIPHERALS_PRINT_ORDER_ENABLED` y `NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED`.
- Devuelve feedback discreto y no revierte el pedido si falla el agent.

Mensajes esperados:

- `Ticket MOCK de pedido enviado`
- `Caja MOCK abierta`
- `Pedido guardado, pero no se pudo contactar el agente de perifericos`
- `Pedido guardado, pero fallo la impresion MOCK`
- `Pedido guardado, pero fallo la apertura de caja MOCK`

Restricciones de pedidos:

- No abre caja para pedido pendiente sin pago.
- No abre caja para pedido `CREDIT` sin abono efectivo.
- No abre caja para pagos no efectivos.
- No abre caja para pedido cancelado o fallido.
- No cambia inventario core, logica de pedidos ni facturacion electronica.

## Integracion scanner MOCK en POS

Fase 10 agrega consumo de eventos MOCK desde:

```text
web/modules/pos/components/PosScreen.tsx
```

Uso:

- Se suscribe a `scanner.code.read` con `subscribeScannerEvents(callback)`.
- Respeta `NEXT_PUBLIC_PERIPHERALS_ENABLED` y `NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED`.
- No abre WebSocket si scanner esta desactivado por feature flag frontend.
- Busca el codigo recibido en el catalogo local del POS.
- Reutiliza la misma funcion de carrito usada por clicks de producto.
- Cierra la suscripcion WebSocket al desmontar el POS.

Campos de matching:

- `primaryBarcode`.
- `barcodeCodes[]`.
- `barcode` si el payload de producto lo expone.
- `codigoBarras` si el payload de producto lo expone.
- `codigo_barras` si el payload de producto lo expone.
- `sku`.
- `reference` si el payload de producto lo expone.
- `referencia` si el payload de producto lo expone.
- `code` si el payload de producto lo expone.
- `codigo` si el payload de producto lo expone.
- `id`.
- `barcodes[].barcode`, `barcodes[].codigoBarras`, `barcodes[].codigo_barras`, `barcodes[].code`, `barcodes[].codigo` o `barcodes[].value` si existen y estan activos.

Fase 10.1 enriquece `GET /products?branchId=...` para que el catalogo POS reciba codigos activos sin hacer N requests por producto:

```json
{
  "primaryBarcode": "46564567",
  "barcodeCodes": ["46564567"],
  "barcodes": [
    {
      "code": "46564567",
      "barcode": "46564567",
      "barcodeType": "UNIT",
      "isPrimary": true,
      "isActive": true
    }
  ]
}
```

El POS incluye un panel compacto `Scanner MOCK/SIMULATOR` para llamar `simulateScannerRead(input)` con default `46564567` y provocar el evento `scanner.code.read` desde `backend-perifericos`.

La suscripcion scanner vive solo dentro de `PosScreen`. Si el usuario esta fuera de `/[tenant]/pos`, el evento puede quedar en logs de `backend-perifericos`, pero no agrega productos, no modifica carrito, no navega y no abre el POS.

Mensajes esperados:

- `Producto agregado por scanner: {code}`
- `Código no encontrado: {code}`
- `Scanner MOCK desconectado. El POS sigue funcionando.`

Restricciones de scanner:

- No conecta scanner fisico.
- No usa USB, HID, serial, drivers, Electron ni Capacitor.
- No cambia inventario core ni facturacion.
